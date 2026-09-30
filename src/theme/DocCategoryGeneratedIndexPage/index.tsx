import React, { type ReactNode } from "react";
import { PageMetadata } from "@docusaurus/theme-common";
import { useCurrentSidebarCategory } from "@docusaurus/plugin-content-docs/client";
import useBaseUrl from "@docusaurus/useBaseUrl";
import DocCardList from "@theme/DocCardList";
import DocPaginator from "@theme/DocPaginator";
import DocVersionBanner from "@theme/DocVersionBanner";
import DocVersionBadge from "@theme/DocVersionBadge";
import DocBreadcrumbs from "@theme/DocBreadcrumbs";
import Heading from "@theme/Heading";
import type { Props } from "@theme/DocCategoryGeneratedIndexPage";

function DocCategoryGeneratedIndexPageMetadata({
  categoryGeneratedIndex,
}: Readonly<Props>): ReactNode {
  return (
    <PageMetadata
      title={categoryGeneratedIndex.title}
      description={categoryGeneratedIndex.description}
      keywords={categoryGeneratedIndex.keywords}
      // TODO `require` this?
      image={useBaseUrl(categoryGeneratedIndex.image)}
    />
  );
}

function DocCategoryGeneratedIndexPageContent({
  categoryGeneratedIndex,
}: Readonly<Props>): ReactNode {
  const category = useCurrentSidebarCategory();
  return (
    <div>
      <DocVersionBanner />
      <DocBreadcrumbs />
      <DocVersionBadge />
      <header className="category-index__header">
        <Heading as="h1">{categoryGeneratedIndex.title}</Heading>
        {categoryGeneratedIndex.description && (
          <p>{categoryGeneratedIndex.description}</p>
        )}
      </header>
      <article className="margin-top--lg">
        <DocCardList items={category.items} />
      </article>
      <footer className="margin-top--lg">
        <DocPaginator
          previous={categoryGeneratedIndex.navigation.previous}
          next={categoryGeneratedIndex.navigation.next}
        />
      </footer>
    </div>
  );
}

export default function DocCategoryGeneratedIndexPage(
  props: Readonly<Props>
): ReactNode {
  return (
    <>
      <DocCategoryGeneratedIndexPageMetadata {...props} />
      <DocCategoryGeneratedIndexPageContent {...props} />
    </>
  );
}
