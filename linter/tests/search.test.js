// Regression tests for the site search (@easyops-cn/docusaurus-search-local).
//
// Session history — three bugs this file exists to prevent from coming back:
//
//  1. DOC-604 (accents). lunr has no diacritic folding: "réseau" is indexed
//     as-is, so "reseau" finds nothing. Fuzzy matching absorbs ONE accent but
//     not two ("securite" vs "sécurité"). The fix is a patch-package patch
//     folding accents at the head of both lunr pipelines, indexing side AND
//     query side. The two sides are coupled through the "foldAccents" label
//     serialized inside the index: patch one without the other and every
//     accented query silently returns zero results.
//
//  2. docs-only mode. The preset serves docs at "/" (routeBasePath), so the
//     search plugin needs docsRouteBasePath: "/". With the default "/docs",
//     the build still succeeds and the index is simply empty.
//
//  3. Cache headers. The index carries a content hash in its file name
//     (hashed: "filename") and lives at the site root, not under /assets/ —
//     so it needs its own immutable Cache-Control rule in nginx. Without it
//     the browser revalidates megabytes on every page load.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PKG = path.join(REPO_ROOT, 'node_modules', '@easyops-cn', 'docusaurus-search-local');
const BUILD_INDEX = path.join(PKG, 'dist/server/server/utils/buildIndex.js');
const WORKER = path.join(PKG, 'dist/client/client/theme/worker.js');

// The linter CI job runs without `yarn install`; these tests are meaningful
// only against real node_modules, and skip cleanly otherwise.
const hasDeps = fs.existsSync(PKG);
const read = (p) => fs.readFileSync(p, 'utf8');

test('the accent-folding patch is applied on the indexing side', { skip: !hasDeps && 'node_modules absent' }, () => {
  const src = read(BUILD_INDEX);
  assert.match(src, /registerFunction\(foldAccents, "foldAccents"\)/,
    'buildIndex.js lost the foldAccents registration — reapply patches/ (yarn install runs patch-package)');
  assert.match(src, /prependFoldAccents\(this\.pipeline\)/,
    'foldAccents is no longer prepended to the indexing pipeline');
  assert.match(src, /prependFoldAccents\(this\.searchPipeline\)/,
    'foldAccents is no longer prepended to searchPipeline — this is the pipeline serialized into the index and replayed on query terms');
});

test('the accent-folding patch is applied on the query side', { skip: !hasDeps && 'node_modules absent' }, () => {
  assert.match(read(WORKER), /registerFunction\(foldAccents, "foldAccents"\)/,
    'worker.js lost the foldAccents registration: lunr.Pipeline.load would drop the label silently and every accented query would return nothing');
});

test('accent folding actually makes accented and unaccented queries equivalent', { skip: !hasDeps && 'node_modules absent' }, () => {
  const lunr = require(path.join(REPO_ROOT, 'node_modules', 'lunr'));
  const fold = (token) => token.update((str) => str.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  lunr.Pipeline.registerFunction(fold, 'foldAccentsTest');

  const build = (folded) => lunr(function () {
    if (folded) {
      this.pipeline.before(this.pipeline._stack[0], fold);
      this.searchPipeline.before(this.searchPipeline._stack[0], fold);
    }
    this.ref('i');
    this.field('t');
    this.add({ i: '1', t: 'Politique de sécurité et réversibilité des données' });
  });

  // Without folding the invariant does not hold — this arm guards the test
  // itself: if lunr ever started folding on its own, it would fail here and
  // the patch could be dropped.
  assert.strictEqual(build(false).search('securite').length, 0,
    'lunr folds accents on its own now — the patch may no longer be needed');

  const index = build(true);
  for (const query of ['securite', 'sécurité', 'reversibilite', 'réversibilité', 'donnees', 'données']) {
    assert.strictEqual(index.search(query).length, 1, `"${query}" should match the accent-folded document`);
  }
});

test('the search index covers the same route base path as the docs', () => {
  const config = read(path.join(REPO_ROOT, 'docusaurus.config.ts'));
  const routeBasePath = config.match(/routeBasePath:\s*"([^"]+)"/);
  const docsRouteBasePath = config.match(/docsRouteBasePath:\s*"([^"]+)"/);
  assert.ok(routeBasePath, 'routeBasePath not found in the docs preset');
  assert.ok(docsRouteBasePath, 'docsRouteBasePath not found in the search plugin options');
  assert.strictEqual(docsRouteBasePath[1], routeBasePath[1],
    'docsRouteBasePath must mirror the preset routeBasePath, otherwise the search index is built empty without failing the build');
});

// The nginx config lives in the private deployment repository, not in this
// public copy; the `hashed: "filename"` contract is still checked here.
const hasNginxConf = fs.existsSync(path.join(REPO_ROOT, 'container', 'nginx.conf'));

test('the search index file name is content-hashed', { skip: !hasNginxConf && 'container/nginx.conf absent (private deployment repo)' }, () => {
  if (hasNginxConf) {
    const conf = read(path.join(REPO_ROOT, 'container', 'nginx.conf'));
    const block = conf.match(/location\s+~\s+\^\/\(en\/\)\?search-index[^{]*\{[^}]*\}/);
    assert.ok(block, 'no nginx location block matching the search index at the site root');
    assert.match(block[0], /Cache-Control\s+"public,\s*max-age=31536000,\s*immutable"/,
      'the search index file name is content-hashed, it must be cached immutably');
  }

  const config = read(path.join(REPO_ROOT, 'docusaurus.config.ts'));
  assert.match(config, /hashed:\s*"filename"/,
    'the immutable caching of the search index assumes the hash is carried by the file name (hashed: "filename")');
});
