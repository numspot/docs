// Integrity test: theme i18n overrides must not hardcode values that are
// dynamic in docusaurus.config.ts. Session history: the English footer
// translation carried a hardcoded "Copyright © 2024 Numspot." that
// silently overrode the dynamic year from the config, leaving the site
// with a stale copyright. The copyright must come from
// docusaurus.config.ts only (new Date().getFullYear()).

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const THEME_I18N_DIR = path.join(REPO_ROOT, 'i18n');
const THEME_DIR_PATTERN = 'docusaurus-theme-classic';
const HARDCODED_YEAR = /©\s*\d{4}/;

function listThemeJsonFiles() {
  const files = [];
  if (!fs.existsSync(THEME_I18N_DIR)) return files;
  for (const locale of fs.readdirSync(THEME_I18N_DIR)) {
    const themeDir = path.join(THEME_I18N_DIR, locale, THEME_DIR_PATTERN);
    if (!fs.existsSync(themeDir)) continue;
    for (const file of fs.readdirSync(themeDir)) {
      if (file.endsWith('.json')) files.push(path.join(themeDir, file));
    }
  }
  return files;
}

test('theme footer translations do not override the dynamic copyright', () => {
  const problems = [];
  for (const file of listThemeJsonFiles()) {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(REPO_ROOT, file);
    const copyrightKey = Object.keys(json).find(
      (k) => k === 'copyright' || k.endsWith('.copyright')
    );
    if (copyrightKey) {
      problems.push(`${rel}: "${copyrightKey}" key must be removed — copyright is dynamic in docusaurus.config.ts`);
    }
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === 'string' && HARDCODED_YEAR.test(value)) {
        problems.push(`${rel}: "${key}" hardcodes a year (${value.trim()}) — dynamic values belong in docusaurus.config.ts`);
      }
    }
  }
  assert.deepStrictEqual(problems, [], `Stale theme i18n overrides:\n${problems.join('\n')}`);
});
