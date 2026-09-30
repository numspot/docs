const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./utils/frontmatter');
const { buildGlossaryIndex } = require('./utils/glossary-index');

const VIOLATION_PENALTIES = { high: 13, medium: 8, low: 3 };
const COMPLIANCE_THRESHOLD = 90;

const rules = [
  require('./rules/heading-format'),
  require('./rules/acronym-plural'),
  require('./rules/backtick-usage'),
  require('./rules/resource-links'),
  require('./rules/tabs-structure'),
  require('./rules/headings'),
  require('./rules/code-blocks'),
  require('./rules/duplicate-meta'),
  require('./rules/glossary-terms'),
  require('./rules/emojis'),
  require('./rules/nested-parentheses'),
  require('./rules/french-residuals'),
  require('./rules/image-refs'),
  require('./rules/english-slugs'),
  require('./rules/code-meta-comments-english'),
  require('./rules/admonition-balance'),
  require('./rules/todo-placeholder'),
  require('./rules/draft-forbidden'),
  require('./rules/forbidden-meta'),
];

function safePath(inputPath) {
  const resolved = path.resolve(inputPath);
  const allowed = [
    path.resolve('docs'),
    path.resolve('i18n'),
    path.resolve('consigns'),
    path.resolve(__dirname),
  ];
  if (!allowed.some(base => resolved.startsWith(base + path.sep) || resolved === base)) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }
  return resolved;
}

function loadGlossary(glossaryPath) {
  if (!glossaryPath) return null;
  try {
    const raw = fs.readFileSync(safePath(glossaryPath), 'utf8'); // nosemgrep: eslint.detect-non-literal-fs-filename
    const json = JSON.parse(raw);
    return buildGlossaryIndex(json);
  } catch (e) {
    return null;
  }
}

function lintPage(filePath, pageType, glossaryPath, lang = 'fr') {
  const content = fs.readFileSync(safePath(filePath), 'utf8'); // nosemgrep: eslint.detect-non-literal-fs-filename
  const frontmatter = parseFrontmatter(content);
  const glossaryIndex = loadGlossary(glossaryPath) || buildGlossaryIndex({ terms: {} });

  const allViolations = [];

  for (const rule of rules) {
    // Some rules are language-specific (FR glossary/terminology, FR acronym
    // pluralization). A rule without `langs` applies to every language.
    if (rule.langs && !rule.langs.includes(lang)) continue;
    try {
      const violations = rule.check(content, frontmatter, glossaryIndex, pageType, filePath);
      allViolations.push(...violations);
    } catch (e) {
      allViolations.push({
        code: 'linter:internal_error',
        type: 'structural',
        severity: 'low',
        description: `Linter rule error: ${e.message}`,
        location_hint: '',
        suggested_fix: '',
        ignored: false,
      });
    }
  }

  const deduplicated = deduplicateViolations(allViolations);

  const score = calculateScore(deduplicated);
  const isCompliant = score >= COMPLIANCE_THRESHOLD;

  return {
    violations: deduplicated,
    score,
    is_compliant: isCompliant,
    linter: true,
  };
}

function calculateScore(violations) {
  let score = 100;
  for (const v of violations) {
    if (v.ignored) continue;
    const penalty = VIOLATION_PENALTIES[v.severity] || 3;
    score -= penalty;
  }
  return Math.max(0, score);
}

function deduplicateViolations(violations) {
  const seen = new Set();
  return violations.filter(v => {
    const fingerprint = `${v.code}::${v.location_hint}::${v.description}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

const LINTER_COVERED_CODES = [
  'standard:heading_backticks',
  'standard:heading_bold',
  'glossary:acronym_plural',
  'standard:resource_backticks_invalid',
  'standard:prose_backticks',
  'standard:resource_link_missing',
  'standard:nested_parentheses',
  'structural:tab_order',
  'structural:missing_heading',
  'structural:empty_category',
  'structural:code_block_lang',
  'structural:duplicate_title',
  'structural:duplicate_description',
  'structural:forbidden_meta',
  'structural:admonition_balance',
  'structural:todo_placeholder',
  'glossary:terminology',
  'tone:emoji',
  'i18n:french_quotes',
  'i18n:french_example',
  'i18n:french_placeholder',
  'i18n:french_comment',
  'i18n:french_term',
  'i18n:terminology',
  'i18n:word_order',
  'i18n:french_text',
  'i18n:non_english_slug',
  'i18n:french_meta_comment',
  'assets:image_missing',
];

module.exports = {
  lintPage,
  loadGlossary,
  calculateScore,
  LINTER_COVERED_CODES,
  COMPLIANCE_THRESHOLD,
};
