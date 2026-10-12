const fs = require("fs");
const path = require("path");

/**
 * Redirects for renamed slugs — SEO-safe and NON-INDEXED.
 *
 * RULE (see conventions/slugs.md): when a page slug is renamed, the OLD
 * URL must keep responding (so as not to break SEO or already-shared links),
 * but it must NOT stay "public": it redirects to the new URL and carries
 * `noindex` so it is not indexed as a distinct page.
 *
 * To register a rename, add `[old-slug, new-slug]` to SLUG_RENAMES
 * below. Nothing else to do: at build time, for each page actually generated
 * under the NEW slug, this plugin creates the twin page under the OLD slug with a
 * redirect stub.
 *
 * Why a home-made plugin rather than @docusaurus/plugin-client-redirects:
 *   1. Docusaurus `postBuild` hooks run in parallel (`Promise.all`), so we
 *      cannot reliably post-process (inject `noindex`) files written by
 *      another plugin in ITS postBuild — that is a race. Here we generate the
 *      HTML ourselves, `noindex` included.
 *   2. The per-SLUG-SEGMENT mapping only targets the locale(s) where the new
 *      slug exists (e.g. `mistral-ai-platform` only exists in EN), so never a
 *      collision with the real FR pages that keep their French slug.
 *
 * ---
 * SAST note (eslint.detect-non-literal-fs-filename): same guarantees as
 * strip-null-bytes.js — `outDir` comes from the Docusaurus postBuild hook, `readdirSync`
 * only returns base names, the `isFile()`/`isDirectory()` guard (lstat) closes
 * symlink following, and the plugin only runs at build time on the tree
 * the same process just generated (no untrusted input).
 */

// [old slug (French / wrong), new slug (corrected)]
const SLUG_RENAMES = [["plateforme-ia-mistral", "mistral-ai-platform"]];

/**
 * Pages deleted from the docs.
 *
 * A deleted page must keep answering at its old URL with the same noindex
 * redirect stub used for renames, and the removal must be announced in the
 * changelog. Both are enforced by `linter/tests/page-deletion.test.js`
 * against the PR diff. Register a deletion as:
 *   ["old/route/path", "target/route/path"]
 * where the target is a still-existing doc page (validated in CI).
 *
 * Unlike SLUG_RENAMES this mapping is exact-route based, so each locale
 * build root gets the stub only if the target page exists for that locale.
 */
const DELETED_PAGES = [
  // Resources page (zones/regions/endpoints) removed: the Catalog concepts
  // page describes the Numspot regions. The "docs/" prefix matches the site
  // URL scheme (all doc routes live under /docs/). The pre-swap English URL
  // /en/docs/resources existed too (the EN tree mirrored the FR one until
  // the removal) and is covered by LOCALE_PREFIX_REDIRECTS — except the page
  // no longer exists in the built tree, so register its old EN routes here.
  ["docs/resources", "docs/catalog/concepts"],
  ["en/docs/resources", "docs/catalog/concepts"],
  ["docs/en/resources", "docs/catalog/concepts"],
  // Pre-swap English site homepage (default-locale flip, internal PR #3):
  // the docs home carries `slug: /`, so /en/ was the English homepage and
  // now answers at /.
  ["en", ""],
];

/**
 * Locale-prefix moves: whole subtrees whose URL prefix changed while every
 * page under them kept its slug.
 *
 * The default-locale flip (French default → English default, internal PR #3)
 * moved every English docs page from /en/docs/<slug> (English was the
 * non-default locale, rendered under the /en/ prefix) to /docs/<slug>. The
 * /docs/en/<slug> shape seen in the wild is covered too. Mirroring the built
 * subtree under each old prefix keeps every present AND future page answering
 * at its old URL — no per-route list to maintain — with the same noindex
 * redirect stub as SLUG_RENAMES, so the pre-swap URLs indexed by search
 * engines stop 404-ing.
 *
 * Each pair is [old-prefix, new-prefix], relative to a locale build root.
 */
const LOCALE_PREFIX_REDIRECTS = [
  ["en/docs", "docs"], // /en/docs/<slug> → /docs/<slug> (pre-swap English URLs)
  ["docs/en", "docs"], // /docs/en/<slug> → /docs/<slug> (in-the-wild variant)
];

function redirectHtml(targetUrl) {
  // `noindex, follow`: do not index this old URL, but follow the
  // redirect. The `canonical` consolidates SEO on the new page. The script
  // preserves the query string and the anchor across the redirect.
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex, follow">
    <meta http-equiv="refresh" content="0; url=${targetUrl}">
    <link rel="canonical" href="${targetUrl}" />
  </head>
  <script>
    window.location.href = '${targetUrl}' + window.location.search + window.location.hash;
  </script>
</html>
`;
}

module.exports = function slugRedirectsPlugin() {
  return {
    name: "slug-redirects",
    async postBuild({ outDir, baseUrl, siteConfig, i18n }) {
      let created = 0;

      // For each page (index.html) under `newDir`, create the twin page under
      // the old slug with a redirect stub pointing to the new URL.
      const mirrorAsRedirects = (newDir, oldDir) => {
        // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
        for (const entry of fs.readdirSync(newDir, { withFileTypes: true })) {
          const nFull = path.join(newDir, entry.name);
          const oFull = path.join(oldDir, entry.name);
          if (entry.isDirectory()) {
            mirrorAsRedirects(nFull, oFull);
          } else if (entry.isFile() && entry.name === "index.html") {
            const rel = path
              .relative(outDir, path.dirname(nFull))
              .split(path.sep)
              .join("/");
            const targetUrl = `${baseUrl}${rel}/`;
            // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
            fs.mkdirSync(oldDir, { recursive: true });
            // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
            fs.writeFileSync(oFull, redirectHtml(targetUrl));
            created += 1;
          }
        }
      };

      const walk = (dir) => {
        // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const full = path.join(dir, entry.name);
          const rename = SLUG_RENAMES.find(([, newSlug]) => entry.name === newSlug);
          if (rename) {
            const [oldSlug] = rename;
            mirrorAsRedirects(full, path.join(dir, oldSlug));
          }
          walk(full);
        }
      };

      walk(outDir);

      // Built page routes (relative to outDir, "/"-separated) under `dir`,
      // materialized in one pass — see LOCALE_PREFIX_REDIRECTS. Collecting
      // before writing matters: for the "docs/en" rule the old directory
      // sits inside the mirrored one, so a walk-as-you-write would pick up
      // the stubs it just created and nest endlessly.
      const collectIndexRoutes = (dir) => {
        const routes = [];
        const visit = (current) => {
          // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
          for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) visit(full);
            else if (entry.isFile() && entry.name === "index.html") {
              routes.push(
                path
                  .relative(outDir, path.dirname(full))
                  .split(path.sep)
                  .join("/")
              );
            }
          }
        };
        visit(dir);
        return routes;
      };

      // Deleted pages: noindex stub at the old route, per locale build root.
      // Docs-only site (`routeBasePath: "/"`): the default locale renders at
      // the outDir root, other locales at <outDir>/<locale>/. A stub is only
      // emitted when the target page actually exists for that locale and the
      // old path is free (never clobber a real generated page).
      const locales = (i18n && i18n.locales) || [];
      const defaultLocale =
        (i18n && i18n.defaultLocale) ||
        (siteConfig && siteConfig.i18n && siteConfig.i18n.defaultLocale) ||
        locales[0] ||
        "";
      const localeRoots = locales.length
        ? locales.map((locale) =>
            locale === defaultLocale ? outDir : path.join(outDir, locale)
          )
        : [outDir];
      for (const [oldPath, targetPath] of DELETED_PAGES) {
        const oldRoute = oldPath.replace(/^\/+|\/+$/g, "");
        const targetRoute = targetPath.replace(/^\/+|\/+$/g, "");
        for (const root of localeRoots) {
          const targetIndex = path.join(root, targetRoute, "index.html");
          // nosemgrep: eslint.detect-non-literal-fs-filename -- SAST note above
          if (!fs.existsSync(targetIndex)) continue;
          const oldDir = path.join(root, oldRoute);
          const oldIndex = path.join(oldDir, "index.html");
          // nosemgrep: eslint.detect-non-literal-fs-filename -- SAST note above
          if (fs.existsSync(oldIndex)) continue;
          const rel = path
            .relative(outDir, path.dirname(targetIndex))
            .split(path.sep)
            .join("/");
          // nosemgrep: eslint.detect-non-literal-fs-filename -- SAST note above
          fs.mkdirSync(oldDir, { recursive: true });
          // nosemgrep: eslint.detect-non-literal-fs-filename -- SAST note above
          // Collapse doubled slashes: an empty rel (site-root target) with a
          // "/" baseUrl would otherwise produce "//".
          fs.writeFileSync(
            oldIndex,
            redirectHtml(`${baseUrl}${rel}/`.replace(/\/{2,}/g, "/"))
          );
          created += 1;
        }
      }

      // Locale-prefix moves: mirror every built page under the old prefix.
      // Only meaningful in the DEFAULT locale build root: the pre-swap URLs
      // (e.g. /en/docs/<slug>, English being the then-non-default locale)
      // belonged to the default-locale site of that era, and the postBuild
      // hook runs once per locale — so gate on the current locale, the other
      // locale roots never served those URLs.
      const isDefaultLocaleRun =
        !i18n || !i18n.currentLocale || i18n.currentLocale === defaultLocale;
      if (isDefaultLocaleRun) {
        for (const [oldPrefix, newPrefix] of LOCALE_PREFIX_REDIRECTS) {
          const newDir = path.join(outDir, newPrefix);
          if (!fs.existsSync(newDir)) continue;
          for (const rel of collectIndexRoutes(newDir)) {
            const oldIndex = path.join(
              outDir,
              oldPrefix,
              rel.slice(newPrefix.length),
              "index.html"
            );
            // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
            if (fs.existsSync(oldIndex)) continue; // never clobber a real page
            fs.mkdirSync(path.dirname(oldIndex), { recursive: true });
            // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
            fs.writeFileSync(oldIndex, redirectHtml(`${baseUrl}${rel}/`));
            created += 1;
          }
        }
      }

      if (created > 0) {
        console.log(
          `[slug-redirects] ${created} redirection(s) noindex générée(s) (anciens slugs).`
        );
      }
    },
  };
}

// Exported for the linter regression tests (page-deletion.test.js reads
// DELETED_PAGES to validate the PR diff) and for reuse in scripts.
module.exports.SLUG_RENAMES = SLUG_RENAMES;
module.exports.DELETED_PAGES = DELETED_PAGES;
module.exports.LOCALE_PREFIX_REDIRECTS = LOCALE_PREFIX_REDIRECTS;
