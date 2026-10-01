// Integrity test: changelog entries must stay in the product/service scope.
// Session history: entries about site UI (footer copyright, feedback widget
// widget) and meta announcements (English version availability, translation
// completion) were added to the changelog. Per AGENTS.md, the changelog
// tracks product and service changes only. Full detection of "relevant vs
// not" is not automatable, so this test enforces a conservative blocklist
// of the UI/meta/tooling patterns already observed in practice. Extend the
// list whenever a new out-of-scope entry slips in.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CHANGELOGS = [
  path.join(REPO_ROOT, 'docs', 'docs', 'changelog.json'),
  path.join(REPO_ROOT, 'i18n', 'en', 'docusaurus-plugin-content-docs', 'current', 'docs', 'changelog.json'),
];

// Conservative blocklist of out-of-scope (site UI / meta / tooling) topics.
// Product pages legitimately mentioning these words in a product context
// should be rephrased rather than weakening this list.
const OUT_OF_SCOPE_PATTERNS = [
  { re: /footer/i, why: 'site UI (footer)' },
  { re: /feedback widget|widget de feedback/i, why: 'site UI (feedback widget)' },
  { re: /copyright/i, why: 'site UI (footer copyright)' },
  {
    re: /(version anglaise|english version|publi[ée]e?s? en anglais|traduit|traduction|translation)/i,
    why: 'meta announcement about translations — content translations ship silently',
  },
  { re: /\blinter\b|\bchangelog\b/i, why: 'docs tooling, not a product/service change' },
];

function evaluateEntry(entry) {
  const text = `${entry.title} ${entry.description ?? ''}`;
  return OUT_OF_SCOPE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.why);
}

test('blocklist detects the out-of-scope patterns observed in past sessions', () => {
  assert.deepStrictEqual(evaluateEntry({ title: 'Widget de feedback traduit en anglais' }), [
    'site UI (feedback widget)',
    'meta announcement about translations — content translations ship silently',
  ]);
  assert.deepStrictEqual(evaluateEntry({ title: 'English footer copyright updated' }), [
    'site UI (footer)',
    'site UI (footer copyright)',
  ]);
  assert.deepStrictEqual(evaluateEntry({ title: 'Pages DLP publiées en anglais' }), [
    'meta announcement about translations — content translations ship silently',
  ]);
  assert.deepStrictEqual(evaluateEntry({ title: 'Mise à jour des images officielles' }), []);
});

test('changelog entries stay in the product/service scope (no UI/meta/tooling topics)', () => {
  const problems = [];
  for (const file of CHANGELOGS) {
    if (!fs.existsSync(file)) continue;
    const entries = JSON.parse(fs.readFileSync(file, 'utf8')).entries || [];
    for (const entry of entries) {
      const why = evaluateEntry(entry);
      if (why.length) {
        problems.push(`${path.relative(REPO_ROOT, file)} [${entry.date}] "${entry.title}": ${why.join(', ')}`);
      }
    }
  }
  assert.deepStrictEqual(problems, [], `Out-of-scope changelog entries:\n${problems.join('\n')}`);
});
