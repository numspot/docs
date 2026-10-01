import React, { type ReactNode, useContext } from "react";
import Link from "@docusaurus/Link";
import { findFirstSidebarItemLink } from "@docusaurus/plugin-content-docs/client";
import { usePluralForm } from "@docusaurus/theme-common";
import { translate } from "@docusaurus/Translate";

import type { Props } from "@theme/DocCard";
import type {
  PropSidebarItemCategory,
  PropSidebarItemLink,
} from "@docusaurus/plugin-content-docs";
import { SectionIconContext } from "@site/src/components/sectionMeta";

function useCategoryItemsPlural() {
  const { selectMessage } = usePluralForm();
  return (count: number) =>
    selectMessage(
      count,
      translate(
        {
          message: "1 item|{count} items",
          id: "theme.docs.DocCard.categoryDescription.plurals",
          description:
            "The default description for a category card in the generated index about how many items this category includes",
        },
        { count }
      )
    );
}

// Card in the home page style (.svc-card): icon badge, title,
// description. The whole card is a link.
function ServiceCard({
  href,
  icon,
  title,
  description,
}: Readonly<{
  href: string;
  icon: string;
  title: string;
  description?: string;
}>): ReactNode {
  return (
    <Link href={href} className="card svc-card svc-card--index">
      <span className="svc-card__header">
        <span className="svc-card__icon">
          <span
            className="svc-card__glyph"
            role="img"
            aria-label={title}
            style={{ WebkitMaskImage: `url(${icon})`, maskImage: `url(${icon})` }}
          ></span>
        </span>
        <span className="svc-card__title">{title}</span>
      </span>
      {description && <span className="svc-card__desc">{description}</span>}
    </Link>
  );
}

function CardCategory({
  item,
  icon,
}: Readonly<{ item: PropSidebarItemCategory; icon: string }>): ReactNode {
  const href = findFirstSidebarItemLink(item);
  const categoryItemsPlural = useCategoryItemsPlural();

  // Categories without a link are filtered upstream.
  if (!href) {
    return null;
  }

  return (
    <ServiceCard
      href={href}
      icon={icon}
      title={item.label}
      description={item.description ?? categoryItemsPlural(item.items.length)}
    />
  );
}

function CardLink({
  item,
  icon,
}: Readonly<{ item: PropSidebarItemLink; icon: string }>): ReactNode {
  // Single pages (links to one page): no description in the card.
  return <ServiceCard href={item.href} icon={icon} title={item.label} />;
}

export default function DocCard({ item }: Props): ReactNode {
  const icon = useContext(SectionIconContext);
  switch (item.type) {
    case "link":
      return <CardLink item={item} icon={icon} />;
    case "category":
      return <CardCategory item={item} icon={icon} />;
    default:
      throw new Error(`unknown item type ${JSON.stringify(item)}`);
  }
}
