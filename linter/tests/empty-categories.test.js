// Guard: no empty documentation category.
//
// A directory containing a _category_.json but no doc page at all (no direct
// .md/.mdx page, no subdirectory) renders as an empty section in the docs
// navigation — docs/docs/security used to ship like that. The CLI reports
// such directories via cli.js structural:empty_category; this test keeps the
// corpus clean at test time too.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DOC_ROOTS = [
  path.join(ROOT, 'docs', 'docs'),
  path.join(ROOT, 'i18n', 'en', 'docusaurus-plugin-content-docs', 'current', 'docs'),
];

function emptyCategoryDirs(rootDir) {
  const empty = [];
  if (!fs.existsSync(rootDir)) return empty;
  const visit = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const full = path.join(dir, e.name);
      const children = fs.readdirSync(full, { withFileTypes: true });
      const hasCategory = children.some(c => c.isFile() && c.name === '_category_.json');
      const hasPages = children.some(
        c => c.isFile() && /\.(md|mdx)$/.test(c.name) && !c.name.startsWith('_')
      );
      const hasSubdirs = children.some(
        c => c.isDirectory() && !c.name.startsWith('.') && !c.name.startsWith('_')
      );
      if (hasCategory && !hasPages && !hasSubdirs) empty.push(path.relative(ROOT, full));
      visit(full);
    }
  };
  visit(rootDir);
  return empty;
}

test('no empty doc category (only _category_.json)', () => {
  const empty = DOC_ROOTS.flatMap(emptyCategoryDirs);
  assert.deepStrictEqual(
    empty,
    [],
    `Empty categories (add a page or remove the _category_.json):\n${empty.join('\n')}`
  );
});
