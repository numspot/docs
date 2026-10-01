const { extractHeadings } = require('../utils/markdown-parser');

function stripFormatting(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function check(content, frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const headings = extractHeadings(content);
  const h1Headings = headings.filter(h => h.level === 1);
  const title = frontmatter.data?.title || '';

  if (h1Headings.length === 0) {
    violations.push({
      code: 'structural:missing_heading',
      type: 'structural',
      severity: 'high',
      description: 'No H1 heading found in the page',
      location_hint: 'Page top',
      suggested_fix: 'Add exactly one H1 heading matching the page title',
      ignored: false,
    });
  } else if (h1Headings.length > 1) {
    violations.push({
      code: 'structural:missing_heading',
      type: 'structural',
      severity: 'high',
      description: `Multiple H1 headings found (${h1Headings.length})`,
      location_hint: h1Headings.map(h => `Line ${h.line}: ${h.text}`).join(', '),
      suggested_fix: 'Keep exactly one H1 heading',
      ignored: false,
    });
  }

  // Note: the former `structural:title_h1_mismatch` rule was removed. The docs
  // SEO strategy intentionally uses descriptive frontmatter titles (e.g.
  // "Catégorie - <nom>") that differ from the visible H1 to deduplicate the
  // HTML <title>, so enforcing title === H1 was counterproductive.
  if (title && h1Headings.length === 1) {
    const h1Text = stripFormatting(h1Headings[0].text);

    if (title === h1Text) {
      violations.push({
        code: 'structural:duplicate_title',
        type: 'structural',
        severity: 'low',
        description: 'Frontmatter title is identical to H1 heading — redundant',
        location_hint: `Line ${h1Headings[0].line}`,
        suggested_fix: 'This is expected in Docusaurus; title should match H1',
        ignored: true,
      });
    }
  }

  return violations;
}

module.exports = { check };
