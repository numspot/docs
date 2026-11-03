// Permissions ↔ documentation coherence guard.
//
// The PermissionsExplorer mapping (src/components/PermissionsExplorer/
// permissions.json) is maintained by hand: the `tenant` and `uuid` fields are
// synced from the IAM API by scripts/generate-permissions-data.mjs, but the
// permission → endpoints mapping is not. Action pages declare their own
// permission list. Nothing else cross-checks the three sources (action pages,
// permissions.json, the OpenAPI mirror in static/files/openapi.yaml), so the
// mapping silently drifted for months (audit of 2026-10-29: wrong permission
// families declared on ~20 pages, ~25 documented endpoints mapped to no
// permission, endpoints absent from the spec mirror).
//
// This test replays that audit on every run:
//   - roles.json must only reference permissions that exist in the catalog;
//   - mapped endpoints must exist in the OpenAPI mirror;
//   - tenant metadata must match the paths a permission maps;
//   - every endpoint a page documents must be mapped to a permission the page
//     declares (warn level — the known backlog lives in the baseline fixture);
//   - a page declaring a permission must have at least one of its endpoints
//     mapped to it.
//
// ERRORs fail the suite outright, except the ones listed in the baseline
// fixture (API-side drift that only the IAM team can settle). WARNs must stay
// a subset of the baseline: any new mismatch fails the run. Fixing pages
// shrinks the baseline — prune it as the list shrinks.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'src', 'components', 'PermissionsExplorer');
const DOCS = path.join(ROOT, 'docs', 'docs');
const BASELINE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'permissions-mapping-baseline.json'), 'utf8'),
);

const permsData = JSON.parse(fs.readFileSync(path.join(DATA, 'permissions.json'), 'utf8'));
const rolesData = JSON.parse(fs.readFileSync(path.join(DATA, 'roles.json'), 'utf8'));
const permissions = permsData.permissions;
const permByName = new Map(permissions.map((p) => [p.name, p]));

const issues = [];
const add = (level, file, msg) => issues.push({ level, file, msg });
const dec = (s) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

// ---------- OpenAPI mirror operation set (line-based, no YAML dependency) ----------
const spec = fs.readFileSync(path.join(ROOT, 'static', 'files', 'openapi.yaml'), 'utf8');
const specSet = new Set();
{
  let current = null;
  for (const line of spec.split('\n')) {
    const pathMatch = line.match(/^  (\/\S+):$/);
    if (pathMatch) { current = pathMatch[1]; continue; }
    const methodMatch = line.match(/^    (get|post|put|delete|patch):$/);
    if (methodMatch && current) specSet.add(`${methodMatch[1].toUpperCase()} ${current}`);
  }
}
test('OpenAPI mirror is present and parses at the operation level', () => {
  assert.ok(specSet.size > 100, `mirror exposes ${specSet.size} operations — regenerate it from the live spec`);
});

// ---------- A) roles → catalog ----------
for (const role of rolesData.roles) {
  for (const name of role.permissions) {
    if (!permByName.has(name)) {
      add('error', `roles.json [${role.name}]`, `references unknown permission "${name}"`);
    }
  }
}

// ---------- B) duplicate endpoint mapping ----------
const epOwners = new Map();
for (const p of permissions) {
  for (const ep of p.endpoints ?? []) {
    const key = `${ep.method} ${dec(ep.path)}`;
    if (!epOwners.has(key)) epOwners.set(key, []);
    epOwners.get(key).push(p.name);
  }
}
for (const [key, owners] of [...epOwners.entries()].sort()) {
  if (owners.length > 1) {
    add('warn', 'permissions.json', `${key} mapped to ${owners.length} permissions: ${owners.join(', ')}`);
  }
}

// ---------- C) mapped endpoints must exist in the OpenAPI mirror ----------
for (const p of permissions) {
  for (const ep of p.endpoints ?? []) {
    const key = `${ep.method} ${dec(ep.path)}`;
    if (!specSet.has(key)) {
      add('error', `permissions.json [${p.name}]`, `endpoint ${key} not found in openapi.yaml mirror`);
    }
  }
}

// ---------- D) tenant metadata coherence ----------
for (const p of permissions) {
  const eps = p.endpoints ?? [];
  if (eps.length === 0) continue;
  const needsOrg = eps.some((e) => e.path.includes('/organisations/{organisationId}/'));
  const needsSpace = eps.some((e) => e.path.includes('/spaces/{spaceId}/'));
  const tenant = p.tenant ?? [];
  if (needsOrg && !tenant.includes('organisation')) add('error', `permissions.json [${p.name}]`, `organisation endpoints but tenant=${JSON.stringify(tenant)}`);
  if (needsSpace && !tenant.includes('space')) add('error', `permissions.json [${p.name}]`, `space endpoints but tenant=${JSON.stringify(tenant)}`);
  if (tenant.includes('organisation') && !needsOrg) add('warn', `permissions.json [${p.name}]`, `tenant has "organisation" but no organisation endpoint`);
}

// ---------- E) parse the action pages ----------
const pages = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(mdx|md)$/.test(entry.name)) pages.push(full);
  }
})(DOCS);

const rel = (f) => path.relative(ROOT, f);
const declaredPages = [];
for (const file of pages) {
  const content = fs.readFileSync(file, 'utf8');
  if (!/This action requires the following (?:\*\*)?IAM/.test(content)) continue;
  const permSection = content.split(/^## Permissions.*$/m)[1] ?? '';
  const stop = permSection.split(/^<Tabs>|^:::note|^## /m)[0];
  const perms = [...stop.matchAll(/^- (?:\*\*|`)([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)(?:\*\*|`)\s*$/gm)].map((m) => m[1]);
  const eps = new Set();
  for (const m of content.matchAll(/#tag\/[a-zA-Z0-9-]+\/(GET|POST|PUT|DELETE|PATCH)\/([^)#\s]+)/g)) {
    eps.add(`${m[1]} /${dec(m[2]).replace(/^\//, '')}`);
  }
  for (const m of content.matchAll(/(?:^|\s)(GET|POST|PUT|DELETE|PATCH) (\/[a-zA-Z0-9{}_\-/.]+)/g)) {
    eps.add(`${m[1]} ${m[2]}`);
  }
  declaredPages.push({ file, perms, eps: [...eps] });
  if (perms.length === 0) {
    add('warn', rel(file), 'declares IAM permissions but none parseable');
  }
}

test('action pages declare parseable IAM permissions', () => {
  assert.ok(declaredPages.length > 100, `${declaredPages.length} pages declare permissions — the page parser regressed`);
});

// ---------- F) page endpoints ↔ declared permissions ----------
for (const { file, perms, eps } of declaredPages) {
  const declaredSet = new Set(perms);
  const documentedEps = eps.filter((e) => /^\/[a-z]/.test(e.split(' ')[1] ?? ''));
  for (const ep of documentedEps) {
    const owners = epOwners.get(ep) ?? [];
    const ok = owners.some((o) => declaredSet.has(o));
    if (!ok) {
      if (owners.length > 0) {
        add('warn', rel(file), `endpoint ${ep} mapped only to [${owners.join(', ')}] — page declares [${perms.join(', ')}]`);
      } else {
        add('warn', rel(file), `endpoint ${ep} documented but mapped to NO permission in permissions.json`);
      }
    }
  }
}

// ---------- G) pages declaring permissions that own none of the page endpoints ----------
for (const { file, perms, eps } of declaredPages) {
  for (const name of perms) {
    const p = permByName.get(name);
    if (!p) continue;
    const epSet = new Set(eps);
    const owned = (p.endpoints ?? []).filter((e) => epSet.has(`${e.method} ${dec(e.path)}`));
    if (owned.length === 0 && eps.size > 0) {
      add('warn', rel(file), `declares "${name}" but none of the page's ${eps.size} endpoint(s) is mapped to it`);
    }
  }
}

// ---------- report + assertions ----------
const key = (i) => `${i.file} :: ${i.msg}`;
const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn').map(key).sort();
const knownErrors = new Set(BASELINE.knownErrors);
const knownWarns = new Set(BASELINE.knownWarns);

test('no new permission-mapping errors', () => {
  const unexpected = errors.map(key).filter((k) => !knownErrors.has(k));
  assert.deepEqual(
    unexpected,
    [],
    `New permission-mapping errors (fix the pages/data, or — API-side drift only — extend linter/tests/fixtures/permissions-mapping-baseline.json):\n${unexpected.join('\n')}`,
  );
});

test('no new permission-mapping warnings beyond the baseline', () => {
  const unexpected = warns.filter((w) => !knownWarns.has(w));
  assert.deepEqual(
    unexpected,
    [],
    `New page ↔ permissions.json ↔ spec mismatches (fix the pages or the mapping):\n${unexpected.join('\n')}`,
  );
});
