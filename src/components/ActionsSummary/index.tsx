import React, { type ReactNode } from "react";
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { useDocsSidebar } from "@docusaurus/plugin-content-docs/client";
import type {
  PropSidebarItem,
  PropSidebarItemCategory,
} from "@docusaurus/plugin-content-docs";

function normalizeTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function isActionsCategory(item: PropSidebarItem): item is PropSidebarItemCategory {
  return (
    item.type === "category" &&
    typeof item.label === "string" &&
    item.label.trim().toLowerCase() === "actions"
  );
}

function findActionsSibling(
  items: readonly PropSidebarItem[],
  pathname: string
): PropSidebarItemCategory | null {
  for (const item of items) {
    if (item.type !== "category") continue;

    const hasCurrentAsDirectChild = item.items.some(
      (child) => child.type === "link" && normalizeTrailingSlash(child.href) === normalizeTrailingSlash(pathname)
    );

    if (hasCurrentAsDirectChild) {
      const sibling = item.items.find(isActionsCategory);
      if (sibling) return sibling;
    }

    const deeper = findActionsSibling(item.items, pathname);
    if (deeper) return deeper;
  }
  return null;
}

export default function ActionsSummary(): ReactNode {
  const sidebar = useDocsSidebar();
  const { pathname } = useLocation();

  const actions = findActionsSibling(sidebar.items, pathname);
  if (!actions) return null;

  const links = actions.items.filter(
    (item): item is Extract<PropSidebarItem, { type: "link" }> =>
      item.type === "link"
  );
  if (links.length === 0) return null;

  return (
    <ul className="actions-summary">
      {links.map((link) => (
        <li key={link.href}>
          <Link to={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}
