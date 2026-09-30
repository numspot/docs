const { extractBacktickTerms, extractHeadings } = require('../utils/markdown-parser');
const { isResource, isAcronym, hasConceptPage } = require('../utils/glossary-index');

const CODE_COMMAND_PATH_PATTERN = /^(\/|[a-z]+:\/\/|\.\/|~\/|\.\.\/|[A-Z]:\\)/;
const CODE_COMMAND_WORDS = new Set([
  'kubectl',
  'kubeconfig',
  'psql',
  'curl',
  'git',
  'npm',
  'node',
  'docker',
  'terraform',
  'import',
  'export',
  'cd',
  'ls',
  'rm',
  'cp',
  'mv',
  'mkdir',
  'chmod',
  'ssh',
  'scp',
  'wget',
  'apt',
  'yum',
  'brew',
  'pip',
]);

function isLikelyCodeCommandOrPath(term) {
  if (CODE_COMMAND_PATH_PATTERN.test(term)) return true;
  const firstWord = term.split(/[\s=]/)[0];
  if (CODE_COMMAND_WORDS.has(firstWord)) return true;
  if (term.includes('()')) return true;
  if (term.includes('{') || term.includes('}')) return true;
  if (term.includes('=') && term.includes('.')) return true;
  if (/^--?[a-z]/.test(term)) return true;
  if (/\.(js|ts|py|json|yaml|yml|toml|xml|sh|bash|zsh|cfg|conf|env|md|mdx|txt)$/i.test(term))
    return true;
  return false;
}

function isPlaceholderValue(term) {
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(-\d+)?$/.test(term) && term.length >= 3 && term.length <= 63)
    return true;
  if (/^[a-zA-Z0-9._-]+-[a-z]+-\d+$/.test(term)) return true;
  return false;
}

// API/console/code tokens are ASCII. A backticked token that contains an accented
// or otherwise non-ASCII letter is almost certainly French prose (e.g. `réservé`).
function hasNonAsciiLetter(term) {
  for (let i = 0; i < term.length; i++) {
    if (term.charCodeAt(i) > 127) return /\p{L}/u.test(term);
  }
  return false;
}

// Natural-language prose in backticks, detected with high precision: the token
// carries an accented/non-ASCII letter (strong French-prose signal) AND is made
// only of words — letters, digits, spaces, apostrophes and hyphens. The second
// condition rules out code that merely happens to contain an accent, such as a
// hostname template `<nom_région>.compute.internal` (has `<`, `>`, `.`).
// We intentionally do NOT flag pure-ASCII multi-word tokens: they are ambiguous
// (e.g. SQL `ALL PRIVILEGES`, the command `kubeadm certs renew all`, CLI labels
// `AWS Access Key ID`). Known prose resource terms are caught via the glossary.
const PROSE_WORD_CHARS = /^[\p{L}\d\s'’-]+$/u;
function isAccentedProse(term) {
  return hasNonAsciiLetter(term) && PROSE_WORD_CHARS.test(term);
}

// True when a backticked token is part of a comma-separated list of backticked
// tokens (e.g. an enumeration of accepted API values:
// `compute`, `connectivity`, `kubernetes`...). In that context the term is a
// literal value/code, not a prose glossary mention, so backticks are legitimate.
function isInBacktickedValueList(body, bt) {
  // bt.index points at the opening backtick; the closing backtick is at
  // bt.index + term.length + 1, so the first char after the token is +2.
  const openIdx = bt.index;
  const afterIdx = bt.index + bt.term.length + 2;
  const before = body.slice(Math.max(0, openIdx - 40), openIdx);
  const after = body.slice(afterIdx, afterIdx + 40);
  // preceded by `…`, (another backticked token then a comma)
  if (/`\s*,\s*$/.test(before)) return true;
  // followed by , `… (a comma then another backticked token)
  if (/^\s*,\s*`/.test(after)) return true;
  return false;
}

function check(content, frontmatter, glossaryIndex, _pageType) {
  const violations = [];
  const body = frontmatter.body || content;
  const lineOffset = frontmatter.frontmatterLines || 0;
  const backtickTerms = extractBacktickTerms(body);
  const headings = extractHeadings(body);
  const headingLineSet = new Set(headings.map(h => h.line));

  for (const bt of backtickTerms) {
    const term = bt.term;
    const lowerTerm = term.toLowerCase();

    const beforeContent = body.slice(0, bt.index);
    const lineNum = beforeContent.split('\n').length + lineOffset;

    if (headingLineSet.has(lineNum)) continue;

    if (isLikelyCodeCommandOrPath(term)) continue;

    // Literal value in an enumeration of backticked values (e.g. accepted API
    // parameter values) — backticks are legitimate here, not a prose mention.
    if (isInBacktickedValueList(body, bt)) continue;

    const glossaryEntry = glossaryIndex.byCorrectForm.get(lowerTerm);
    if (!glossaryEntry) {
      // Accented French prose in backticks (independent of the glossary): natural
      // language, not a literal API/console/code token. Endpoints, paths, commands
      // and value enumerations are already excluded above.
      if (isAccentedProse(term)) {
        violations.push({
          code: 'standard:prose_backticks',
          type: 'standards',
          severity: 'medium',
          description: `Backticks on prose "${term}" — backticks are reserved for literal API/console/code tokens (parameter and field names, enum values, endpoints, commands, resource names), not prose`,
          location_hint: `Line ${lineNum}`,
          suggested_fix: `Remove backticks: use plain text, or **bold** for buttons / "quotes" for UI fields and statuses`,
          ignored: false,
        });
        continue;
      }

      const isOrdinaryWord =
        !/\d/.test(term) && !isPlaceholderValue(term) && term.length < 30 && !/[-_\/\.]/.test(term);

      if (isOrdinaryWord) {
        const anglicismCheck = glossaryIndex.byLowerCorrect.get(lowerTerm);
        if (anglicismCheck) {
          violations.push({
            code: 'standard:resource_backticks_invalid',
            type: 'standards',
            severity: 'medium',
            description: `Backticks on glossary term "${term}" — glossary terms are plain text`,
            location_hint: `Line ${lineNum}`,
            suggested_fix: `Remove backticks: "${term}" should be plain text`,
            ignored: false,
          });
        }
      }
      continue;
    }

    if (isResource(glossaryEntry)) {
      violations.push({
        code: 'standard:resource_backticks_invalid',
        type: 'standards',
        severity: 'medium',
        description: `Backticks on resource type "${term}" — resource types are linked on first use then plain text, never backticked`,
        location_hint: `Line ${lineNum}`,
        suggested_fix: `Remove backticks: link first occurrence [${term}](concept_page), then plain text`,
        ignored: false,
      });
    } else if (isAcronym(glossaryEntry)) {
      violations.push({
        code: 'standard:resource_backticks_invalid',
        type: 'standards',
        severity: 'medium',
        description: `Backticks on acronym "${term}" — acronyms are plain text, never backticked`,
        location_hint: `Line ${lineNum}`,
        suggested_fix: `Remove backticks: "${term}" should be plain text`,
        ignored: false,
      });
    } else {
      violations.push({
        code: 'standard:resource_backticks_invalid',
        type: 'standards',
        severity: 'medium',
        description: `Backticks on glossary term "${term}" — glossary terms are plain text`,
        location_hint: `Line ${lineNum}`,
        suggested_fix: `Remove backticks: "${term}" should be plain text`,
        ignored: false,
      });
    }
  }

  return violations;
}

module.exports = { check };
