# Doc Compliance Linter

A static linter that validates Numspot documentation pages against the glossary, writing standards, and structural rules. Runs in CI on every merge request and push to `main`.

**Zero external dependencies** — pure vanilla Node.js, no `npm install` required.

## Usage

```bash
# Lint only changed files (vs main branch)
node linter/cli.js --diff main

# Lint all documentation files
node linter/cli.js docs/docs/

# Lint a single file
node linter/cli.js docs/docs/compute/vms/quickstart.mdx

# Lint with explicit page type
node linter/cli.js docs/docs/compute/vms/create.mdx --type action

# JSON output (for tooling integration)
node linter/cli.js docs/docs/ --json

# CI mode — exits with code 1 if any file is non-compliant
node linter/cli.js docs/docs/ --ci
```

### Options

| Flag | Description |
|---|---|
| `--diff <ref>` | Lint only markdown files changed vs `<ref>` (branch, tag, or commit SHA). Filters to `docs/docs/*.md(x)` only |
| `--type <action\|concept>` | Override page type detection (default: auto-detected from file path — `actions/` = action) |
| `--glossary <path>` | Path to `glossary.json` (default: `consigns/glossary.json`) |
| `--json` | Output results as JSON |
| `--ci` | Exit with code 1 if any file scores below compliance threshold |
| `--help` | Show help |

## Scoring

Each page starts at **100**. Violations deduct points based on severity:

| Severity | Penalty |
|---|---|
| High | -13 |
| Medium | -8 |
| Low | -3 |

A page is **compliant** if its score is **≥ 90%**.

In CI mode, the pipeline fails if any file is non-compliant.

## Rules

| Code | Severity | Description |
|---|---|---|
| `standard:heading_backticks` | Medium | No backticks in headings |
| `standard:heading_bold` | Medium | No bold text in headings |
| `glossary:acronym_plural` | Medium | Acronyms must not take an 's' (e.g., "VMs" → "VM"). Skipped inside URLs/paths (e.g. the `VPCs/` segment of an image path) and for malformed no-op entries |
| `standard:resource_backticks_invalid` | Medium | Glossary terms must not be in backticks — **except** when the term is a literal value in a backticked, comma-separated enumeration (e.g. accepted API values `` `compute`, `connectivity`… ``) |
| `standard:resource_link_missing` | Medium | A resource type must link to its concept page at least once. Satisfied as soon as the concept page is linked by **any** synonym (dedup by `concept_page`); occurrences inside markdown links or inline code are not counted |
| `structural:missing_tabs` | High | Action pages must have tabs (Console, Terraform, API) |
| `structural:incomplete_tab` | Medium | Each tab must have content |
| `structural:tab_order` | Low | Tabs must follow the standard order |
| `structural:missing_heading` | High | Page must have exactly one H1 heading (`#` lines inside fenced code blocks are not counted) |
| `structural:duplicate_title` | Low | Frontmatter title identical to H1 (informational, ignored) |
| `structural:code_block_lang` | Low | Code blocks must specify a language |
| `structural:duplicate_description` | Medium | Meta description must not duplicate title or first paragraph |
| `structural:forbidden_meta` | High | Dead frontmatter keys `metaTitle` / `metaDescription` are forbidden (decision D-015) — use `title` for the HTML `<title>` and `description` for the meta description |
| `glossary:terminology` | Medium | Wrong glossary term form (e.g., "Compute" → "compute") |
| `tone:emoji` | Low | No emoji characters in documentation |

### Ignored rules

`structural:duplicate_title` is marked as ignored — it is informational only and does not affect the score. (The former `structural:title_h1_mismatch` rule was removed: the SEO strategy uses descriptive frontmatter titles that intentionally differ from the H1 to deduplicate the HTML `<title>`.)

### False positive filtering

The `glossary:terminology` rule applies aggressive false-positive filtering to avoid flagging:

- Terms inside code blocks or inline code
- Terms inside image alt text
- Terms inside URLs and link paths
- Terms inside bold console labels (e.g., **Compute** → **VMs**)
- Terms in quoted console field labels
- Terms after French UI indicators (liste déroulante, champ, bouton, etc.)
- Terms that are part of compound product names (e.g., "Compute Bridge", "Internet Gateway")
- Terms in acronym expansions in parentheses (e.g., "VPC (Virtual Private Cloud)")
- Terms at the start of a sentence with only a capitalization difference — including the start of a line, a list item (`-`, `*`, `+`, `1.`), a blockquote (`>`), a table cell (`|`), or just after a colon (`:`)
- Terms with uppercase acronyms in compound words (e.g., "NAT gateway")

Other rules also apply targeted exceptions:

- **`standard:resource_backticks_invalid`** skips a backticked term that belongs to a comma-separated list of backticked values (a literal enumeration of API values, e.g. `` `compute`, `connectivity`, `kubernetes` ``), where backticks are legitimate.
- **`standard:resource_link_missing`** treats a resource type as covered once its `concept_page` is linked at least once anywhere on the page (so synonyms such as "VM" / "virtual machine" pointing to the same page need only one link), and never counts occurrences that sit inside a markdown link or an inline code span.
- **`glossary:acronym_plural`** ignores occurrences inside URLs/paths (e.g. a `VPCs/` directory segment in an image path) and any malformed entry whose singular equals its plural.

### Scope

Files and directories whose name starts with `_` are **partials/includes** in Docusaurus (excluded from routing), so the linter skips them too — both in `--diff` mode and when walking a directory.

## CI Integration

The linter runs as a GitHub Actions job (`.github/workflows/ci.yml`). On pull requests, it only checks files changed in the PR (diffed against `origin/main`). On pushes to `main`, it checks all files — both the French and English trees:

```yaml
- name: Lint changed pages
  if: github.event_name == 'pull_request'
  run: node linter/cli.js --diff origin/main --ci
- name: Lint every page
  if: github.event_name == 'push'
  run: |
    node linter/cli.js docs/docs/ --ci
    node linter/cli.js i18n/fr/docusaurus-plugin-content-docs/current/docs/ --ci
```

The `lint` job needs no install and no checkout depth beyond `fetch-depth: 0` (full history, to resolve the PR diff base) — the linter has zero external dependencies.

## Adding or modifying rules

1. Create a new file in `linter/rules/` exporting a `check(content, frontmatter, glossaryIndex, pageType, filePath)` function
2. The function must return an array of violation objects:

```javascript
{
  code: 'category:rule_name',       // e.g., 'structural:missing_heading'
  type: 'structural',               // structural | standards | glossary | tone
  severity: 'medium',               // high | medium | low
  description: 'What is wrong',
  location_hint: 'Line 42',
  suggested_fix: 'How to fix it',
  ignored: false,                   // true to make it informational only
}
```

3. Register the rule in `linter/index.js` by adding `require('./rules/your-rule')` to the `rules` array

## Regression tests

Beyond per-page rules, `linter/tests/*.test.js` guards repository-level invariants (run by the CI via `node --test`). Two of them are diff-based:

- **`last-updated-date.test.js`** — pages changed in the diff must carry a refreshed `last_update.date` (decision D-017). Skips when no diff base can be resolved.
- **`page-deletion.test.js`** — pages deleted in the PR diff must have a redirect registered in `DELETED_PAGES` (`src/plugins/slug-redirects.js`) whose target still exists, and a dated `removed` changelog entry in both locales. Runs only when a diff base is available (`GITHUB_BASE_REF`/`origin/main` in the Actions workflow, or `LINTER_DIFF_BASE` locally); skips when no git binary is present, fails loudly on an unresolvable ref.

Diff-based tests shell out to `git`, so their CI job must provide it and clone the full history — the `lint` job of `.github/workflows/ci.yml` uses `actions/checkout` with `fetch-depth: 0` for that (the PR diff base can sit beyond a shallow clone). See [`PROBLEMS.md`](../PROBLEMS.md) for the incident that taught this.

The remaining tests (changelog sync/scope/format, i18n parity, sidebar ordering, search index, theme i18n…) are indexed in [`PROBLEMS.md`](../PROBLEMS.md).

## Source

This is a standalone copy of the linter from the internal doc-compliance-pilot project. The original version is integrated into the Electron app and also runs AI-based validation. This standalone version contains only the static (deterministic) rules.
