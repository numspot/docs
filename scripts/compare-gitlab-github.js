#!/usr/bin/env node
// Cross-repository consistency check for the locale-layout migration.
//
// Compares the GitLab checkout (pre-migration layout: French at docs/docs,
// English under i18n/en/) against the GitHub checkout (post-migration:
// English at docs/docs, French under i18n/fr/). Verifies that:
//   1. every French page survived the move, byte-identical;
//   2. every English page survived the move, byte-identical;
//   3. no page was lost or gained on either side (partial/_category_ files
//      excluded — they keep living in the default-locale tree only);
//   4. the FR/EN changelogs stay entry-for-entry aligned in both repos;
//   5. the GitHub i18n config declares English as the default locale.
//
// Usage:
//   node scripts/compare-gitlab-github.js /path/to/numspot-docs /path/to/docs
// Exits 0 when everything matches, 1 with a diff report otherwise.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const [gitlabRoot, githubRoot] = process.argv.slice(2).map((p) => p && path.resolve(p));
if (!gitlabRoot || !githubRoot) {
  console.error('usage: node scripts/compare-gitlab-github.js <gitlab-checkout> <github-checkout>');
  process.exit(2);
}

// Path mapping introduced by the 2026-10-01 default-locale swap:
//   GitHub docs/docs        (EN, source of truth)  = GitLab i18n/en/…/docs
//   GitHub i18n/fr/…/docs   (FR mirror)            = GitLab docs/docs
const MAPS = [
  {
    name: 'EN tree (source of truth)',
    github: 'docs/docs',
    gitlab: 'i18n/en/docusaurus-plugin-content-docs/current/docs',
  },
  {
    name: 'FR tree (mirror)',
    github: 'i18n/fr/docusaurus-plugin-content-docs/current/docs',
    gitlab: 'docs/docs',
  },
];

const problems = [];
let compared = 0;

function listPages(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(md|mdx|json)$/.test(entry.name) && !entry.name.startsWith('_')) {
        out.push(path.relative(root, full));
      }
    }
  };
  walk(root);
  return out.sort();
}

function sameContent(a, b) {
  return fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8');
}

for (const map of MAPS) {
  const ghDir = path.join(githubRoot, map.github);
  const glDir = path.join(gitlabRoot, map.gitlab);
  if (!fs.existsSync(ghDir)) {
    problems.push(`[${map.name}] missing on GitHub: ${map.github}`);
    continue;
  }
  if (!fs.existsSync(glDir)) {
    problems.push(`[${map.name}] missing on GitLab: ${map.gitlab}`);
    continue;
  }
  const ghPages = new Set(listPages(ghDir));
  const glPages = new Set(listPages(glDir));
  const onlyGithub = [...ghPages].filter((p) => !glPages.has(p));
  const onlyGitlab = [...glPages].filter((p) => !ghPages.has(p));
  if (onlyGithub.length) {
    problems.push(`[${map.name}] ${onlyGithub.length} files only on GitHub (expected: new since the GitLab main froze):\n  ${onlyGithub.slice(0, 8).join('\n  ')}`);
  }
  if (onlyGitlab.length) {
    problems.push(`[${map.name}] ${onlyGitlab.length} files missing on GitHub:\n  ${onlyGitlab.slice(0, 8).join('\n  ')}`);
  }
  let differing = 0;
  for (const rel of ghPages) {
    if (!glPages.has(rel)) continue;
    const ghFile = path.join(ghDir, rel);
    const glFile = path.join(glDir, rel);
    if (!sameContent(ghFile, glFile)) {
      differing += 1;
      if (differing <= 5) problems.push(`[${map.name}] content differs: ${rel}`);
    }
  }
  compared += ghPages.size;
  console.log(`[${map.name}] ${ghPages.size} GitHub files vs ${glPages.size} GitLab files, ${differing} content differences`);
}

// Changelog alignment inside each repository (FR/EN entry counts).
for (const [repo, root] of [['GitHub', githubRoot], ['GitLab', gitlabRoot]]) {
  const frPath = repo === 'GitHub'
    ? path.join(root, 'i18n/fr/docusaurus-plugin-content-docs/current/docs/changelog.json')
    : path.join(root, 'docs/docs/changelog.json');
  const enPath = repo === 'GitHub'
    ? path.join(root, 'docs/docs/changelog.json')
    : path.join(root, 'i18n/en/docusaurus-plugin-content-docs/current/docs/changelog.json');
  for (const p of [frPath, enPath]) {
    if (!fs.existsSync(p)) {
      problems.push(`[${repo}] missing changelog: ${path.relative(root, p)}`);
    }
  }
  if (fs.existsSync(frPath) && fs.existsSync(enPath)) {
    const fr = JSON.parse(fs.readFileSync(frPath, 'utf8')).entries.length;
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8')).entries.length;
    if (fr !== en) problems.push(`[${repo}] changelog drift: FR ${fr} entries vs EN ${en}`);
    console.log(`[${repo}] changelog entries: EN ${en} / FR ${fr}`);
  }
}

// GitHub i18n config sanity: English must be the default locale.
const config = fs.readFileSync(path.join(githubRoot, 'docusaurus.config.ts'), 'utf8');
if (!/defaultLocale:\s*"en"/.test(config)) {
  problems.push('[config] GitHub defaultLocale is not "en"');
}
if (!/locales:\s*\[\s*"en",\s*"fr"\s*\]/.test(config)) {
  problems.push('[config] GitHub locales should be ["en", "fr"]');
}

console.log(`\ncompared ${compared} files across ${MAPS.length} mapped trees`);
if (problems.length) {
  console.error(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log('ALL OK — GitHub and GitLab content trees match through the path mapping.');
