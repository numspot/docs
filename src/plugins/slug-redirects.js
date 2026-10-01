const fs = require("fs");
const path = require("path");

/**
 * Redirects for renamed slugs — SEO-safe and NON-INDEXED.
 *
 * RULE (see CONVENTIONS-SLUGS.md): when a page slug is renamed, the OLD
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
// Pages deleted from the documentation tree, mapped to the still-existing
// page that best replaces them: ["old-route", "target-route"]. The plugin
// serves a noindex redirect stub at the old URL; the page-deletion guard
// (linter/tests/page-deletion.test.js) enforces the registration.
const DELETED_PAGES = [
  // Resources page (resource locations) removed by D-023 (8): the useful
  // information (full API base URLs) now lives inside the action pages.
  ["docs/resources", "docs/reference/parameter-types"],
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
          fs.writeFileSync(oldIndex, redirectHtml(`${baseUrl}${rel}/`));
          created += 1;
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
