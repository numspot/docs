// Types for src/components/sidebar-order.js (implementation in plain
// CommonJS so the zero-dependency linter test suite can require it).
export interface SidebarSortItem {
  type: string;
  label?: string;
  id?: string;
  className?: string;
  link?: { type: string; id?: string };
  items?: SidebarSortItem[];
}

export interface SidebarSortDoc {
  id: string;
  sourceDirName: string;
}

export const HIGHLIGHTED_SIDEBAR_ENTRIES: ReadonlySet<string>;
export const SIDEBAR_GROUPS: readonly (readonly string[])[];
export const GROUP_HEAD_CLASS: readonly (string | undefined)[];

/** External link pinned at level 0, right after an existing top-level entry. */
export interface ExternalSidebarLink {
  /** Locale-stable key of the entry the link is spliced below (after sorting). */
  afterKey: string;
  label: { default: string } & Record<string, string>;
  href: { default: string } & Record<string, string>;
}

export const EXTERNAL_SIDEBAR_LINKS: readonly ExternalSidebarLink[];

export function injectSidebarLinks(
  items: SidebarSortItem[],
  docs: readonly SidebarSortDoc[],
  currentLocale: string,
  links?: readonly ExternalSidebarLink[],
): void;

export function sortSidebarEntries<T extends SidebarSortItem>(
  items: T[],
  docs: readonly SidebarSortDoc[],
  highlighted?: ReadonlySet<string>,
): T[];
