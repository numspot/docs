// Maintainer meta-comments (TODO / FIXME / NOTE / HACK / XXX) are
// engineering artifacts, not reader content: they are grepped across git
// history and code reviews, and conventionally stay in English on every
// locale. Reader-facing comments are page content and follow the page
// language (see consigns/standards.md, "Commentaires de code").
//
// FR pages only: on EN pages any French comment is already flagged by
// french-residuals. Only comments INSIDE fenced code blocks are inspected,
// and only when a meta marker is followed by French text.

const FENCE = /^(```|~~~)/;

// Comment starting with a conventional meta marker — line start OR inline
// (e.g. `replicas: 3 # FIXME: …`).
const META =
  /(?:^|[\s(])(?:#|\/\/|--)\s*(TODO|FIXME|NOTE|HACK|XXX)\b\s*[:\-–—]?\s*(.+)$/i;

// French indicators: accented characters, imperative verbs typical of
// French comments, unambiguous connectors. Deliberately narrow — a bare
// "TODO" or English text must never be flagged.
const ACCENT = /[éèêëàâäîïôöûùüçœæ]/i;
const FRENCH =
  /\b(?:cr[ée]er|cr[ée]ez|supprimer|supprimez|lister|r[ée]cup[ée]rer|g[ée]n[ée]rer|v[ée]rifier|v[ée]rifiez|modifier|ajouter|ajoutez|configurer|remplacer|remplacez|utiliser|utilisez|dans|pour|avec|votre|vos|selon|ainsi|puis)\b/i;

function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) continue;

    const m = lines[i].match(META);
    if (!m) continue;

    const body = m[2];
    if (ACCENT.test(body) || FRENCH.test(body)) {
      violations.push({
        code: 'i18n:french_meta_comment',
        type: 'i18n',
        severity: 'medium',
        description: `French text in a ${m[1].toUpperCase()} meta-comment — maintainer markers (TODO/FIXME/NOTE/HACK/XXX) stay in English on every locale`,
        location_hint: `Line ${i + 1}`,
        suggested_fix:
          'Translate the meta-comment to English (reader-facing comments stay in the page language)',
        ignored: false,
      });
    }
  }

  return violations;
}

// FR pages only — EN pages flag any French comment via french-residuals.
module.exports = { check, langs: ['fr'] };
