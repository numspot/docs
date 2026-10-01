import React, { useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import type { ReactNode } from 'react';
import styles from './styles.module.css';
import data from './permissions.json';

type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary: string;
};

type Permission = {
  name: string;
  domain: string;
  description: string;
  endpoints: Endpoint[];
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

const permissions = data.permissions as Permission[];

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
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();

  const { i18n } = useDocusaurusContext();
  const locale = i18n.currentLocale.startsWith('en') ? 'en' : 'fr';

  function domainLabel(domain: string): string {
    return DOMAIN_META[domain]?.label[locale] ?? domain;
  }

  function domainTag(domain: string): string {
    return DOMAIN_META[domain]?.tag ?? domain;
  }

  const { matches, apiTotal } = useMemo(() => {
    const result: { permission: Permission; endpoints: Endpoint[]; nameHit: boolean }[] = [];
    let apiTotal = 0;
    for (const permission of permissions) {
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
  }, [q]);

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

      {domainGroups.map(([domain, groupMatches]) => (
        <section key={domain}>
          <h2 className={styles.domain}>{domainLabel(domain)}</h2>
          {groupMatches.map(({ permission, endpoints, nameHit }) => (
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
              </summary>
              <div className={styles.cardBody}>
                {permission.description && (
                  <p className={styles.cardDesc}>{permission.description}</p>
                )}
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
              </div>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
