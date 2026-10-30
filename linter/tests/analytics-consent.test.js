// Regression tests for the consent-gated GA4 analytics (decision D-030).
//
// The session history this file exists to prevent from coming back: the GA4
// tag used to be injected UNCONDITIONALLY by the preset gtag plugin into
// every page <head> — no consent asked, nothing stored, nothing to revoke.
// A future "simplification" that puts a `gtag:` option back into the preset,
// or that loads the tag outside the consent gate, reintroduces an
// undeclared audience measurement on a sovereign-cloud site (CNIL: consent
// is required, no exemption for analytics). These pins freeze the contract:
//
//  1. No build-time injection: the preset `gtag` option and the measurement
//     ID are absent from docusaurus.config.ts — the tag can only come from
//     src/client/analytics-consent.ts.
//  2. The loader is strictly opt-in: production-only, idempotent, and
//     gated by the stored consent or the banner event; a refusal sets the
//     official `ga-disable-…` flag and expires the `_ga*` cookies.
//  3. Consent is revocable: the banner is reachable again (reopen pill)
//     and both choices are equal (no dark patterns).
//  4. SPA pageviews keep the exact contract of the removed preset plugin
//     (one page_view per actual route change, title deferred one tick).

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const REPO_ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');

test('docusaurus.config.ts must not inject the GA4 tag at build time', () => {
  const config = read('docusaurus.config.ts');
  assert.doesNotMatch(config, /trackingID/i,
    'the preset gtag option (unconditional <head> injection) must stay removed');
  assert.doesNotMatch(config, /G-[A-Z0-9]{6,}/,
    'the measurement ID must not appear in the config — only in the consent-gated loader');
  assert.match(config, /["']\.\/src\/client\/analytics-consent\.ts["']/,
    'the consent-gated loader must be registered as a client module');
});

test('the GA4 loader must be strictly opt-in', () => {
  const loader = read('src', 'client', 'analytics-consent.ts');
  assert.match(loader, /readStoredConsent\(\)/,
    'the loader must read the stored consent at module init');
  assert.match(loader, /process\.env\.NODE_ENV !== "production"\) return/,
    'the tag must stay production-only (same scope as the removed plugin)');
  assert.match(loader, /document\.querySelector\(`script\[data-numspot-ga4/,
    'loadGa4 must be idempotent (marker-attribute guard)');
  assert.match(loader, /CONSENT_EVENT, \(event\)/,
    'the loader must react to the banner consent event');
  assert.match(loader, /ga-disable-\$\{MEASUREMENT_ID\}/,
    'a consent withdrawal must set the official GA4 opt-out flag');
  assert.match(loader, /name === "_ga" \|\| name\.startsWith\("_ga_"\)/,
    'a consent withdrawal must expire the GA cookies');
});

test('the loader must keep the SPA pageview contract of the removed plugin', () => {
  const loader = read('src', 'client', 'analytics-consent.ts');
  assert.match(loader, /onRouteDidUpdate/,
    'route tracking hook');
  assert.match(loader, /typeof gtag !== "function"\) return/,
    'before consent gtag is absent — pageviews must no-op');
  assert.match(loader, /setTimeout\(\(\) => \{/,
    'pageviews must be deferred one tick (title updated by react-helmet-async, docusaurus#7420)');
  assert.match(loader, /gtag\?\.\("set", "page_path", location\.pathname \+ location\.search \+ location\.hash\)/,
    'page_path must carry path + search + hash');
  assert.match(loader, /gtag\?\.\("event", "page_view"\)/,
    'the page_view event must be sent');
  assert.match(loader, /anonymize_ip: true/,
    'the config must keep the anonymize_ip flag (parity with the removed plugin)');
});

test('the consent banner must offer accept AND decline, and stay revocable', () => {
  const banner = read('src', 'components', 'ConsentBanner', 'index.tsx');
  assert.match(banner, /decide\(true\)/, 'accept button wired');
  assert.match(banner, /decide\(false\)/, 'decline button wired');
  assert.match(banner, /localStorage\.setItem\(CONSENT_KEY/,
    'the choice must be persisted');
  assert.match(banner, /dispatchEvent\(\s*new CustomEvent/,
    'the loader must be notified through the consent event');
  assert.match(banner, /id="consent\.accept"/, 'accept label via Translate');
  assert.match(banner, /id="consent\.decline"/, 'decline label via Translate');
  assert.match(banner, /COOKIE_POLICY_URL/,
    'the banner must link the Numspot cookie policy');
  assert.match(banner, /choice == null/, 'the banner opens only without a stored choice');
  assert.match(banner, /setChoice\(null\)/,
    'the reopen pill must let the visitor change their choice');
  assert.match(banner, /aria-hidden="true"/, 'the pill emoji is decorative, the aria-label names the button');
  assert.match(banner, /🍪/, 'the reopen pill is the cookie emoji');
  assert.match(banner, /id: "consent\.reopen\.aria"/,
    'the emoji-only pill must carry its accessible name via translate()');
});

test('the consent banner must be mounted site-wide and translated in FR', () => {
  const root = read('src', 'theme', 'Root', 'index.tsx');
  assert.match(root, /ConsentBanner/, 'Root must render the consent banner');

  const fr = JSON.parse(read('i18n', 'fr', 'code.json'));
  for (const key of [
    'consent.message',
    'consent.accept',
    'consent.decline',
    'consent.learn_more',
    'consent.aria',
    'consent.reopen.aria',
  ]) {
    assert.ok(fr[key] && fr[key].message.length > 0, `missing FR translation: ${key}`);
  }
});
