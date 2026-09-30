function buildGlossaryIndex(glossaryJson) {
  const terms = glossaryJson.terms || {};
  const byCorrectForm = new Map();
  const byWrongForm = new Map();
  const byLowerCorrect = new Map();

  for (const [key, entry] of Object.entries(terms)) {
    const correct = entry.correct_form;
    if (!correct) continue;

    byCorrectForm.set(correct.toLowerCase(), entry);

    byLowerCorrect.set(correct.toLowerCase(), { key, entry });

    if (entry.wrong_form) {
      byWrongForm.set(entry.wrong_form.toLowerCase(), entry);
      if (entry.wrong_form.toUpperCase) {
        byWrongForm.set(entry.wrong_form.toUpperCase(), entry);
        byWrongForm.set(entry.wrong_form.toLowerCase(), entry);
      }
    }

    const capitalized = correct.charAt(0).toUpperCase() + correct.slice(1);
    if (capitalized !== correct) {
      byWrongForm.set(capitalized, entry);
    }
    const allCaps = correct.toUpperCase();
    if (allCaps !== correct && allCaps !== capitalized) {
      byWrongForm.set(allCaps, entry);
    }
  }

  return { byCorrectForm, byWrongForm, byLowerCorrect, terms };
}

function isResource(entry) {
  return entry.type && entry.type.includes('RESOURCE');
}

function isAcronym(entry) {
  return entry.type && entry.type.includes('ACRONYM');
}

function hasConceptPage(entry) {
  return !!entry.concept_page;
}

function isProperNoun(entry) {
  const t = entry && entry.type;
  return Array.isArray(t) ? t.includes('PROPER_NOUN') : t === 'PROPER_NOUN';
}

module.exports = { buildGlossaryIndex, isResource, isAcronym, isProperNoun, hasConceptPage };
