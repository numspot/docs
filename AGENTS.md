# Numspot Documentation - AGENTS.md

> **Single source of truth for all AI coding agents** (Claude Code, Cursor, Copilot, Gemini CLI, …) **and human contributors**.
> Session problems & solutions live in `PROBLEMS.md`, decisions in `DECISIONS.md` — see "Session Knowledge Base" below.

## Project Overview

Public documentation website for Numspot, a sovereign cloud provider. Built with [Docusaurus](https://docusaurus.io/).

## Tech Stack

- **Framework**: Docusaurus 3.10
- **Language**: TypeScript
- **Node**: >=18.0 (recommended: Node 20+, see `.nvmrc`)
- **Package Manager**: Yarn 1.22+
- **Content**: English documentation at the root (published as `en-GB`); French versions under `i18n/fr/`

## Essential Commands

```bash
# Install dependencies
yarn

# Development server with live reload (http://localhost:3000)
yarn start

# Build for production
yarn build

# Type checking
yarn typecheck

# Clear build cache
yarn clear

# Serve production build locally
yarn serve

# Lint changed documentation files
yarn lint:docs

# Linter regression tests
yarn test
```

## Project Structure

```
/
├── docs/                    # Main documentation folder
│   └── docs/               # All doc files (.md, .mdx)
│       ├── home.mdx        # Homepage
│       ├── terraform/      # Terraform guides
│       ├── connectivity/   # VPN & networking docs
│       └── changelog.json  # Changelog entries (FR, source of truth)
├── consigns/                # Normative reference files (standards, glossary…)
├── conventions/             # Operational deep-dives (slugs…)
├── linter/                  # Documentation compliance linter
├── src/                     # React components & CSS
│   └── css/
│       ├── custom.css
│       └── changelog.css
├── static/                  # Static assets
│   └── img/
├── i18n/                    # Internationalization (fr, en-GB)
├── patches/                 # patch-package patches
├── docusaurus.config.ts     # Main configuration
└── sidebars.ts              # Sidebar navigation
```

## Documentation Rules

### File Naming

- Use hyphens (-) as separators (no underscores, no camelCase)
- Lowercase only
- No special characters (!, @, #, $, etc.)
- No accented characters (é, ç, à, etc.)
- Max 30 characters per filename (excluding extension)
- English names only
- No numeric prefixes for ordering — use `sidebar_position` in frontmatter instead

### Header Structure

- H1 (`#`) reserved for page titles
- H2 (`##`) for section headers
- H3 (`###`) for subsections
- **No bold text in headers**
- The frontmatter `title` MAY differ from the visible H1 for SEO purposes (e.g. a descriptive `Catégorie - <nom>` title that deduplicates the HTML `<title>` while the H1 stays short). The linter does not require `title == H1`.
- The `description` frontmatter key is the meta description. `metaTitle` and `metaDescription` are **forbidden** (dead keys Docusaurus ignores — decision D-015): put the HTML `<title>` in `title` (adding `sidebar_label` when it differs from the sidebar text) and the meta description in `description`. Reappearance is linted as `structural:forbidden_meta` (high).

## Prohibited URLs

- **Never include links to private or internal Numspot systems** (internal version-control instances, internal wikis, ticket trackers, ops dashboards) in any documentation file.
- Always use either public-facing Numspot URLs or official upstream vendor docs.

## URL Slug Rules

- **URLs must NEVER contain accented characters** (e.g. `é`, `è`, `ê`, `à`, `ç`, `ù`, etc.). Docusaurus generates URL slugs from directory names and `_category_.json` labels. If a label contains accents, you MUST set an explicit `slug` in the `_category_.json` `link` object to override the auto-generated slug with an accent-free version (e.g. `"slug": "reversibilite"` instead of the default `réversibilité`).

### Deleting pages

A documentation page must never be deleted without both of the following — enforced by `linter/tests/page-deletion.test.js` on the PR diff (decision D-021):

1. **A redirect** for the old URL (SEO: already-indexed and shared URLs must keep answering with a `noindex` redirect to a relevant still-existing page). Register `["old/route/path", "target/route/path"]` in `DELETED_PAGES` (`src/plugins/slug-redirects.js`). Slug *renames* use `SLUG_RENAMES` in the same file instead.
2. **A changelog entry** with `status: "removed"`, dated, in both FR and EN, referencing the page (its title or its slug's last segment).

### Content Formatting

- **Bold** for Numspot console UI elements (e.g., **Create Instance**)
- `inline code` for paths, parameters, technical terms
- Code blocks for multi-line code examples

### Admonitions

- Types: `note`, `tip`, `info`, `warning`, `danger`
- **Maximum one admonition per H2 section**

### Review Date (last update)

Every documentation page (except the homepage) displays its review date right under the H1 — "Mise à jour le <date>" (FR) / "Reviewed on <date>" (EN, US format). It is rendered by the theme from the `last_update.date` frontmatter; **never write the date line in the page body**.

- Every page carries `last_update: { date: YYYY-MM-DD }` in frontmatter. New pages: mandatory. Changed pages: refresh the date to the day of the revision — the linter fails otherwise.
- Pages never touched since the rule was introduced fall back to their last git commit date (automatic).
- Full rule: `consigns/standards.md` → "Date de mise à jour"; enforcement: `linter/tests/last-updated-date.test.js`. Decision: D-017.

## Changelog Updates

**The changelog tracks product and service changes only.** It tells end users what is new or different in the products and services Numspot documents — not what happened inside the docs project. Read the rules below at the start of every session before touching `changelog.json`.

### ✅ Changes that REQUIRE a changelog entry (product / service scope)

Add an entry when the change affects what users can do or read about a product or service:

- new service, product feature, or product capability documented
- page added, modified, or deleted for a product/service (actions, guides, concepts, API references)
- section added, modified, or deleted that changes product facts
- product or service renamed
- content corrections that change what users read about a product (wrong values, wrong names, wrong endpoints, wrong limits)

### ❌ Changes that MUST NOT get a changelog entry

Neither tooling nor site/UI/meta changes — even though both "touch the docs":

- linter rules, linter tests, linter fixes (`linter/`)
- CI configuration (`.github/workflows/`, security/scanning workflows)
- build configuration, dependencies, dependency bumps
- i18n infrastructure (translation plumbing, `code.json` keys, footer/menu framework strings)
- internal scripts, agent instructions (AGENTS.md, agent skills), redirects plumbing
- documentation-site UI and cosmetics: footer, feedback widget, theme, layout, navigation polish
- meta announcements about the documentation itself (e.g. "an English version is now available") and translation-completion notes

**Rule of thumb:** the changelog answers "what changed in the products/services?", not "what changed in the docs project?".

### Timing — one entry per Pull Request, when pages go public

Changelog entries land **when the affected pages become public on `main`** — not at each intermediate commit. In practice:

- write the changelog entry **in the PR that ships the change**, as one consolidated entry (or a few, if the PR touches several products)
- do not add one entry per unit commit: multiple commits of the same PR describe a single change
- if the PR is rebased or squashed, keep the entry consistent with what actually lands on `main`

### How to add an entry

Edit **both** files in the same commit, keeping them ISO (same entries, same order, same `date`/`status`/`components`; only `title`, `description` and translated `service` names differ):

- English (source of truth): `docs/docs/changelog.json`
- French: `i18n/fr/docusaurus-plugin-content-docs/current/docs/changelog.json`

```json
{
  "service": "Compute",
  "status": "added|changed|deprecated|fixed|removed|security",
  "date": "2025-08-06",
  "title": "New feature",
  "description": "Description of the change",
  "components": ["api", "console"]
}
```

FR/EN alignment is enforced by `linter/tests/changelog-sync.test.js` (runs in the linter regression tests CI job): a missing, misplaced or untranslated entry fails the pipeline. Service names must be registered in its `SERVICE_TRANSLATIONS` map when a new service appears.

Both files must stay in the **canonical JSON serialization** (`JSON.stringify(parsed, null, 2) + "\n"` — 2-space indent, scalar arrays inlined). Reformatting between styles is linted as a failure by `linter/tests/changelog-format.test.js` (decision D-020); fix with `node linter/tests/changelog-format.test.js --fix`.

## Session Knowledge Base

Problems encountered in past sessions and the decisions taken along the way are **not** documented here — they live in dedicated files so this one stays lean:

- **`PROBLEMS.md`** — recurring session problems with their fixes and automated guards (`linter/tests/*`, run in CI), plus the non-lintable rules (branching, secret detection, one commit per PR).
- **`DECISIONS.md`** — dated log of decisions taken across sessions (what & why), referenced from the relevant rules.

**Read both at session start when relevant to your task.** When a session detects a problem: add an automated guard if it is lintable, otherwise log it in `PROBLEMS.md`. When a lasting decision is taken: log it in `DECISIONS.md`.

### Reference files — what they are and when they change

The `consigns/` directory holds the **normative** reference files the linter, the skills and this rulebook apply — they change only through a deliberate standard, never to patch a one-off session incident:

- **`consigns/standards.md`** — the writing standards (titles, tone, terminology, backticks, tabs, slugs, structure…). Edit it **only when a new writing rule is adopted** (user decision — log it in `DECISIONS.md`), then update the matching linter rule(s) and the affected pages. Session problems never edit it directly.
- **`consigns/glossary.json`** — official terminology. Edit when a term's official form changes or a wrong form is identified (with a `DECISIONS.md` entry when it is a real naming choice, e.g. D-003).
- **`consigns/tone_of_voice.json`**, **`consigns/golden_page_actions.mdx`** — tone and the reference action page (English model; mirror its structure for FR pages); edit only through a logged decision.
- **`PROBLEMS.md`** / **`DECISIONS.md`** — session knowledge (see above).

### Conventions directory — `conventions/`

The `conventions/` directory holds the **operational deep-dives** for transverse technical topics (how-to: rule → why, with a pointer to its `DECISIONS.md` entry → step-by-step → linter enforcement). They are contributor-facing documentation, referenced by the code itself:

- **`conventions/slugs.md`** — slugs are English in every locale, and a renamed or deleted slug keeps answering through a `noindex` redirect (`SLUG_RENAMES` / `DELETED_PAGES` in `src/plugins/slug-redirects.js`). Referenced by `docusaurus.config.ts`, `linter/rules/english-slugs.js` and the plugin itself. Enforced by `i18n:non_english_slug`.

A convention earns its own file there only when it is referenced by code/tools, needed by external contributors, or too long for this rulebook (> ~30 lines) — otherwise it stays a section here. The *decision* behind each convention is logged in `DECISIONS.md`; the file carries the *how-to*.

## Git Workflow

1. Create a branch from `main`
2. Make changes following the documentation rules
3. Open a Pull Request
4. CI runs GitHub Actions: documentation lint, linter regression tests, typecheck and build
5. After review approval, merge to `main` — production deployment is then triggered manually from the internal CI (GitLab)

One commit per Pull Request — squash as you go: see `PROBLEMS.md`.

### SHAs — always copied from tool output, then verified

Commit SHAs referenced anywhere (PR notes, issue-tracker comments, summaries, replies) must come from a tool output — `git log`/`git rev-parse`, the GitHub API responses, workflow run listings — never reconstructed or abbreviated from memory:

- **Copy, don't type**: take the SHA string from the tool output of the command that produced it. A short form (`de28c9c3`) is only ever an abbreviation of a SHA seen in a tool result.
- **Verify before citing**: run `git rev-parse --verify <sha>^{commit}` (or re-fetch the object via the API) and, when the claim is "this is the branch/PR head", compare against `git rev-parse HEAD` and `git rev-parse origin/<branch>`. A wrong or stale SHA in a review note sends reviewers to the wrong state.
- **Remote SHAs** (PR head, workflow sha): re-fetch the PR/branch from GitHub rather than reusing a value from an earlier call in the session — pushes and merges make them stale.

### Commit Messages (Semver)

All commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/) with semver-impacting prefixes:

- `feat:` → minor version bump (new feature or service)
- `fix:` → patch version bump (bug fix, typo, broken link)
- `feat!:` or `BREAKING CHANGE:` in footer → major version bump
- `docs:` → documentation-only changes (no version bump)
- `chore:`, `ci:`, `refactor:`, `style:`, `test:` → no version bump

Format: `<type>(<scope>): <description>`

Examples:

- `feat(compute): add GPU instance documentation`
- `fix(connectivity): correct VPN endpoint URL`
- `feat!(storage): restructure object storage API docs`

### Pull Request Language

**PR titles and descriptions are written in US English** — spelling
(`color`, `behavior`, `initialize`), dates and terminology included.

This is the review surface: it is what a reviewer sees first, what search and
notifications carry, and the first artifact an external contributor reads. It
stays English even when the branch only touches French content.

Note the deliberate contrast with the documentation itself: the published
English site is **UK English** (`htmlLang: "en-GB"`, see `docusaurus.config.ts`
and the i18n direction). Project metadata is US English, published content is
UK English — do not align one on the other.

## Testing

After making changes:

1. Run `yarn start` to preview locally
2. Run `yarn typecheck` to verify TypeScript
3. Run `yarn lint:docs` to check compliance
4. Check for broken links (Docusaurus throws on broken links)
5. Verify admonition count per H2 section
6. Ensure file naming follows rules

## Doc Compliance Linter

A static linter validates documentation pages against the Numspot glossary and writing standards. It runs in CI on every pull request and push to `main`.

### Commands

| Command                                                   | Purpose                             |
| --------------------------------------------------------- | ----------------------------------- |
| `yarn lint:docs`                                          | Lint only files changed vs `main`   |
| `yarn lint:docs:ci`                                       | Same, with non-zero exit on failure |
| `yarn lint:docs:all`                                      | Lint all docs                       |
| `node linter/cli.js --diff main`                          | Lint only changed files vs `main`   |
| `node linter/cli.js --diff HEAD~3`                        | Lint changed files vs 3 commits ago |
| `node linter/cli.js docs/docs/compute/vms/quickstart.mdx` | Lint a single file                  |
| `node linter/cli.js docs/docs/ --json`                    | JSON output for tooling             |

The glossary is auto-detected at `consigns/glossary.json`. Override with `--glossary <path>`.

### Scoring

- Start at 100, minus penalties per violation (high: -13, medium: -8, low: -3)
- Compliant ≥ 90%
- CI fails if any file scores below 90%

### Covered Rules

| Code                                  | Severity | Description                                                                                                                                         |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standard:heading_backticks`          | Medium   | No backticks in headings                                                                                                                            |
| `standard:heading_bold`               | Medium   | No bold text in headings                                                                                                                            |
| `glossary:acronym_plural`             | Medium   | Acronyms must not take an 's' (e.g., "VMs" → "VM"); skipped inside URLs/paths                                                                       |
| `standard:resource_backticks_invalid` | Medium   | Glossary terms must not be in backticks — except literal values in a backticked comma-separated enumeration (e.g. `` `compute`, `connectivity`… ``) |
| `standard:resource_link_missing`      | Medium   | A resource type must link to its concept page at least once (dedup by `concept_page`; links/inline code not counted)                                |
| `structural:missing_tabs`             | High     | Action pages must have tabs                                                                                                                         |
| `structural:incomplete_tab`           | Medium   | Each tab must have content                                                                                                                          |
| `structural:tab_order`                | Low      | Tabs must follow standard order                                                                                                                     |
| `structural:missing_heading`          | High     | Page must have exactly one H1 (`#` lines in code blocks ignored)                                                                                    |
| `structural:empty_category`           | High     | A directory with a `_category_.json` must contain at least one documentation page (or subdirectory)                                                 |
| `structural:duplicate_title`          | Low      | Title identical to H1 (ignored — Docusaurus expects this)                                                                                           |
| `structural:code_block_lang`          | Low      | Code blocks must specify a language                                                                                                                 |
| `structural:duplicate_description`    | Medium   | Meta description must not duplicate title/first paragraph                                                                                           |
| `structural:forbidden_meta`           | High     | Dead frontmatter keys `metaTitle`/`metaDescription` are forbidden (decision D-015) — use `title`/`description`                                      |
| `glossary:terminology`                | Medium   | Wrong glossary term form                                                                                                                            |
| `tone:emoji`                          | Low      | No emoji characters                                                                                                                                 |

### CI Behavior

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and push to `main`, with three jobs:

- **`lint`** — on pull requests, only files changed vs `main` are linted (`node linter/cli.js --diff origin/main --ci`); on pushes to `main`, all documentation files are linted (English and French trees). No `yarn install` is needed — the linter has zero external dependencies.
- **`tests`** — the linter regression tests (`node --test linter/tests/*.test.js`).
- **`build`** — `yarn install --frozen-lockfile`, then `yarn typecheck` and `yarn build`.

- **Partials** (files/directories whose name starts with `_`, e.g. `_components/`, `_quickstart.mdx`) are excluded from linting, since Docusaurus excludes them from routing.

The `lint` job fails (non-zero exit) if any documentation file scores below 90%.

### Adding Rules

Create a file in `linter/rules/` exporting `check(content, frontmatter, glossaryIndex, pageType, filePath)` returning an array of violation objects. Register it in `linter/index.js`. See `linter/README.md` for details.

## Sidebar Menu Ordering — Highlight + Alphabetical

Sidebar levels 0 (top sections) and 1 (their direct children) are ordered at
build time by `src/components/sidebar-order.js`, consumed by the
`sidebarItemsGenerator` override in `docusaurus.config.ts` (decision D-019):

1. **Highlighted entries first**, then **alphabetical** (collator pinned to
   `fr` for deterministic builds).
2. To highlight an entry, add its key to `HIGHLIGHTED_SIDEBAR_ENTRIES` —
   level 0: `"terraform"`, level 1: `"compute/vms"`. Keys are locale-stable
   paths below the docs root. Current highlights: Terraform and Services
   Managés (level 0); every top-level "Concepts" entry, Kubernetes and VM
   (level 1) — see the module. OpenAPI is pinned first by `sidebars.ts`
   (highlighting it would be a no-op) and its "Global" child is ordered
   manually in `sidebars.ts`.
3. Visual groups ("Ressources & outils", "Nos services", "Management &
   gouvernance") stay contiguous blocks, sorted internally. Accueil and
   OpenAPI are pinned (explicit `sidebars.ts` items).
4. Levels ≥ 2 keep their `sidebar_position` ordering — the managed-services
   in-service structure (Concepts → Actions → Guides → Versions et
   lifecycle) is preserved that way. At level 1, `managed-services/*` sorts
   like every other section; the mandated first position of its "Concepts"
   entry is kept by highlighting `managed-services/concepts`. The suite
   `linter/tests/sidebar-order.test.js` guards all of this.

## Managed Services — Mandatory Menu Structure

The following sidebar menu structure is **mandatory** for all managed services (Kubernetes, PostgreSQL, Container Registry, Secret Manager, …). The order below must be strictly respected:

```
Services Managés
  Concepts                    ← managed-services/concepts.mdx
  <Service>                   ← managed-services/<service>/_category_.json
    Concepts                  ← managed-services/<service>/concepts.mdx       (position: 1)
    Actions/                  ← managed-services/<service>/actions/           (position: 2)
      Action1                 ← pages with API/Console/Terraform tabs
      Action2
    Guides/                   ← managed-services/<service>/guides/            (position: 3)
      Guide1                  ← informational pages, no Numspot API action
      Guide2
    Versions et lifecycle     ← managed-services/<service>/supported-versions.mdx (position: 4)
```

### Rules

1. **Concepts** must always be the first item under a service (position: 1).
2. **Actions** must always be the second item (position: 2). Only pages that describe an action achievable via the **Numspot API**, the **Numspot Console**, or the **Numspot Terraform Provider** (i.e. pages with `<Tabs>` containing `api`/`console`/`terraform` tab items) may reside in Actions.
3. **Guides** must always be the third item (position: 3). Pages that are informational, best-practice, or tutorial in nature — with no direct Numspot API/Console/Terraform action — must be placed in Guides. If a page currently lives in Actions but has no Numspot API/Console/Terraform action, it must be moved to Guides.
4. **Versions et lifecycle** must always be the fifth and last item (position: 5). This is the `supported-versions.mdx` file with `sidebar_label: "Versions et lifecycle"`.

### Creating a new managed service

When adding a new managed service, you must create the full structure: `concepts.mdx`, `actions/` (with `_category_.json`), `guides/` (with `_category_.json`), `reversibility.mdx`, and `supported-versions.mdx`. Follow the position values above.

### Adding a new page to a managed service

- If the page documents a Numspot API/Console/Terraform action → place in `actions/`.
- If the page is a guide, tutorial, best practice, or informational → place in `guides/`.
- Never place loose `.mdx` files at the service root (except `concepts.mdx`, `reversibility.mdx`, `supported-versions.mdx`).

## Source Comment Language

The dividing line is **who reads the comment**, not which file it lives in.

- **A visitor reads it in the rendered page** → same language as the page
  (French on FR pages, English on EN pages). This is content: it is governed by
  `consigns/standards.md` ("Commentaires de code") and enforced by the linter.
  In practice this means comments inside the fenced code blocks of a `.md`/
  `.mdx` page, which the reader sees on screen.
- **Only a maintainer reads it** → **US English**, everywhere, whatever the
  file extension: `src/**` (components, CSS, client modules, plugins),
  `docusaurus.config.ts`, `sidebars.ts`, `.github/workflows/**`, `linter/**`,
  `patches/**`, and the comments of a `.md`/`.mdx` page that are **not**
  rendered — `{/* … */}` and `<!-- … -->`.

Two consequences inside documentation pages, both already linted:

- maintainer meta markers (`TODO`, `FIXME`, `NOTE`, `HACK`, `XXX`) stay English
  even in a French code block — they are engineering artifacts, grepped across
  git history (`i18n:french_meta_comment`);
- a reader-facing comment such as `# Créer le bucket` on an FR page stays
  French — it reads as prose and the visitor sees it.

**Quoting is not writing.** A US English comment may quote French terms,
content or identifiers when that is what it is about — `linter/rules/` does it
constantly (`e-santé`, `<nom_région>`, `« réseau » is indexed verbatim`). Do
not mangle a quoted term to avoid an accent.

## Boy Scout Rule

Always leave the codebase better than you found it. When editing a file, fix any nearby linter violations, typos, or obvious issues even if they are not part of your current task. This applies to documentation files, configuration, and code. Do not leave known problems behind just because they were there before.

## Support — Réversibilité Menu Structure

The **Support** section contains a **Réversibilité** submenu (`support/reversibility/`) with the following mandatory structure:

```
Support
  Réversibilité/               ← support/reversibility/_category_.json
    Politique générale         ← support/reversibility/global-reversibility-policy.mdx (position: 1)
    <Service>                  ← support/reversibility/<service>.mdx (position: 2+)
```

### Rules

1. The **Politique générale de réversibilité** must always be the first item (position: 1). It describes the overall reversibility principles of Numspot.
2. Service-specific reversibility pages follow, ordered by service name. Each page is named after the service (e.g., `kubernetes.mdx`, `postgresql.mdx`, `registry.mdx`, `secret-manager.mdx`).
3. When adding a new managed service, create both the redirect stub at `managed-services/<service>/reversibility.mdx` and the full reversibility page at `support/reversibility/<service>.mdx`.

## Important Notes

- **Do not force fix package issues** - can break Docusaurus features
- `yarn build` creates production content; use `--dev` flag to include draft docs
- Production deployment is triggered manually from the internal CI (GitLab "Run pipeline") — merging does not deploy by itself

## Common Issues

### Build Failure

- Check for broken links in console output
- Verify all MDX syntax is correct
- Run `yarn typecheck` for TypeScript errors

### Development Server Won't Start

- Clear cache: `yarn clear`
- Delete `node_modules` and reinstall: `rm -rf node_modules && yarn`

### Broken Links

- Docusaurus throws on broken links by default
- Check internal links format: `[text](/path/to/doc)` (no `.md` extension)
