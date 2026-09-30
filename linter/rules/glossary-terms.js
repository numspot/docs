function check(content, _frontmatter, glossaryIndex, _pageType) {
  const violations = [];
  const { byWrongForm, byCorrectForm, terms } = glossaryIndex;

  const lines = content.split('\n');
  const codeBlockRanges = [];
  const headingLines = new Set();
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
    if (/^#{1,6}\s+/.test(lines[i])) {
      headingLines.add(i);
    }
  }
  if (inCodeBlock) codeBlockRanges.push([codeStart, lines.length - 1]);

  function isInCodeBlock(lineNum) {
    return codeBlockRanges.some(([start, end]) => lineNum >= start && lineNum <= end);
  }

  function isInHeading(lineNum) {
    return headingLines.has(lineNum - 1);
  }

  function isInsideQuotedLabel(contentStr, position) {
    const before = contentStr.slice(Math.max(0, position - 80), position);
    const after = contentStr.slice(position, position + 80);
    const openQuoteBefore = (before.match(/"/g) || []).length;
    if (openQuoteBefore % 2 === 1) return true;
    if (/→\s*\*\*[^*]*$/.test(before)) return true; // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos
    if (/^\*\*[^*]+\*\*\s*→/.test(after)) return true;
    return false;
  }

  function isInsideBoldConsolePath(contentStr, position) {
    const before = contentStr.slice(Math.max(0, position - 100), position);
    const after = contentStr.slice(position, position + 100);
    if (/\*\*[^*]*$/.test(before) && /^[^*]*\*\*/.test(after)) return true; // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos
    if (/→/.test(before) && /\*\*/.test(before.slice(-60))) return true;
    return false;
  }

  function isInsideBoldLabel(contentStr, position, matchLength) {
    const before = contentStr.slice(Math.max(0, position - 60), position);
    const after = contentStr.slice(position + matchLength, position + matchLength + 60);
    if (/\*\*[^*]*$/.test(before) && /^[^*]*\*\*/.test(after)) return true; // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos
    return false;
  }

  function isAcronymExpansion(contentStr, position, matchLength) {
    const before = contentStr.slice(Math.max(0, position - 5), position);
    const after = contentStr.slice(position + matchLength, position + matchLength + 5);
    if (/\(\s*$/.test(before) && /^\s*\)/.test(after)) return true;
    return false;
  }

  for (const [wrongForm, entry] of byWrongForm) {
    if (!entry.correct_form) continue;

    const escaped = escapeRegex(wrongForm);
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi'); // nosemgrep: eslint.detect-non-literal-regexp
    let match;
    while ((match = regex.exec(content)) !== null) {
      const before = content.slice(0, match.index);
      const lineNum = before.split('\n').length;

      if (isInCodeBlock(lineNum - 1)) continue;
      if (isInHeading(lineNum)) continue;

      if (isInsideQuotedLabel(content, match.index)) continue;
      if (isInsideBoldConsolePath(content, match.index)) continue;
      if (isInsideBoldLabel(content, match.index, match[0].length)) continue;
      if (isAcronymExpansion(content, match.index, match[0].length)) continue;
      if (isInsideImageAlt(content, match.index)) continue;
      if (isInsideInlineCode(content, match.index)) continue;
      if (isInsideUrlOrPath(content, match.index, match[0].length)) continue;
      if (isConsoleUiLabel(content, match.index, match[0].length)) continue;

      const beforeChar = content[match.index - 1] || '';
      const afterChar = content[match.index + match[0].length] || '';
      if (beforeChar === '"' && afterChar === '"') continue;
      if (beforeChar === '[' || afterChar === ']') continue;

      const actualMatch = match[0];
      if (actualMatch === entry.correct_form) continue;

      if (
        isStartOfSentence(content, match.index) &&
        isOnlyFirstCharDifferent(actualMatch, entry.correct_form)
      )
        continue;

      if (containsAcronymInUppercase(actualMatch, entry.correct_form)) continue;
      if (isPartOfCompoundProductName(content, match.index, match[0].length)) continue;

      violations.push({
        code: 'glossary:terminology',
        type: 'glossary',
        severity: 'medium',
        description: `Wrong terminology: "${actualMatch}" should be "${entry.correct_form}"`,
        location_hint: `Line ${lineNum}`,
        suggested_fix: `Replace "${actualMatch}" with "${entry.correct_form}"`,
        ignored: false,
      });
    }
  }

  return violations;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isStartOfSentence(content, position) {
  if (position === 0) return true;
  const before = content.slice(Math.max(0, position - 40), position);
  // After sentence-ending punctuation or a colon introducing a clause
  if (/[.!?:]\s+$/.test(before)) return true;
  // Start of a line, list item (-, *, +, 1.), or blockquote (>)
  if (/\n[ \t>]*(?:[-*+]\s+|\d+\.\s+)?$/.test(before)) return true;
  // Start of a Markdown table cell
  if (/\|[ \t]*$/.test(before)) return true;
  return false;
}

function isOnlyFirstCharDifferent(actual, correct) {
  if (actual.length !== correct.length) return false;
  if (actual.slice(1).toLowerCase() !== correct.slice(1).toLowerCase()) return false;
  return actual[0] === actual[0].toUpperCase() && correct[0] === correct[0].toLowerCase();
}

function containsAcronymInUppercase(actual, correctForm) {
  const actualWords = actual.split(/\s+/);
  const correctWords = correctForm.split(/\s+/);
  if (actualWords.length !== correctWords.length) return false;

  for (let i = 0; i < actualWords.length; i++) {
    const aw = actualWords[i];
    const cw = correctWords[i];
    if (aw.length >= 2 && aw === aw.toUpperCase() && cw === cw.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function isInsideImageAlt(content, position) {
  const before = content.slice(Math.max(0, position - 200), position);
  const after = content.slice(position, position + 200);
  const lastImgOpen = before.lastIndexOf('![');
  if (lastImgOpen === -1) return false;
  const betweenImgOpenAndHere = before.slice(lastImgOpen);
  const closeBracketCount = (betweenImgOpenAndHere.match(/\]/g) || []).length;
  if (closeBracketCount === 0) return true;
  return false;
}

function isInsideInlineCode(content, position) {
  const before = content.slice(0, position);
  const backtickCount = (before.match(/(?<!`)`(?!`)/g) || []).length;
  return backtickCount % 2 === 1;
}

function isInsideUrlOrPath(content, position, matchLength) {
  const before = content.slice(Math.max(0, position - 200), position);
  const after = content.slice(position + matchLength, position + matchLength + 200);

  if (/\]\([^)]*$/.test(before) && /^[^)]*\)/.test(after)) return true; // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos

  if (/\([^)\n]*\/[^\s)\n]*$/.test(before)) return true; // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos

  if (
    /\(\/img\//.test(before) || // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos
    /\/img\//.test(content.slice(Math.max(0, position - 50), position)) // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos
  )
    return true;

  // Bare URL (http(s)://… glued to the term, no space).
  if (/https?:\/\/\S*$/.test(before)) return true; // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos

  // Domain / path / email: term glued to a dot, slash or @
  // (e.g. "numspot" in docs.numspot.com, /numspot, support@numspot.com).
  const charBefore = content[position - 1] || '';
  const charAfter = content[position + matchLength] || '';
  const charAfter2 = content[position + matchLength + 1] || '';
  if (charBefore === '@' || charBefore === '/' || charBefore === '.') return true;
  if (charAfter === '@') return true; // numspot@host (email/SSH user)
  if (charAfter === '.' && /[\w-]/.test(charAfter2)) return true; // numspot.com

  return false;
}

function isConsoleUiLabel(content, position, matchLength) {
  const before = content.slice(Math.max(0, position - 80), position);
  if (/(?:liste déroulante|champ|section|onglet|bouton|menu|colonne|barre)\s+\w*\s*$/i.test(before))
    return true;
  if (/(?:sélectionnez|choisissez|cliquez|entrez|saisissez)\s+.*\s+\w*\s*$/i.test(before)) // nosemgrep: nodejs_scan.javascript-dos-rule-regex_dos
    return true;
  if (/dans (le|la|l'|les|un|une)\s+\w*\s*$/i.test(before)) return true;
  return false;
}

function isPartOfCompoundProductName(content, position, matchLength) {
  const after = content.slice(position + matchLength, position + matchLength + 30);
  if (/^\s+[A-Z][a-zA-Z]+/.test(after)) return true;
  const before = content.slice(Math.max(0, position - 30), position);
  if (/[A-Z][a-zA-Z]+\s+$/.test(before)) return true;
  return false;
}

// FR glossary terminology — not relevant on English pages.
module.exports = { check, langs: ['fr'] };
