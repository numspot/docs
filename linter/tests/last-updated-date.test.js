// Review-date enforcement test (see DECISIONS.md D-017).
//
// Every documentation page (except the homepage) displays its review date
// under the title — "Mise à jour le <date>" (FR) / "Reviewed on <date>" (EN) —
// rendered by src/components/LastUpdatedDate from the `last_update.date`
// frontmatter, with the file's git date as fallback for pages never touched
// since the feature shipped.
//
// Authors own that date. This test enforces it on the files changed in an MR:
//   - ADDED page   → `last_update.date` must be present;
//   - MODIFIED page → `last_update.date` must exist and be newer than the
//     value it had at the diff base (absent before = adding it now is fine);
//   - any date must be `YYYY-MM-DD` and not in the future (1-day tolerance
//     for timezone drift).
//
// Homepage and `_`-prefixed partials are excluded. Like changelog-scope, this
// is a repo-level test: it runs on MR pipelines (CI_MERGE_REQUEST_DIFF_BASE_SHA)
// and on main (HEAD~1). Without a resolvable diff base the test is skipped.

const fs = require('node:fs');
const path = require('node:path');
const {execSync} = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');

const DOC_ROOTS = ['docs/docs/', 'i18n/fr/docusaurus-plugin-content-docs/current/docs/'];

// Homepage never displays a review date (theme-level exclusion) and must not
// carry one.
const EXCLUDED_PATHS = new Set(['docs/docs/home.mdx', 'i18n/fr/docusaurus-plugin-content-docs/current/docs/home.mdx']);

// --- pure helpers (self-tested below) ---------------------------------------

// The linter's shared parseFrontmatter is flat (no nested keys), and
// `last_update.date` is nested YAML. Extract the date with a focused regex
// on the raw frontmatter block instead of extending the shared parser.
function extractLastUpdateDate(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const lines = fmMatch[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/^last_update:\s*$/.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') continue;
      if (!/^\s/.test(line)) break; // end of the nested block
      const m = line.match(/^\s+date:\s*(\S+)\s*$/);
      if (m) return m[1];
    }
  }
  return undefined;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function daysAgoFromToday(dateString) {
  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Math.round((base.getTime() - new Date(`${dateString}T00:00:00Z`).getTime()) / 86_400_000);
}

// --- git helpers ------------------------------------------------------------

function resolveDiffRef() {
  const candidates = [
    process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA,
    'origin/main',
    'HEAD~1',
  ].filter(Boolean);
  for (const ref of candidates) {
    try {
      execSync(`git rev-parse --verify --quiet ${ref}^{commit}`, {stdio: 'pipe'});
      return ref;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function listChangedDocFiles(diffRef) {
  const output = execSync(
    `git diff --name-status --find-renames=100% --diff-filter=ACMR ${diffRef}`,
    {encoding: 'utf8'},
  );
  return output
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    // A pure rename (R100) moves a file without touching its content: the
    // displayed review date does not need a refresh, so renames are skipped.
    // This keeps mass tree reorganizations (e.g. locale swaps) from tripping
    // the guard for every moved page.
    .filter((line) => !line.startsWith('R100'))
    .map((line) => line.split('\t').pop())
    .filter((f) => DOC_ROOTS.some((root) => f.startsWith(root)))
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .filter((f) => !f.split('/').some((seg) => seg.startsWith('_')))
    .filter((f) => !EXCLUDED_PATHS.has(f));
}

function readBaseContent(diffRef, filePath) {
  try {
    return execSync(`git show ${diffRef}:${filePath}`, {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return null; // file is new relative to the diff base
  }
}

// Pre-locale-swap mirrors of the locale trees (the 2026-10-01 EN-at-root
// migration swapped docs/docs (was FR) with i18n/en (was EN). Kept so the
// diff-base check can recognize pages whose content only moved across the
// locale trees as unchanged; safe to drop once every branch bases on a
// post-migration main.
const LEGACY_LOCALE_MIRRORS = [
  // EN content moved from the old i18n/en mirror to the docs root…
  {current: 'docs/docs/', legacy: 'i18n/en/docusaurus-plugin-content-docs/current/docs/'},
  // …and the FR content moved the other way, into the new i18n/fr tree.
  {current: 'i18n/fr/docusaurus-plugin-content-docs/current/docs/', legacy: 'docs/docs/'},
];

// True when the page content is byte-identical to what the diff base carried
// under one of the legacy locale-tree mirrors (i.e. it only changed location).
function contentUnchangedAcrossLocaleSwap(diffRef, filePath, content) {
  for (const {current, legacy} of LEGACY_LOCALE_MIRRORS) {
    if (!filePath.startsWith(current)) continue;
    const rel = filePath.slice(current.length);
    if (readBaseContent(diffRef, legacy + rel) === content) return true;
  }
  return false;
}

// --- checks -----------------------------------------------------------------

function checkPage(diffRef, filePath) {
  const problems = [];
  const content = fs.readFileSync(path.join(REPO_ROOT, filePath), 'utf8');
  const baseContent = readBaseContent(diffRef, filePath);
  const localeSwapRename = contentUnchangedAcrossLocaleSwap(
    diffRef, filePath, content,
  );
  if (localeSwapRename) {
    // The page only moved across locale trees: not a content review, the
    // guard does not apply.
    return problems;
  }
  const isNew = baseContent === null;

  const date = extractLastUpdateDate(content);

  if (date === undefined) {
    problems.push(
      isNew
        ? 'new page: frontmatter is missing `last_update:` block with a `date:` value'
        : 'modified page: frontmatter is missing `last_update:` block with a `date:` (add one — the displayed review date must be refreshed)',
    );
    return problems;
  }

  if (!isValidDate(date)) {
    problems.push(`\`last_update.date\` is not a valid YYYY-MM-DD date: "${date}"`);
    return problems;
  }

  const ageInDays = daysAgoFromToday(date);
  if (ageInDays < -1) {
    problems.push(`\`last_update.date\` is in the future: "${date}"`);
  }

  if (!isNew) {
    const baseDate = extractLastUpdateDate(baseContent);
    if (baseDate !== undefined) {
      if (!isValidDate(baseDate)) {
        // Base was malformed; requiring the new date to simply be valid is enough.
      } else if (date < baseDate) {
        // "Refreshed" means not older than the base revision. Same-day
        // revisions legitimately keep the same date (the rule is "the date
        // of the revision"), so only strictly older dates are flagged.
        problems.push(
          `\`last_update.date\` was not refreshed: "${date}" must be at least "${baseDate}" (the page changed in this change set)`,
        );
      }
    }
  }

  return problems;
}

// --- self-tests of the helpers ---------------------------------------------

test('helpers: frontmatter extraction and date validation', () => {
  assert.strictEqual(
    extractLastUpdateDate('---\ntitle: X\ndraft: false\n---\n# X'),
    undefined,
  );
  assert.strictEqual(
    extractLastUpdateDate('---\ntitle: X\nlast_update:\n  date: 2026-09-11\n---\n# X'),
    '2026-09-11',
  );
  assert.strictEqual(
    extractLastUpdateDate('---\ntitle: X\nlast_update:\n  author: y\n  date: 2026-09-11\n---\n# X'),
    '2026-09-11',
  );
  assert.ok(isValidDate('2026-09-11'));
  assert.ok(!isValidDate('2026-9-11'));
  assert.ok(!isValidDate('11/09/2026'));
  assert.ok(!isValidDate('banana'));
  assert.ok(!isValidDate(undefined));
  // 1-day future tolerance. Built from UTC midnight + 26h so the value is
  // always exactly the next UTC day: a Date.now() offset (e.g. +26h) can
  // straddle two UTC date boundaries near midnight and fail the assertion.
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
      26 * 3600 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  assert.ok(daysAgoFromToday(tomorrow) >= -1);
});

// --- repo-wide enforcement ---------------------------------------------------

test('changed doc pages carry an updated last_update date (homepage excluded)', () => {
  const diffRef = resolveDiffRef();
  if (!diffRef) {
    return; // no git context available (e.g. archive build) — nothing to compare
  }

  const changed = listChangedDocFiles(diffRef);
  const problems = [];
  for (const filePath of changed) {
    for (const problem of checkPage(diffRef, filePath)) {
      problems.push(`${filePath}: ${problem}`);
    }
  }

  assert.deepStrictEqual(
    problems,
    [],
    `Pages changed in this branch must set \`last_update.date\` in their frontmatter (YYYY-MM-DD, today), homepage excluded — see consigns/standards.md "Date de mise à jour":\n${problems.join('\n')}`,
  );
});
