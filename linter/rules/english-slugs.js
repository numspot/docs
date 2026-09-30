// Enforces the company policy: EVERY page URL (slug) must be in English, in ALL
// locales (FR included). The slug comes from the `slug:` frontmatter when present,
// otherwise from the file path. We flag clearly-French words that appear as whole
// slug words (hyphen/slash delimited) — never as substrings, so English words like
// "access" or "lifecycle" are not false-flagged.
//
// Fix when a page has a French path: add an English `slug:` in the frontmatter
// (KEEP the file path so the i18n link between a page and its translation stays
// intact), and — if the page was already published under the old slug — register
// the rename in src/plugins/slug-redirects.js (SLUG_RENAMES) so the old URL keeps
// working as a non-indexed redirect. See CONVENTIONS-SLUGS.md.
//
// Applies to every language (no `langs`): slugs are English even on FR pages.

// Clearly-French words that must never appear in a slug. Kept to unambiguous French
// words (no English homographs like "role", "audit", "journal", "creation",
// "modification", "suppression", "access"), matched as whole slug words only.
const FRENCH_SLUG_WORDS = new Set([
  'plateforme', 'passerelle', 'annuaire', 'donnee', 'donnees', 'utilisateur',
  'utilisateurs', 'reseau', 'reseaux', 'stockage', 'securite', 'sauvegarde',
  'repertoire', 'fichier', 'fichiers', 'demarrage', 'gestion', 'journaux',
  'parametre', 'parametres', 'apercu', 'reglages', 'abonnement', 'adhesion',
  'reversibilite', 'deploiement', 'journalisation', 'chiffrement', 'connexion',
  'telechargement', 'serveur', 'serveurs', 'environnement', 'requete', 'requetes',
  'facturation', 'catalogue', 'sauvegardes',
]);

// Splits a slug/path into lowercase words (hyphen, underscore, slash, dot delimited).
function slugWords(str) {
  return String(str)
    .toLowerCase()
    .split(/[/\-_.\s]+/)
    .filter(Boolean);
}

function frenchWordsIn(str) {
  return [...new Set(slugWords(str).filter(w => FRENCH_SLUG_WORDS.has(w)))];
}

function check(content, frontmatter, _glossaryIndex, _pageType, filePath) {
  const file = String(filePath || '');
  // Partials / components (_-prefixed) are not routed pages: no public URL.
  if (/(^|\/)_/.test(file.replace(/\\/g, '/'))) return [];

  // parseFrontmatter returns { data, body, raw, ... }; fields live under `.data`.
  // Fall back to the object itself so the rule also works if passed a flat map.
  const fm = (frontmatter && frontmatter.data) || frontmatter || {};

  // Effective slug: explicit `slug:` wins; otherwise the doc-relative file path.
  const hasExplicitSlug = typeof fm.slug === 'string' && fm.slug.trim();

  let target;
  let fromSlug;
  if (hasExplicitSlug) {
    target = fm.slug;
    fromSlug = true;
  } else {
    // Doc-relative path: everything after the last "/docs/" (works for both
    // docs/docs/… and i18n/en/…/current/docs/…), without the extension.
    const norm = file.replace(/\\/g, '/');
    const idx = norm.lastIndexOf('/docs/');
    target = (idx >= 0 ? norm.slice(idx + 6) : norm).replace(/\.[^.]+$/, '');
    fromSlug = false;
  }

  const french = frenchWordsIn(target);
  if (french.length === 0) return [];

  const list = french.join('", "');
  return [
    {
      code: 'i18n:non_english_slug',
      type: 'i18n',
      severity: 'medium',
      description: fromSlug
        ? `Slug contains French word(s): "${list}". Slugs must be in English (all locales).`
        : `Page URL derives from a French path segment: "${list}". Slugs must be in English (all locales).`,
      location_hint: fromSlug ? 'Frontmatter slug' : 'File path',
      suggested_fix: fromSlug
        ? 'Rewrite the `slug:` in English; keep the old slug alive as a noindex redirect (SLUG_RENAMES in src/plugins/slug-redirects.js — see CONVENTIONS-SLUGS.md).'
        : 'Add an English `slug:` frontmatter (keep the file path for i18n), and register the old slug in SLUG_RENAMES (src/plugins/slug-redirects.js — see CONVENTIONS-SLUGS.md).',
      ignored: false,
    },
  ];
}

module.exports = { check };
