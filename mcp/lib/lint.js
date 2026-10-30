// Wrapper around the repository's doc-compliance linter (linter/cli.js).
//
// The MCP server never re-implements validation: it shells out to the exact
// CLI that CI runs, so the results an agent sees always match the pipeline.
// Only the JSON output is projected — same fields, minus internal noise.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// Paths offered to agents must stay inside the repository.
function resolveInsideRepo(inputPath) {
  const resolved = path.resolve(REPO_ROOT, inputPath);
  if (resolved !== REPO_ROOT && !resolved.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`Path escapes the repository: ${inputPath}`);
  }
  return resolved;
}

function runLinter(args) {
  const result = spawnSync(process.execPath, ['linter/cli.js', ...args, '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`Failed to run the linter: ${result.error.message}`);
  }
  // The CLI prints a plain sentence instead of JSON when the diff is empty.
  if (result.stdout.trim().startsWith('No documentation files to lint')) {
    return {
      files: [],
      summary: { totalFiles: 0, compliantFiles: 0, totalViolations: 0 },
    };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    const stdout = (result.stdout || '').slice(0, 500);
    const stderr = (result.stderr || '').slice(0, 500);
    throw new Error(`Linter did not return valid JSON.\nstdout: ${stdout}\nstderr: ${stderr}`);
  }
}

// Keep the fields an authoring agent acts on; drop purely internal ones.
function projectFiles(files) {
  return (files || []).map((file) => ({
    file: file.file,
    score: file.score,
    is_compliant: file.is_compliant,
    violations: (file.violations || []).map((violation) => ({
      code: violation.code,
      severity: violation.severity,
      description: violation.description,
      location_hint: violation.location_hint,
      suggested_fix: violation.suggested_fix,
    })),
  }));
}

function lintPage({ path: target, type } = {}) {
  if (!target) {
    throw new Error('Missing required argument: path');
  }
  const resolved = resolveInsideRepo(target);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${target}`);
  }
  const args = [path.relative(REPO_ROOT, resolved).split(path.sep).join('/')];
  if (type) {
    if (!['action', 'concept'].includes(type)) {
      throw new Error(`Invalid type "${type}": expected "action" or "concept".`);
    }
    args.push('--type', type);
  }
  const parsed = runLinter(args);
  return { files: projectFiles(parsed.files), summary: parsed.summary };
}

// Resolve the PR diff base the way PROBLEMS.md prescribes for diff-based
// tooling: try the requested ref, then the usual CI names, and degrade
// gracefully — a shallow pull-request checkout (the CI `tests` job) carries
// no branch ref at all, so `main` cannot resolve there.
function gitRefExists(ref) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd: REPO_ROOT,
  });
  return result.status === 0;
}

function lintChangedFiles({ base } = {}) {
  const requested = base || 'main';
  const resolved = [requested, 'origin/main', 'main'].find((ref) => gitRefExists(ref));
  if (!resolved) {
    return {
      base: requested,
      error:
        'No diff base available in this checkout (shallow clone without branch refs). Pass an explicit base or run on a full checkout.',
      summary: null,
      non_compliant_files: [],
    };
  }
  const parsed = runLinter(['--diff', resolved]);
  // Only surface non-compliant files: the checklist reader wants what to fix.
  const files = projectFiles(parsed.files).filter((file) => !file.is_compliant);
  return { base: resolved, summary: parsed.summary, non_compliant_files: files };
}

module.exports = { lintPage, lintChangedFiles, runLinter };
