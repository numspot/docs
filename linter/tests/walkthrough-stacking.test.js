// Regression tests for the Walkthrough stacking context (DOC-669).
//
// The bug this file exists to prevent from coming back: the walkthrough tip
// (the coachmark) carried `z-index: 3` while NO ancestor created a stacking
// context — `.stage` is only `position: relative` with `z-index: auto`. The
// tip's z-index therefore escaped to the ROOT stacking context and painted
// OVER the sticky doc-page title (`position: sticky; z-index: 2` with an
// opaque background, custom.css) whenever the page was scrolled so the stage
// slid under it. Every other content element scrolls BEHIND that title; the
// coachmark floated above it.
//
// The fix scopes the walkthrough in its own atomic stacking context
// (`isolation: isolate` on `.wrap`). These pins freeze the contract:
//
//  1. The walkthrough must isolate its stacking context on `.wrap` — the
//     sticky title (z-index: 2) then always paints above the whole component.
//  2. The fix must be the isolation, not a lowered tip z-index: a tip that
//     plays in the root context would break again with any other overlay.
//  3. The sticky title keeps its side of the contract (sticky + z-index +
//     opaque background), so the walkthrough scrolls behind it.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

test('the walkthrough must scope its stacking context (isolation on .wrap)', () => {
  const css = read('src', 'components', 'Walkthrough', 'styles.module.css');
  assert.match(
    css,
    /\.wrap\s*\{[^}]*isolation:\s*isolate/s,
    '.wrap must create an atomic stacking context — otherwise the tip z-index escapes to the root and paints over the sticky doc title (DOC-669)'
  );
});

test('the tip must keep its local z-index (isolation is the fix, not a lower z-index)', () => {
  const css = read('src', 'components', 'Walkthrough', 'styles.module.css');
  assert.match(css, /\.tip\s*\{[^}]*z-index:\s*\d+/s,
    'the tip must stay above the spot/image INSIDE the walkthrough');
});

test('the sticky doc title keeps its side of the stacking contract', () => {
  const css = read('src', 'css', 'custom.css');
  assert.match(
    css,
    /\.theme-doc-markdown > header,\s*\.theme-doc-markdown > h1:first-of-type\s*\{[^}]*position:\s*sticky[^}]*z-index:\s*2[^}]*background:\s*var\(--ifm-background-color\)/s,
    'the sticky title must stay above in-flow content (sticky + z-index + opaque background)'
  );
});
