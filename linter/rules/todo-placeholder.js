// Flags TODO/FIXME placeholders left outside code blocks: they end up visible
// in the rendered page (e.g. a Terraform tab containing only "TODO") or in the
// public source of the documentation repository.
function check(content, _frontmatter, _glossaryIndex, _pageType) {
  const violations = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let fence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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

    const match = line.match(/\b(TODO|FIXME)\b/);
    if (match) {
      violations.push({
        code: 'structural:todo_placeholder',
        type: 'structural',
        severity: 'medium',
        description: `Placeholder "${match[1]}" left outside a code block`,
        location_hint: `Line ${i + 1}`,
        suggested_fix: 'Replace the placeholder with real content or remove the empty section',
        ignored: false,
      });
    }
  }

  return violations;
}

module.exports = { check };
