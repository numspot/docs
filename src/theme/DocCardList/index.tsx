import React, { type ReactNode } from "react";
import clsx from "clsx";
import {
  useCurrentSidebarCategory,
  filterDocCardListItems,
} from "@docusaurus/plugin-content-docs/client";
import DocCard from "@theme/DocCard";
import type { Props } from "@theme/DocCardList";
import { sectionIcon, SectionIconContext } from "@site/src/components/sectionMeta";

export default function DocCardList(props: Readonly<Props>): ReactNode {
  const { items, className } = props;
  const category = useCurrentSidebarCategory();
  // Every card of an index page carries its parent category's icon
  // (same style as the home page grid).
  const icon = sectionIcon((category as { className?: string }).className);
  const list = items ?? category.items;
  const filteredItems = filterDocCardListItems(list);

  return (
    <SectionIconContext.Provider value={icon}>
      <section className={clsx("svc-grid", className)}>
        {filteredItems.map((item, index) => (
          <DocCard key={index} item={item} />
        ))}
      </section>
    </SectionIconContext.Provider>
  );
}
