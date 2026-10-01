#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { lintPage, calculateScore } = require('./index');

const DEFAULT_GLOSSARY = path.resolve(__dirname, '..', 'consigns', 'glossary.json');

// Roots scanned for empty categories, mirroring the two documentation trees
// the CLI lints (FR source + EN translation).
const DOC_ROOTS = ['docs/docs', 'i18n/fr/docusaurus-plugin-content-docs/current/docs'];

// A directory holding a _category_.json but no doc page at all (no direct
// .md/.mdx page, no subdirectory) renders as an empty section in the docs
// navigation. Docusaurus silently publishes it, so the linter reports it as
// a pseudo-file violation attached to the _category_.json path.
function findEmptyCategoryDirs(rootDir) {
  const root = safePath(rootDir);
  if (!fs.existsSync(root)) return []; // nosemgrep: eslint.detect-non-literal-fs-filename
  const empty = [];
  const visit = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true }); // nosemgrep: eslint.detect-non-literal-fs-filename
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith('.') ||
        entry.name.startsWith('_') ||
        entry.name === 'node_modules'
      )
        continue;
      const full = path.join(dir, entry.name);
      let children;
      try {
        children = fs.readdirSync(full, { withFileTypes: true }); // nosemgrep: eslint.detect-non-literal-fs-filename
      } catch {
        continue;
      }
      const hasCategory = children.some(c => c.isFile() && c.name === '_category_.json');
      const hasPages = children.some(
        c => c.isFile() && (c.name.endsWith('.md') || c.name.endsWith('.mdx')) && !c.name.startsWith('_')
      );
      const hasSubdirs = children.some(
        c => c.isDirectory() && !c.name.startsWith('.') && !c.name.startsWith('_')
      );
      if (hasCategory && !hasPages && !hasSubdirs) {
        empty.push(path.join(full, '_category_.json'));
      }
      visit(full);
    }
  };
  visit(root);
  return empty;
}

function getEmptyCategoryViolations() {
  const seen = new Set();
  const results = [];
  for (const root of DOC_ROOTS) {
    for (const catFile of findEmptyCategoryDirs(root)) {
      const violations = [
        {
          code: 'structural:empty_category',
          type: 'structural',
          severity: 'high',
          description: 'Category contains a _category_.json but no documentation page',
          location_hint: path.relative(process.cwd(), catFile),
          suggested_fix: 'Add a page to the category or remove the _category_.json',
          ignored: false,
        },
      ];
      const result = {
        file: path.relative(process.cwd(), catFile),
        violations,
        score: calculateScore(violations),
        is_compliant: false,
        linter: true,
      };
      if (seen.has(result.file)) continue;
      seen.add(result.file);
      results.push(result);
    }
  }
  return results;
}

function findPageType(relativePath) {
  return relativePath.includes('actions') ? 'action' : 'concept';
}

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

function lintFiles(files, glossaryPath, options = {}) {
  const existing = files.filter(f => {
    try {
      return fs.existsSync(safePath(f)); // nosemgrep: eslint.detect-non-literal-fs-filename
    } catch {
      return false;
    }
  });
  // Empty categories are checked regardless of the files being linted: a
  // diff-mode run may contain zero markdown files (e.g. the only page of a
  // category was deleted — deletions are filtered out) while the orphaned
  // _category_.json must still fail the lint.
  const categoryResults = getEmptyCategoryViolations();
  if (existing.length === 0 && categoryResults.length === 0) {
    console.log('No documentation files to lint.');
    return;
  }

  let totalFiles = 0;
  let compliantFiles = 0;
  let totalViolations = 0;
  const allResults = [];

  for (const file of existing) {
    const relPath = path.relative(process.cwd(), file);
    const pageType = options.pageType || findPageType(relPath);
    // Language: CLI override (--lang), otherwise auto-detected from the path
    // (translations live under i18n/fr/…). Determines which language-specific
    // rules apply (see rule.langs in index.js).
    const lang = options.lang || (relPath.startsWith('i18n/fr/') ? 'fr' : 'en');
    const result = lintPage(file, pageType, glossaryPath, lang);

    totalFiles++;
    totalViolations += result.violations.length;
    if (result.is_compliant) compliantFiles++;

    allResults.push({ file: relPath, ...result });

    if (!options.json && result.violations.length > 0) {
      printHumanReadable(relPath, result);
    }
  }

  for (const categoryResult of categoryResults) {
    totalFiles++;
    totalViolations += categoryResult.violations.length;
    allResults.push(categoryResult);
    if (!options.json) printHumanReadable(categoryResult.file, categoryResult);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        { files: allResults, summary: { totalFiles, compliantFiles, totalViolations } },
        null,
        2
      )
    );
  } else {
    console.log('\n' + '='.repeat(60));
    console.log(
      `Summary: ${compliantFiles}/${totalFiles} files compliant, ${totalViolations} total violations`
    );
  }

  if (options.ci && compliantFiles < totalFiles) {
    process.exit(1);
  }
}

// Docusaurus excludes files/folders whose name starts with "_" from routing
// (they are partials/includes, not standalone pages), so the linter skips them too.
function isPartial(filePath) {
  return filePath.split('/').some(seg => seg.startsWith('_'));
}

function getChangedFiles(diffRef) {
  try {
    const output = execSync(`git diff --name-only --diff-filter=ACMR ${diffRef}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(
        f =>
          (f.startsWith('docs/docs/') ||
            f.startsWith('i18n/fr/docusaurus-plugin-content-docs/current/docs/')) &&
          (f.endsWith('.md') || f.endsWith('.mdx'))
      )
      .filter(f => !isPartial(f))
      .map(f => path.resolve(f));
  } catch (e) {
    console.error(`Failed to get changed files from git diff ${diffRef}: ${e.message}`);
    process.exit(1);
  }
}

function walkDir(dir, files) {
  const safeDir = safePath(dir);
  const entries = fs.readdirSync(safeDir, { withFileTypes: true }); // nosemgrep: eslint.detect-non-literal-fs-filename
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_') || entry.name === 'node_modules')
        continue;
      walkDir(fullPath, files);
    } else if (
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) &&
      !entry.name.startsWith('_')
    ) {
      files.push(fullPath);
    }
  }
}

function printHumanReadable(filePath, result) {
  const status = result.is_compliant ? '✅' : '❌';
  console.log(`\n${status} ${path.basename(filePath)} — Score: ${result.score}%`);

  for (const v of result.violations) {
    const icon = v.severity === 'high' ? '🔴' : v.severity === 'medium' ? '🟡' : '🔵';
    const ignored = v.ignored ? ' [IGNORED]' : '';
    console.log(`  ${icon} [${v.code}] ${v.description}${ignored}`);
    if (v.location_hint) console.log(`     → ${v.location_hint}`);
    if (v.suggested_fix) console.log(`     Fix: ${v.suggested_fix}`);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: node linter/cli.js <path> [options]
       node linter/cli.js --diff <ref> [options]

Arguments:
  <path>                File or directory to lint

Options:
  --diff <ref>            Lint only changed files (markdown in docs/docs/ and
                          i18n/fr/.../current/docs/) vs <ref>
                          <ref> can be a branch, tag, or commit SHA
                          In CI, use $CI_MERGE_REQUEST_DIFF_BASE_SHA
  --type <action|concept> Override page type detection (default: auto-detect from path)
  --lang <fr|en>          Force the language ruleset (default: auto — files under
                          i18n/fr/ are linted as 'fr', which skips EN-only rules
                          like glossary terminology and acronym pluralization)
  --glossary <path>       Path to glossary.json (default: consigns/glossary.json)
  --json                  Output results as JSON
  --ci                    Exit with code 1 if not compliant
  --help                  Show this help

Empty categories (a directory with a _category_.json but no documentation
page) are always reported as a structural:empty_category violation, whatever
the linted file set.

Examples:
  # Lint all docs
  node linter/cli.js docs/docs/

  # Lint a single file
  node linter/cli.js docs/docs/compute/vms/create.mdx

  # Lint only files changed vs main (local)
  node linter/cli.js --diff main

  # Lint only files changed in MR (CI)
  node linter/cli.js --diff $CI_MERGE_REQUEST_DIFF_BASE_SHA --ci

  # JSON output
  node linter/cli.js docs/docs/ --json
`);
    process.exit(0);
  }

  const options = {};
  let pageType = null;
  let glossaryPath = DEFAULT_GLOSSARY;
  let diffRef = null;
  let targetPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--diff' && args[i + 1]) {
      diffRef = args[++i];
    } else if (args[i] === '--type' && args[i + 1]) {
      pageType = args[++i];
    } else if (args[i] === '--glossary' && args[i + 1]) {
      glossaryPath = path.resolve(args[++i]);
    } else if (args[i] === '--json') {
      options.json = true;
    } else if (args[i] === '--ci') {
      options.ci = true;
    } else if (args[i] === '--lang' && args[i + 1]) {
      options.lang = args[++i];
    } else if (!args[i].startsWith('--')) {
      targetPath = args[i];
    }
  }

  if (pageType) options.pageType = pageType;

  if (diffRef) {
    const files = getChangedFiles(diffRef);
    lintFiles(files, glossaryPath, options);
  } else if (targetPath) {
    const resolvedPath = safePath(targetPath);
    const stat = fs.statSync(resolvedPath); // nosemgrep: eslint.detect-non-literal-fs-filename
    if (stat.isDirectory()) {
      const files = [];
      walkDir(resolvedPath, files);
      lintFiles(files, glossaryPath, options);
    } else {
      lintFiles([resolvedPath], glossaryPath, options);
    }
  } else {
    console.error('Error: provide a <path> or --diff <ref>. Use --help for usage.');
    process.exit(1);
  }
}

main();
