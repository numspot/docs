// Checks that admonition fences are balanced: every `:::type` opener must be
// closed by a bare-colon line with the same colon count. A mismatched closer
// (e.g. `::::` closing a `:::danger`) or an unclosed admonition swallows the
// rest of the page into the admonition box, visibly breaking the rendering.
// Nested admonitions are legitimate when each level uses more colons than the
// one it wraps (outer `::::note` … inner `:::info` … `:::` … `::::`).
function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const lines = content.split('\n');
  const stack = []; // colon counts of currently open admonitions

  let inCodeBlock = false;
  let fence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip fenced code blocks: colons there are code, not admonition syntax.
    // Leading whitespace is accepted on the closing fence because code blocks
    // inside numbered/bulleted lists are indented.
    if (inCodeBlock) {
      const c = line.match(/^\s*(`{3,})\s*$/);
      if (c && c[1].length >= fence.length) inCodeBlock = false;
      continue;
    }
    const o = line.match(/^\s*(`{3,})(\w+)?/);
    if (o) {
      inCodeBlock = true;
      fence = o[1];
      continue;
    }

    const opener = line.match(/^\s*:::([a-zA-Z][\w-]*)(\s|$)/);
    if (opener) {
      stack.push(3);
      continue;
    }

    const closer = line.match(/^\s*(:{2,})\s*$/);
    if (closer) {
      const count = closer[1].length;
      if (stack.length === 0) {
        violations.push({
          code: 'structural:admonition_balance',
          type: 'structural',
          severity: 'high',
          description: 'Admonition closing fence without a matching opener',
          location_hint: `Line ${i + 1}`,
          suggested_fix: 'Remove the stray closing fence or add the missing `:::type` opener above',
          ignored: false,
        });
      } else {
        const open = stack.pop();
        if (open !== count) {
          violations.push({
            code: 'structural:admonition_balance',
            type: 'structural',
            severity: 'high',
            description: `Admonition closed with ${count} colons but opened with ${open}`,
            location_hint: `Line ${i + 1}`,
            suggested_fix: `Close with ${':'.repeat(open)} (same colon count as the opener)`,
            ignored: false,
          });
        }
      }
    }
  }

  if (stack.length > 0) {
    violations.push({
      code: 'structural:admonition_balance',
      type: 'structural',
      severity: 'high',
      description: stack.length === 1
        ? 'Admonition opened but never closed'
        : `${stack.length} admonitions opened but never closed`,
      location_hint: 'End of page',
      suggested_fix: 'Add a `:::` closing fence after the admonition content',
      ignored: false,
    });
  }

  return violations;
}

module.exports = { check };
