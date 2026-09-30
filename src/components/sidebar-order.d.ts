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

export function sortSidebarEntries<T extends SidebarSortItem>(
  items: T[],
  docs: readonly SidebarSortDoc[],
  highlighted?: ReadonlySet<string>,
): T[];
