const { extractHeadings } = require('../utils/markdown-parser');

function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const headings = extractHeadings(content);

  for (const heading of headings) {
    if (/`[^`]+`/.test(heading.text)) {
      const backtickTerms = heading.text
        .match(/`([^`]+)`/g)
        .map(m => m.slice(1, -1))
        .join(', ');
      violations.push({
        code: 'standard:heading_backticks',
        type: 'standards',
        severity: 'medium',
        description: `Heading contains backticks: "${backtickTerms}"`,
        location_hint: `Line ${heading.line}: ${heading.text}`,
        suggested_fix: `Remove backticks from heading: use plain text instead of \`${backtickTerms}\``,
        ignored: false,
      });
    }

    if (/\*\*[^*]+\*\*/.test(heading.text)) {
      violations.push({
        code: 'standard:heading_bold',
        type: 'standards',
        severity: 'medium',
        description: `Heading contains bold formatting`,
        location_hint: `Line ${heading.line}: ${heading.text}`,
        suggested_fix: `Remove bold formatting from heading`,
        ignored: false,
      });
    }
  }

  return violations;
}

module.exports = { check };
