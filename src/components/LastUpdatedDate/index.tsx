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

// Pages that never show a review date (landing pages).
const EXCLUDED_DATE_DOC_IDS = new Set(['docs/home']);

const GITHUB_BLOB_BASE = 'https://github.com/numspot/docs/blob/main/';

/**
 * Review date displayed in small dark-gray text right under the page title
 * ("Reviewed on ..." / "Mise à jour le ..."), rendered through the
 * MDXComponents swizzle (h1 mapping) so it sits directly below the markdown
 * H1. Next to it, a link to the page's source file on GitHub — rendered on
 * every doc page with a resolvable source file, with or without a review
 * date.
 */
export default function LastUpdatedDate(): ReactNode {
  const {i18n} = useDocusaurusContext();

  let metadata: {id: string; lastUpdatedAt?: number; source?: string} | undefined;
  try {
    metadata = useDoc().metadata;
  } catch {
    // Outside a DocProvider (should not happen for MDX h1): render nothing.
    return null;
  }

  // Source file in the GitHub repository: metadata.source is the
  // "@site/<relative path>" alias produced by the docs plugin.
  const sourcePath = metadata?.source?.startsWith('@site/')
    ? metadata.source.slice('@site/'.length)
    : metadata?.source;
  const githubUrl = sourcePath
    ? `${GITHUB_BLOB_BASE}${sourcePath}`
    : undefined;

  // The review date and the GitHub link are rendered together, only on pages
  // with a git date (homepage excluded).
  const showDate =
    Boolean(metadata?.lastUpdatedAt) && !EXCLUDED_DATE_DOC_IDS.has(metadata.id);
  if (!showDate || !githubUrl) {
    return null;
  }

  const atDate = metadata?.lastUpdatedAt ? new Date(metadata.lastUpdatedAt) : undefined;
  const formatted = atDate
    ? new Intl.DateTimeFormat(
        INTL_LOCALES[i18n.currentLocale] ?? i18n.currentLocale,
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        },
      ).format(atDate)
    : undefined;

  return (
    <p className="doc-last-updated">
      {showDate && formatted && atDate && (
        <>
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
          {' · '}
        </>
      )}
      {githubUrl && (
        <a
          className="doc-github-link"
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer">
          <Translate
            id="theme.docs.viewOnGithub"
            description="Link to the page source file on GitHub, next to the review date"
          >
            {'View on GitHub'}
          </Translate>
        </a>
      )}
    </p>
  );
}
