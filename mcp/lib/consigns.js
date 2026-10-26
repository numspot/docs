// Serves the normative writing references to contributing agents:
//
//   - get_contribution_process: the AGENTS.md rulebook (full text, or a single
//     H2/H3 section), plus pointers to the session knowledge base.
//   - get_conventions: the consigns/ references a writer must follow —
//     standards, tone of voice, glossary, and the golden page of the type.
//
// Both are read-only views over files that already exist; nothing is
// duplicated here so the tools can never drift from the sources of truth.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONSIGNS_DIR = path.join(REPO_ROOT, 'consigns');

// Page types the documentation uses. `menu` and `home` have no golden page:
// their structure is enforced by the sidebar-order component and the
// home-zones linter test instead.
const PAGE_TYPES = [
  'action',
  'concept',
  'guide',
  'lab',
  'faq',
  'changelog',
  'quickstart',
  'glossary',
  'reversibility',
  'menu',
  'home',
];

// Golden page per page type (decision D-026): one structural model each in
// consigns/. `lab` pages follow the guide model — they are informational
// pages too. Golden pages change only through a logged decision; this map
// only points at them.
const GOLDEN_PAGES = {
  action: {
    path: 'golden_page_actions.mdx',
    note: 'Exemplar action page (D-012 layout) — mirror its structure for every action page, any language.',
  },
  concept: {
    path: 'golden_page_concepts.mdx',
    note: 'Exemplar concept page — the stable reference page of a service or component.',
  },
  guide: {
    path: 'golden_page_guides.mdx',
    note: 'Exemplar guide page — informational, no Numspot API/Console/Terraform action.',
  },
  lab: {
    path: 'golden_page_guides.mdx',
    note: 'Labs are informational pages: they follow the guide model.',
  },
  faq: {
    path: 'golden_page_faq.mdx',
    note: 'Exemplar FAQ page — numbered questions, self-sufficient answers.',
  },
  changelog: {
    path: 'golden_page_changelog.mdx',
    note: 'Reference changelog entry — canonical shape, timing and scope rules (D-006, D-007, D-020).',
  },
  quickstart: {
    path: 'golden_page_quickstart.mdx',
    note: 'Exemplar quickstart page — guided end-to-end tutorial with the Walkthrough component.',
  },
  glossary: {
    path: 'golden_page_glossary.mdx',
    note: 'Exemplar glossary page — one H2 per letter, one H4 per term.',
  },
  reversibility: {
    path: 'golden_page_reversibility.mdx',
    note: 'Exemplar service reversibility page — links the general policy instead of restating it.',
  },
};

function readText(fileName) {
  return fs.readFileSync(path.join(CONSIGNS_DIR, fileName), 'utf8');
}

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(CONSIGNS_DIR, fileName), 'utf8'));
}

// The glossary carries lint-oriented metadata; project it to what a writer
// needs (official form, forbidden forms, meaning) to keep the payload lean.
function projectGlossary(glossary) {
  const terms = {};
  for (const [key, term] of Object.entries(glossary.terms || {})) {
    terms[key] = {
      correct_form: term.correct_form,
      ...(term.wrong_form ? { wrong_form: term.wrong_form } : {}),
      ...(term.meaning ? { meaning: term.meaning } : {}),
    };
  }
  return { metadata: glossary.metadata, terms };
}

// Uniform shape for every reference: where it comes from + what it says
// (raw text for Markdown, parsed JSON for JSON files).
function getConventions(args) {
  args = args || {};
  // A mistyped argument name (e.g. "pageType" instead of "type") must fail
  // loudly: silently ignoring it would serve the action golden page while the
  // caller believes it holds the model of its own page type.
  const unknown = Object.keys(args).filter((key) => key !== 'type');
  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument ${unknown.map((key) => `"${key}"`).join(', ')} for get_conventions. Use "type" — one of: ${PAGE_TYPES.join(', ')}.`
    );
  }
  const { type } = args;
  if (type && !PAGE_TYPES.includes(type)) {
    throw new Error(`Unknown page type "${type}". Expected one of: ${PAGE_TYPES.join(', ')}.`);
  }
  // No type given = the contributor is writing an action page: serve the
  // action model, the most constrained one.
  const golden = type ? GOLDEN_PAGES[type] : GOLDEN_PAGES.action;
  const result = {
    page_type: type || 'action',
    standards: {
      path: 'consigns/standards.md',
      content: readText('standards.md'),
    },
    tone_of_voice: {
      path: 'consigns/tone_of_voice.json',
      content: readJson('tone_of_voice.json'),
    },
    glossary: {
      path: 'consigns/glossary.json',
      note: 'Official terminology — use correct_form, never wrong_form.',
      content: { terms: projectGlossary(readJson('glossary.json')).terms },
    },
  };
  if (golden) {
    result.golden_page = {
      path: `consigns/${golden.path}`,
      note: golden.note,
      content: fs.readFileSync(path.join(CONSIGNS_DIR, golden.path), 'utf8'),
    };
  }
  return result;
}

function getContributionProcess({ section } = {}) {
  const content = fs.readFileSync(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8');
  if (!section) {
    return {
      source: 'AGENTS.md',
      note: 'Session problems and past decisions live in PROBLEMS.md and DECISIONS.md. Call again with { section } to extract a single topic.',
      content,
    };
  }

  // Sections match at H2 or H3 level; the block stops at the next heading of
  // the same or higher level, so an H3 slice stays inside its H2 chapter.
  const lines = content.split('\n');
  const needle = section.toLowerCase();
  let start = -1;
  let startLevel = 2;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{2,3})\s+/);
    if (match && lines[i].toLowerCase().includes(needle)) {
      start = i;
      startLevel = match[1].length;
      break;
    }
  }
  if (start === -1) {
    const available = lines
      .filter((line) => /^#{2,3}\s+/.test(line))
      .map((line) => line.replace(/^#{2,3}\s+/, ''));
    throw new Error(
      `No section matching "${section}" in AGENTS.md. Available sections:\n- ${available.join('\n- ')}`
    );
  }

  const stopRe = new RegExp(`^#{1,${startLevel}}\\s+`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (stopRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  return {
    source: 'AGENTS.md',
    section: lines[start].replace(/^#{2,3}\s+/, ''),
    content: lines.slice(start, end).join('\n').trimEnd(),
  };
}

module.exports = { getContributionProcess, getConventions, PAGE_TYPES };
