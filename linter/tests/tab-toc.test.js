// Tab-TOC grouping test.
//
// Action pages render their steps inside <Tabs> (Console / API / Terraform,
// Linux / Windows, …). For the right-hand TOC to group the page content by
// tab, each <TabItem> must carry a real H2 heading with an explicit
// `tabhead-*` id (`## Console {#tabhead-console}`), hidden in the page body
// by the single CSS rule in src/css/custom.css
// (`.markdown h2[id^="tabhead-"]`). Without it the TOC falls back to a flat
// list that hides the tab structure (or nothing at all when the tab content
// has no heading).
//
// Contract enforced here, for every page using <Tabs> (both locales):
//   - every <TabItem> contains exactly one `##` heading whose explicit id is
//     `tabhead-<value>` (id compared case-insensitively: the FR tree carries
//     both `tabhead-console` and `tabhead-Console` for value="Console"/"console");
//   - the heading text is the tab label (falls back to the value when the
//     <TabItem> has no label — that is what the tab button displays);
//   - no `tabhead-*` id may exist that does not belong to a tab of the page
//     (catches typos and leftovers after a tab is renamed or removed).
//
// Like the other repo-level guards, this runs on every CI pipeline
// (`node --test linter/tests/*.test.js`).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DOC_ROOTS = [
  path.join(ROOT, 'docs/docs'),
  path.join(ROOT, 'i18n/fr/docusaurus-plugin-content-docs/current/docs'),
];

// Fenced code blocks may contain <TabItem>/heading examples — not page
// structure (same rule as parity.test.js).
function stripCodeBlocks(content) {
  return content.replace(/^```[^\n]*\n[\s\S]*?\n```/gm, '');
}

// A commented-out <TabItem> is not rendered and must not be required (same
// rule as linter/rules/tabs-structure.js).
function stripJsxComments(s) {
  return s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_')) continue; // partials are not routed
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mdx|md)$/.test(e.name)) out.push(p);
  }
  return out;
}

function audit(content) {
  const body = stripJsxComments(stripCodeBlocks(content));
  if (!/<Tabs[\s>]/.test(body)) return null;

  const problems = [];
  // No nested <TabItem> in the docs tree (verified repo-wide), so a
  // non-greedy open→close match is exactly one tab block. Quote- and
  // order-tolerant: some pages use value='console' (single quotes).
  const blocks = [...body.matchAll(/<TabItem\b[^>]*>[\s\S]*?<\/TabItem>/g)];
  const tabIds = new Set();

  for (const block of blocks) {
    const value = block[0].match(/value=["']([^"']+)["']/)[1];
    tabIds.add(`tabhead-${value}`.toLowerCase());
    const labelMatch = block[0].match(/label=["']([^"']*)["']/);
    const label = labelMatch ? labelMatch[1] : '';
    const wantText = label || value;
    const wantId = `tabhead-${value}`.toLowerCase();

    const headings = [...block[0].matchAll(/^##\s+(.+?)\s*\{#(tabhead-[^}]+)\}\s*$/gm)];
    const matching = headings.filter(([, , id]) => id.toLowerCase() === wantId);

    if (matching.length === 0) {
      problems.push(`<TabItem value="${value}"> has no "## ${wantText} {#${wantId}}" heading`);
    } else if (matching.length > 1) {
      problems.push(`<TabItem value="${value}"> has ${matching.length} tabhead headings, expected 1`);
    } else if (matching[0][1] !== wantText) {
      problems.push(
        `<TabItem value="${value}"> tabhead text is "${matching[0][1]}", expected "${wantText}"`
      );
    }
  }

  // Every tabhead id in the page must belong to one of its tabs.
  for (const [, id] of body.matchAll(/\{#(tabhead-[^}]+)\}/g)) {
    if (!tabIds.has(id.toLowerCase())) {
      problems.push(`tabhead id "${id}" does not match any <TabItem value> of the page`);
    }
  }

  return { tabCount: blocks.length, problems };
}

test('every page using <Tabs> carries one hidden tabhead H2 per tab (TOC grouping)', () => {
  const files = DOC_ROOTS.flatMap((root) => walk(root));
  const problems = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const result = audit(fs.readFileSync(file, 'utf8'));
    if (!result) continue;
    for (const problem of result.problems) {
      problems.push(`${rel}: ${problem}`);
    }
  }

  assert.deepStrictEqual(problems, [], `tabhead/TOC contract violated:\n${problems.join('\n')}`);
});

// Self-test of the audit helper on synthetic content (mirrors
// last-updated-date.test.js style).
test('audit helper: missing, duplicate, deviant and orphan tabheads are detected', () => {
  const ok = [
    '<Tabs>',
    '<TabItem value="console" label="Console" default>',
    '## Console {#tabhead-console}',
    'content',
    '</TabItem>',
    '<TabItem value="api" label="API">',
    '## API {#tabhead-api}',
    '</TabItem>',
    '</Tabs>',
  ].join('\n');
  assert.deepStrictEqual(audit(ok).problems, []);

  // No label → text falls back to the value; id case-insensitive.
  const noLabel = [
    '<Tabs>',
    '<TabItem value="Linux" default>',
    '## Linux {#tabhead-linux}',
    '</TabItem>',
    '</Tabs>',
  ].join('\n');
  assert.deepStrictEqual(audit(noLabel).problems, []);

  const missing = ok.replace('## API {#tabhead-api}\n', '');
  assert.match(audit(missing).problems[0], /no "## API \{#tabhead-api\}"/);

  const duplicate = ok.replace('content', '## Console {#tabhead-console}\ncontent');
  assert.match(audit(duplicate).problems[0], /2 tabhead headings/);

  const deviant = ok.replace('## Console {#tabhead-console}', '## Console page {#tabhead-console}');
  assert.match(audit(deviant).problems[0], /tabhead text is "Console page", expected "Console"/);

  // A tab without its tabhead heading is a missing-heading problem…
  const missingTab = ok.replace('</Tabs>', '<TabItem value="old" label="Old">\n</TabItem>\n</Tabs>');
  assert.match(audit(missingTab).problems[0], /no "## Old \{#tabhead-old\}"/);

  // …while a tabhead id belonging to no tab of the page (leftover after a
  // tab is renamed or removed) is the orphan-id problem.
  const orphanId = ok.replace('</Tabs>', '</Tabs>\n\n## Legacy {#tabhead-legacy}');
  assert.match(audit(orphanId).problems[0], /does not match any <TabItem value>/);
});

test('audit helper: pages without <Tabs> are ignored', () => {
  assert.strictEqual(audit('# A page\n\nSome content.\n'), null);
  // TabItem examples inside a fenced code block are not page structure.
  assert.strictEqual(
    audit('# A page\n\n```mdx\n<Tabs>\n<TabItem value="console">\n</TabItem>\n</Tabs>\n```\n'),
    null
  );
});
