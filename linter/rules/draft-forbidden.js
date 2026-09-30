function check(_content, frontmatter, _glossaryIndex, _pageType, _filePath) {
  const draft = frontmatter ? frontmatter.draft : undefined;
  if (draft === true || draft === 'true') {
    return [
      {
        code: 'structural:draft_forbidden',
        type: 'structural',
        severity: 'high',
        description: 'Page is in draft (draft: true). Draft pages must be published or removed before merge.',
        location_hint: 'frontmatter',
        suggested_fix: 'Set draft: false or remove the page',
        ignored: false,
      },
    ];
  }
  return [];
}

module.exports = { check };
