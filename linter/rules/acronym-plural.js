const ACRONYM_PLURALS = [
  'VMs',
  'APIs',
  'VPCs',
  'IAMs',
  'ACLs',
  'IPs',
  'SSDs',
  'GPUs',
  'AZs',
  'NICs',
  'CDRs',
  'CIDRs',
  'CORSs',
  'DHCPs',
  'DNSs',
  'EIMs',
  'HMACs',
  'HTTPs',
  'HTTPSs',
  'IaaSy',
  'ICMPs',
  'IKEs',
  'NATs',
  'NRNs',
  'OIDCs',
  'RBACs',
  'SDKs',
  'TLs',
  'UUIDs',
  'VTIs',
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True when the match sits inside a Markdown link destination, a parenthesised
// path, or an image path (so directory/URL segments are not flagged as plurals).
function isInsideUrlOrPath(content, position, matchLength) {
  const before = content.slice(Math.max(0, position - 200), position);
  const after = content.slice(position + matchLength, position + matchLength + 200);
  if (/\]\([^)]*$/.test(before) && /^[^)]*\)/.test(after)) return true;
  if (/\([^)\n]*\/[^\s)\n]*$/.test(before)) return true;
  if (/\/[^\s)\n]*$/.test(before)) return true;
  return false;
}

function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];

  for (const plural of ACRONYM_PLURALS) {
    const singular = plural.replace(/s$/i, '');
    // Skip malformed entries that are not actually a plural (e.g. an acronym that
    // does not end in 's'): the "fix" would be a no-op and only yields false positives.
    if (singular === plural) continue;

    const escaped = escapeRegex(plural);
    const regex = new RegExp(`\\b${escaped}\\b`, 'g'); // nosemgrep: eslint.detect-non-literal-regexp
    let match;
    while ((match = regex.exec(content)) !== null) {
      const before = content.slice(Math.max(0, match.index - 1), match.index);
      if (before === '"') continue;

      const afterIdx = match.index + match[0].length;
      const after = content[afterIdx] || '';
      if (after === '"') continue;

      // Skip occurrences that are part of a path/URL segment (e.g. directory
      // names in image paths like /img/console/network/vpc/VPCs/...).
      if (before === '/' || after === '/') continue;
      if (isInsideUrlOrPath(content, match.index, match[0].length)) continue;

      const line = content.slice(0, match.index).split('\n').length;

      violations.push({
        code: 'glossary:acronym_plural',
        type: 'glossary',
        severity: 'medium',
        description: `Forbidden plural form: "${plural}" — acronyms do not take an 's'`,
        location_hint: `Line ${line}`,
        suggested_fix: `Use singular form: les ${singular} (no 's')`,
        ignored: false,
      });
    }
  }

  return violations;
}

// French-style acronym plurals (VM, API… without "s") — English pluralizes
// with "s" (VMs, APIs), so this is a FR-only rule.
module.exports = { check, langs: ['fr'] };
