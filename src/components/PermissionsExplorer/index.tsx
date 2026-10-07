import React, { useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import type { ReactNode } from 'react';
import styles from './styles.module.css';
import data from './permissions.json';
import rolesData from './roles.json';

type TenantType = 'organisation' | 'space';

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary: string;
};

type Permission = {
  name: string;
  domain: string;
  description: string;
  uuid?: string;
  /** Tenant levels the permission is exercised at; a permission available at
      both levels lists both and is rendered under each umbrella section. */
  tenant?: TenantType[];
  endpoints: Endpoint[];
};

type Role = {
  uuid: string;
  name: string;
  description: string;
  tenantType: TenantType[];
  permissions: string[];
};

type DomainMeta = {
  label: { fr: string; en: string };
  tag: string;
};

// Permission domain -> display label (FR/EN) and OpenAPI tag slug
// (anchors: /openapi/#tag/<tag>/<METHOD>/<path>).
const DOMAIN_META: Record<string, DomainMeta> = {
  compute: { label: { fr: 'Compute', en: 'Compute' }, tag: 'compute' },
  connectivity: { label: { fr: 'Connectivité', en: 'Connectivity' }, tag: 'connectivity' },
  iam: {
    label: { fr: 'IAM', en: 'IAM' },
    tag: 'identity-access-management',
  },
  inventory: { label: { fr: 'Inventaire', en: 'Inventory' }, tag: 'inventory' },
  kubernetes: { label: { fr: 'Kubernetes', en: 'Kubernetes' }, tag: 'kubernetes' },
  postgresql: { label: { fr: 'PostgreSQL', en: 'PostgreSQL' }, tag: 'postgresql' },
  registry: {
    label: { fr: 'Container Registry', en: 'Container Registry' },
    tag: 'registry',
  },
};

const TENANT_ORDER: TenantType[] = ['organisation', 'space'];

const permissions = data.permissions as Permission[];
const roles = (rolesData.roles ?? []) as Role[];

function endpointMatches(endpoint: Endpoint, query: string): boolean {
  return (
    endpoint.path.toLowerCase().includes(query) ||
    endpoint.method.toLowerCase() === query ||
    endpoint.summary.toLowerCase().includes(query)
  );
}

function Highlighted({
  text,
  query,
}: {
  text: string;
  query: string;
}): ReactNode {
  if (!query) {
    return <>{text}</>;
  }
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export default function PermissionsExplorer(): ReactNode {
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [tenantFilter, setTenantFilter] = useState<'all' | TenantType>('all');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Closes the role dropdown on any click outside of it.
  React.useEffect(() => {
    if (!roleMenuOpen) return;
    function onMouseDown(event: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [roleMenuOpen]);

  const q = query.trim().toLowerCase();

  const { i18n } = useDocusaurusContext();
  const locale = i18n.currentLocale.startsWith('en') ? 'en' : 'fr';

  function domainLabel(domain: string): string {
    return DOMAIN_META[domain]?.label[locale] ?? domain;
  }

  function domainTag(domain: string): string {
    return DOMAIN_META[domain]?.tag ?? domain;
  }

  function tenantLabel(tenant: TenantType): string {
    return tenant === 'organisation'
      ? translate({
          id: 'permexplorer.tenant.organisation',
          message: 'Organisation',
          description: 'Tenant level: organisation',
        })
      : translate({
          id: 'permexplorer.tenant.space',
          message: 'Espace',
          description: 'Tenant level: space',
        });
  }

  function tenantNameSuffix(tenantType: TenantType[]): string {
    // Distinguishes same-named roles defined for both tenant levels.
    return tenantType.length === 1
      ? ` — ${tenantLabel(tenantType[0] as TenantType)}`
      : '';
  }

  function copyUuid(uuid: string) {
    navigator.clipboard?.writeText(uuid).then(
      () => {
        setCopiedUuid(uuid);
        window.setTimeout(() => setCopiedUuid(null), 1500);
      },
      () => undefined,
    );
  }

  // Role lookup: permission name -> standard roles granting it.
  const rolesByPermission = useMemo(() => {
    const map = new Map<string, Role[]>();
    for (const role of roles) {
      for (const name of role.permissions) {
        const list = map.get(name) ?? [];
        list.push(role);
        map.set(name, list);
      }
    }
    return map;
  }, []);

  // Roles selected in the multi-select: a permission matches when at least one
  // of them grants it.
  const selectedRoles = useMemo(
    () =>
      roleFilters
        .map((uuid) => roles.find((role) => role.uuid === uuid))
        .filter((role): role is Role => Boolean(role)),
    [roles, roleFilters],
  );

  function toggleRoleFilter(uuid: string) {
    setRoleFilters((uuids) =>
      uuids.includes(uuid) ? uuids.filter((id) => id !== uuid) : [...uuids, uuid],
    );
  }

  // Dropdown groups: one section per tenant level.
  const roleGroups = useMemo(
    () =>
      (['organisation', 'space'] as TenantType[]).map((tenant) => ({
        tenant,
        roles: roles.filter((role) => role.tenantType.includes(tenant)),
      })),
    [],
  );

  const { matches, apiTotal } = useMemo(() => {
    const result: { permission: Permission; endpoints: Endpoint[]; nameHit: boolean }[] = [];
    let apiTotal = 0;
    for (const permission of permissions) {
      if (
        tenantFilter !== 'all' &&
        !(permission.tenant ?? TENANT_ORDER).includes(tenantFilter)
      ) {
        continue;
      }
      if (
        roleFilters.length > 0 &&
        !rolesByPermission.get(permission.name)?.some((role) => roleFilters.includes(role.uuid))
      ) {
        continue;
      }
      const nameHit =
        !q ||
        permission.name.toLowerCase().includes(q) ||
        permission.description.toLowerCase().includes(q);
      const endpoints = nameHit
        ? permission.endpoints
        : permission.endpoints.filter((endpoint) => endpointMatches(endpoint, q));
      if (endpoints.length > 0) {
        result.push({ permission, endpoints, nameHit });
        apiTotal += endpoints.length;
      }
    }
    return { matches: result, apiTotal };
  }, [q, tenantFilter, roleFilters, rolesByPermission]);

  const domainGroups = useMemo(() => {
    const groups = new Map<string, { permission: Permission; endpoints: Endpoint[]; nameHit: boolean }[]>();
    for (const match of matches) {
      const list = groups.get(match.permission.domain) ?? [];
      list.push(match);
      groups.set(match.permission.domain, list);
    }
    return [...groups.entries()].sort((a, b) =>
      domainLabel(a[0]).localeCompare(domainLabel(b[0]), locale),
    );
  }, [matches, locale]);

  // Umbrella sections per tenant level: each permission appears under every
  // tenant it covers.
  const tenantSections = useMemo(
    () =>
      TENANT_ORDER.filter(
        (tenant) => tenantFilter === 'all' || tenantFilter === tenant,
      ).map((tenant) => ({
        tenant,
        domains: domainGroups.filter(([, groupMatches]) =>
          groupMatches.some((match) =>
            (match.permission.tenant ?? TENANT_ORDER).includes(tenant),
          ),
        ),
      })),
    [domainGroups, tenantFilter],
  );

  const suggestions = useMemo(() => {
    const permPart: Permission[] = [];
    const epPart: { permission: Permission; endpoint: Endpoint }[] = [];
    if (q) {
      for (const permission of permissions) {
        if (
          permission.name.toLowerCase().includes(q) ||
          permission.description.toLowerCase().includes(q)
        ) {
          permPart.push(permission);
        }
        for (const endpoint of permission.endpoints) {
          if (endpointMatches(endpoint, q)) {
            epPart.push({ permission, endpoint });
          }
        }
      }
    }
    return {
      perms: permPart.slice(0, 8),
      totalPerms: permPart.length,
      eps: epPart.slice(0, 8),
      totalEps: epPart.length,
    };
  }, [q]);

  const flatSuggestions = useMemo(
    () => [
      ...suggestions.perms.map((permission) => ({ label: permission.name, value: permission.name })),
      ...suggestions.eps.map(({ permission, endpoint }) => ({
        label: `${endpoint.method} ${endpoint.path}`,
        value: permission.name,
        method: endpoint.method,
      })),
    ],
    [suggestions],
  );

  function pick(value: string) {
    setQuery(value);
    setDropdownOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, flatSuggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (selected >= 0 && flatSuggestions[selected]) {
        pick(flatSuggestions[selected].value);
      }
    } else if (event.key === 'Escape') {
      setQuery('');
      setDropdownOpen(false);
    }
  }

  return (
    <div className={styles.explorer}>
      <div className={styles.searchBox}>
        <svg
          className={styles.searchIcon}
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(-1);
            setDropdownOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            window.setTimeout(() => setDropdownOpen(false), 150);
          }}
          placeholder={translate({
            id: 'permexplorer.search.placeholder',
            message: "Search for a permission (iam.space.create) or an API (POST /iam/spaces…)…",
            description: 'Search placeholder of the IAM permissions page',
          })}
          aria-label={translate({
            id: 'permexplorer.search.aria',
            message: "Search for a permission or an API",
            description: 'Search field accessible name of the IAM permissions page',
          })}
          spellCheck={false}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className={styles.clearButton}
            aria-label={translate({
              id: 'permexplorer.clear',
              message: "Clear the search",
              description: 'Clear the permissions search field',
            })}
            onClick={() => {
              setQuery('');
              setDropdownOpen(false);
              inputRef.current?.focus();
            }}>
            ✕
          </button>
        )}
        {dropdownOpen && q && flatSuggestions.length > 0 && (
          <div className={styles.suggest} role="listbox">
            {suggestions.perms.length > 0 && (
              <>
                <div className={styles.suggestGroup}>
                  {translate({
                    id: 'permexplorer.group.permissions',
                    message: 'Permissions',
                    description: 'Suggestions group heading: permissions',
                  })}
                  {` (${suggestions.totalPerms})`}
                </div>
                {suggestions.perms.map((permission, index) => (
                  <div
                    key={permission.name}
                    role="option"
                    aria-selected={selected === index}
                    className={
                      selected === index
                        ? `${styles.suggestItem} ${styles.suggestItemActive}`
                        : styles.suggestItem
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pick(permission.name);
                    }}>
                    <span className={styles.suggestLabel}>
                      <Highlighted text={permission.name} query={q} />
                    </span>
                    <span className={styles.suggestSub}>
                      {translate(
                        {
                          id: 'permexplorer.count.apis',
                          message: '{n} API',
                          description: 'API count shown on a permission card',
                        },
                        { n: String(permission.endpoints.length) },
                      )}
                    </span>
                  </div>
                ))}
              </>
            )}
            {suggestions.eps.length > 0 && (
              <>
                <div className={styles.suggestGroup}>
                  {translate({
                    id: 'permexplorer.group.apis',
                    message: "APIs",
                    description: 'Suggestions group heading: APIs',
                  })}
                  {` (${suggestions.totalEps})`}
                </div>
                {suggestions.eps.map(({ permission, endpoint }, index) => {
                  const flatIndex = suggestions.perms.length + index;
                  return (
                    <div
                      key={`${permission.name}-${endpoint.method}-${endpoint.path}`}
                      role="option"
                      aria-selected={selected === flatIndex}
                      className={
                        selected === flatIndex
                          ? `${styles.suggestItem} ${styles.suggestItemActive}`
                          : styles.suggestItem
                      }
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pick(permission.name);
                      }}>
                      <span className={`${styles.method} ${styles[`method${endpoint.method}`]}`}>
                        {endpoint.method}
                      </span>
                      <span className={styles.suggestLabel}>
                        <Highlighted text={endpoint.path} query={q} />
                      </span>
                      <span className={styles.suggestSub}>{permission.name}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.filters} role="group">
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>
            {translate({
              id: 'permexplorer.filters.tenant',
              message: 'Tenant:',
              description: 'Tenant filter label',
            })}
          </span>
          {(['all', ...TENANT_ORDER] as const).map((tenant) => (
            <button
              key={tenant}
              type="button"
              className={
                tenantFilter === tenant
                  ? `${styles.filterChip} ${styles.filterChipActive}`
                  : styles.filterChip
              }
              onClick={() => setTenantFilter(tenant)}>
              {tenant === 'all'
                ? translate({
                    id: 'permexplorer.filters.all',
                    message: 'All',
                    description: 'Filter chip: no tenant filter',
                  })
                : tenantLabel(tenant)}
            </button>
          ))}
          {roles.length > 0 && (
            <div className={styles.dropdown} ref={roleMenuRef}>
              <button
                type="button"
                className={
                  roleFilters.length > 0
                    ? `${styles.dropdownButton} ${styles.dropdownButtonActive}`
                    : styles.dropdownButton
                }
                aria-haspopup="listbox"
                aria-expanded={roleMenuOpen}
                onClick={() => setRoleMenuOpen((open) => !open)}>
                <span className={styles.dropdownLabel}>
                  {translate({
                    id: 'permexplorer.filters.role',
                    message: 'Standard role:',
                    description: 'Standard role filter label',
                  })}
                </span>
                <span className={styles.dropdownValue}>
                  {selectedRoles.length === 0
                    ? translate({
                        id: 'permexplorer.filters.all',
                        message: 'All',
                        description: 'Filter chip: no tenant filter',
                      })
                    : selectedRoles.length === 1
                      ? `${selectedRoles[0].name}${tenantNameSuffix(selectedRoles[0].tenantType)}`
                      : translate(
                          {
                            id: 'permexplorer.filters.rolesCount',
                            message: '{n} roles selected',
                            description: 'Dropdown label when several standard roles are selected',
                          },
                          { n: String(selectedRoles.length) },
                        )}
                </span>
                <span className={styles.dropdownCaret} aria-hidden="true">
                  ▾
                </span>
              </button>
              {roleMenuOpen && (
                <div className={styles.menu} role="listbox" aria-multiselectable="true">
                  {roleGroups.map(({ tenant, roles: groupRoles }) =>
                    groupRoles.length === 0 ? null : (
                      <React.Fragment key={tenant}>
                        <div className={styles.menuGroup}>{tenantLabel(tenant)}</div>
                        {groupRoles.map((role) => {
                          const checked = roleFilters.includes(role.uuid);
                          return (
                            <button
                              key={role.uuid}
                              type="button"
                              role="option"
                              aria-selected={checked}
                              title={role.description}
                              className={
                                checked
                                  ? `${styles.menuItem} ${styles.menuItemActive}`
                                  : styles.menuItem
                              }
                              onClick={() => toggleRoleFilter(role.uuid)}>
                              <span className={styles.menuItemCheck} aria-hidden="true">
                                {checked ? '✓' : ''}
                              </span>
                              <span className={styles.menuItemName}>{role.name}</span>
                              <span className={styles.menuItemCount}>
                                {translate(
                                  {
                                    id: 'permexplorer.count.permissions',
                                    message: '{n} permissions',
                                    description: 'Permission count shown on a role menu entry',
                                  },
                                  { n: String(role.permissions.length) },
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedRoles.length > 0 && (
        <div className={styles.activeFilter}>
          <span className={styles.filterLabel}>
            {translate({
              id: 'permexplorer.filters.role',
              message: 'Standard role:',
              description: 'Active standard role filter label',
            })}
          </span>
          {selectedRoles.map((role) => (
            <span
              key={role.uuid}
              className={`${styles.activeFilterPill} ${
                role.tenantType.includes('organisation') && role.tenantType.length === 1
                  ? styles.roleTagOrganisation
                  : styles.roleTagSpace
              }`}>
              {role.name}
              {tenantNameSuffix(role.tenantType)}
              <button
                type="button"
                className={styles.pillClear}
                aria-label={translate(
                  {
                    id: 'permexplorer.filters.clearRole',
                    message: 'Remove {role} from the filter',
                    description: 'Remove a standard role from the active filter',
                  },
                  { role: role.name },
                )}
                onClick={() => toggleRoleFilter(role.uuid)}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <p className={styles.stats}>
        {translate(
          {
            id: 'permexplorer.stats',
            message: '{count} permissions shown · {apis} API',
            description: 'Visible permissions and APIs count',
          },
          { count: String(matches.length), apis: String(apiTotal) },
        )}
      </p>

      {matches.length === 0 && (
        <div className={styles.empty}>
          {translate({
            id: 'permexplorer.empty',
            message: "No permission or API matches this search.",
            description: 'Empty state of the permissions search',
          })}
        </div>
      )}

      {tenantSections.map(({ tenant, domains }) =>
        domains.length === 0 ? null : (
          <section key={tenant} className={styles.tenantSection}>
            <h2 className={styles.tenantHeading}>
              {tenantLabel(tenant)}
              <span className={styles.tenantHint}>
                {tenant === 'organisation'
                  ? translate({
                      id: 'permexplorer.tenant.organisation.hint',
                      message: 'permissions exercised at the organisation level',
                      description: 'Hint under the organisation umbrella section',
                    })
                  : translate({
                      id: 'permexplorer.tenant.space.hint',
                      message: 'permissions exercised within a space',
                      description: 'Hint under the space umbrella section',
                    })}
              </span>
            </h2>
            {domains.map(([domain, groupMatches]) => (
              <section key={`${tenant}-${domain}`}>
                <h3 className={styles.domain}>{domainLabel(domain)}</h3>
                {groupMatches
                  .filter((match) => (match.permission.tenant ?? TENANT_ORDER).includes(tenant))
                  .map(({ permission, endpoints, nameHit }) => {
                    const permissionRoles = rolesByPermission.get(permission.name) ?? [];
                    return (
                      <details key={permission.name} className={styles.card} open={q ? true : undefined}>
                        <summary className={styles.summary}>
                          <code className={styles.permLabel}>
                            <Highlighted text={permission.name} query={q} />
                          </code>
                          <span className={styles.count}>
                            {translate(
                              {
                                id: 'permexplorer.count.apis',
                                message: '{n} API',
                                description: 'API count shown on a permission card',
                              },
                              { n: String(endpoints.length) },
                            )}
                          </span>
                          {permissionRoles.map((role) => (
                            <button
                              key={role.uuid}
                              type="button"
                              title={translate({
                                id: 'permexplorer.role.filterHint',
                                message: 'Filter by this role',
                                description: 'Hint on a clickable standard role tag',
                              })}
                              aria-pressed={roleFilters.includes(role.uuid)}
                              className={`${styles.roleTag} ${
                                role.tenantType.includes('organisation') && role.tenantType.length === 1
                                  ? styles.roleTagOrganisation
                                  : styles.roleTagSpace
                              }${roleFilters.includes(role.uuid) ? ` ${styles.roleTagActive}` : ''}`}
                              onClick={() => toggleRoleFilter(role.uuid)}>
                              {role.name}
                            </button>
                          ))}
                        </summary>
                        <div className={styles.cardBody}>
                          {permission.uuid && (
                            <p className={styles.uuidLine}>
                              <span className={styles.uuidLabel}>UUID</span>
                              <code className={styles.uuidValue}>{permission.uuid}</code>
                              <button
                                type="button"
                                className={styles.uuidCopy}
                                onClick={() => copyUuid(permission.uuid as string)}>
                                {copiedUuid === permission.uuid
                                  ? translate({
                                      id: 'permexplorer.uuid.copied',
                                      message: 'copied',
                                      description: 'Feedback after copying a permission UUID',
                                    })
                                  : translate({
                                      id: 'permexplorer.uuid.copy',
                                      message: 'copy',
                                      description: 'Copy a permission UUID',
                                    })}
                              </button>
                            </p>
                          )}
                          {permission.description && (
                            <p className={styles.cardDesc}>{permission.description}</p>
                          )}
                          {endpoints.length === 0 ? (
                            <p className={styles.consoleNote}>
                              {translate({
                                id: 'permexplorer.console',
                                message:
                                  'No public API for this permission: the action is performed from the Numspot console.',
                                description: 'Note shown on permissions without a public endpoint',
                              })}
                            </p>
                          ) : (
                            <ul className={styles.endpointList}>
                              {endpoints.map((endpoint) => (
                                <li
                                  key={`${permission.name}-${endpoint.method}-${endpoint.path}`}
                                  className={styles.endpoint}>
                                  <span className={`${styles.method} ${styles[`method${endpoint.method}`]}`}>
                                    {endpoint.method}
                                  </span>
                                  <a
                                    className={styles.path}
                                    href={`https://docs.numspot.com/openapi/#tag/${domainTag(permission.domain)}/${endpoint.method}/${endpoint.path}`}
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    <Highlighted text={endpoint.path} query={nameHit ? '' : q} />
                                  </a>
                                  {endpoint.summary && (
                                    <span className={styles.endpointSummary}>— {endpoint.summary}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    );
                  })}
              </section>
            ))}
          </section>
        ),
      )}
    </div>
  );
}
