# Search

The site search is powered by
[`@easyops-cn/docusaurus-search-local`](https://github.com/easyops-cn/docusaurus-search-local),
configured in the `themes` array of `docusaurus.config.ts`. It is entirely
self-hosted: no query ever leaves the visitor's browser, which is a hard
requirement for a sovereign cloud provider.

## Why it replaced `docusaurus-lunr-search` (DOC-6xx)

The previous engine was diagnosed in production with three distinct defects:

1. **No partial matching.** Lunr matched whole stemmed terms only, so a
   visitor typing `snap` or `clus` got "no results" and gave up before
   finishing the word — while `snapshot` and `cluster` returned 43 and 126
   results. This was the main reason the search felt broken.
2. **The input was disabled while the index loaded.** The swizzled search bar
   carried `disabled={!indexReady}` and only started loading on the first
   `requestIdleCallback` (5 s timeout), so the field refused keystrokes for
   several seconds on every full page load.
3. **The index was never cached.** It was served from the site root, and
   `container/nginx.conf` only set `Cache-Control` under `/assets/` — so
   3.5 MB of JSON were revalidated on every page load, then parsed and loaded
   into lunr **on the main thread**.

What the current engine does instead:

- queries carry leading/trailing wildcards plus an edit distance of 1, so
  `snap` finds `snapshot` and `kubernets` finds `kubernetes`;
- the index is fetched, parsed and queried inside a **web worker** — the main
  thread is never blocked and the input is usable immediately;
- the index is fetched **lazily**, on first hover or focus of the search
  field, not on page load;
- the file name carries a content hash and is cached immutably for a year
  (see the nginx rule below), so it is downloaded once.

## Query language (DOC-6xx)

The search input accepts a small query language. When the raw input carries
an operator, the stock "smart" query combinatorics are bypassed entirely and
the input is parsed into deterministic lunr clauses:

| Syntax | Meaning |
| --- | --- |
| `word` | optional match, prefix + edit distance 1 (the stock recall behavior) |
| `+word` / `AND` | required, strict: no wildcard, no fuzzy |
| `-word` / `NOT` | prohibited: matching documents are excluded from the results |
| `a OR b` | union — one lunr query per OR group |
| `"machine virtuelle"` | quoted phrase: every word required and strict (adjacency is NOT guaranteed — the index carries no token positions) |
| `word*` | required prefix (`snap*` finds `snapshot`) — the prefix is **stemmed** first, so `template*` also works (see below) |
| `word~2` | required with an explicit edit distance |
| `word*~2` | prefix wins, the edit distance is dropped (lunr honours one or the other, never both) |
| `title:word` | required, and the results are scoped to page-title documents |

Examples: `registry AND password`, `firewall OR vpn`,
`kubernetes NOT autoscaling`, `title:registry "access key" -deprecated`.

Precedence rules: `AND` binds its two neighbor units; `OR` splits the units
into independent queries; `-`/`NOT` units are global (applied to every OR
group); a query with no positive unit (`-foo` alone) falls back to the stock
smart path since lunr would match nothing. The `title:` scoping is an index
skip, not a lunr field: the plugin indexes five document types (title,
heading, description, keywords, content) and the worker simply skips the
non-title ones.

## Stemmed recall — why complete words match (DOC-6xx)

Lunr runs **no** search pipeline on wildcard clauses (see the comment in
`Index.query` in `node_modules/lunr/lunr.js`), while the index stores
**stemmed** tokens (`templates` → `templat`, `technical` → `technic`). Two
consequences, both fixed in `numspotSearch.js`:

1. **Operator prefixes are stemmed before the wildcard.** `template*` becomes
   the clause `templat*` — the raw `template*` pattern could only ever match
   tokens *longer* than itself, and indexed stems are shorter, so typing a
   complete word followed by `*` used to return zero results while shorter
   prefixes worked.
2. **Plain queries gain one stemmed union query.** The stock smart queries
   wildcard the *raw* token, which hits the same wall from the plain path: a
   complete word longer than its stem (`template`, `technica`) matched
   nothing while shorter prefixes worked. Every typed token is now stemmed
   through a replica of the index pipeline (fold → French stemmer → English
   stemmer) and matched as a trailing-wildcard prefix, concatenated before
   the synonym queries. Stems shorter than 3 characters skip the wildcard
   (the French stemmer can shrink `ds` to `d`, and a one-letter prefix would
   flood the results).

## Results page — cap and honest count

The results page lists at most `SEARCH_RESULT_LIMIT` (100) documents. When
the search reaches the cap, the label reads **« > 100 documents trouvés »**
("> 100 documents found") instead of the truncated exact count, so a capped
list is never presented as complete. The search bar dropdown keeps its own
smaller limit.

## Syntax popover — discoverability of the query language

The navbar search field gains a small **"?" button** (swizzle
`src/theme/SearchBar/index.tsx` wrapping the plugin's SearchBar), opening a
popover that lists the full grammar, one row per form — prefix and keyword
forms are kept apart since they read differently: `+word` (required, exact),
`a AND b` (both words), `a OR b` (either), `-word` (excluded), `NOT word`
(same as `-word`), `"quoted words"`, `prefix*`, `word~2`, `title:word` — plus
the accent-folding note and a worked example. It opens on hover like a
tooltip and pins on click/tap and keyboard focus (Esc or an outside click
closes it). All strings are localized through `i18n/fr/code.json`
(`theme.search.syntax.*`). A flat one-line hint on the /search results page
was tried first and replaced by this popover: the navbar sits on every page,
while the hint only existed where refined queries are typed.

## Semantic proximity — bilingual synonyms (DOC-6xx)

Plain queries (no operator) gain extra union queries: every typed token is
looked up in a curated FR/EN synonym map (`SYNONYM_GROUPS` inside
`numspotSearch.js` — vm ↔ machine virtuelle, backup ↔ sauvegarde, k8s ↔
kubernetes…) and each synonym phrase becomes one extra lunr query whose
words are required and ranked lower (`boost: 0.5`), so exact matches stay on
top. This gives FR visitors recall over English-slugged pages and the
reverse, without any network call.

The map is bounded on purpose (nouns only, ≤ 4 phrases per token, ≤ 6 extra
queries per search): each hit adds one worker query. Verbs are excluded —
the stemmers make them too noisy.

## Query-side patch files (DOC-604 + DOC-6xx)

| File | Role |
| --- | --- |
| `dist/client/client/theme/numspotSearch.js` | **New file**: the query-language parser, the stemmed-recall helper and the synonym map (CommonJS on purpose, so the linter tests can `require()` it from Node) |
| `dist/client/client/theme/worker.js` | Registers `foldAccents` client-side (DOC-604), parses the raw input, appends the stemmed query and the synonym queries, skips non-title indexes for `title:` |
| `dist/server/server/utils/buildIndex.js` | Registers `foldAccents` and prepends it to `pipeline` **and** `searchPipeline` |
| `dist/server/server/utils/getIndexHash.js` | Adds the plugin options, the patched builder **and the two query-side files** to the index hash |

## Accent-insensitive search (DOC-604)

Neither lunr nor `lunr-languages` folds diacritics: `réseau` is indexed
verbatim, so `reseau` finds nothing. Fuzzy matching absorbs **one** accent by
itself (`reseau` → `réseau`, edit distance 1) but not two — `securite` did not
find `sécurité`.

`patches/@easyops-cn+docusaurus-search-local+0.55.3.patch` therefore folds
accents at the head of the lunr pipelines, applied by `patch-package` on every
`yarn install`. It touches three files:

| File | Role |
| --- | --- |
| `dist/server/server/utils/buildIndex.js` | Registers `foldAccents` and prepends it to `pipeline` **and** `searchPipeline` |
| `dist/client/client/theme/worker.js` | Registers the same function client-side |
| `dist/server/server/utils/getIndexHash.js` | Adds the plugin options and the patched builder to the index hash |

The two first files are **coupled through the index itself**: the label
`foldAccents` is serialized into the index JSON (`pipeline:
["foldAccents","stemmer-fr","stemmer"]`) and replayed on query terms. Patch
the indexing side without the query side and `lunr.Pipeline.load` drops the
unknown label silently — the index is folded, the queries are not, and every
accented query returns zero results with no error anywhere.

`searchPipeline`, not `pipeline`, is the one serialized into the index and
replayed on query terms — both need the function.

## Caching — why the hash matters

`hashed: "filename"` puts a content hash in the file name
(`search-index-<hash>.json`), which lets nginx serve it with
`Cache-Control: public, max-age=31536000, immutable`. That rule is only safe
if the hash really changes whenever the index does, and upstream it covers
only the plugin version and the markdown files under `docsDir`. Two gaps were
closed:

- `docsDir: ["docs", "i18n"]` in the config, so an English-only translation
  change also busts the hash (the default `"docs"` ignores `i18n/`);
- the patch adds the plugin options and the patched index builder to the hash,
  so changing a search option or the patch itself produces a new file name.

Without those, a visitor could keep a stale index **for a year**.

## Tests

`yarn test` runs `linter/tests/search.test.js`, which:

- pins the applied state of the patch on both the indexing and the query side
  (a dependency bump that silently drops it fails loudly),
- functionally asserts the accent-folding invariant at the lunr level, with a
  control arm that fails if lunr ever starts folding on its own,
- asserts `docsRouteBasePath` mirrors the preset `routeBasePath` — they must
  match in docs-only mode, and a mismatch builds an **empty index without
  failing the build**,
- asserts the nginx immutable rule exists and matches the hashing mode,
- pins the parser clause shapes for every operator, every combination and the
  degenerate inputs (empty, prohibition-only, keywords alone),
- runs the stemmed-recall regression (`template`, `technica`, complete words
  longer than their stem) against a replica of the production index
  pipeline, with a control arm documenting the raw-wildcard lunr behavior the
  fix works around,
- pins the results-page cap and the "> N documents found" truncation label.

The tests skip gracefully when `node_modules` is absent (the zero-dependency
linter CI job); they run for real locally and anywhere a `yarn install`
happened.

## Regenerating the patch

Edit the files under `node_modules/@easyops-cn/docusaurus-search-local/`, then:

```bash
npx patch-package @easyops-cn/docusaurus-search-local
```

Commit the updated file under `patches/` in the same change, and rebuild —
the index hash changes with the patch, which is the intended behaviour.
