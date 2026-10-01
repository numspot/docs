// FR/EN changelog synchronization tests.
//
// The English changelog (docs/docs/changelog.json) is the source of truth and
// the French one (i18n/fr/docusaurus-plugin-content-docs/current/docs/changelog.json)
// must mirror it entry for entry — translated title/description/service, but
// identical structure:
//   - same number of entries, same order;
//   - same date, status and components per entry;
//   - service names must match the approved FR→EN translation map below.
//
// A missing or untranslated new entry shifts the indexes, so any lag between
// the two files fails these tests. Fix: add (and translate) the missing
// entry in BOTH files in the same commit.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const EN_PATH = path.join(ROOT, 'docs', 'docs', 'changelog.json');
const FR_PATH = path.join(
  ROOT,
  'i18n/fr/docusaurus-plugin-content-docs/current/docs/changelog.json'
);

// Approved FR -> EN service name translations. A new service must be added
// here in the same commit that introduces it in the changelogs.
const SERVICE_TRANSLATIONS = {
  Compute: 'Compute',
  Connectivité: 'Connectivity',
  'Container Registry': 'Container Registry',
  Console: 'Console',
  DLP: 'DLP',
  IAM: 'IAM',
  Inventaire: 'Inventory',
  Kubernetes: 'Kubernetes',
  'Object Storage': 'Object Storage',
  'Plateforme IA Mistral': 'Mistral AI Platform',
  PostgreSQL: 'PostgreSQL',
  Réseau: 'Network',
  Ressources: 'Resources',
  'Référence': 'Reference',
  'Secret Manager': 'Secret Manager',
  'Services Managés': 'Managed Services',
  Support: 'Support',
};

const REQUIRED_FIELDS = ['service', 'status', 'date', 'title', 'description', 'components'];

function loadEntries(p) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.ok(Array.isArray(data.entries), `${p} must contain an "entries" array`);
  return data.entries;
}

test('both changelog files exist and parse', () => {
  assert.ok(fs.existsSync(FR_PATH), `missing ${FR_PATH}`);
  assert.ok(fs.existsSync(EN_PATH), `missing ${EN_PATH}`);
  loadEntries(FR_PATH);
  loadEntries(EN_PATH);
});

test('English changelog has the same number of entries as French', () => {
  const fr = loadEntries(FR_PATH);
  const en = loadEntries(EN_PATH);
  assert.strictEqual(
    fr.length,
    en.length,
    `FR changelog has ${fr.length} entries, EN has ${en.length}. ` +
    'Add the missing entries to i18n/fr/docusaurus-plugin-content-docs/current/docs/changelog.json.'
  );
});

test('entries are aligned: same date, status and components at the same position', () => {
  const fr = loadEntries(FR_PATH);
  const en = loadEntries(EN_PATH);
  const issues = [];
  for (let i = 0; i < Math.min(fr.length, en.length); i++) {
    const f = fr[i];
    const e = en[i];
    if (f.date !== e.date) {
      issues.push(`#${i}: date FR ${f.date} != EN ${e.date} ("${f.title}")`);
    }
    if (f.status !== e.status) {
      issues.push(`#${i}: status FR ${f.status} != EN ${e.status} ("${f.title}")`);
    }
    if (JSON.stringify(f.components) !== JSON.stringify(e.components)) {
      issues.push(`#${i}: components differ ("${f.title}")`);
    }
  }
  assert.deepStrictEqual(issues, []);
});

test('every French service name maps to its approved English translation', () => {
  const fr = loadEntries(FR_PATH);
  const en = loadEntries(EN_PATH);
  const issues = [];
  for (let i = 0; i < Math.min(fr.length, en.length); i++) {
    const frService = fr[i].service;
    const enService = en[i].service;
    const expected = SERVICE_TRANSLATIONS[frService];
    if (expected === undefined) {
      issues.push(
        `#${i}: service "${frService}" has no FR->EN translation in SERVICE_TRANSLATIONS — add it`
      );
    } else if (enService !== expected) {
      issues.push(`#${i}: service "${frService}" should translate to "${expected}", got "${enService}"`);
    }
  }
  assert.deepStrictEqual(issues, []);
});

test('every entry carries the same field set in both locales', () => {
  const fr = loadEntries(FR_PATH);
  const en = loadEntries(EN_PATH);
  const issues = [];
  for (let i = 0; i < Math.min(fr.length, en.length); i++) {
    for (const f of REQUIRED_FIELDS) {
      if (!(f in fr[i])) issues.push(`#${i}: FR entry missing field "${f}"`);
      if (!(f in en[i])) issues.push(`#${i}: EN entry missing field "${f}"`);
    }
  }
  assert.deepStrictEqual(issues, []);
});
