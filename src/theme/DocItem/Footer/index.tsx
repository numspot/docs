import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import TagsListInline from '@theme/TagsListInline';

/**
 * Same as the original DocItem/Footer minus the "Last updated on ..." edit
 * meta row: the review date is now displayed under the page title by
 * src/components/LastUpdatedDate (via the MDXComponents swizzle).
 */
export default function DocItemFooter(): ReactNode {
  const {tags} = useDoc().metadata;

  if (tags.length === 0) {
    return null;
  }

  return (
    <footer
      className={clsx(ThemeClassNames.docs.docFooter, 'docusaurus-mt-lg')}>
      <div
        className={clsx(
          'row margin-top--sm',
          ThemeClassNames.docs.docFooterTagsRow,
        )}>
        <div className="col">
          <TagsListInline tags={tags} />
        </div>
      </div>
    </footer>
  );
}
