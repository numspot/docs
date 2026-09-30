// Unit tests for the code-meta-comments-english rule: maintainer meta
// markers (TODO/FIXME/NOTE/HACK/XXX) must stay English on FR pages, while
// reader-facing comments are content and follow the page language.

const test = require('node:test');
const assert = require('node:assert');
const rule = require('../rules/code-meta-comments-english');

function violations(...body) {
  return rule.check(['---\ntitle: Test\n---\n', ...body].join('\n'), {}, {}, 'page');
}

test('French text after a meta marker is flagged', () => {
  const v = violations('```bash', '# TODO: supprimer quand la migration sera terminée', 'echo ok', '```');
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].code, 'i18n:french_meta_comment');
  assert.strictEqual(v[0].severity, 'medium');
});

test('French FIXME inside a code block is flagged', () => {
  const v = violations('```yaml', 'replicas: 3 # FIXME: vérifier la valeur avec le support', '```');
  assert.strictEqual(v.length, 1);
});

test('bare TODO without French text is not flagged', () => {
  assert.deepStrictEqual(violations('```bash', '# TODO', 'echo ok', '```'), []);
});

test('English meta comment is not flagged', () => {
  assert.deepStrictEqual(
    violations('```bash', '# TODO: remove once the API is GA', 'echo ok', '```'),
    []
  );
});

test('reader-facing French comment (no marker) is content and stays unflagged', () => {
  assert.deepStrictEqual(
    violations('```bash', '# Créer le bucket', 'aws s3 mb s3://mon-bucket', '```'),
    []
  );
});

test('meta comment outside a code block is not flagged', () => {
  assert.deepStrictEqual(violations('# TODO: vérifier ceci', '', 'Text.'), []);
});
