// FR/EN structural parity tests.
//
// Detects translation drift that a human reviewer can miss:
//   - frontmatter flags differing between the FR source and the EN translation
//     (e.g. hide_feedback present in one locale only, sidebar_position moved);
//   - a <Walkthrough> component (or its step count) present in one locale only;
//   - TabItem values, imports or heading structure diverging.
//
// Known, already-documented drift lives in the two allowlists below. They can
// only SHRINK: removing an entry once the drift is fixed is expected, adding
// new entries or letting a page drift further is a CI failure. Text-level
// accuracy (wording, numeric values in prose) stays a human review concern —
// these tests cover the structural contract only.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const EN_DIR = path.join(ROOT, 'i18n/en/docusaurus-plugin-content-docs/current/docs');
const FR_DIR = path.join(ROOT, 'docs/docs');

// Frontmatter flags that must have the same value in both locales.
const PARITY_FLAGS = [
  'sidebar_position',
  'hide_feedback',
  'hide_title',
  'hide_table_of_contents',
  'breadcrumbs',
  'pagination_next',
  'pagination_prev',
  'slug',
];

// EN pages whose FR source has a <Walkthrough> but whose EN translation does
// not yet. Documented pending work (see MR !328 description). Remove the
// entry as soon as the EN walkthrough is added — never grow this set.
const KNOWN_PENDING_WALKTHROUGHS = new Set([
  'managed-services/kubernetes/actions/kubeconfig.mdx',
  'managed-services/kubernetes/actions/nodepools-add.mdx',
  'managed-services/kubernetes/actions/status.mdx',
  'managed-services/postgresql/actions/delete.mdx',
  'managed-services/postgresql/actions/patch.mdx',
  'managed-services/postgresql/actions/status.mdx',
  'network/internet-gateway/actions/administration/attach.mdx',
  'network/public-ip/actions/detach.mdx',
  'network/route-table/actions/administration/detach.mdx',
  'storage/block-storage/volumes/actions/detach.mdx',
]);

// EN pages whose tab-internal ### structure still differs from the FR
// source (translated/restructured section titles). Remove the entry once
// FR/EN match — never grow this set.
const KNOWN_H3_DRIFT = new Set([
  'catalog/actions/get.mdx',
  'compute/images/actions/list.mdx',
  'compute/keypairs/actions/update.mdx',
  'compute/vms/actions/create.mdx',
  'connectivity/direct-link/actions/create.mdx',
  'connectivity/hybrid-bridge/actions/create.mdx',
  'connectivity/vpn/route-vpn/actions/use/activate.mdx',
  'iam/access/actions/attribute.mdx',
  'iam/access/actions/audit.mdx',
  'iam/access/actions/get.mdx',
  'iam/access/actions/role.mdx',
  'iam/service-account/actions/create.mdx',
  'iam/service-account/actions/delete.mdx',
  'iam/service-account/actions/get.mdx',
  'iam/service-account/actions/list-spaces.mdx',
  'iam/service-account/actions/list.mdx',
  'iam/service-account/actions/update.mdx',
  'iam/space/actions/create.mdx',
  'iam/space/actions/delete.mdx',
  'iam/space/actions/list.mdx',
  'iam/space/actions/update.mdx',
  'iam/user/actions/create.mdx',
  'iam/user/actions/delete.mdx',
  'iam/user/actions/generate.mdx',
  'iam/user/actions/get.mdx',
  'iam/user/actions/list-spaces.mdx',
  'iam/user/actions/list.mdx',
  'iam/user/actions/update.mdx',
  'managed-services/concepts.mdx',
  'managed-services/kubernetes/actions/create.mdx',
  'managed-services/kubernetes/actions/delete.mdx',
  'managed-services/kubernetes/actions/kubeconfig.mdx',
  'managed-services/kubernetes/actions/nodepools-add.mdx',
  'managed-services/kubernetes/actions/nodepools-delete.mdx',
  'managed-services/kubernetes/actions/nodepools-get.mdx',
  'managed-services/kubernetes/actions/nodepools-list.mdx',
  'managed-services/kubernetes/actions/status.mdx',
  'managed-services/kubernetes/actions/versions.mdx',
  'managed-services/postgresql/actions/backup-create.mdx',
  'managed-services/postgresql/actions/backup-delete.mdx',
  'managed-services/postgresql/actions/backups-list.mdx',
  'managed-services/postgresql/actions/create.mdx',
  'managed-services/postgresql/actions/minor-upgrade.mdx',
  'managed-services/postgresql/actions/patch.mdx',
  'managed-services/postgresql/guides/security-authentication.mdx',
  'managed-services/registry/guides/manage-users-roles.mdx',
  'network/internet-gateway/actions/delete.mdx',
  'network/nat/actions/create.mdx',
  'network/public-ip/actions/attach.mdx',
  'network/public-ip/actions/deallocate.mdx',
  'storage/block-storage/volumes/actions/resize.mdx',
]);

// EN pages MISSING whole top-level (##) sections that exist in the FR
// source — real content losses to translate (worst: load-balancer create
// missing 9 API-walkthrough sections, support/general missing service
// status/hours). Remove the entry once the sections are translated —
// never grow this set.
const KNOWN_MISSING_H2 = new Set([
  'compute/images/actions/export.mdx',
  'compute/vms/actions/access.mdx',
  'connectivity/vpn/virtual-gateway/actions/attach.mdx',
  'inventory/actions/listBySpace.mdx',
  'network/dhcp/actions/delete.mdx',
  'network/internet-gateway/actions/administration/tutorial.mdx',
  'network/load-balancer/actions/load-balancer/create.mdx',
  'storage/block-storage/snapshots/actions/export.mdx',
  'support/general.mdx',
  'terraform/actions/ssh-vm.mdx',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue; // partials are not routed
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mdx|md)$/.test(e.name)) out.push(p);
  }
  return out;
}

function splitFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

function parseScalarFrontmatter(fm) {
  const flags = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.+)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^['"]|['"]$/g, '');
    if (v === 'null') v = null;
    else if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    flags[m[1]] = v;
  }
  return flags;
}

// Fenced code blocks may contain <TabItem>, headings or walkthrough steps
// that are examples, not page structure — remove them before comparing.
function stripCodeBlocks(content) {
  return content.replace(/^```[^\n]*\n[\s\S]*?\n```/gm, '');
}

function tabValues(content) {
  return [...stripCodeBlocks(content).matchAll(/<TabItem value="([^"]+)"/g)].map((m) => m[1]);
}

function walkthroughStepCount(content) {
  const s = stripCodeBlocks(content);
  if (!/<Walkthrough/.test(s)) return null;
  return [...s.matchAll(/img:\s*"/g)].length;
}

// FR action pages carry headings inside <TabItem> blocks (## Console
// {#tabhead-console}, renamed section titles, …); EN translations
// restructure those freely — they are presentation, tied to the tab labels
// already compared above. Headings OUTSIDE tabs are real page structure
// (## Permissions, ## Prérequis, …) and must match.
function contentOutsideTabs(content) {
  const s = stripCodeBlocks(content);
  return s.replace(/<TabItem[\s\S]*?<\/TabItem>/g, '');
}

function headingCount(content, level) {
  const s = level === '##' ? contentOutsideTabs(content) : stripCodeBlocks(content);
  return [...s.matchAll(new RegExp(`^${level} `, 'gm'))].length;
}

// Quote-style (" vs ') varies between locales and is irrelevant — compare
// imports modulo quotes.
function imports(content) {
  return [...content.matchAll(/^import .*$/gm)]
    .map((m) => m[0].replace(/["']/g, ''))
    .sort();
}

test('every EN page has a FR counterpart', () => {
  const missing = walk(EN_DIR)
    .map((p) => path.relative(EN_DIR, p))
    .filter((rel) => !fs.existsSync(path.join(FR_DIR, rel)));
  assert.deepStrictEqual(missing, [], `EN pages without FR source:\n${missing.join('\n')}`);
});

test('FR/EN structural parity', () => {
  const enFiles = walk(EN_DIR);
  assert.ok(enFiles.length > 200, `expected the full EN tree, got ${enFiles.length} files`);
  const problems = [];

  for (const enPath of enFiles) {
    const rel = path.relative(EN_DIR, enPath);
    const frPath = path.join(FR_DIR, rel);
    const en = fs.readFileSync(enPath, 'utf8');
    const fr = fs.readFileSync(frPath, 'utf8');

    const enFm = parseScalarFrontmatter(splitFrontmatter(en));
    const frFm = parseScalarFrontmatter(splitFrontmatter(fr));
    for (const flag of PARITY_FLAGS) {
      if (JSON.stringify(enFm[flag]) !== JSON.stringify(frFm[flag])) {
        problems.push(
          `${rel}: frontmatter ${flag} FR=${JSON.stringify(frFm[flag])} EN=${JSON.stringify(enFm[flag])}`
        );
      }
    }

    const frWt = walkthroughStepCount(fr);
    const enWt = walkthroughStepCount(en);
    if ((frWt === null) !== (enWt === null)) {
      if (KNOWN_PENDING_WALKTHROUGHS.has(rel)) {
        if (enWt !== null) {
          problems.push(`${rel}: EN walkthrough added — remove ${rel} from KNOWN_PENDING_WALKTHROUGHS`);
        }
      } else {
        problems.push(
          `${rel}: <Walkthrough> present in one locale only (FR steps=${frWt}, EN steps=${enWt})`
        );
      }
    } else if (frWt !== null && frWt !== enWt) {
      problems.push(`${rel}: Walkthrough step count FR=${frWt} EN=${enWt}`);
    }

    const frTabs = JSON.stringify(tabValues(fr));
    const enTabs = JSON.stringify(tabValues(en));
    if (frTabs !== enTabs) {
      problems.push(`${rel}: tab values FR=${frTabs} EN=${enTabs}`);
    }

    for (const level of ['##', '###']) {
      // The glossary is organized into alphabetical (##) sections; a term sorts
      // into a different letter per language (e.g. "Journal de décision" → J in
      // FR, "Decision log" → D in EN), so its ## section counts legitimately
      // differ between locales. Skip the ## check here (term-level ### still runs).
      if (level === '##' && rel === 'glossary/index.mdx') continue;
      const frH = headingCount(fr, level);
      const enH = headingCount(en, level);
      if (frH !== enH) {
        if (level === '##' && KNOWN_MISSING_H2.has(rel)) {
          if (frH === enH) {
            problems.push(`${rel}: sections restored — remove ${rel} from KNOWN_MISSING_H2`);
          }
        } else if (level === '###' && KNOWN_H3_DRIFT.has(rel)) {
          if (frH === enH) {
            problems.push(`${rel}: ### structure aligned — remove ${rel} from KNOWN_H3_DRIFT`);
          }
        } else {
          problems.push(`${rel}: ${level} heading count FR=${frH} EN=${enH}`);
        }
      }
    }

    // Skip imports for pages awaiting their EN walkthrough: the diff there
    // is exactly the missing Walkthrough import, tracked above.
    if (!KNOWN_PENDING_WALKTHROUGHS.has(rel)) {
      const frImports = JSON.stringify(imports(fr));
      const enImports = JSON.stringify(imports(en));
      if (frImports !== enImports) problems.push(`${rel}: imports FR=${frImports} EN=${enImports}`);
    }
  }

  assert.strictEqual(
    problems.length,
    0,
    `${problems.length} parity problem(s):\n${problems.join('\n')}`
  );
});
