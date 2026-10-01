const { isResource, hasConceptPage } = require('../utils/glossary-index');
const { extractBodyText } = require('../utils/markdown-parser');

function check(content, frontmatter, glossaryIndex, pageType, filePath) {
  const violations = [];
  const body = frontmatter.body || content;
  const bodyText = extractBodyText(body);

  const resourceTerms = [];
  for (const [lowerForm, entry] of glossaryIndex.byCorrectForm) {
    if (isResource(entry) && hasConceptPage(entry)) {
      resourceTerms.push({
        correct_form: entry.correct_form,
        concept_page: entry.concept_page,
        lowerForm,
        plural: entry.plural || null,
      });
    }
  }

  resourceTerms.sort((a, b) => b.correct_form.length - a.correct_form.length);

  const pageSlug = (frontmatter.data && frontmatter.data.slug) || '';
  const pageFileNorm = filePath
    ? filePath
        .replace(/\\/g, '/')
        .replace(/\/index\.mdx?$/, '')
        .replace(/\.mdx?$/, '')
    : '';

  // Concept pages already linked at least once in the body. A resource term is
  // considered covered as soon as its concept page is linked (by any synonym),
  // so we don't require redundant links such as
  // "[VM](/docs/compute/concept/) ([Virtual Machine](/docs/compute/concept/))" —
  // a single link to the concept page is enough.
  const normPage = p => (p || '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  const linkedConceptPages = new Set();
  {
    const linkDestRe = /\]\(([^)]+)\)/g;
    let lm;
    while ((lm = linkDestRe.exec(body)) !== null) linkedConceptPages.add(normPage(lm[1]));
  }

  for (const term of resourceTerms) {
    const { correct_form, concept_page, lowerForm } = term;

    if (isSelfPage(concept_page, pageSlug, pageFileNorm)) continue;
    if (linkedConceptPages.has(normPage(concept_page))) continue;

    const escapedForm = escapeRegex(correct_form);
    // Build singular and plural variants, using the glossary's plural field if available
    const pluralForm = term.plural || (correct_form + 's');
    const escapedPlural = escapeRegex(pluralForm);

    // nosemgrep: eslint.detect-non-literal-regexp
    const linkPattern = new RegExp(
      `\\[(?:${escapedForm}|${escapedPlural})\\]\\([^)]+\\)`,
      'i'
    );
    const plainPattern = new RegExp(`\\b(?:${escapedForm}|${escapedPlural})\\b`, 'i'); // nosemgrep: eslint.detect-non-literal-regexp

    const firstLinkMatch = body.search(linkPattern);
    let firstPlainMatch = findFirstPlainOccurrence(body, plainPattern);

    if (firstPlainMatch === -1) continue;

    if (firstLinkMatch === -1) {
      const line =
        body.slice(0, firstPlainMatch).split('\n').length + (frontmatter.frontmatterLines || 0);
      violations.push({
        code: 'standard:resource_link_missing',
        type: 'standards',
        severity: 'medium',
        description: `First occurrence of resource type "${correct_form}" is not linked to its concept page`,
        location_hint: `Line ${line}`,
        suggested_fix: `Link first occurrence: [${correct_form}](${concept_page})`,
        ignored: false,
      });
    } else {
      const afterFirstLink = body.slice(firstLinkMatch);
      const remainingLinks = afterFirstLink
        .slice(1)
        .match(
          // nosemgrep: eslint.detect-non-literal-regexp
          new RegExp(
            `\\[(?:${escapedForm}|${escapedPlural})\\]\\([^)]+\\)`,
            'gi'
          )
        );
      if (remainingLinks && remainingLinks.length > 0) {
        violations.push({
          code: 'standard:resource_link_missing',
          type: 'standards',
          severity: 'medium',
          description: `Resource type "${correct_form}" is linked more than once — only the first occurrence should be a link`,
          location_hint: `Multiple links found for "${correct_form}"`,
          suggested_fix: `Keep only the first occurrence as a link, use plain text for subsequent occurrences`,
          ignored: false,
        });
      }
    }
  }

  return violations;
}

function isSelfPage(conceptPage, pageSlug, pageFileNorm) {
  if (!conceptPage) return false;

  const conceptNorm = conceptPage.replace(/^\/docs\//, '').replace(/\/concepts?$/, '');

  if (pageSlug && conceptNorm === pageSlug) return true;
  if (pageSlug && conceptNorm === pageSlug.replace(/\/concepts?$/, '')) return true;

  if (pageFileNorm) {
    let normalized = pageFileNorm
      .replace(/\\/g, '/')
      .replace(/\/index\.mdx?$/, '')
      .replace(/\.mdx?$/, '');
    const ddIdx = normalized.indexOf('/docs/docs/');
    if (ddIdx !== -1) normalized = normalized.slice(ddIdx + '/docs/'.length);
    normalized = normalized.replace(/\/concepts?$/, '');
    const segments = normalized.split('/');
    const joined = [];
    for (let i = segments.length - 1; i >= 0; i--) {
      joined.unshift(segments[i]);
      if (joined.join('/') === conceptNorm) return true;
    }
  }

  return false;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the first occurrence of plainPattern in body that is NOT inside a markdown link.
 * A term is "inside a markdown link" if it appears between [ and ]( or between ]( and ).
 * We skip those because they are part of a larger link text (e.g. "[Get the status of a PostgreSQL cluster](...)"),
 * not a standalone resource term that needs to be linked to its concept page.
 */
function findFirstPlainOccurrence(body, plainPattern) {
  // Build a map of character positions that are inside markdown links
  // Using manual parsing instead of regex to avoid ReDoS risk (CWE-185)
  const linkRanges = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '[') {
      const closeBracket = body.indexOf('](', i + 1);
      if (closeBracket === -1) continue;
      const closeParen = body.indexOf(')', closeBracket + 2);
      if (closeParen === -1) continue;
      // Text range is between [ and ](
      linkRanges.push([i + 1, closeBracket]);
      i = closeParen;
    }
  }

  // Also skip occurrences inside inline code spans (`...`): a term written as
  // `value` is a literal value/code, not a prose mention that needs a link.
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '`') {
      const close = body.indexOf('`', i + 1);
      if (close === -1) break;
      linkRanges.push([i + 1, close]);
      i = close;
    }
  }

  let searchStart = 0;
  while (searchStart < body.length) {
    const remaining = body.slice(searchStart);
    const match = remaining.search(plainPattern);
    if (match === -1) return -1;

    const pos = searchStart + match;

    // Check if this position falls inside any link text range
    const insideLinkText = linkRanges.some(([start, end]) => pos >= start && pos < end);
    if (!insideLinkText) {
      return pos;
    }

    // Skip past this occurrence and continue searching
    const matchLen = (remaining.slice(match).match(plainPattern) || [''])[0].length;
    searchStart = pos + matchLen;
  }

  return -1;
}

module.exports = { check };
