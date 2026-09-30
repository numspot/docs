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
- asserts the nginx immutable rule exists and matches the hashing mode.

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
