// Canonical JSON formatting of the changelog files.
//
// Contributors kept reformatting the changelog JSON (single-line vs
// multi-line `components` arrays) back and forth between MRs. Both forms
// render identically, so this is a pure style choice — but the choice must
// be made once and enforced, or every MR carries a formatting diff.
//
// Canonical form = the natural serialization:
//   JSON.stringify(JSON.parse(text), null, 2) + "\n"
// (2-space indent, scalar arrays inlined when they fit, LF, trailing newline)
//
// Fix: `node linter/tests/changelog-format.test.js --fix`

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

const FILES = [
  path.join(ROOT, 'docs', 'docs', 'changelog.json'),
  path.join(
    ROOT,
    'i18n/en/docusaurus-plugin-content-docs/current/docs/changelog.json'
  ),
];

function canonicalize(text) {
  return JSON.stringify(JSON.parse(text), null, 2) + '\n';
}

test('changelog files use the canonical JSON serialization', () => {
  const issues = [];
  for (const file of FILES) {
    const text = fs.readFileSync(file, 'utf8');
    if (text !== canonicalize(text)) {
      issues.push(
        `${path.relative(ROOT, file)} is not canonically formatted — ` +
        'run `node linter/tests/changelog-format.test.js --fix`'
      );
    }
  }
  assert.deepStrictEqual(issues, []);
});

if (require.main === module && process.argv.includes('--fix')) {
  for (const file of FILES) {
    const text = fs.readFileSync(file, 'utf8');
    if (text !== canonicalize(text)) {
      fs.writeFileSync(file, canonicalize(text));
      console.log(`reformatted ${path.relative(ROOT, file)}`);
    } else {
      console.log(`already canonical ${path.relative(ROOT, file)}`);
    }
  }
}
