// Flags nested parentheses in prose — a parenthesis opened while already inside
// another one (e.g. "(… vCPU (virtual CPU))"). Forbidden by the writing standards
// (consigns/standards.md, "Ponctuation et style" section).
//
// The usual source is an acronym/anglicism expansion, required on first occurrence
// (e.g. "vCPU (virtual CPU)"), landing inside an outer parenthetical. The fix is to
// drop the OUTER parentheses (colon, dash, comma or rephrasing), never the expansion.
//
// Parentheses inside code (fenced blocks, inline code), JSX/HTML tags and link URLs
// are not prose and are ignored.

// Replace a matched span with same-length blanks, keeping newlines so character
// offsets and line numbers stay aligned with the original body.
function blank(match) {
  return match.replace(/[^\n]/g, ' ');
}

// Mask everything that is not prose, length-preserving: fenced code blocks, inline
// code, JSX/HTML tags, and the URL part of markdown links ("](…)").
function maskNonProse(body) {
  return body
    .replace(/```[\s\S]*?```/g, blank)
    .replace(/`[^`\n]+`/g, blank)
    .replace(/<[^>]+>/g, blank)
    .replace(/\]\([^)]*\)/g, blank);
}

function makeViolation(originalLine, start, end, lineNum) {
  let snippet = originalLine.slice(start, end + 1).trim();
  if (snippet.length > 80) snippet = `${snippet.slice(0, 77)}…`;
  return {
    code: 'standard:nested_parentheses',
    type: 'standards',
    severity: 'medium',
    description: `Parenthèses imbriquées : "${snippet}" — interdites dans la prose`,
    location_hint: `Line ${lineNum}`,
    suggested_fix: `Retirer la parenthèse externe (deux-points, tiret, virgule ou reformulation) ; conserver le développement de l'acronyme`,
    ignored: false,
  };
}

function check(content, frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const body = frontmatter.body || content;
  const lineOffset = frontmatter.frontmatterLines || 0;

  const maskedLines = maskNonProse(body).split('\n');
  const originalLines = body.split('\n');

  for (let i = 0; i < maskedLines.length; i++) {
    const masked = maskedLines[i];
    let depth = 0;
    let outerStart = -1;
    let nested = false;

    for (let j = 0; j < masked.length; j++) {
      const ch = masked[j];
      if (ch === '(') {
        if (depth === 0) outerStart = j;
        depth++;
        if (depth >= 2) nested = true;
      } else if (ch === ')') {
        if (depth > 0) depth--;
        if (depth === 0 && nested) {
          violations.push(makeViolation(originalLines[i], outerStart, j, i + 1 + lineOffset));
          nested = false;
          outerStart = -1;
        }
      }
    }

    // Nested group left unbalanced at end of line — still report it.
    if (nested && outerStart >= 0) {
      violations.push(makeViolation(originalLines[i], outerStart, masked.length - 1, i + 1 + lineOffset));
    }
  }

  return violations;
}

module.exports = { check };
