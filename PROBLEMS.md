# Session Problems & Solutions

> **Single source of truth for problems encountered while building this documentation** (human or AI-assisted sessions) and their fixes. `AGENTS.md` references this file but does not duplicate it. Decisions (what & why) live in [`DECISIONS.md`](DECISIONS.md).

When a session detects a problem, it must not recur:

1. **Lintable** → add an automated guard in `linter/tests/` (runs in the CI via `node --test linter/tests/*.test.js`) and add a row to the table below.
2. **Not lintable** → document the rule in a subsection below.

## Automated guards

| Problem seen in past sessions                      | Guard                                                       |
| -------------------------------------------------- | ----------------------------------------------------------- |
| Changelog FR/EN drift (missing/misplaced entries)  | `linter/tests/changelog-sync.test.js`                       |
| Changelog entries about site UI / meta / tooling   | `linter/tests/changelog-scope.test.js`                      |
| Changelog JSON reformatted (component-array style flip-flops between contributors) | `linter/tests/changelog-format.test.js` (`--fix` available) |
| Doc pages deleted without SEO redirect or changelog "removed" entry | `linter/tests/page-deletion.test.js`                       |
| UI labels drifting from the glossary (src/, sidebars.ts) | `linter/tests/ui-terminology.test.js`                 |
| Theme i18n overrides hardcoding dynamic values (stale footer copyright year) | `linter/tests/theme-i18n-overrides.test.js` |
| i18n parity / French text leaking into EN pages    | `linter/tests/parity.test.js`, `linter/tests/french-residuals.test.js` |
| Last-updated-date test flaky around UTC midnight (test lookahead built from `Date.now()` straddling two UTC dates) | Fixed in `linter/tests/last-updated-date.test.js` — the "tomorrow" fixture is derived from UTC midnight + 26h |
| Multiple unit commits piling up in one PR          | Not lintable — see "One commit per Pull Request" below      |

## Branching — always start from up-to-date `main` (not lintable)

A past session created a new feature branch from the tip of another working branch instead of `main`, without checking that this branch had already been merged. The result was only correct by luck (the merge was a fast-forward). Rules:

- **Always create a branch from an up-to-date `origin/main`**: run `git fetch origin` and `git log origin/main --oneline -5` first, and check which PRs are open/merged before choosing the base.
- **Never stack a branch on another working branch** unless the user explicitly asks for it.
- **If the state is ambiguous** (pending PRs, user mentions merges, unclear base) — **ask the user** instead of assuming.
- If you branch from a stale base anyway: compare with `origin/main` immediately, and rebase onto `origin/main` before pushing.

## Secret scanning and example credentials (not lintable)

Documentation frequently needs to show what a credential looks like. Lessons from past sessions:

- Example credentials in docs (e.g. the AWS sample keys `AKIAIOSFODNN7EXAMPLE` / `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`) are **allowed** — they are the literal, publicly documented examples published by AWS. Secret scanners flag them anyway; dismiss those findings rather than altering the example.
- Prefer obviously-fake placeholders (`your-access-key-id`, `EXAMPLE-UUID`) in new documentation so most findings never appear.
- Never weaken the secret-scanning configuration of the repository to silence findings — fix the content instead.

## One commit per Pull Request — squash as you go (not lintable)

A branch carries exactly one commit. Fold each new change into the branch's existing commit instead of stacking a new one:

- **Subsequent changes**: `git add <files> && git commit --amend` — keep the message accurate (`--no-edit` only if the scope did not change); a multi-part change updates the message body too.
- **Already-pushed branch**: update it with `git push --force-with-lease` — never plain `--force`.
- **Branch with legacy stacked commits to clean up**: `git reset --soft origin/main && git add <files> && git commit` to rebuild a single commit, or `--fixup` + `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash origin/main`.
- **Never** rewrite commits already merged to `main`, and never squash other people's commits.
- The final commit message must follow Conventional Commits and describe the whole branch change.

## Diff-based tests need git in their CI job (not lintable)

Diff-based linter tests (e.g. `page-deletion.test.js`) shell out to `git` to resolve the PR diff base. Lessons from a past session:

- **A CI job running git-dependent tests must provide git and the full history**: in GitHub Actions this is `actions/checkout` with `fetch-depth: 0` — without it, the diff base can sit beyond a shallow clone and the test fails loudly.
- **Diff-based tests must degrade gracefully**: resolve the diff base through a git call wrapped in try/catch — `ENOENT` (no git binary) → skip cleanly; an unresolvable configured ref (shallow clone, typo) → fail loudly. Never let a raw `execFileSync('git', …)` error escape a test (see `page-deletion.test.js` `diffBase()`).
