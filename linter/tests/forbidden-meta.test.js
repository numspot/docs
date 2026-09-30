// Unit tests for the forbidden-meta rule: metaTitle/metaDescription are dead
// frontmatter keys (decision D-015). The HTML <title> comes from "title" and
// the meta description from "description" — any occurrence of the legacy keys
// must be flagged so they never come back through copy-paste or AI
// regeneration.
//
// Tests go through the real parseFrontmatter so the rule is exercised against
// the exact { data, raw } contract it receives at runtime.

const test = require('node:test');
const assert = require('node:assert');
const rule = require('../rules/forbidden-meta');
const { parseFrontmatter } = require('../utils/frontmatter');

function violations(page) {
  return rule.check(page, parseFrontmatter(page), { terms: {} }, 'page', 'docs/docs/test.mdx');
}

test('both legacy keys are flagged, one violation per key', () => {
  const page = '---\ntitle: Test\nmetaTitle: Test - Kubernetes managé\nmetaDescription: Desc\n---\n\nContent';
  const v = violations(page);
  assert.strictEqual(v.length, 2);
  assert.deepStrictEqual(v.map((x) => x.code), [
    'structural:forbidden_meta',
    'structural:forbidden_meta',
  ]);
  assert.deepStrictEqual(v.map((x) => x.severity), ['high', 'high']);
  assert.deepStrictEqual(v.map((x) => x.location_hint), ['frontmatter', 'frontmatter']);
});

test('a single legacy key is still flagged', () => {
  const page = '---\ntitle: Test\nmetaDescription: Desc\n---\n\nContent';
  assert.strictEqual(violations(page).length, 1);
});

test('an empty-valued legacy key is flagged', () => {
  const page = '---\ntitle: Test\nmetaTitle:\n---\n\nContent';
  assert.strictEqual(violations(page).length, 1);
});

test('quoted and dash-prefixed keys cannot evade the rule', () => {
  const page = '---\ntitle: Test\n"metaTitle": Test\n- metaDescription: Desc\n---\n\nContent';
  assert.strictEqual(violations(page).length, 2);
});

test('a commented-out legacy key is ignored', () => {
  const page = '---\ntitle: Test\n# metaTitle: legacy value\n---\n\nContent';
  assert.deepStrictEqual(violations(page), []);
});

test('the legacy key inside the body is ignored', () => {
  const page = '---\ntitle: Test\n---\n\nUse `metaTitle: foo` inside a code example';
  assert.deepStrictEqual(violations(page), []);
});

test('compliant frontmatter produces no violation', () => {
  const page = '---\ntitle: Test - Kubernetes managé\nsidebar_label: Test\ndescription: Desc\n---\n\nContent';
  assert.deepStrictEqual(violations(page), []);
});

test('missing frontmatter object is handled', () => {
  assert.deepStrictEqual(rule.check('content', null, { terms: {} }, 'page', 'x.mdx'), []);
});
