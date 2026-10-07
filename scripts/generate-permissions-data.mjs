// Regenerate the data files of the PermissionsExplorer component from the
// live IAM API:
//
//   src/components/PermissionsExplorer/permissions.json  (uuid + tenant added)
//   src/components/PermissionsExplorer/roles.json        (standard roles catalog
//                                                         and role → permissions
//                                                         mapping)
//
// Usage:
//   IAM_TOKEN="{TOKEN}" node scripts/generate-permissions-data.mjs
//   IAM_TOKEN="…" IAM_ORG_ID="…" IAM_SPACE_ID="…" node scripts/generate-permissions-data.mjs
//
// IAM_TOKEN is a Bearer access token (IAM API authentication flow, see
// /docs/iam/concepts/api/). When IAM_ORG_ID / IAM_SPACE_ID are omitted, the
// script decodes the JWT payload and looks for organisation / space claims;
// if discovery fails, it prints the claim keys so the IDs can be passed
// explicitly.
//
// The API responses are also cached under .permissions-cache/ for debugging.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = process.env.IAM_BASE_URL ?? 'https://api.eu-west-2.numspot.com';
const TOKEN = process.env.IAM_TOKEN;
const COMPONENT_DIR = path.resolve('src/components/PermissionsExplorer');
const CACHE_DIR = path.resolve('.permissions-cache');

if (!TOKEN) {
  console.error('Missing IAM_TOKEN environment variable (Bearer access token).');
  process.exit(1);
}

function decodeJwtPayload(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function apiGet(pathname) {
  const url = `${BASE_URL}${pathname}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} on GET ${pathname}: ${await response.text()}`);
  }
  return response.json();
}

// Follows the deepObject pagination (page[size], page[nextToken]) and yields
// every item of the paginated list.
async function listAll(pathname) {
  const items = [];
  let nextToken;
  do {
    const search = new URLSearchParams({ 'page[size]': '50' });
    if (nextToken) search.set('page[nextToken]', nextToken);
    const page = await apiGet(`${pathname}?${search.toString()}`);
    items.push(...(page.items ?? []));
    nextToken = page.nextPageToken;
  } while (nextToken);
  return items;
}

// Cache each raw response for offline inspection.
async function cachedList(label, pathname) {
  const items = await listAll(pathname);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CACHE_DIR, `${label}.json`),
    JSON.stringify({ pathname, count: items.length, items }, null, 2) + '\n',
  );
  console.log(`${label}: ${items.length} items`);
  return items;
}

function deriveTenant(endpoints, fallback) {
  const tenants = new Set();
  for (const endpoint of endpoints ?? []) {
    if (endpoint.path.includes('/organisations/{organisationId}/')) tenants.add('organisation');
    if (endpoint.path.includes('/spaces/{spaceId}/')) tenants.add('space');
  }
  if (tenants.size === 0 && fallback) tenants.add(fallback);
  return [...tenants].sort();
}

async function main() {
  const payload = decodeJwtPayload(TOKEN);
  let orgId = process.env.IAM_ORG_ID;
  let spaceId = process.env.IAM_SPACE_ID;

  if (!orgId || !spaceId) {
    console.log('JWT payload claims:', payload ? Object.keys(payload) : '(undecodable)');
    console.log(JSON.stringify(payload, null, 2));
  }
  if (!orgId) {
    for (const key of ['organisationId', 'org_id', 'organisation', 'org']) {
      if (payload?.[key]) { orgId = payload[key]; break; }
    }
  }
  if (!spaceId) {
    for (const key of ['spaceId', 'space_id', 'space']) {
      if (payload?.[key]) { spaceId = payload[key]; break; }
    }
  }
  console.log(` organisationId: ${orgId ?? '(not found — set IAM_ORG_ID)'}`);
  console.log(` spaceId: ${spaceId ?? '(not found — set IAM_SPACE_ID)'}`);
  if (!orgId || !spaceId) process.exit(1);

  // 1. Registered permissions (uuid + name + description) at both tenants.
  // The organisation level requires iam.permission.get / iam.role.get at that
  // tenant: on 403, warn and continue with the space catalog only.
  const catalog = [];
  for (const [tenantType, permissionsPath, rolesPath] of [
    ['organisation', `/iam/organisations/${orgId}/permissions`, `/iam/organisations/${orgId}/roles`],
    ['space', `/iam/spaces/${spaceId}/permissions`, `/iam/spaces/${spaceId}/roles`],
  ]) {
    try {
      const tenantPermissions = await cachedList(`permissions-${tenantType}`, permissionsPath);
      const tenantRoles = await cachedList(`roles-${tenantType}`, rolesPath);
      catalog.push({ tenantType, tenantPermissions, tenantRoles, rolesPath });
    } catch (error) {
      if (String(error).includes('403')) {
        console.warn(`${tenantType} level not accessible (403) — skipping its catalog; grant iam.permission.get / iam.role.get at this level to include it.`);
      } else {
        throw error;
      }
    }
  }

  // 2. Standard roles per tenant type, with their assigned permissions.
  const roles = [];
  for (const { tenantType, tenantRoles, rolesPath } of catalog) {
    const tenantRoles = await cachedList(`roles-${tenantType}`, rolesPath);
    for (const role of tenantRoles) {
      const roleUuid = role.uuid;
      if (!roleUuid) {
        console.warn(`Role without uuid: ${JSON.stringify(role)}`);
        continue;
      }
      const rolePermissions = await cachedList(
        `role-${tenantType}-${roleUuid}-permissions`,
        `${rolesPath}/${roleUuid}/permissions`,
      );
      roles.push({
        uuid: roleUuid,
        name: role.name,
        description: role.description ?? '',
        tenantType: role.tenantType ?? [tenantType],
        permissions: rolePermissions.map((permission) => permission.name).sort(),
      });
    }
  }

  // 3. Merge into permissions.json: keep the existing endpoints, add uuid and
  //    tenant from the API, report drift on both sides.
  const filePath = path.join(COMPONENT_DIR, 'permissions.json');
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const byName = new Map();
  const tenantOfName = new Map();
  for (const { tenantType, tenantPermissions } of catalog) {
    for (const permission of tenantPermissions) {
      if (!byName.has(permission.name)) byName.set(permission.name, permission);
      tenantOfName.set(permission.name, (tenantOfName.get(permission.name) ?? new Set()).add(tenantType));
    }
  }

  const permissions = existing.permissions.map((permission) => {
    const registered = byName.get(permission.name);
    // Endpoints decide the tenant; console-only permissions (no endpoints)
    // inherit the tenant level of the catalog they were exported from.
    const derived = deriveTenant(permission.endpoints, null);
    const entry = {
      name: permission.name,
      domain: permission.domain,
      description: permission.description,
    };
    if (registered) {
      entry.uuid = registered.uuid;
      entry.tenant =
        derived.length > 0
          ? derived
          : [...(tenantOfName.get(permission.name) ?? [])];
      byName.delete(permission.name);
    } else {
      // Not returned by the API (e.g. organisation catalog not accessible):
      // keep the existing uuid and derive the tenant from the endpoints.
      if (permission.uuid) entry.uuid = permission.uuid;
      if (derived.length > 0) entry.tenant = derived;
      else if (permission.tenant) entry.tenant = permission.tenant;
    }
    entry.endpoints = permission.endpoints;
    return entry;
  });

  // Registered permissions without a documented endpoint are actions performed
  // by the console (or upcoming APIs): keep them so the explorer mirrors the
  // full IAM catalog and the standard role tags stay meaningful.
  for (const [name, registered] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    permissions.push({
      name,
      domain: name.split('.')[0],
      description: registered.description ?? '',
      uuid: registered.uuid,
      tenant: [...tenantOfName.get(name) ?? ['space']],
      endpoints: [],
    });
  }
  byName.clear();

  const orphan = [...byName.keys()];
  if (orphan.length > 0) {
    console.warn(`Registered permissions without a documented endpoint, added with an empty endpoint list: ${orphan.length}`);
  }

  const updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(filePath, JSON.stringify({ updatedAt, permissions }, null, 2) + '\n');
  fs.writeFileSync(
    path.join(COMPONENT_DIR, 'roles.json'),
    JSON.stringify({ updatedAt, roles }, null, 2) + '\n',
  );
  console.log(`permissions.json: ${permissions.length} permissions (${permissions.filter((p) => p.uuid).length} with uuid)`);
  console.log(`roles.json: ${roles.length} roles`);
}

await main();
