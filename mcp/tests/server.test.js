// Smoke tests for the doc-contrib MCP server.
//
// The server is started as a real child process speaking newline-delimited
// JSON-RPC 2.0 on stdio, exactly the way an MCP client drives it. One
// successful call per tool is asserted, plus the error surfaces (unknown
// tool, path traversal, unknown section, empty query).

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const { COMPLIANCE_THRESHOLD } = require('../../linter/index');

const SERVER = path.resolve(__dirname, '..', 'server.js');
const RPC_TIMEOUT_MS = 15000;

class Client {
  constructor() {
    this.child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.nextId = 0;
    this.pending = new Map();

    const rl = readline.createInterface({ input: this.child.stdout, terminal: false });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      const message = JSON.parse(line);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        pending(message);
      }
    });
  }

  rpc(method, params) {
    const id = ++this.nextId;
    const envelope = { jsonrpc: '2.0', id, method };
    if (params !== undefined) envelope.params = params;
    this.child.stdin.write(JSON.stringify(envelope) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), RPC_TIMEOUT_MS);
      this.pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  callTool(name, args) {
    return this.rpc('tools/call', { name, arguments: args || {} });
  }

  // Returns the parsed payload of a successful tool call.
  async toolPayload(name, args) {
    const response = await this.callTool(name, args);
    assert.strictEqual(response.result.isError, undefined, `${name} should succeed`);
    return JSON.parse(response.result.content[0].text);
  }

  // Returns the error text of a tool call expected to fail.
  async toolError(name, args) {
    const response = await this.callTool(name, args);
    assert.strictEqual(response.result.isError, true, `${name} should fail`);
    return response.result.content[0].text;
  }

  kill() {
    this.child.kill();
  }
}

test('initialize handshake returns the server identity', async () => {
  const client = new Client();
  try {
    const response = await client.rpc('initialize', { protocolVersion: '2025-06-18' });
    assert.strictEqual(response.result.protocolVersion, '2025-06-18');
    assert.strictEqual(response.result.serverInfo.name, 'doc-contrib');
    assert.deepStrictEqual(response.result.capabilities, { tools: {} });
  } finally {
    client.kill();
  }
});

test('tools/list exposes the five contribution tools', async () => {
  const client = new Client();
  try {
    const response = await client.rpc('tools/list');
    assert.deepStrictEqual(
      response.result.tools.map((tool) => tool.name),
      ['lint_page', 'get_contribution_process', 'get_conventions', 'search_docs', 'prepare_pr']
    );
  } finally {
    client.kill();
  }
});

test('lint_page scores a real documentation page', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('lint_page', { path: 'docs/docs/home.mdx' });
    assert.ok(payload.summary.totalFiles >= 1, 'at least one file linted');
    for (const file of payload.files) {
      assert.strictEqual(typeof file.score, 'number');
      assert.strictEqual(typeof file.is_compliant, 'boolean');
    }
  } finally {
    client.kill();
  }
});

test('lint_page rejects paths escaping the repository', async () => {
  const client = new Client();
  try {
    const message = await client.toolError('lint_page', { path: '../../etc/passwd' });
    assert.match(message, /escapes the repository/);
  } finally {
    client.kill();
  }
});

test('search_docs ranks kubernetes pages first', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('search_docs', { query: 'control plane kubernetes', limit: 5 });
    assert.ok(payload.results.length >= 1, 'at least one result');
    for (const result of payload.results) {
      assert.ok(result.title.length > 0);
      assert.ok(['en', 'fr'].includes(result.lang));
      assert.match(result.path, /\.(md|mdx)$/);
    }
    const scores = payload.results.map((result) => result.score);
    assert.deepStrictEqual([...scores].sort((a, b) => b - a), scores, 'results sorted by score');
    assert.match(JSON.stringify(payload.results), /control plane/i);
  } finally {
    client.kill();
  }
});

test('search_docs rejects an empty query', async () => {
  const client = new Client();
  try {
    const message = await client.toolError('search_docs', { query: '   ' });
    assert.match(message, /Empty query/);
  } finally {
    client.kill();
  }
});

test('search_docs supports the title: filter advertised in the schema', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('search_docs', { query: 'title:registry', limit: 25 });
    assert.ok(payload.results.length >= 1, 'title-filtered search finds pages');
    for (const result of payload.results) {
      assert.match(result.title, /registry/i, 'every result matches the title filter');
    }
    // A title filter with no match returns nothing rather than everything.
    const empty = await client.toolPayload('search_docs', { query: 'title:nonexistenttermmatch' });
    assert.deepStrictEqual(empty.results, []);
    // An exclusion also applies to the title matches (same surface as the
    // positive terms): "title:registry -registry" can only match nothing.
    const selfExcluded = await client.toolPayload('search_docs', { query: 'title:registry -registry' });
    assert.deepStrictEqual(selfExcluded.results, [], 'a title filter cancelled by its own exclusion matches nothing');
  } finally {
    client.kill();
  }
});

test('get_conventions returns the writing references, golden page included for actions', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('get_conventions', { type: 'action' });
    assert.ok(payload.standards.content.includes('Writing rules'));
    assert.ok(payload.tone_of_voice.content.numspot_tone_of_voice_criteria);
    assert.ok(Object.keys(payload.glossary.content.terms).length > 10);
    assert.match(payload.golden_page.path, /golden_page_actions\.mdx$/);
    assert.match(payload.golden_page.content, /GOLDEN PAGE/);
    assert.match(payload.golden_page.content, /tabhead-api/, 'action model carries the D-012 tab anchors');

    const bare = await client.toolPayload('get_conventions', {});
    assert.strictEqual(bare.page_type, 'action', 'omitted type resolves to the served action model');
    assert.match(bare.golden_page.path, /golden_page_actions\.mdx$/, 'action model served by default');
  } finally {
    client.kill();
  }
});

test('get_conventions serves the golden page matching the page type', async () => {
  const client = new Client();
  try {
    const expected = {
      guide: 'golden_page_guides.mdx',
      concept: 'golden_page_concepts.mdx',
      faq: 'golden_page_faq.mdx',
      changelog: 'golden_page_changelog.mdx',
      quickstart: 'golden_page_quickstart.mdx',
      glossary: 'golden_page_glossary.mdx',
      reversibility: 'golden_page_reversibility.mdx',
    };
    for (const [type, file] of Object.entries(expected)) {
      const payload = await client.toolPayload('get_conventions', { type });
      assert.match(
        payload.golden_page.path,
        new RegExp(`${file.replace('.', '\\.')}$`),
        `${type} must serve ${file}`
      );
      assert.match(payload.golden_page.content, /GOLDEN PAGE/);
    }

    // Labs are informational pages: they follow the guide model.
    const lab = await client.toolPayload('get_conventions', { type: 'lab' });
    assert.match(lab.golden_page.path, /golden_page_guides\.mdx$/);

    // Menu/home have no golden page: their structure is component-enforced.
    const menu = await client.toolPayload('get_conventions', { type: 'menu' });
    assert.strictEqual(menu.golden_page, undefined);
    const home = await client.toolPayload('get_conventions', { type: 'home' });
    assert.strictEqual(home.golden_page, undefined);
  } finally {
    client.kill();
  }
});

test('get_conventions rejects a mistyped argument instead of silently defaulting', async () => {
  const client = new Client();
  try {
    // Wrong argument name (pageType instead of type): a silent fallback would
    // serve the action golden page with no warning — the caller would believe
    // it holds the model of its own page type.
    const message = await client.toolError('get_conventions', { pageType: 'concept' });
    assert.match(message, /Unknown argument "pageType"/);
    assert.match(message, /Use "type"/);
  } finally {
    client.kill();
  }
});

test('get_conventions rejects an unknown page type', async () => {
  const client = new Client();
  try {
    const message = await client.toolError('get_conventions', { type: 'newsletter' });
    assert.match(message, /Unknown page type/);
  } finally {
    client.kill();
  }
});

test('get_contribution_process extracts a single section', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('get_contribution_process', { section: 'Changelog Updates' });
    assert.match(payload.section, /[Cc]hangelog/);
    assert.match(payload.content, /changelog/i);

    const full = await client.toolPayload('get_contribution_process', {});
    assert.ok(full.content.includes('# Numspot Documentation - AGENTS.md'));
  } finally {
    client.kill();
  }
});

test('get_contribution_process lists available sections on a miss', async () => {
  const client = new Client();
  try {
    const message = await client.toolError('get_contribution_process', { section: 'Nonexistent Topic' });
    assert.match(message, /No section matching/);
    assert.match(message, /Available sections/);
  } finally {
    client.kill();
  }
});

test('get_contribution_process serves H3 sections too', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('get_contribution_process', { section: 'Deleting pages' });
    assert.match(payload.section, /Deleting pages/);
    assert.match(payload.content, /noindex/);
  } finally {
    client.kill();
  }
});

test('prepare_pr returns the checklist and the changed-files lint', async () => {
  const client = new Client();
  try {
    const payload = await client.toolPayload('prepare_pr', { lint: true });
    assert.ok(payload.checklist.length >= 8);
    assert.strictEqual(
      payload.compliance_threshold,
      COMPLIANCE_THRESHOLD,
      'threshold must come from the linter, not be restated'
    );
    for (const step of payload.checklist) {
      assert.ok(step.section, 'each step points at its authoritative AGENTS.md section');
    }
    assert.ok(payload.lint, 'prepare_pr(lint: true) attaches the changed-files lint');
    // On a full checkout the diff resolves and a summary comes back; on a
    // shallow pull-request checkout the tool degrades gracefully (explicit
    // error note, no isError) — see PROBLEMS.md.
    if (payload.lint.error) {
      assert.match(payload.lint.error, /No diff base available/);
    } else {
      assert.strictEqual(typeof payload.lint.summary, 'object');
    }
  } finally {
    client.kill();
  }
});

test('lintChangedFiles degrades gracefully on an unresolvable base', async () => {
  const { lintChangedFiles } = require('../lib/lint');
  const result = lintChangedFiles({ base: 'not-a-real-ref' });
  // Locally the resolver falls back to a resolvable ref; on a shallow
  // checkout it returns the explicit error note instead of throwing.
  assert.ok(result.summary || /No diff base available/.test(result.error || ''));
});

test('buildCorpus returns a fresh corpus on every call (no cache)', () => {
  const { buildCorpus } = require('../lib/search');
  const first = buildCorpus();
  const second = buildCorpus();
  // The search tool's contract is "uncommitted edits are visible": the corpus
  // must never be cached, or a long-lived server session would serve stale
  // documents after the first call.
  assert.notStrictEqual(first, second, 'a fresh corpus object must be built on every call');
  assert.ok(first.length >= 1);
  assert.deepStrictEqual(first.map((entry) => entry.path), second.map((entry) => entry.path));
});

test('excluded terms also match the title and the headings', () => {
  const { parseQuery, scoreEntry } = require('../lib/search');
  const titleOnly = {
    doc: {
      titleTokens: new Set(['container', 'registry']),
      headingTokens: new Set(['image', 'tags']),
      bodyTokens: new Map([
        ['vm', 2],
        ['image', 1],
      ]),
      fullText: 'vm image tags',
      headings: [],
    },
  };
  // "registry" sits in the title only: the page must still be excluded.
  assert.strictEqual(scoreEntry(titleOnly, parseQuery('vm -registry')), null);
  // Positive control: the same page matches without the exclusion.
  assert.ok(scoreEntry(titleOnly, parseQuery('vm')).score > 0);

  const headingOnly = {
    doc: {
      titleTokens: new Set(['create', 'vm']),
      headingTokens: new Set(['registry', 'setup']),
      bodyTokens: new Map([['vm', 2]]),
      fullText: 'vm registry setup',
      headings: [],
    },
  };
  // "registry" sits in the headings only: the page must still be excluded.
  assert.strictEqual(scoreEntry(headingOnly, parseQuery('vm -registry')), null);
});

test('unknown methods answer with a JSON-RPC error', async () => {
  const client = new Client();
  try {
    const response = await client.rpc('resources/list');
    assert.strictEqual(response.error.code, -32601);
  } finally {
    client.kill();
  }
});
