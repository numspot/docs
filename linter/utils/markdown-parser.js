function extractHeadings(body) {
  const headings = [];
  const lines = body.split('\n');
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    // Toggle fenced code blocks so that shell comments ("# ...") inside ```bash
    // are not mistaken for Markdown headings.
    if (/^\s*```/.test(lines[i])) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }
  return headings;
}

function extractBacktickTerms(body) {
  const terms = [];
  const lines = body.split('\n');
  let inCodeBlock = false;
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^```/)) {
      inCodeBlock = !inCodeBlock;
      charOffset += line.length + 1;
      continue;
    }
    if (!inCodeBlock) {
      const inlineRegex = /`([^`\n]+)`/g;
      let match;
      while ((match = inlineRegex.exec(line)) !== null) {
        terms.push({ term: match[1], index: charOffset + match.index });
      }
    }
    charOffset += line.length + 1;
  }
  return terms;
}

function extractLinks(body) {
  const links = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    links.push({ text: match[1], url: match[2], index: match.index });
  }
  return links;
}

function extractTabs(body) {
  const tabs = [];
  const regex = /<TabItem\s+value="([^"]+)"(?:\s+label="([^"]*)")?(?:\s+default)?/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const value = match[1];
    const label = match[2] || '';
    const tabStart = match.index;

    const closingRegex = new RegExp(`<\\/TabItem>`, 'g');
    closingRegex.lastIndex = tabStart;
    const closingMatch = closingRegex.exec(body);
    const contentStart = tabStart + match[0].length;
    const contentEnd = closingMatch ? closingMatch.index : body.length;
    const content = body.slice(contentStart, contentEnd).trim();

    tabs.push({ value, label, content, contentLength: content.length });
  }
  return tabs;
}

function extractCodeBlocks(body) {
  const blocks = [];
  const lines = body.split('\n');
  let charOffset = 0;
  let fence = null; // opening backtick run kept while a block is open
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence === null) {
      // Outside a block: a line of 3+ backticks opens one. Read the language
      // (first word after the backticks) and accept trailing attributes
      // (e.g. ```bash title="…"). Also handles 4+ backtick fences (````bash),
      // used when the code itself contains ```.
      const m = line.match(/^(`{3,})(\w+)?/);
      if (m) {
        blocks.push({ language: m[2] || null, index: charOffset });
        fence = m[1];
      }
    } else {
      // Inside a block: close only on a BARE fence at least as long
      // (CommonMark rule). A ```lang line or a shorter fence inside is
      // content (e.g. a guide showing code blocks).
      const c = line.match(/^(`{3,})\s*$/);
      if (c && c[1].length >= fence.length) fence = null;
    }
    charOffset += line.length + 1;
  }
  return blocks;
}

function extractBodyText(body) {
  let text = body;
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^---[\s\S]*?---/m, '');
  return text.trim();
}

function isInHeading(line, fullContent) {
  const lines = fullContent.split('\n');
  let charCount = 0;
  for (const l of lines) {
    if (charCount + l.length + 1 > line) break;
    charCount += l.length + 1;
  }
  const currentLine = lines[charCount > 0 ? charCount - 1 : 0] || '';
  return /^#{1,6}\s+/.test(currentLine);
}

function isInQuotedLabel(content, position) {
  const before = content.slice(Math.max(0, position - 50), position);
  const after = content.slice(position, position + 50);
  if (/"[^"]*$/.test(before) && /^[^"]*"/.test(after)) return true;
  return false;
}

module.exports = {
  extractHeadings,
  extractBacktickTerms,
  extractLinks,
  extractTabs,
  extractCodeBlocks,
  extractBodyText,
  isInHeading,
  isInQuotedLabel,
};
