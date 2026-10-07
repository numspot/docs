# Contributing to the Numspot documentation

Thank you for helping improve the Numspot public documentation. This guide
covers the development setup, the writing standards and the review process.

## Development setup

Requirements: **Node 20+** and **Yarn 1.22+**.

```bash
yarn               # install dependencies
yarn start         # dev server with live reload -> http://localhost:3000
yarn typecheck     # TypeScript checks
yarn build         # production build (fails on broken links)
```

`yarn build` generates production content. Pass `--dev` to include pages
marked `draft: true`.

## Proposing a change

1. Open an issue describing the problem or the requested page.
2. Create a branch from `main`.
3. Make the change following the writing standards below.
4. Validate locally (see below) and open a merge request / pull request.
5. A member of the support team reviews and approves the change.

Questions and feedback on the documentation can also be sent to the
[Numspot support](mailto:support-client@numspot.com).

## Writing standards

### Language

The French content under `docs/docs/` is the source of truth. New pages are
written in French. English versions live under
`i18n/en/docusaurus-plugin-content-docs/current/` and mirror the French
structure — both versions must be updated together.

### File naming

- Lowercase, hyphen-separated (`create-snapshot.mdx`) — no underscores, no
  camelCase, no accented or special characters
- English names only, maximum 30 characters (excluding extension)
- No numeric prefixes for ordering — use `sidebar_position` in the frontmatter

### Headings

- `#` is reserved for the page title (exactly one per page)
- `##` for sections, `###` for subsections
- No bold text, no backticks and no emoji in headings

### Formatting

- **Bold** for Numspot console UI elements (e.g. **Create Instance**)
- Inline code for paths, parameters and technical terms
- Code blocks (with a language) for multi-line examples
- Maximum one admonition (`note`, `tip`, `info`, `warning`, `danger`) per
  `##` section
- Internal links use the full doc path without `.md` extension
  (e.g. `/compute/vms/quickstart`)
- Action pages (console/API procedures) use tabs, ordered
  `API` → `Console` → `Terraform`

### Terminology

Product names and terms follow the glossary in `consigns/glossary.json`.
The [compliance linter](linter/README.md) enforces this automatically.

### Changelog

Product or service changes require an entry in
`docs/docs/changelog.json` (French) and
`i18n/en/docusaurus-plugin-content-docs/current/docs/changelog.json`
(English), aligned in order and metadata. The changelog tracks product and
service changes only — not documentation site changes.

## Validation

Before requesting a review:

```bash
yarn lint:docs        # lint changed pages (score must be >= 90%)
node --test linter/tests/*.test.js   # linter unit tests
yarn typecheck
yarn build
```

The `lint:docs` CI job runs on every merge request and fails if a changed
page scores below 90%. The quality target for the open-source release is
92% or higher; pages below that target are being remediated.

## Review process

Every merge request is approved by a member of the support team, who checks
compliance with the rules above. Merges to the default branch trigger an
automatic production deployment.

## Yearly maintenance

Update the copyright year once a year, in January:

- `LICENSES/README.md` carries the only hand-maintained copyright statement
  in the repository (`Copyright (c) 20XX Numspot and contributors.`) — bump
  the year there.
- The site footer in `docusaurus.config.ts` computes the year at build time
  (`new Date().getFullYear()`) and needs no manual update.
- The root `LICENSE` file is the verbatim CC BY 4.0 text and intentionally
  carries no copyright line — do not edit it.
