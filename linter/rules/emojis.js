const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];

  const codeBlockRanges = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^```/)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeStart = i;
      } else {
        inCodeBlock = false;
        codeBlockRanges.push([codeStart, i]);
      }
    }
  }
  if (inCodeBlock) codeBlockRanges.push([codeStart, lines.length - 1]);

  function isInCodeBlock(lineNum) {
    return codeBlockRanges.some(([s, e]) => lineNum >= s && lineNum <= e);
  }

  let match;
  while ((match = EMOJI_REGEX.exec(content)) !== null) {
    const before = content.slice(0, match.index);
    const lineNum = before.split('\n').length;
    if (isInCodeBlock(lineNum - 1)) continue;

    violations.push({
      code: 'tone:emoji',
      type: 'tone',
      severity: 'medium',
      description: `Emoji found: ${match[0]} — emojis are not allowed in documentation`,
      location_hint: `Line ${lineNum}`,
      suggested_fix: `Remove emoji "${match[0]}"`,
      ignored: false,
    });
  }

  return violations;
}

module.exports = { check };
