// Unit tests for the french-residuals rule, focused on the proper-noun
// exemption contract: domain terms (e-santé, Magny-Les-Hameaux, Téléhouse)
// must never be flagged, even though they are NOT glossary PROPER_NOUN
// entries — while ordinary accented French text must keep being flagged.

const test = require('node:test');
const assert = require('node:assert');
const rule = require('../rules/french-residuals');

const PAGE = '---\ntitle: Test\n---\n\n';

function accentViolations(content, glossaryTerms = {}) {
  return rule
    .check(PAGE + content, {}, { terms: glossaryTerms }, 'page')
    .filter((v) => v.code === 'i18n:french_text');
}

test('domain proper nouns with accents are not flagged (e-santé)', () => {
  const v = accentViolations(
    'Find out more: [HDS certification - Everything you need to know | e-santé](https://esante.gouv.fr/produits-services/hds)\n'
  );
  assert.deepStrictEqual(v, [], 'e-santé must be exempt from the accent safety net');
});

test('datacenter town names are not flagged (Magny-Les-Hameaux, Téléhouse)', () => {
  const v = accentViolations('- **PAR1**, Téléhouse (Magny-Les-Hameaux)\n');
  assert.deepStrictEqual(v, []);
});

test('ordinary accented French text is still flagged', () => {
  const v = accentViolations('Cette clé est réservée aux administrateurs.\n');
  assert.strictEqual(v.length, 1);
});

test('glossary PROPER_NOUN entries remain exempt', () => {
  const v = accentViolations('Located at Téléhouse.\n', {
    telehouse: { type: ['PROPER_NOUN'], correct_form: 'Téléhouse', meaning: 'Datacenter' },
  });
  assert.deepStrictEqual(v, []);
});
