import React from 'react';
import Translate from '@docusaurus/Translate';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import type {ReactNode} from 'react';

// US English formatting ("October 29, 2025") per the review-date convention,
// even though the published site locale is en-GB.
const INTL_LOCALES: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

// Doc ids that never show a review date.
const EXCLUDED_DOC_IDS = new Set(['docs/home']);

/**
 * Review date displayed in small dark-gray text right under the page title.
 * Rendered through the MDXComponents swizzle (h1 mapping) so it sits directly
 * below the markdown H1. Skipped on the homepage and when git history has no
 * date for the file.
 */
export default function LastUpdatedDate(): ReactNode {
  const {i18n} = useDocusaurusContext();

  let metadata: {id: string; lastUpdatedAt?: number} | undefined;
  try {
    metadata = useDoc().metadata;
  } catch {
    // Outside a DocProvider (should not happen for MDX h1): render nothing.
    return null;
  }

  if (!metadata || EXCLUDED_DOC_IDS.has(metadata.id) || !metadata.lastUpdatedAt) {
    return null;
  }

  const atDate = new Date(metadata.lastUpdatedAt);
  const formatted = new Intl.DateTimeFormat(
    INTL_LOCALES[i18n.currentLocale] ?? i18n.currentLocale,
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(atDate);

  return (
    <p className="doc-last-updated">
      <Translate
        id="theme.docs.reviewedOn"
        description="Review date displayed under the page title"
        values={{
          date: (
            <time dateTime={atDate.toISOString()} itemProp="dateModified">
              {formatted}
            </time>
          ),
        }}>
        {'Reviewed on {date}'}
      </Translate>
    </p>
  );
}
