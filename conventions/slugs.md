# Convention — Slugs & SEO preservation

## Policy: slugs are in English

> **All slugs (URLs) are in English, in every locale — FR included.**
> The English version of the slug takes precedence and is the one displayed.

This rule is **retroactive**: pages already published under a non-English slug
must adopt an English slug (the old slug being kept as a redirect, see below).
Example: the "Plateforme IA Mistral" service has the slug `mistral-ai-platform`
in FR **and** EN; the old `plateforme-ia-mistral` stays alive as a redirect.

> **Why FR too?** Slugs are stable technical identifiers, not content: we
> standardize them in English for consistency, inbound links and cross-locale
> sharing. The **content** of the FR page obviously stays in French; only the
> URL is English.

This rule is enforced by the linter (`linter/rules/english-slugs.js`, code
`i18n:non_english_slug`): it flags any slug — explicit or derived from the file
path — that contains a French word.

## The SEO non-regression rule

> **Never break an already-published URL.** When you rename a page's slug, the
> **old URL must keep responding** — via a **non-indexed (`noindex`) redirect**
> to the new URL.

In other words, an old slug (even a French or incorrect one) does not disappear:
it becomes a permanent redirect to the new slug, but **stops being public**
(it is no longer indexed as a full page by search engines).

### Why

- **SEO**: URLs indexed by Google, cited in articles, bookmarks or inbound
  links must not return a 404. A redirect preserves the "SEO juice" and the
  user experience.
- **`noindex`**: we don't want the old and the new URL to both be indexed
  (duplicate content). The old one redirects and carries `noindex, follow`; a
  `<link rel="canonical">` points to the new one, which remains the only
  indexable page.

## How to apply it

### 1. Fix the slug

A page's slug comes from its **file path** (there is no prefixed `routeBasePath`:
`routeBasePath: "/"`, but the `docs/docs/…` tree adds the `/docs/` segment). To
give a page a different URL **without renaming the file** (mandatory for i18n:
the file path must stay identical across locales to link a translation to its
source), add a `slug:` in the frontmatter:

```yaml
---
title: "Mistral AI Platform - Concepts"
slug: /docs/managed-services/mistral-ai-platform/concepts
---
```

> **i18n**: the `slug` is read **per locale**. Setting an English `slug` in the
> `i18n/fr/…` file changes **only** the French URL; the English version keeps
> its French slug. This is the case for `plateforme-ia-mistral` (FR) →
> `mistral-ai-platform` (EN): the product is called "Plateforme IA Mistral" in
> French and "Mistral AI Platform" in English.

Remember to update the **internal links** that pointed to the old slug (the
build fails otherwise: `onBrokenLinks: "throw"`).

### 2. Register the old slug for the redirect

Add the `[old-slug, new-slug]` pair to **`src/plugins/slug-redirects.js`**:

```js
const SLUG_RENAMES = [
  ["plateforme-ia-mistral", "mistral-ai-platform"],
  // ["old-slug", "new-slug"], ← add here
];
```

That's it. At build time, for each page actually generated under the **new**
slug, the plugin automatically creates the twin page under the **old** slug
with a `noindex` redirect stub to the new URL.

The mapping is done **per slug segment**: it only activates in the locale(s)
where the new slug actually exists. An English new slug that exists only in EN
therefore never touches the FR pages (no collision).

## Verify

```bash
yarn build
# → expected log: [slug-redirects] N redirection(s) noindex générée(s) (anciens slugs).

# The old URL is a noindex redirect:
cat build/en/docs/managed-services/plateforme-ia-mistral/concepts/index.html
#   <meta name="robots" content="noindex, follow">
#   <meta http-equiv="refresh" content="0; url=/en/docs/managed-services/mistral-ai-platform/concepts/">

# The new URL is a real page; the FR version stays unchanged and indexable.
```

## What not to do

- ❌ Delete or rename a published page file **without** registering the old slug
  in `SLUG_RENAMES` → 404 and SEO loss.
- ❌ Add the old slug as a real page (indexed duplicate content).
- ❌ Rename the **file/folder** of a translated page to change its URL: this
  breaks the i18n link with the source. Use `slug:` in the frontmatter instead.
