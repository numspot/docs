// Pre-PR orchestration for this repository.
//
// This file deliberately does NOT restate the contribution rules: every step
// points at the AGENTS.md section that is authoritative, and agents read the
// actual rule text with the get_contribution_process tool (same server). The
// only numbers here come from the linter itself, so a rule change in
// AGENTS.md or in the linter can never silently drift from this checklist.

const { COMPLIANCE_THRESHOLD } = require('../../linter/index');
const { lintChangedFiles } = require('./lint');

// Each step maps to the exact AGENTS.md heading holding the rule (H2 or H3).
const STEPS = [
  { step: 'branch', section: 'Git Workflow', hint: 'Create the branch from an up-to-date origin/main; never stack on another working branch (D-008).' },
  { step: 'file-naming', section: 'File Naming', hint: 'Hyphens, lowercase, English, no accents, max 30 characters, no numeric prefixes.' },
  { step: 'commits', section: 'Commit Messages', hint: 'Conventional Commits; one commit per PR, squash as you go (D-009).' },
  { step: 'last-update', section: 'Review Date (last update)', hint: 'Refresh last_update.date on every changed page; add it on new pages.' },
  { step: 'changelog', section: 'Changelog Updates', hint: 'Product/service changes only; one consolidated entry per PR, EN + FR (D-006, D-007).' },
  { step: 'page-deletion', section: 'Deleting pages', hint: 'Redirect + status:"removed" changelog entry in the same PR (D-021).' },
  { step: 'linter', section: 'Doc Compliance Linter', hint: 'Every changed page must reach the compliance threshold.' },
  { step: 'pull-request', section: 'Pull Request Language', hint: 'Title and description in US English (D-014); CI green; maintainer approval.' },
];

function preparePr({ lint = false, base = 'main' } = {}) {
  const result = {
    note: 'Steps in order. The rule text lives in AGENTS.md — call get_contribution_process({ section }) to get it verbatim.',
    compliance_threshold: COMPLIANCE_THRESHOLD,
    checklist: STEPS,
  };
  if (lint) {
    result.lint = lintChangedFiles({ base });
  }
  return result;
}

module.exports = { preparePr };
