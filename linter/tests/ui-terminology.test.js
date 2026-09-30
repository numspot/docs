// Integrity test: UI source files (sidebars.ts, src/**) must respect the
// glossary. Session history shows UI labels drifting from the glossary
// (e.g. "Data Leak Protection" instead of "Data Loss Prevention" in the
// sidebar and the OpenAPI landing page). Doc pages are covered by the
// glossary:terminology rule; this test extends the same contract to the
// UI code that the doc linter does not scan.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GLOSSARY_PATH = path.join(REPO_ROOT, 'consigns', 'glossary.json');

const UI_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', 'build', '.docusaurus']);

function loadWrongForms() {
  const glossary = JSON.parse(fs.readFileSync(GLOSSARY_PATH, 'utf8'));
  const terms = Array.isArray(glossary.terms)
    ? glossary.terms
    : Object.entries(glossary.terms).map(([key, term]) => ({ key, ...term }));
  return terms
    .filter((t) => t.wrong_form && t.correct_form)
    .map((t) => ({ wrong: t.wrong_form, correct: t.correct_form }));
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-sensitive on purpose: wrong forms like "NumSpot" must not match
// lowercase URLs or correct lowercase text. Word boundaries on both sides
// so short wrong forms (e.g. "HA") do not match inside other words
// (e.g. "CHANGELOG").
function findViolations(content, wrongForms) {
  const violations = [];
  for (const { wrong, correct } of wrongForms) {
    const re = new RegExp(`\\b${escapeRegExp(wrong)}\\b`, 'g');
    let match;
    while ((match = re.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      violations.push({ wrong, correct, line });
    }
  }
  return violations;
}

function collectUiFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectUiFiles(full, files);
    else if (UI_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

test('detector catches a known wrong form in UI source', () => {
  const wrongForms = loadWrongForms();
  const dlp = wrongForms.find((w) => w.wrong === 'Data Leak Protection');
  assert.ok(dlp, 'glossary dlp entry must declare wrong_form "Data Leak Protection"');
  const violations = findViolations(
    'label: "Data Leak Protection" — should be Data Loss Prevention',
    wrongForms
  );
  assert.strictEqual(violations.length, 1);
  assert.strictEqual(violations[0].correct, 'DLP');
});

test('detector ignores correct forms (case-sensitive)', () => {
  const wrongForms = loadWrongForms();
  assert.deepStrictEqual(
    findViolations('Numspot and Data Loss Prevention are correct', wrongForms),
    []
  );
});

test('sidebars.ts and src/** contain no glossary wrong forms', () => {
  const wrongForms = loadWrongForms();
  const files = collectUiFiles(path.join(REPO_ROOT, 'src'));
  files.push(path.join(REPO_ROOT, 'sidebars.ts'));
  const problems = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const v of findViolations(content, wrongForms)) {
      problems.push(`${path.relative(REPO_ROOT, file)}:${v.line} "${v.wrong}" → use "${v.correct}"`);
    }
  }
  assert.deepStrictEqual(problems, [], `Glossary wrong forms found in UI files:\n${problems.join('\n')}`);
});
