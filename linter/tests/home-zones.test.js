// Guard: home page zone URLs must resolve to real documentation pages.
//
// The home zones (src/components/HomeZones) declare curated entries by URL.
// A renamed or removed page would leave a dead link on the homepage — this
// suite validates every declared URL against the docs tree.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DOCS_DIR = path.join(ROOT, 'docs', 'docs');
const ZONES_FILE = path.join(
  ROOT,
  'src',
  'components',
  'HomeZones',
  'index.tsx'
);

// Every URL declared in the zones component (url: "…" entries). Placeholder
// entries of the hidden Labs zone ("#") are skipped.
function declaredUrls() {
  const content = fs.readFileSync(ZONES_FILE, 'utf8');
  return [...content.matchAll(/url:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith('/docs/'));
}

// /docs/<path>/ -> docs/docs/<path>.{md,mdx}
function docFileFor(url) {
  const rel = /^\/docs\/(.+)\/$/.exec(url);
  if (!rel) return null;
  return ['.md', '.mdx']
    .map((ext) => path.join(DOCS_DIR, `${rel[1]}${ext}`))
    .find((file) => fs.existsSync(file));
}

test('home zones: every declared URL resolves to a real docs page', () => {
  const urls = declaredUrls();
  assert.ok(urls.length > 0, 'no URLs found in HomeZones — did the file move?');
  const missing = urls.filter((url) => !docFileFor(url));
  assert.deepStrictEqual(
    missing,
    [],
    `home zone URLs without a docs page (fix the entry or restore the page):\n${missing.join('\n')}`
  );
});
