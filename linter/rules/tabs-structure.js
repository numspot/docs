const { extractTabs } = require('../utils/markdown-parser');

// Strips JSX comments ({/* ... */}): a commented-out <TabItem> is not
// rendered, so it must not count toward the tab order.
function stripJsxComments(s) {
  return s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

function check(content, _frontmatter, _glossaryIndex, pageType) {
  if (pageType !== 'action') return [];

  const stripped = stripJsxComments(content);
  const violations = [];
  const expectedOrder = ['console', 'api', 'terraform'];

  // Checks the order WITHIN EACH <Tabs>…</Tabs> block separately: a page may
  // contain several, each with its own console→api→terraform sequence.
  const tabsBlocks = stripped.match(/<Tabs[\s\S]*?<\/Tabs>/g) || [stripped];
  for (const block of tabsBlocks) {
    const actualOrder = extractTabs(block)
      .map(t => t.value)
      .filter(v => expectedOrder.includes(v));

    let isOrdered = true;
    for (let i = 0; i < actualOrder.length - 1; i++) {
      if (expectedOrder.indexOf(actualOrder[i + 1]) <= expectedOrder.indexOf(actualOrder[i])) {
        isOrdered = false;
        break;
      }
    }

    if (!isOrdered && actualOrder.length > 1) {
      violations.push({
        code: 'structural:tab_order',
        type: 'structural',
        severity: 'low',
        description: `Tabs are not in the correct order. Expected: console → api → terraform, got: ${actualOrder.join(' → ')}`,
        location_hint: 'Tab section',
        suggested_fix: 'Reorder tabs: Console (default), then API, then Terraform',
        ignored: false,
      });
      break; // one order violation per page is enough
    }
  }

  // The Console tab, if present, must be the default tab.
  const tabValues = extractTabs(stripped).map(t => t.value);
  if (tabValues.includes('console')) {
    const consoleTabLine = stripped.indexOf('<TabItem value="console"');
    if (consoleTabLine !== -1) {
      const tabTag = stripped.slice(consoleTabLine, consoleTabLine + 80);
      if (
        !tabTag.includes('default') &&
        !stripped.slice(Math.max(0, consoleTabLine - 200), consoleTabLine).includes('default')
      ) {
        const hasDefaultOnAnotherTab = stripped.match(/<TabItem[^>]+default[^>]*>/);
        if (!hasDefaultOnAnotherTab) {
          violations.push({
            code: 'structural:tab_order',
            type: 'structural',
            severity: 'low',
            description: 'Console tab should be the default tab',
            location_hint: 'Tab section',
            suggested_fix: 'Add `default` attribute to the Console TabItem',
            ignored: false,
          });
        }
      }
    }
  }

  return violations;
}

module.exports = { check };
