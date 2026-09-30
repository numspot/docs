// Detects leftover French in English pages (the AI translation skips
// non-prose: code comments, placeholders, diagrams…). English-only rule
// (see rule.langs). On a FR page all of this is normal, so the rule does
// not run there.

const { isProperNoun } = require('../utils/glossary-index');

// Domain proper nouns that must never be flagged but are intentionally NOT
// glossary terms (external site names, datacenter towns). Keep this list
// minimal and documented; the glossary stays for translatable vocabulary.
const DOMAIN_PROPER_NOUNS = ['e-santé', 'Magny-Les-Hameaux', 'Téléhouse'];

// Proper nouns allowed even with accents (brands, agencies, cities) — read
// from the glossary (PROPER_NOUN entries), not hardcoded. To allow a new
// accented proper noun (e.g. a town), add it to the glossary or, for
// non-glossary domain terms, to DOMAIN_PROPER_NOUNS above.
function properNouns(glossaryIndex) {
  const terms = (glossaryIndex && glossaryIndex.terms) || {};
  const names = [...DOMAIN_PROPER_NOUNS];
  for (const key of Object.keys(terms)) {
    const e = terms[key];
    if (isProperNoun(e) && e.correct_form) names.push(e.correct_form);
  }
  // Longest first: "Magny-Les-Hameaux" is stripped before "Magny".
  return names.sort((a, b) => b.length - a.length);
}

// Verbs/words typical of French code comments.
const FRENCH_COMMENT =
  /(?:^|\s)(?:#|--|\/\/)\s*(?:Vérifier|Supprimer|Lister|Créer|Récupérer|Générer|Exporter|Restreindre|Configurer|Tester|Surveiller|Afficher|Consulter|Activer|Désactiver|Réinitialiser|Insérer|Sélectionn\w*|Qui peut|Ne jamais|Utiliser|Rôle|Projets|Synchronisation)/;

// French placeholders (<utilisateur>, <hôte>, <mot_de_passe>, <Type de VM>…).
const FRENCH_PLACEHOLDER =
  /<\s*(?:utilisateur|hôte|base_de_données|mot_de_passe\w*|nom[-_\s][^>]*|schéma|verbe|ressource|NUMERO_\w*|Choisis\w*|Type de\b|ID de\b|date_expiration|nouveau_mot\w*|le nom\b)/i;

// Example values "mon-…" (instead of "my-…").
const EXAMPLE_MON = /\bmon-(?:cluster|backup|secret-manager|container-registry|node_pool)\b/;

// Spelled-out French terms that should not appear in English.
const FRENCH_TERMS = /\b(?:utilisateur|utilisateurs|comptes? de services?)\b/i;

// Terminology to unify (console/glossary label = "primary user").
const MAIN_USER = /\bmain user\b/;

// French word order (adjective after the noun).
const WORD_ORDER = /\bclusters? PostgreSQL\b/;

// French guillemets.
const FRENCH_QUOTES = /[«»]/;

// French accented characters.
const ACCENT = /[éèêëàâäîïôöûùüçœæ]/i;

function stripNoise(line) {
  return line
    .replace(/https?:\/\/\S+/g, '') // URLs
    .replace(/\]\(([^)]*)\)/g, '') // destinations de liens markdown
    .replace(/`[^`]*`/g, ''); // code inline
}

function stripProperNouns(s, names) {
  let out = s;
  for (const n of names) out = out.split(n).join('');
  return out;
}

function check(content, _frontmatter, glossaryIndex, _pageType) {
  const violations = [];
  const names = properNouns(glossaryIndex);
  const lines = content.split('\n');
  const push = (line, code, severity, description, fix) =>
    violations.push({
      code,
      type: 'i18n',
      severity,
      description,
      location_hint: `Line ${line}`,
      suggested_fix: fix,
      ignored: false,
    });

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const n = i + 1;
    const stripped = stripNoise(raw);

    if (FRENCH_QUOTES.test(stripped)) {
      push(n, 'i18n:french_quotes', 'medium', 'French guillemets « » in an English page', 'Use English quotes " " (curly “ ” inside JSX/JS strings to stay valid)');
      continue;
    }
    if (EXAMPLE_MON.test(stripped)) {
      push(n, 'i18n:french_example', 'medium', 'French example value "mon-…" in an English page', 'Use "my-…" instead of "mon-…"');
      continue;
    }
    if (FRENCH_PLACEHOLDER.test(raw)) {
      push(n, 'i18n:french_placeholder', 'medium', 'French placeholder in an English page', 'Translate the placeholder (e.g. <utilisateur> → <user>, <hôte> → <host>)');
      continue;
    }
    if (FRENCH_COMMENT.test(raw)) {
      push(n, 'i18n:french_comment', 'medium', 'French code comment in an English page', 'Translate the comment to English');
      continue;
    }
    if (FRENCH_TERMS.test(stripped)) {
      push(n, 'i18n:french_term', 'medium', 'French term ("utilisateur"/"compte de service") in an English page', 'Use "user" / "service account"');
      continue;
    }
    if (MAIN_USER.test(stripped)) {
      push(n, 'i18n:terminology', 'low', 'Inconsistent terminology "main user" (use "primary user")', 'Replace "main user" with "primary user"');
      continue;
    }
    if (WORD_ORDER.test(stripped)) {
      push(n, 'i18n:word_order', 'low', 'French word order "cluster PostgreSQL"', 'Use "PostgreSQL cluster(s)"');
      continue;
    }
    // Safety net: any remaining accented French word (excluding proper nouns).
    if (ACCENT.test(stripProperNouns(stripped, names))) {
      push(n, 'i18n:french_text', 'low', 'Accented French text left in an English page', 'Translate the residual French text (keep proper nouns and URLs)');
    }
  }

  return violations;
}

// English pages only.
module.exports = { check, langs: ['en'] };
