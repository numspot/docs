// Checks that referenced images (/img/…) actually exist under static/, with
// the RIGHT CASE. macOS has a case-insensitive filesystem, so a reference to
// "Numspot.png" pointing at "NumSpot.png" works there but 404s on Linux/GitLab
// Pages. We therefore compare each path segment against the real directory
// entries (readdir), so case mismatches are caught too. Cross-locale rule
// (FR + EN).
const fs = require('fs');
const path = require('path');

function existsCaseSensitive(relPath) {
  const parts = relPath.split('/').filter(p => p && p !== '.');
  let dir = process.cwd();
  for (const part of parts) {
    let entries;
    try {
      entries = fs.readdirSync(dir); // nosemgrep: eslint.detect-non-literal-fs-filename
    } catch {
      return false;
    }
    if (!entries.includes(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
}

function check(content) {
  const violations = [];
  const refs = new Set();

  // src="/img/…" | src='/img/…' | img: "/img/…" (Walkthrough component)
  const reAttr = /(?:\bsrc|\bimg)\s*[:=]\s*["']([^"']+)["']/g;
  let m;
  while ((m = reAttr.exec(content)) !== null) refs.add(m[1]);
  // ![alt](/img/…) — the destination may contain spaces + an optional title
  const reMd = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((m = reMd.exec(content)) !== null) refs.add(m[1].replace(/\s+"[^"]*"$/, '').trim());

  for (const ref of refs) {
    if (!ref.startsWith('/img/')) continue;
    const clean = ref.replace(/[#?].*$/, ''); // no anchor/query on an image
    if (!existsCaseSensitive('static' + clean)) {
      violations.push({
        code: 'assets:image_missing',
        type: 'assets',
        severity: 'high',
        description: `Image "${ref}" not found under static/ (missing file or wrong case)`,
        location_hint: `Image: ${ref}`,
        suggested_fix:
          'Match the path/case to the real file in static/img/ (case-sensitive on Linux/CI)',
        ignored: false,
      });
    }
  }

  return violations;
}

module.exports = { check };
