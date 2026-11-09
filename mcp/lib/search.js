// Working-tree full-text search over the documentation sources.
//
// The public site search (docusaurus-search-local) runs on the BUILT index,
// which only exists after `yarn build`. A contributing agent instead needs to
// find pages in the CURRENT working tree — including uncommitted edits — so
// this module scans the Markdown sources directly:
//
//   - English docs (source of truth): docs/docs/**
//   - French translations:            i18n/fr/.../docs/**
//
// The corpus is rebuilt on every search — never cached: a long-lived MCP
// session must see edits made between two calls, which is the whole point
// of scanning the working tree instead of a built index.
//
// Scoring is simple and deterministic: title hits weigh more than heading
// hits, which weigh more than body hits. Query terms are AND-ed, `-term`
// excludes, `"quoted phrases"` must appear verbatim after accent/case
// folding, and `title:term` restricts a term to matching the page title.
// Zero external dependencies, same policy as the linter.

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../../linter/utils/frontmatter');
// Single source of truth for the documentation trees (same constant the
// linter CLI scans): one place to update when a tree moves or is added.
const { DOC_ROOTS } = require('../../linter/utils/doc-roots');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// [language, directory below the repository root] — the FR tree is the i18n one.
const CORPUS_ROOTS = DOC_ROOTS.map((root) => [root.includes('i18n/') ? 'fr' : 'en', root]);

const MAX_BODY_OCCURRENCES = 5;
const MAX_HEADINGS_IN_RESULT = 5;

// Fold accents and case so "réseau" matches "reseau" and "VM" matches "vm".
function fold(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokenize(text) {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

// Recursively collect .md/.mdx files, skipping partials (leading "_", the same
// rule Docusaurus and the linter apply) and hidden directories.
function walkMarkdown(dir) {
  const files = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(full));
    else if (/\.(md|mdx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

// Remove everything that is prose noise for matching: fenced code blocks, MDX
// import/export statements, JSX/HTML comments and real tags. Inline code
// content is kept — it usually carries the terms users look for. Only actual
// tags are stripped (leading letter or slash): a bare "<" in prose, as in
// "a < b", survives.
function stripNoise(body) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(import|export)\s.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ');
}

function parseDocument(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { data, body } = parseFrontmatter(content);
  const clean = stripNoise(body);

  const headings = [];
  for (const match of clean.matchAll(/^#{1,3}\s+(.+)$/gm)) {
    headings.push(match[1].trim());
  }

  const title = data.title || (content.match(/^#\s+(.+)$/m) || [])[1] || path.basename(filePath);

  const bodyTokens = new Map();
  for (const token of tokenize(clean)) {
    bodyTokens.set(token, (bodyTokens.get(token) || 0) + 1);
  }

  return {
    title,
    titleText: fold(title),
    titleTokens: new Set(tokenize(title)),
    headings,
    headingTokens: new Set(headings.flatMap(tokenize)),
    bodyTokens,
    fullText: fold(clean),
  };
}

// Rebuilt on every call, never cached: the tool's contract is to reflect the
// CURRENT working tree (uncommitted edits included), so a long-lived server
// must not serve a snapshot taken at the first call. Scanning the ~600
// Markdown sources costs tens of milliseconds per search — negligible at
// human speed. (Guarded by the no-cache test in mcp/tests/server.test.js.)
function buildCorpus() {
  const corpus = [];
  for (const [lang, dir] of CORPUS_ROOTS) {
    for (const file of walkMarkdown(path.join(REPO_ROOT, dir))) {
      corpus.push({
        lang,
        path: path.relative(REPO_ROOT, file).split(path.sep).join('/'),
        doc: parseDocument(file),
      });
    }
  }
  return corpus;
}

// The "title:" prefix (case-insensitive) restricts the term to the page
// title instead of the whole document — advertised in the tool schema.
const TITLE_PREFIX = 'title:';

function parseQuery(query) {
  const phrases = [];
  const positive = [];
  const excluded = [];
  const titles = [];
  const remainder = query.replace(/"([^"]+)"/g, (_, phrase) => {
    phrases.push(fold(phrase));
    return ' ';
  });
  for (const raw of remainder.split(/\s+/)) {
    if (!raw) continue;
    if (raw.startsWith('-') && raw.length > 1) excluded.push(fold(raw.slice(1)));
    else if (raw.toLowerCase().startsWith(TITLE_PREFIX)) {
      const term = fold(raw.slice(TITLE_PREFIX.length));
      if (term) titles.push(term);
    } else positive.push(fold(raw));
  }
  return { phrases, positive, excluded, titles };
}

// A term matches a token set on exact form, or as a prefix when the query term
// is at least 3 characters (so "kube" finds "kubernetes" but "vm" stays strict).
function matchesTokenSet(term, tokens) {
  if (tokens.has(term)) return true;
  if (term.length < 3) return false;
  for (const token of tokens) {
    if (token.startsWith(term)) return true;
  }
  return false;
}

function scoreEntry(entry, parsed) {
  const { doc } = entry;

  for (const term of parsed.excluded) {
    // Same matching surface as the positive terms: body (exact token), title
    // and headings (prefix rule) — so "-registry" also drops pages naming it
    // only in their title or headings.
    if (doc.bodyTokens.has(term)) return null;
    if (matchesTokenSet(term, doc.titleTokens)) return null;
    if (matchesTokenSet(term, doc.headingTokens)) return null;
  }
  for (const phrase of parsed.phrases) {
    if (!doc.fullText.includes(phrase)) return null;
  }
  if (
    parsed.positive.length === 0 &&
    parsed.phrases.length === 0 &&
    parsed.titles.length === 0
  ) {
    return null;
  }

  let score = 0;
  for (const term of parsed.titles) {
    // A title-filtered term must match the title (prefix rule included);
    // it does not also count as a body term.
    if (!matchesTokenSet(term, doc.titleTokens)) return null;
    score += 10;
  }
  for (const term of parsed.positive) {
    let termScore = 0;
    if (matchesTokenSet(term, doc.titleTokens)) termScore += 10;
    if (matchesTokenSet(term, doc.headingTokens)) termScore += 4;
    if (doc.bodyTokens.has(term)) termScore += Math.min(doc.bodyTokens.get(term), MAX_BODY_OCCURRENCES);
    if (termScore === 0) return null; // every positive term must match somewhere
    score += termScore;
  }
  for (const phrase of parsed.phrases) {
    score += doc.titleText.includes(phrase) ? 20 : 10;
  }

  const matchedHeadings = doc.headings.filter((heading) => {
    const folded = fold(heading);
    return (
      parsed.positive.some((term) => folded.includes(term)) ||
      parsed.titles.some((term) => folded.includes(term)) ||
      parsed.phrases.some((phrase) => folded.includes(phrase))
    );
  });

  return { score, headings: matchedHeadings.slice(0, MAX_HEADINGS_IN_RESULT) };
}

function searchDocs(query, { limit = 10 } = {}) {
  const parsed = parseQuery(query);
  if (
    parsed.positive.length === 0 &&
    parsed.phrases.length === 0 &&
    parsed.titles.length === 0
  ) {
    throw new Error('Empty query: provide at least one term, a quoted phrase, or a title: filter.');
  }

  const results = [];
  for (const entry of buildCorpus()) {
    const scored = scoreEntry(entry, parsed);
    if (!scored) continue;
    results.push({
      title: entry.doc.title,
      path: entry.path,
      lang: entry.lang,
      score: scored.score,
      headings: scored.headings,
    });
  }

  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return results.slice(0, limit);
}

// buildCorpus, parseQuery and scoreEntry are exported for the tests: the
// no-cache guard and the exclusion-surface guard assert on them directly.
module.exports = { searchDocs, buildCorpus, parseQuery, scoreEntry };
