// Guard: the sidebar ordering rules (decision D-019).
//
// Sidebar levels 0 and 1 are ordered at build time by
// src/components/sidebar-order.js: highlighted entries first, then
// alphabetical (within each visual group). This suite unit-tests that logic
// and validates the HIGHLIGHTED_SIDEBAR_ENTRIES keys against the real docs
// tree — a typo in a key would silently do nothing at build time.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  sortSidebarEntries,
  HIGHLIGHTED_SIDEBAR_ENTRIES,
} = require('../../src/components/sidebar-order.js');

const ROOT = path.join(__dirname, '..', '..');
const DOCS_DIR = path.join(ROOT, 'docs', 'docs');

// Fixtures mirroring the generator contract: categories carry no `source`
// (stripped by the default generator), so identity is re-derived from the
// docs' sourceDirName — an id's parent path (docs/<folder>/…).
const doc = (id, label) => ({ type: 'doc', id, label });
const cat = (label, className, children) => ({
  type: 'category',
  label,
  ...(className && { className }),
  items: children,
});
function docsOf(items) {
  const docs = [];
  const visit = (entries) => {
    for (const item of entries) {
      if (item.type === 'category') {
        visit(item.items);
      } else {
        docs.push({ id: item.id, sourceDirName: item.id.split('/').slice(0, -1).join('/') });
      }
    }
  };
  visit(items);
  return docs;
}

test('level 0: highlighted first, then alphabetical (A,B,C,D,E with B,E highlighted -> B,E,A,C,D)', () => {
  // Mapped on real tools-group entries: A=reference, B=support, C=faq,
  // D=glossary, E=terraform; highlights {support, terraform}.
  const items = [
    cat('Référence', 'section-title reference', [doc('docs/reference/parameter-types')]),
    cat('Support', 'section-title support', [doc('docs/support/general')]),
    cat('Foire aux questions', 'section-title faq', [doc('docs/faq/general')]),
    cat('Glossaire', 'section-title glossary', [doc('docs/glossary/general')]),
    cat('Terraform', 'section-title terraform', [doc('docs/terraform/quickstart')]),
  ];
  const result = sortSidebarEntries(items, docsOf(items), new Set(['support', 'terraform']));
  assert.deepStrictEqual(
    result.map((i) => i.label),
    ['Support', 'Terraform', 'Foire aux questions', 'Glossaire', 'Référence'],
  );
});

test('level 1: highlighted child first, then alphabetical (compute/vms, compute/concept)', () => {
  const items = [
    cat('Compute', 'section-title compute', [
      cat('VM', undefined, [doc('docs/compute/vms/quickstart')]),
      cat('GPU', undefined, [doc('docs/compute/gpu/concept')]),
      doc('docs/compute/concept', 'Concepts'),
    ]),
  ];
  const result = sortSidebarEntries(
    items,
    docsOf(items),
    new Set(['compute/vms', 'compute/concept']),
  );
  assert.deepStrictEqual(
    result[0].items.map((i) => i.label ?? i.id),
    ['Concepts', 'VM', 'GPU'],
  );
});

test('managed-services: Concepts stays first, highlighted Kubernetes second', () => {
  const items = [
    cat('Services Managés', 'section-title managed-services', [
      cat('Kubernetes', undefined, [doc('docs/managed-services/kubernetes/concepts')]),
      doc('docs/managed-services/concepts', 'Concepts'),
      cat('PostgreSQL', undefined, [doc('docs/managed-services/postgresql/concepts')]),
    ]),
  ];
  const result = sortSidebarEntries(
    items,
    docsOf(items),
    new Set(['managed-services', 'managed-services/concepts', 'managed-services/kubernetes']),
  );
  assert.deepStrictEqual(
    result[0].items.map((i) => i.label ?? i.id),
    ['Concepts', 'Kubernetes', 'PostgreSQL'],
  );
});

test('visual groups stay contiguous and sort internally (no highlights)', () => {
  const items = [
    cat('Réseau', 'section-title network', [doc('docs/network/vpc/concepts')]),
    cat('Stockage', 'section-title storage', [doc('docs/storage/block-storage/concepts')]),
    cat('Compute', 'section-title compute', [doc('docs/compute/concept')]),
    cat('Connectivité', 'section-title connectivity', [doc('docs/connectivity/direct-link/concepts')]),
    doc('docs/changelog', 'Changelog'),
  ];
  const result = sortSidebarEntries(items, docsOf(items), new Set());
  assert.deepStrictEqual(
    result.map((i) => i.label),
    ['Changelog', 'Compute', 'Connectivité', 'Réseau', 'Stockage'],
  );
});

test('a category whose only child is its index link keeps its folder key (glossary)', () => {
  // On current main, the glossary is a category whose single index child was
  // converted to the category link (docs/glossary/index): its key must come
  // from the LINKED DOC's folder, not the id's last segment ("index").
  const slice = [
    {
      type: 'category',
      label: 'Glossaire',
      className: 'section-title glossary',
      link: { type: 'doc', id: 'docs/glossary/index' },
      items: [],
    },
    cat('Terraform', 'section-title terraform', [doc('docs/terraform/quickstart')]),
    cat('IAM', 'section-title iam', [doc('docs/iam/connection/first-connection')]),
  ];
  const docs = [
    { id: 'docs/glossary/index', sourceDirName: 'docs/glossary' },
    { id: 'docs/terraform/quickstart', sourceDirName: 'docs/terraform' },
    { id: 'docs/iam/connection/first-connection', sourceDirName: 'docs/iam' },
  ];
  const result = sortSidebarEntries(slice, docs, new Set(['terraform']));
  // glossary must land in the tools bucket (2nd), NOT in the ungrouped tail.
  assert.deepStrictEqual(
    result.map((i) => i.label),
    ['Terraform', 'Glossaire', 'IAM'],
  );
});

test('every highlight key resolves to a real docs entry (typo = silent no-op)', () => {
  const problems = [];
  for (const key of HIGHLIGHTED_SIDEBAR_ENTRIES) {
    const segments = key.split('/');
    let dir = DOCS_DIR;
    for (const [index, segment] of segments.entries()) {
      const isLast = index === segments.length - 1;
      const asDir =
        fs.existsSync(path.join(dir, segment)) &&
        fs.statSync(path.join(dir, segment)).isDirectory();
      const asPage = ['.md', '.mdx'].some((ext) =>
        fs.existsSync(path.join(dir, `${segment}${ext}`)),
      );
      if (isLast) {
        if (!asDir && !asPage) {
          problems.push(`${key}: "${segment}" matches no folder or page in ${dir.replace(`${ROOT}/`, '')}`);
        }
      } else if (!asDir) {
        problems.push(`${key}: "${segment}" is not a folder in ${dir.replace(`${ROOT}/`, '')}`);
        break;
      } else {
        dir = path.join(dir, segment);
      }
    }
  }
  assert.deepStrictEqual(problems, [], `invalid highlight keys:\n${problems.join('\n')}`);
});
