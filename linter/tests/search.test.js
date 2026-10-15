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
const NUMSPOT_SEARCH = path.join(PKG, 'dist/client/client/theme/numspotSearch.js');
const GET_INDEX_HASH = path.join(PKG, 'dist/server/server/utils/getIndexHash.js');

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

// ---------------------------------------------------------------------------
// DOC-6xx follow-up — query language + bilingual synonym expansion. Both live
// in the patched worker (numspotSearch.js, required by worker.js) and are
// covered by the index hash (getIndexHash.js): a dependency bump or a patch
// regeneration that drops any of it fails here.
// ---------------------------------------------------------------------------

test('the query language module is wired into the worker', { skip: !hasDeps && 'node_modules absent' }, () => {
  const worker = read(WORKER);
  assert.match(worker, /import \{ parseQuery, buildSynonymQueries, buildStemmedQuery \} from "\.\/numspotSearch"/,
    'worker.js no longer imports the query-language module — the patch was lost (yarn install runs patch-package)');
  assert.match(worker, /const parsed = parseQuery\(input\)/,
    'worker.js no longer parses operator queries');
  assert.match(worker, /buildStemmedQuery\(rawTokens\)/,
    'worker.js no longer appends the stemmed query — complete words longer than their stem ("template" → indexed "templat") would match nothing again');
  assert.match(worker, /buildSynonymQueries\(rawTokens\)/,
    'worker.js no longer appends the synonym queries — semantic proximity is gone');
});

test('the index hash covers the query-side patch files', { skip: !hasDeps && 'node_modules absent' }, () => {
  const src = read(path.join(PKG, 'dist/server/server/utils/getIndexHash.js'));
  assert.match(src, /client\/client\/theme\/worker\.js/,
    'getIndexHash.js does not hash worker.js — a query-side patch change would keep the old immutable index for a year');
  assert.match(src, /numspotSearch\.js/,
    'getIndexHash.js does not hash numspotSearch.js — editing the query language or the synonyms would not bust the immutable cache');
});

test('the parser shapes every operator into the documented clauses', { skip: !hasDeps && 'node_modules absent' }, () => {
  const { parseQuery } = require(NUMSPOT_SEARCH);
  const OPTIONAL = 1;
  const REQUIRED = 2;
  const PROHIBITED = 3;
  const shape = (input) => {
    const parsed = parseQuery(input);
    return parsed
      ? parsed.queries.map((q) => q.term.map((c) => [
          c.value,
          c.presence,
          c.wildcard > 0 ? 'prefix' : 'exact',
          ...(c.editDistance != null ? [`~${c.editDistance}`] : []),
          ...(c.field ? [c.field] : []),
        ]))
      : null;
  };

  // Plain inputs stay on the stock smart path — zero regression, whatever
  // the word count, length or case.
  for (const plain of ['machine virtuelle', 'vm', 'Kubernetes', 'a and b', 'ou OU ou', 'template']) {
    assert.strictEqual(parseQuery(plain), null, `"${plain}" carries no operator — smart path`);
  }
  // Degenerate inputs never throw and fall back to the smart path too.
  assert.strictEqual(parseQuery(''), null);
  assert.strictEqual(parseQuery('   '), null);
  assert.strictEqual(parseQuery(null), null);
  assert.strictEqual(parseQuery('*'), null, 'a lone * carries no word — fall back');
  assert.strictEqual(parseQuery('AND OR'), null, 'keywords alone are not searchable');
  assert.strictEqual(parseQuery('NOT foo'), null, 'a prohibition-only query would match nothing');
  assert.strictEqual(parseQuery('-foo'), null, 'same for the - shorthand');
  assert.strictEqual(parseQuery('NOT "machine virtuelle"'), null, 'a prohibition-only phrase would match nothing');

  // +word — required, strict: no wildcard, no fuzzy, whatever the length.
  assert.deepStrictEqual(shape('+template'), [[['template', REQUIRED, 'exact']]], '+ must be required and strict');
  assert.deepStrictEqual(shape('+vm*'), [[['vm', REQUIRED, 'prefix']]], '+word* keeps the prefix on a required clause');
  // -word — prohibited; it is an exclusion, not a highlight token.
  assert.deepStrictEqual(shape('vm -deprecated'), [[['deprecated', PROHIBITED, 'exact'], ['vm', OPTIONAL, 'exact']]]);
  // AND chains bind every neighbor; values are lowercased.
  assert.deepStrictEqual(shape('a AND b AND c'), [
    [['a', REQUIRED, 'exact'], ['b', REQUIRED, 'exact'], ['c', REQUIRED, 'exact']],
  ], 'AND makes each neighbor required');
  // Keywords are uppercase-only; lowercase "and" is just a word.
  assert.strictEqual(parseQuery('vm and cluster'), null, 'lowercase "and" is a search word, not an operator');
  // OR — one lunr query per group; prohibitions are global to every group.
  const orThree = parseQuery('kubernetes OR docker OR registry');
  assert.strictEqual(orThree.queries.length, 3, 'each OR alternative is its own lunr query');
  assert.deepStrictEqual(orThree.queries.map((q) => q.term[0].value), ['kubernetes', 'docker', 'registry']);
  assert.strictEqual(
    parseQuery('vm OR storage -internal').queries.every((q) => q.term.some((c) => c.value === 'internal' && c.presence === PROHIBITED)),
    true, 'prohibitions apply to every OR group',
  );
  // word* — required prefix, stemmed before the wildcard (the root-cause fix:
  // lunr runs no pipeline on wildcard clauses).
  assert.deepStrictEqual(shape('template*'), [[['templat', OPTIONAL, 'prefix']]]);
  assert.deepStrictEqual(shape('technica*'), [[['technic', OPTIONAL, 'prefix']]]);
  assert.deepStrictEqual(shape('templat*'), [[['templat', OPTIONAL, 'prefix']]], 'an already-stemmed prefix is stable');
  assert.deepStrictEqual(shape('+technica*'), [[['technic', REQUIRED, 'prefix']]], '+word* keeps the prefix on a required clause');
  // Prefix + fuzzy: lunr honours one or the other, never both — the prefix wins.
  const prefixFuzzy = parseQuery('snap*~1').queries[0].term[0];
  assert.strictEqual('editDistance' in prefixFuzzy, false, 'a prefix clause drops the edit distance (lunr keeps one or the other)');
  assert.strictEqual(prefixFuzzy.wildcard > 0, true);
  // word~N — explicit edit distance, any length.
  assert.deepStrictEqual(shape('kubernets~2'), [[['kubernets', OPTIONAL, 'exact', '~2']]]);
  assert.deepStrictEqual(shape('a~1'), [[['a', OPTIONAL, 'exact', '~1']]]);
  // Quoted phrases — every word required and strict.
  assert.deepStrictEqual(shape('"machine virtuelle"'), [[['machine', REQUIRED, 'exact'], ['virtuelle', REQUIRED, 'exact']]]);
  assert.deepStrictEqual(shape('"machine virtuelle" AND kubernetes'), [
    [['machine', REQUIRED, 'exact'], ['virtuelle', REQUIRED, 'exact'], ['kubernetes', REQUIRED, 'exact']],
  ]);
  // title: scopes to page titles and is strict by default.
  assert.deepStrictEqual(shape('title:registry'), [[['registry', REQUIRED, 'exact', 'title']]]);
  assert.strictEqual(parseQuery('title:registry').titleOnly, true);
  // One-letter and short tokens survive parsing.
  assert.deepStrictEqual(shape('+a'), [[['a', REQUIRED, 'exact']]]);
  assert.deepStrictEqual(shape('k*'), [[['k', OPTIONAL, 'prefix']]]);
  // A long multi-word query keeps every unit, in order.
  const many = parseQuery('+kubernetes +cluster -deprecated +autoscaling');
  assert.deepStrictEqual(many.queries[0].term.map((c) => [c.value, c.presence]), [
    ['deprecated', PROHIBITED], ['kubernetes', REQUIRED], ['cluster', REQUIRED], ['autoscaling', REQUIRED],
  ]);
  // Mixed grammar: quotes + OR + a global exclusion in one query.
  const mixed = parseQuery('"machine virtuelle" OR kubernetes -windows');
  assert.strictEqual(mixed.queries.length, 2, 'OR splits into two lunr queries');
  assert.ok(mixed.queries.every((q) => q.term.some((c) => c.value === 'windows' && c.presence === PROHIBITED)),
    'the exclusion is global to every OR group');
  assert.ok(mixed.queries[0].term.some((c) => c.value === 'machine' && c.presence === REQUIRED)
    && mixed.queries[0].term.some((c) => c.value === 'virtuelle' && c.presence === REQUIRED),
    'group 1 keeps its quoted words required');
  assert.ok(mixed.queries[1].term.some((c) => c.value === 'kubernetes' && c.presence === OPTIONAL),
    'group 2 carries only its own positive');
  assert.ok(!mixed.queries[1].term.some((c) => c.value === 'virtuelle'),
    'the quoted phrase of group 1 does not leak into group 2');
});

test('synonym expansion proposes the bilingual equivalents', { skip: !hasDeps && 'node_modules absent' }, () => {
  const { buildSynonymQueries, lookupSynonyms } = require(path.join(PKG, 'dist/client/client/theme/numspotSearch.js'));
  assert.ok(lookupSynonyms('vm').includes('machine virtuelle'), '"vm" must propose "machine virtuelle"');
  assert.ok(lookupSynonyms('machine').includes('vm'), 'the expansion works from the French side too');
  assert.deepStrictEqual(lookupSynonyms('unknownword'), [], 'unknown tokens add no query');
  const queries = buildSynonymQueries(['vm']);
  assert.ok(queries.length > 0, '"vm" must generate at least one synonym query');
  for (const query of queries) {
    const required = query.term.filter((c) => c.presence === 2);
    assert.ok(required.length > 0, 'each synonym query carries its phrase as required words');
    assert.ok(required.every((c) => c.boost != null && c.boost < 1), 'synonym words rank below exact matches');
  }
  assert.deepStrictEqual(buildSynonymQueries(['zzz']), [], 'a token with no synonym adds no query');
});

test('the query language actually filters at the lunr level', { skip: !hasDeps && 'node_modules absent' }, () => {
  const lunr = require(path.join(REPO_ROOT, 'node_modules', 'lunr'));
  const { parseQuery } = require(path.join(PKG, 'dist/client/client/theme/numspotSearch.js'));
  const index = lunr(function () {
    this.ref('i');
    this.field('t');
    this.add({ i: '1', t: 'Create a VM cluster in the managed Kubernetes service' });
    this.add({ i: '2', t: 'Kubernetes cluster autoscaling and node pools' });
    this.add({ i: '3', t: 'VM snapshots and backup restore' });
  });
  const run = (input) => {
    const parsed = parseQuery(input);
    const out = [];
    for (const { term } of parsed.queries) {
      out.push(...index.query((query) => {
        for (const item of term) {
          query.term(item.value, {
            wildcard: item.wildcard,
            presence: item.presence,
            ...(item.editDistance != null ? { editDistance: item.editDistance } : null),
            ...(item.boost != null ? { boost: item.boost } : null),
          });
        }
      }).map((r) => r.ref));
    }
    return [...new Set(out)].sort();
  };

  assert.deepStrictEqual(run('kubernetes AND cluster'), ['1', '2'], 'AND intersects');
  assert.deepStrictEqual(run('autoscaling OR snapshot'), ['2', '3'], 'OR unions');
  assert.deepStrictEqual(run('kubernetes NOT autoscaling'), ['1'], 'NOT excludes');
  assert.deepStrictEqual(run('snap*'), ['3'], 'prefix search');
});

// ---------------------------------------------------------------------------
// Stemmed recall — the root-cause fix for "complete words return nothing".
// lunr runs NO pipeline on wildcard clauses and the index stores STEMMED
// tokens, so a typed word longer than its stem ("template" vs the indexed
// "templat") can never be reached by the stock wildcard queries. The parser
// stems prefixes itself and the plain path gains one stemmed union query;
// these tests run both against a replica of the production index pipeline
// (fold → French stemmer → English stemmer).
// ---------------------------------------------------------------------------

test('prefix clauses are stemmed to the indexed stem', { skip: !hasDeps && 'node_modules absent' }, () => {
  const { parseQuery } = require(NUMSPOT_SEARCH);
  // typed query → the exact clause value the index can actually prefix-match
  for (const [typed, stemmedValue] of [
    ['template*', 'templat'], ['templat*', 'templat'], ['templates*', 'templat'],
    ['technica*', 'technic'], ['technic*', 'technic'], ['kubernetes*', 'kubernet'],
  ]) {
    const clause = parseQuery(typed).queries[0].term[0];
    assert.strictEqual(clause.value, stemmedValue, `"${typed}" must be stemmed before the wildcard`);
    assert.ok(clause.wildcard > 0, `"${typed}" stays a prefix clause`);
  }
});

test('the stemmed query covers complete words the stock path misses', { skip: !hasDeps && 'node_modules absent' }, () => {
  const { buildStemmedQuery } = require(NUMSPOT_SEARCH);
  assert.deepStrictEqual(buildStemmedQuery([]), null, 'no token, no query');
  assert.deepStrictEqual(buildStemmedQuery(null), null);
  const q = buildStemmedQuery(['Template']);
  assert.strictEqual(q.term[0].value, 'templat', 'the stem of the typed word is queried, not the raw word');
  assert.strictEqual(q.term[0].wildcard > 0, true, 'as a trailing prefix');
  assert.strictEqual(q.term[0].presence, 1, 'optional: the stemmed query only widens recall');
  const two = buildStemmedQuery(['template', 'cluster']);
  assert.deepStrictEqual(two.term.map((c) => c.value), ['templat', 'clust'], 'one stemmed clause per token');
  assert.deepStrictEqual(buildStemmedQuery(['vm', 'VM', 'vms']).term.length, 1,
    'stems collapse to one clause per distinct stem');
});

test('complete words find their documents at the lunr level (plain and operator)', { skip: !hasDeps && 'node_modules absent' }, () => {
  const lunr = require(path.join(REPO_ROOT, 'node_modules', 'lunr'));
  require(path.join(REPO_ROOT, 'node_modules', 'lunr-languages', 'lunr.stemmer.support.js'))(lunr);
  require(path.join(REPO_ROOT, 'node_modules', 'lunr-languages', 'lunr.fr.js'))(lunr);
  require(path.join(REPO_ROOT, 'node_modules', 'lunr-languages', 'lunr.multi.js'))(lunr);
  const foldAccents = (token) => token.update((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  lunr.Pipeline.registerFunction(foldAccents, 'foldAccents');
  // Mirror of the production index pipeline: [foldAccents, stemmer-fr, stemmer]
  // (multiLanguage en+fr trims, folds, then stems with both stemmers).
  const index = lunr(function () {
    this.use(lunr.multiLanguage('en', 'fr'));
    this.pipeline.before(this.pipeline._stack[0], foldAccents);
    this.searchPipeline.before(this.searchPipeline._stack[0], foldAccents);
    this.ref('i');
    this.field('t');
    this.add({ i: '1', t: 'Create reusable templates for your technical documentation' });
    this.add({ i: '2', t: 'Kubernetes cluster autoscaling and node pools' });
    this.add({ i: '3', t: 'Modèles de machines virtuelles et instantanés' });
  });
  const run = (clauses) => [...new Set(index.query((query) => {
    for (const item of clauses) {
      query.term(item.value, {
        wildcard: item.wildcard,
        presence: item.presence,
        ...(item.editDistance != null ? { editDistance: item.editDistance } : null),
        ...(item.boost != null ? { boost: item.boost } : null),
      });
    }
  }).map((r) => r.ref))].sort();

  // The stock guard: a RAW wildcard on a word longer than its stem matches
  // nothing. This arm documents the lunr behavior the fix works around — if
  // lunr ever stems wildcard clauses on its own, this fails and the patch
  // can be simplified.
  assert.deepStrictEqual(run([{ value: 'template', presence: 1, wildcard: lunr.Query.wildcard.TRAILING }]), [],
    'the raw "template*" pattern cannot reach the stemmed "templat" — this is why prefixes are stemmed');

  const { parseQuery, buildStemmedQuery } = require(NUMSPOT_SEARCH);
  assert.deepStrictEqual(run(parseQuery('template*').queries[0].term), ['1'], 'operator "template*" finds the templates');
  assert.deepStrictEqual(run(parseQuery('technica*').queries[0].term), ['1'], 'operator "technica*" finds the technical page');
  assert.deepStrictEqual(run(buildStemmedQuery(['template']).term), ['1'], 'plain "template" finds the templates via the stemmed query');
  assert.deepStrictEqual(run(buildStemmedQuery(['technica']).term), ['1'], 'plain "technica" finds the technical page');
  assert.deepStrictEqual(run(buildStemmedQuery(['kubernetes']).term), ['2'], 'complete words whose stem is shorter still match');
  // The plain path also keeps matching short prefixes and French input.
  assert.deepStrictEqual(run(buildStemmedQuery(['instantanes']).term), ['3'], 'accent-folded stems match French content');
  // Strict operators still match through the query pipeline (stemming applies
  // to non-wildcard clauses).
  assert.deepStrictEqual(run(parseQuery('+templates').queries[0].term), ['1'], '+word is strict but still stemmed by the pipeline');
});

// ---------------------------------------------------------------------------
// Results page — cap and honest "> N documents found" label (patched
// SearchPage.jsx; JSX cannot be required from Node, so pin the source).
// ---------------------------------------------------------------------------

test('the results page caps the list and labels the truncation honestly', { skip: !hasDeps && 'node_modules absent' }, () => {
  const searchPagePath = path.join(PKG, 'dist/client/client/theme/SearchPage/SearchPage.jsx');
  const src = read(searchPagePath);
  const limit = src.match(/const SEARCH_RESULT_LIMIT = (\d+)/);
  assert.ok(limit, 'SearchPage.jsx lost the SEARCH_RESULT_LIMIT constant');
  assert.match(src, new RegExp(`searchByWorker\\([^)]*SEARCH_RESULT_LIMIT\\)`),
    'the results page must fetch with SEARCH_RESULT_LIMIT, not an inline literal');
  assert.match(src, /count: searchResults\.length >= SEARCH_RESULT_LIMIT/,
    'at the cap the label must switch to "> N documents found" — a capped list must never read as complete');
  assert.match(src, />\s*\$\{searchResults\.length\}/,
    'the "> N" label is built from the numeric cap');
});

// ---------------------------------------------------------------------------
// Search syntax popover — the navbar SearchBar swizzle adds a "?" button
// next to the field, opening the full query-language reference; the /search
// results page renders the same shared component next to its input. Site
// code (TypeScript, not requirable from Node), so pin the source text and
// the translations.
// ---------------------------------------------------------------------------

test('the navbar search bar carries the syntax popover', () => {
  const wrapperPath = path.join(REPO_ROOT, 'src', 'theme', 'SearchBar', 'index.tsx');
  assert.ok(fs.existsSync(wrapperPath), 'src/theme/SearchBar/index.tsx is missing — the syntax tooltip is gone');
  const wrapper = read(wrapperPath);
  assert.match(wrapper, /from ['"]@theme-original\/SearchBar['"]/,
    'the swizzle must wrap the plugin SearchBar, not replace it');
  assert.match(wrapper, /<SearchBar \{\.\.\.props\}\s*\/>/, 'plugin props must pass through');
  assert.match(wrapper, /<SearchSyntaxHelp\s*\/>/,
    'the swizzle must render the shared syntax-help component');
  // The shared component documents every operator of the grammar — prefix
  // and keyword forms on separate rows, in sync with SEARCH.md.
  const help = read(path.join(REPO_ROOT, 'src', 'components', 'SearchSyntaxHelp', 'index.tsx'));
  for (const row of ['+word', 'a AND b', 'a OR b', '-word', 'NOT word', '"quoted words"', 'prefix*', 'word~2', 'title:word']) {
    assert.ok(help.includes(`'${row}'`), `the popover must list "${row}"`);
  }
  for (const key of ['toggleLabel', 'popoverTitle', 'required', 'and', 'or', 'excluded', 'not', 'phrase', 'prefix', 'fuzzy', 'fieldTitle', 'footnote']) {
    assert.match(help, new RegExp(`theme\\.search\\.syntax\\.${key}`),
      `the popover references theme.search.syntax.${key} — keep it wired`);
  }
});

test('the syntax popover is translated in French', () => {
  const code = JSON.parse(read(path.join(REPO_ROOT, 'i18n', 'fr', 'code.json')));
  const help = read(path.join(REPO_ROOT, 'src', 'components', 'SearchSyntaxHelp', 'index.tsx'));
  const ids = [...help.matchAll(/['"](theme\.search\.syntax\.[A-Za-z]+)['"]/g)].map((m) => m[1]);
  assert.ok(ids.length >= 12, 'the popover must localize the toggle, the title, every row and the footnote');
  for (const id of ids) {
    assert.ok(code[id], `i18n/fr/code.json is missing "${id}"`);
    assert.notStrictEqual(code[id].message, undefined);
    assert.notStrictEqual(code[id].message.trim(), '', `"${id}" must carry the French wording`);
  }
  // The one-line results-page hint was replaced by the popover: its key must
  // not linger half-removed.
  assert.strictEqual(code['theme.SearchPage.syntaxHint'], undefined,
    'the results-page hint was replaced by the syntax popover — remove the dead key');
});

test('the /search page carries the same syntax help next to its input', { skip: !hasDeps && 'node_modules absent' }, () => {
  const searchPagePath = path.join(PKG, 'dist/client/client/theme/SearchPage/SearchPage.jsx');
  const src = read(searchPagePath);
  assert.match(src, /import SearchSyntaxHelp from "@site\/src\/components\/SearchSyntaxHelp"/,
    'the /search page must import the shared syntax-help component');
  assert.match(src, /<SearchSyntaxHelp\/>/,
    'the /search input must have the "?" help button beside it');
  const css = read(path.join(REPO_ROOT, 'src', 'css', 'components', 'search.css'));
  assert.match(css, /\.search-query-row \{/,
    'the search page input row must be a flex line (input stretches, button right)');
});
