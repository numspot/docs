// Page-deletion guards.
//
// Deleting a documentation page silently breaks every indexed or shared URL
// pointing to it. Two requirements, checked against the MR diff:
//   1. REDIRECT — the old route must be registered in DELETED_PAGES
//      (src/plugins/slug-redirects.js) as ["old/route", "target/route"],
//      where the target is a still-existing documentation page. The plugin
//      then serves a noindex redirect stub at the old URL.
//   2. CHANGELOG — a dated entry with status "removed" must announce the
//      removal in BOTH the French and the English changelog, referencing
//      the page (its title or its slug's last segment).
//
// The tests only run when a diff base is available:
// CI_MERGE_REQUEST_DIFF_BASE_SHA (merge-request pipelines) or
// LINTER_DIFF_BASE (local runs, e.g. `LINTER_DIFF_BASE=origin/main`).
// They shell out to `git`, so they also skip cleanly when no git binary
// exists (e.g. a bare node:20-alpine CI image — the test:linter job installs
// git itself); a ref that exists but cannot be resolved (shallow clone,
// typo) still fails loudly rather than silently disabling the guard.

const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DOCS = path.join(ROOT, 'docs', 'docs');
const REDIRECTS_FILE = path.join(ROOT, 'src', 'plugins', 'slug-redirects.js');
const FR_CHANGELOG = path.join(ROOT, 'docs', 'docs', 'changelog.json');
const EN_CHANGELOG = path.join(
  ROOT,
  'i18n/en/docusaurus-plugin-content-docs/current/docs/changelog.json'
);

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

// The diff base to compare against, or null when there is nothing usable:
// no ref configured, or no git binary (ENOENT) — the tests then skip instead
// of crashing. A configured ref that git cannot resolve (shallow clone,
// typo) is a configuration error and is rethrown so the guard stays visible.
function diffBase() {
  const ref =
    process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA ||
    process.env.LINTER_DIFF_BASE ||
    null;
  if (!ref) return null;
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  return ref;
}

// --- helpers ---------------------------------------------------------------

function isPartial(relPath) {
  return relPath.split('/').some((segment) => segment.startsWith('_'));
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = {};
  for (const key of ['slug', 'title']) {
    const line = match[1].match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
    if (line) fm[key] = line[1].trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

// Route of a doc page relative to the docs root (no leading/trailing slash).
// The site is docs-only (`routeBasePath: "/"`), so routes start right after
// the locale segment.
function routeFor(relPath, frontmatter) {
  const dir = path.posix.dirname(relPath);
  const base = path.posix.basename(relPath).replace(/\.mdx?$/, '');
  if (base === 'index') return dir === '.' ? '' : dir;
  const slug = (frontmatter.slug || '').replace(/^\/+|\/+$/g, '');
  if (slug) return path.posix.join(dir, slug).replace(/\/+$/, '');
  return dir === '.' ? base : path.posix.join(dir, base);
}

// --- data gathering ---------------------------------------------------------

// Pages deleted by the diff: route at deletion time + frontmatter title.
function deletedPages(ref) {
  const out = git([
    'diff',
    '--name-only',
    '--diff-filter=D',
    ref,
    '--',
    'docs/docs',
  ]);
  return out
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => /\.mdx?$/.test(p) && !isPartial(p.replace(/^docs\/docs\//, '')))
    .map((p) => {
      const rel = p.replace(/^docs\/docs\//, '');
      const frontmatter = parseFrontmatter(git(['show', `${ref}:${p}`]));
      return { rel, route: routeFor(rel, frontmatter), title: frontmatter.title || '' };
    });
}

// Every route a visitor can currently reach (doc file routes only; no
// `_category_.json` in this repo uses `link`, so category pages have no
// route of their own).
function existingRoutes() {
  const routes = new Set();
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relNext = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('_')) walk(path.join(dir, entry.name), relNext);
      } else if (/\.mdx?$/.test(entry.name) && !isPartial(relNext)) {
        routes.add(routeFor(relNext, parseFrontmatter(fs.readFileSync(path.join(dir, entry.name), 'utf8'))));
      }
    }
  };
  walk(DOCS, '');
  return routes;
}

function removedChangelogEntries(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (data.entries || []).filter((entry) => entry.status === 'removed');
}

function loadDeletedPagesMapping() {
  delete require.cache[require.resolve(REDIRECTS_FILE)];
  const plugin = require(REDIRECTS_FILE);
  return (plugin.DELETED_PAGES || []).map(([oldPath, targetPath]) => [
    String(oldPath).replace(/^\/+|\/+$/g, ''),
    String(targetPath).replace(/^\/+|\/+$/g, ''),
  ]);
}

function removedEntryIssue(entries, page) {
  const tokens = [];
  const last = page.route.split('/').pop();
  if (last) {
    tokens.push(last.toLowerCase());
    tokens.push(last.toLowerCase().replace(/-/g, ' '));
  }
  if (page.title) {
    tokens.push(page.title.toLowerCase().replace(/\s+/g, ' ').trim());
  }
  const hit = entries.find((entry) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || ''))) return false;
    const text = `${entry.title || ''} ${entry.description || ''}`
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return tokens.some((token) => text.includes(token));
  });
  if (hit) return null;
  return `no dated changelog entry (status: "removed") references "${page.rel}" ` +
    '(mention the page title or its slug last segment in title or description)';
}

// --- tests -------------------------------------------------------------------

const ref = diffBase();

test('every deleted doc page has a redirect entry in DELETED_PAGES', () => {
  if (!ref) return;
  const mapping = loadDeletedPagesMapping();
  const missing = deletedPages(ref)
    .filter((page) => !mapping.some(([oldPath]) => oldPath === page.route))
    .map((page) => page.rel);
  assert.deepStrictEqual(
    missing,
    [],
    'Deleted doc pages without a redirect entry in DELETED_PAGES ' +
    '(src/plugins/slug-redirects.js): add ["<old-route>", "<target-route>"] ' +
    'so already-indexed URLs keep answering with a noindex redirect.'
  );
});

test('every DELETED_PAGES target exists in the docs tree', () => {
  if (!ref) return;
  const routes = existingRoutes();
  const deleted = deletedPages(ref);
  const bad = loadDeletedPagesMapping()
    .filter(([oldPath]) => deleted.some((page) => page.route === oldPath))
    .filter(([, targetPath]) => !routes.has(targetPath))
    .map(([, targetPath]) => targetPath);
  assert.deepStrictEqual(
    bad,
    [],
    'DELETED_PAGES targets not matching any existing doc page route — ' +
    'point the redirect at a relevant still-existing page.'
  );
});

test('deleted pages are announced in the FR changelog (status removed)', () => {
  if (!ref) return;
  const issues = deletedPages(ref)
    .map((page) => removedEntryIssue(removedChangelogEntries(FR_CHANGELOG), page))
    .filter(Boolean);
  assert.deepStrictEqual(issues, []);
});

test('deleted pages are announced in the EN changelog (status removed)', () => {
  if (!ref) return;
  const issues = deletedPages(ref)
    .map((page) => removedEntryIssue(removedChangelogEntries(EN_CHANGELOG), page))
    .filter(Boolean);
  assert.deepStrictEqual(issues, []);
});
