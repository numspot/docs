#!/usr/bin/env node
// Post-build synonym validator for the site search (PR #21 review follow-up).
//
// The curated FR/EN synonym map (SYNONYM_GROUPS in numspotSearch.js) is a
// query-side construct: nothing fails at build time if a member can never
// match. Past failure mode (caught in review): members containing stopwords
// ("mot de passe" — the index removes "de") or hyphens ("pare-feu" — the
// tokenizer splits on "-") were emitted as a single REQUIRED clause that
// matched nothing, and lunr voids a whole query when one REQUIRED clause
// matches nothing — the member silently returned zero results.
//
// This script runs after `yarn build` (CI wires it there) against the REAL
// built indexes and fails loudly when:
//   1. a synonym member matches no document on any locale index (dead
//      member — the exact bug above), or
//   2. a stopword or 1–2 character word became a TOKEN_INDEX lookup key
//      (trigger-word pollution: typing "déploiement de l'application" used
//      to fire the password/database/availability-zone/load-balancer
//      synonyms through the "de" key).
//
// It is a guard, not a fix: the parser normalizes phrases through the index
// tokenizer by design (see numspotSearch.js and SEARCH.md).
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const PKG = path.join(REPO_ROOT, "node_modules", "@easyops-cn", "docusaurus-search-local");
const NUMSPOT_SEARCH = path.join(PKG, "dist/client/client/theme/numspotSearch.js");

const lunr = require(path.join(REPO_ROOT, "node_modules", "lunr"));
require(path.join(REPO_ROOT, "node_modules", "lunr-languages", "lunr.stemmer.support.js"))(lunr);
require(path.join(REPO_ROOT, "node_modules", "lunr-languages", "lunr.fr.js"))(lunr);

// The serialized pipeline carries the "foldAccents" label (accent-folding
// patch): register it identically or lunr.Index.load drops it silently.
const foldAccents = (token) => token.update((str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
lunr.Pipeline.registerFunction(foldAccents, "foldAccents");

const { SYNONYM_GROUPS, synonymIndexWords, phraseWords, isStopword } = require(NUMSPOT_SEARCH);

// ---------------------------------------------------------------------------
// 1. Locate every built index (root locale + i18n locales, every version).
// ---------------------------------------------------------------------------
function findBuiltIndexes(dir, out = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findBuiltIndexes(full, out);
        }
        // The plugin writes the index at the root of every locale build:
        // build/search-index[-<context>]-<hash>.json (hashed: "filename").
        else if (/^search-index.*\.json$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

const buildDir = path.join(REPO_ROOT, "build");
const indexFiles = findBuiltIndexes(buildDir);
if (indexFiles.length === 0) {
    console.error("validate-search-synonyms: no built search index found under build/ — run `yarn build` first.");
    process.exit(1);
}

// The built file is the same payload the worker fetches: an array of
// { documents, index } per document type; `lunr.Index.load` rehydrates it.
const failures = [];

// ---------------------------------------------------------------------------
// 2. Every synonym member must match >= 1 document on >= 1 locale index,
//    running exactly the clauses the worker emits for it (its normalized
//    words as REQUIRED, boosted below exact matches).
// ---------------------------------------------------------------------------
const SYNONYM_BOOST = 0.5;

function matchesOnAnyLocale(words) {
    for (const file of indexFiles) {
        const wrapped = JSON.parse(fs.readFileSync(file, "utf8"));
        for (const { index } of wrapped) {
            const results = lunr.Index.load(index).query((query) => {
                for (const word of words) {
                    query.term(word, { presence: lunr.Query.presence.REQUIRED, boost: SYNONYM_BOOST });
                }
            });
            if (results.length > 0) {
                return file;
            }
        }
    }
    return null;
}

for (const group of SYNONYM_GROUPS) {
    for (const member of group) {
        const words = phraseWords(member);
        if (words.length === 0) {
            failures.push(`"${member}" is reduced to stopwords — the member can never match anything`);
            continue;
        }
        const foundIn = matchesOnAnyLocale(words);
        if (!foundIn) {
            failures.push(`"${member}" (words: ${words.join(" + ")}) matches 0 document on every built index`);
        }
    }
}

// ---------------------------------------------------------------------------
// 3. Hygiene of the TOKEN_INDEX keys: no stopword, no 1–2 character trigger
//    word (they match thousands of tokens and pollute unrelated queries).
// ---------------------------------------------------------------------------
for (const key of synonymIndexWords()) {
    if (isStopword(key)) {
        failures.push(`stopword "${key}" became a synonym lookup key — normalize members through phraseWords()`);
    }
    else if (key.length < 2) {
        failures.push(`1-character key "${key}" in the synonym index — too broad a trigger word`);
    }
}

if (failures.length > 0) {
    console.error(`validate-search-synonyms: ${failures.length} dead or polluted synonym member(s):`);
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    console.error(`Indexes checked: ${indexFiles.length}`);
    process.exit(1);
}

console.log(`validate-search-synonyms: ${SYNONYM_GROUPS.flat().length} members alive across ${indexFiles.length} built index file(s) ✓`);
