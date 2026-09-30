// D-015: metaTitle/metaDescription are dead frontmatter keys — nothing in the
// build reads them. The HTML <title> comes from "title" (which may differ from
// the H1) and the meta description from "description". Any occurrence of the
// legacy keys (copy-paste, AI regeneration) must fail the linter so they never
// come back silently.
//
// The check runs on the raw frontmatter lines rather than on the parsed keys:
// parseFrontmatter keeps quoting in keys ("metaTitle") and dash prefixes
// (- metaTitle) that would evade a plain data lookup. Matching stays
// case-sensitive: D-015 forbids the two exact keys.

const FORBIDDEN_KEY = /^\s*(?:["']|-)?\s*(metaTitle|metaDescription)(?:["'])?\s*:/;

function check(_content, frontmatter, _glossaryIndex, _pageType, _filePath) {
  if (!frontmatter) return [];
  return (frontmatter.raw || '')
    .split('\n')
    .map((line) => line.match(FORBIDDEN_KEY))
    .filter(Boolean)
    .map((match) => {
      const key = match[1];
      return {
        code: 'structural:forbidden_meta',
        type: 'structural',
        severity: 'high',
        description:
          `Frontmatter key "${key}" is forbidden (decision D-015): Docusaurus ignores it. ` +
          'Use "title" for the HTML <title> and "description" for the meta description.',
        location_hint: 'frontmatter',
        suggested_fix:
          key === 'metaTitle'
            ? 'Merge the value into "title" and pin the sidebar text with "sidebar_label" if the two differ'
            : 'Rename the key to "description"',
        ignored: false,
      };
    });
}

module.exports = { check };
