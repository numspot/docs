// OpenAPI anchor guard.
//
// Action pages and guides link to the API reference with deep anchors of the
// form /openapi/#tag/<tag>/<METHOD>/<path>. When an operation is renamed or
// removed from the spec, those anchors silently rot into dead links (they
// still render — Scalar just shows nothing useful). This test resolves every
// anchor in the documentation trees (EN + FR) against the committed mirror
// static/files/openapi.yaml, the same artifact the /openapi/ pages render.
//
// The mirror is regenerated from the live spec
// (https://api.eu-west-2.numspot.com/openapi — the published OCI artifact via
// `make spec-update` on the internal side). When this test fails after an API
// change: refresh the mirror, then fix the pages it exposes.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const SPEC = fs.readFileSync(path.join(ROOT, 'static', 'files', 'openapi.yaml'), 'utf8');

// Line-based operation set — same parser shape as the permissions-mapping
// guard; keeps the linter dependency-free (no YAML library).
const specSet = new Set();
{
  let current = null;
  for (const line of SPEC.split('\n')) {
    const pathMatch = line.match(/^  (\/\S+):$/);
    if (pathMatch) { current = pathMatch[1]; continue; }
    const methodMatch = line.match(/^    (get|post|put|delete|patch):$/);
    if (methodMatch && current) specSet.add(`${methodMatch[1].toUpperCase()} ${current}`);
  }
}

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(mdx?|json)$/.test(entry.name)) files.push(full);
  }
})(path.join(ROOT, 'docs', 'docs'));
(function walkI18n(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkI18n(full);
    else if (/\.(mdx?|json)$/.test(entry.name)) files.push(full);
  }
})(path.join(ROOT, 'i18n'));

const anchorRe = /openapi\/#tag\/([a-zA-Z0-9-]+)\/(GET|POST|PUT|DELETE|PATCH)\/([^)#\s"'<>]+)/g;
const dec = (s) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

let ok = 0;
const broken = new Map();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const m of content.matchAll(anchorRe)) {
    let p;
    try { p = decodeURIComponent(m[3]); } catch { p = m[3]; }
    p = '/' + p.replace(/^\//, '');
    if (specSet.has(`${m[2]} ${p}`)) ok++;
    else {
      if (!broken.has(file)) broken.set(file, new Set());
      broken.get(file).add(`${m[2]} ${p}`);
    }
  }
}

test('every /openapi/#tag anchor resolves against the OpenAPI mirror', () => {
  assert.ok(specSet.size > 100, 'the OpenAPI mirror exposes no operations — regenerate it from the live spec');
  const report = [...broken.entries()]
    .sort()
    .map(([file, set]) => [...set].map((ep) => `  - [${path.relative(ROOT, file)}] ${ep}`).join('\n'))
    .join('\n');
  assert.equal(broken.size, 0, `${broken.size} file(s) carry dead OpenAPI anchors:\n${report}`);
});
