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
// Search follow-up — query language + bilingual synonym expansion. Both live
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
    'worker.js no longer appends the stemmed query — raw wildcards could never reach shorter stems ("template*" vs the indexed "templat")');
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
  // AND chains bind every neighbor; values are lowercased. A required
  // stopword ("a") is dropped instead of voiding the whole query — the index
  // removed it, so the REQUIRED clause could never match (the reviewer's
  // P1: any REQUIRED clause matching nothing voids the lunr query).
  assert.deepStrictEqual(shape('a AND b AND c'), [
    [['b', REQUIRED, 'exact']],
  ], 'AND makes each neighbor required; the stopwords "a" (en) and "c" (fr) are dropped instead of voiding the query');
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
  // Quoted phrases — every word required and strict; stopwords are dropped
  // (the index removed them: keeping "de" would void the whole query).
  assert.deepStrictEqual(shape('"machine virtuelle"'), [[['machine', REQUIRED, 'exact'], ['virtuelle', REQUIRED, 'exact']]]);
  assert.deepStrictEqual(shape('"base de données"'), [[['base', REQUIRED, 'exact'], ['données', REQUIRED, 'exact']]],
    'the stopword "de" is dropped from the quoted phrase');
  assert.deepStrictEqual(shape('"access to the registry"'), [[['access', REQUIRED, 'exact'], ['registry', REQUIRED, 'exact']]],
    'English stopwords are dropped the same way');
  assert.strictEqual(parseQuery('"de la"'), null,
    'a phrase reduced to stopwords contributes nothing — fall back to the stock path');
  assert.deepStrictEqual(shape('"machine virtuelle" AND kubernetes'), [
    [['machine', REQUIRED, 'exact'], ['virtuelle', REQUIRED, 'exact'], ['kubernetes', REQUIRED, 'exact']],
  ]);
  // title: scopes to page titles and is strict by default.
  assert.deepStrictEqual(shape('title:registry'), [[['registry', REQUIRED, 'exact', 'title']]]);
  assert.strictEqual(parseQuery('title:registry').titleOnly, true);
  // Short tokens survive parsing — except REQUIRED stopwords: the index
  // removed them, so a REQUIRED stopword clause could never match (the
  // query would be voided); the parser drops it and falls back instead.
  assert.strictEqual(parseQuery('+a'), null,
    '"a" is a stopword — a REQUIRED "a" clause can never match, fall back to the stock path');
  assert.strictEqual(parseQuery('+de'), null, 'same for the French stopword "de"');
  assert.deepStrictEqual(shape('kubernetes AND de'), [[['kubernetes', REQUIRED, 'exact']]],
    'a required stopword bound by AND is dropped, not kept as a voiding clause');
  assert.deepStrictEqual(shape('k*'), [[['k', OPTIONAL, 'prefix']]]);
  // A prefix whose stem is too short keeps the raw form (same guard as the
  // plain path): "ds*" must not become "d*" over the whole corpus.
  assert.deepStrictEqual(shape('ds*'), [[['ds', OPTIONAL, 'prefix']]]);
  assert.deepStrictEqual(shape('template*'), [[['templat', OPTIONAL, 'prefix']]],
    'longer prefixes are still stemmed');  // A long multi-word query keeps every unit, in order.
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
  // Reviewer P2 pin — stopwords must never become lookup keys: "de" is a
  // word of "mot de passe", "base de données", "zone de disponibilité" and
  // "répartiteur de charge"; a "de" key fired 4 unrelated synonym queries on
  // nearly every French input.
  assert.deepStrictEqual(lookupSynonyms('de'), [], 'a stopword must not trigger any synonym group');
  assert.deepStrictEqual(buildSynonymQueries(['de']), [], 'no synonym query from a stopword token');
  // Reviewer P1 pin — hyphenated members are split like the index does.
  assert.ok(lookupSynonyms('feu').includes('firewall'), '"feu" (from "pare-feu") must hit the firewall group');
  assert.ok(lookupSynonyms('pare').includes('firewall'), '"pare" too');
  const firewall = buildSynonymQueries(['firewall']).find((q) => q.term.some((c) => c.value === 'pare'));
  assert.ok(firewall, '"pare-feu" must be proposed for "firewall"');
  assert.deepStrictEqual(firewall.term.filter((c) => c.presence === 2).map((c) => c.value), ['pare', 'feu'],
    'the hyphenated member runs as two required words, not one dead "pare-feu" clause');
  assert.ok(firewall.term.every((c) => !String(c.value).includes('-')), 'no clause value may carry a hyphen');
  // No required clause may carry a stopword — any of them would void the query.
  for (const query of buildSynonymQueries(['vm', 'password', 'database', 'security'])) {
    for (const clause of query.term.filter((c) => c.presence === 2)) {
      assert.notStrictEqual(['de', 'la', 'le', 'les', 'the', 'of'].includes(clause.value), true,
        `stopword "${clause.value}" must not survive as a REQUIRED clause`);
    }
  }
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
// Stemmed recall. lunr runs NO pipeline on wildcard clauses and the index
// stores STEMMED tokens, so a raw wildcard can only match stems at or longer
// than itself: the operator prefix "template*" could never reach the indexed
// stem "templat". The parser stems prefixes itself, and the plain path gains
// one stemmed union query on top of the stock recall (plain complete words
// already matched — their exact/fuzzy clauses run through the query
// pipeline). These tests run both against a replica of the production index
// pipeline (fold → French stemmer → English stemmer).
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

test('the stemmed query widens recall with the typed stems', { skip: !hasDeps && 'node_modules absent' }, () => {
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
// Reviewer P1/P2 regression — stopwords. The index pipeline removes them but
// the search pipeline does not: a REQUIRED clause on a removed word matches
// nothing and lunr voids the whole query. Quoted phrases and synonym members
// must therefore be split and stopword-filtered by the parser. The replica
// index below mirrors production (multiLanguage en+fr puts the stopword
// filters in the INDEX pipeline only).
// ---------------------------------------------------------------------------

test('quoted phrases and synonym members survive stopwords and hyphens', { skip: !hasDeps && 'node_modules absent' }, () => {
  const lunr = require(path.join(REPO_ROOT, 'node_modules', 'lunr'));
  require(path.join(REPO_ROOT, 'node_modules', 'lunr-languages', 'lunr.stemmer.support.js'))(lunr);
  require(path.join(REPO_ROOT, 'node_modules', 'lunr-languages', 'lunr.fr.js'))(lunr);
  require(path.join(REPO_ROOT, 'node_modules', 'lunr-languages', 'lunr.multi.js'))(lunr);
  const foldAccents = (token) => token.update((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  lunr.Pipeline.registerFunction(foldAccents, 'foldAccents');
  const index = lunr(function () {
    this.use(lunr.multiLanguage('en', 'fr'));
    this.pipeline.before(this.pipeline._stack[0], foldAccents);
    this.searchPipeline.before(this.searchPipeline._stack[0], foldAccents);
    this.ref('i');
    this.field('t');
    this.add({ i: '1', t: 'Créer une base de données managée dans votre espace' });
    this.add({ i: '2', t: 'Réinitialiser le mot de passe administrateur' });
    this.add({ i: '3', t: 'Configurer le pare-feu du cluster Kubernetes' });
    this.add({ i: '4', t: 'Access to the registry with a service account' });
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

  // Control arm documenting the voiding behavior: a REQUIRED clause on a
  // word the index removed matches nothing and kills the whole query.
  assert.deepStrictEqual(run([{ value: 'de', presence: 2, wildcard: 0 }]), [],
    'a REQUIRED "de" clause voids the query — this is why phrases must be stopword-filtered');

  const { parseQuery, buildSynonymQueries } = require(NUMSPOT_SEARCH);
  assert.deepStrictEqual(run(parseQuery('"base de données"').queries[0].term), ['1'],
    '"base de données" must run as base + données (was 0 results with the dead "de" clause)');
  assert.deepStrictEqual(run(parseQuery('"mot de passe"').queries[0].term), ['2'],
    '"mot de passe" must run as mot + passe');
  assert.deepStrictEqual(run(parseQuery('"pare-feu"').queries[0].term), ['3'],
    '"pare-feu" must run as pare + feu — the index tokenizes on the hyphen');
  assert.deepStrictEqual(run(parseQuery('"access to the registry"').queries[0].term), ['4'],
    'English stopwords ("to", "the") are dropped from the quoted phrase too');
  // The previously dead synonym members now find their French documents.
  const synonym = buildSynonymQueries(['password']).find((q) => q.term.some((c) => c.value === 'mot'));
  assert.ok(synonym, '"password" must propose "mot de passe"');
  assert.deepStrictEqual(run(synonym.term), ['2'],
    'the "mot de passe" synonym query finds its document (was dead with the "de" clause)');
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
