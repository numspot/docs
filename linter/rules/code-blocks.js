const { extractCodeBlocks } = require('../utils/markdown-parser');

function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const codeBlocks = extractCodeBlocks(content);

  for (const block of codeBlocks) {
    if (!block.language) {
      const line = content.slice(0, block.index).split('\n').length;
      violations.push({
        code: 'structural:code_block_lang',
        type: 'structural',
        severity: 'low',
        description: 'Code block missing language specification',
        location_hint: `Line ${line}`,
        suggested_fix: 'Add language specification (e.g., ```bash, ```json, ```yaml)',
        ignored: false,
      });
    }
  }

  return violations;
}

module.exports = { check };
