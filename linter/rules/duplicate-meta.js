function check(content, frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const { data } = frontmatter;
  const title = data?.title || '';
  const descriptionValue = data?.description || '';

  if (!descriptionValue) return violations;

  if (title && descriptionValue === title) {
    violations.push({
      code: 'structural:duplicate_description',
      type: 'structural',
      severity: 'low',
      description: 'description is identical to the title',
      location_hint: 'Frontmatter',
      suggested_fix: 'Write a unique description that differs from the title',
      ignored: false,
    });
  }

  const body = (frontmatter.body || content).trim();
  const firstParagraph = body.split('\n\n')[0]?.trim() || '';
  if (
    firstParagraph &&
    descriptionValue &&
    firstParagraph.includes(descriptionValue) &&
    descriptionValue.length > 20
  ) {
    violations.push({
      code: 'structural:duplicate_description',
      type: 'structural',
      severity: 'low',
      description: 'description is a substring of the first paragraph',
      location_hint: 'Frontmatter',
      suggested_fix: 'Write a unique description summarizing the page',
      ignored: false,
    });
  }

  return violations;
}

module.exports = { check };
