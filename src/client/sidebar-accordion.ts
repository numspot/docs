const COLLAPSE_SIDEBAR_ACCORDION = () => {
  const sidebar = document.querySelector<HTMLElement>(
    ".theme-doc-sidebar-container",
  );
  if (!sidebar) return;

  // onRouteDidUpdate calls this function on every navigation, but the sidebar
  // container persists: without a guard, one listener gets stacked per
  // navigation → the handler fires N times per click and (un)clicks sibling
  // categories several times → erratic accordion. Bind only once.
  if (sidebar.dataset.accordionBound === "1") return;
  sidebar.dataset.accordionBound = "1";

  sidebar.addEventListener(
    "click",
    (e) => {
      // "Accueil" (root link, href="/"): collapse ALL open sections. Click
      // every trigger still expanded (aria-expanded="true"), like the
      // accordion — navigating to the home page exposes no active category,
      // so nothing re-opens afterwards. rAF: collapse after the click/navigation.
      const homeLink = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a.menu__link[href]',
      );
      if (homeLink && homeLink.getAttribute("href") === "/") {
        requestAnimationFrame(() => {
          sidebar
            .querySelectorAll<HTMLElement>('[aria-expanded="true"]')
            .forEach((expanded) => expanded.click());
        });
        return;
      }

      const trigger = (e.target as HTMLElement).closest(
        '.menu__list-item-collapsible, .menu__link--sublist, .menu__caret',
      );
      if (!trigger) return;

      const item = trigger.closest(".menu__list-item");
      if (!item) return;

      // The item's OWN trigger (never a subcategory's). Restrict it to the
      // direct header `> .menu__list-item-collapsible`: without this scope,
      // `item.querySelector('[aria-expanded]')` climbed into collapsed nested
      // categories. Consequence: when closing a sibling containing
      // subcategories, the synthetic close click was read as an "open" and
      // closed in turn the category we had just opened (the target was
      // sometimes not expanded). So read the aria-expanded of the item's own
      // header only.
      const ownToggle = (li: Element) =>
        li.querySelector<HTMLElement>(
          ':scope > .menu__list-item-collapsible [aria-expanded]',
        );

      const itemToggle = ownToggle(item);
      // Act only on open; ignore closes (including synthetic ones).
      if (!itemToggle || itemToggle.getAttribute("aria-expanded") !== "false")
        return;

      const parentList = item.parentElement;
      if (!parentList) return;

      const siblings = Array.from(
        parentList.querySelectorAll(":scope > .menu__list-item"),
      ).filter((sibling) => sibling !== item);

      requestAnimationFrame(() => {
        siblings.forEach((sibling) => {
          const expanded = ownToggle(sibling);
          if (expanded && expanded.getAttribute("aria-expanded") === "true") {
            expanded.click();
          }
        });
      });
    },
    true,
  );
};

export function onRouteDidUpdate() {
  COLLAPSE_SIDEBAR_ACCORDION();
}

if (typeof window !== "undefined") {
  COLLAPSE_SIDEBAR_ACCORDION();
}
