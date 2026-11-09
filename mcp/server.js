#!/usr/bin/env node
// Doc-contrib MCP server for the Numspot public documentation repository.
//
// Exposes the contribution toolchain to any MCP-capable AI agent over stdio
// (newline-delimited JSON-RPC 2.0, per the MCP spec). Zero external
// dependencies: the transport and dispatch below are hand-rolled, and
// validation shells out to the repo's own linter.
//
// Tools:
//   lint_page                 — run the doc compliance linter on a page/directory
//   get_contribution_process  — the AGENTS.md rulebook (full text or one section)
//   get_conventions           — standards, tone of voice, glossary, golden page
//   search_docs               — working-tree full-text search (EN + FR sources)
//   prepare_pr                — pre-PR checklist + optional changed-files lint
//
// Discovery: the committed .mcp.json registers this server for agents that
// read it (Claude Code, Cursor, ...). OpenCode users add the equivalent
// snippet from mcp/README.md to their opencode.json.
//
// Protocol notes: requests are JSON-RPC 2.0 objects, one per stdin line;
// responses go to stdout, logs to stderr only. Notifications (no id) never
// get a response.

const readline = require('node:readline');
const { lintPage } = require('./lib/lint');
const { getContributionProcess, getConventions, PAGE_TYPES } = require('./lib/consigns');
const { searchDocs } = require('./lib/search');
const { preparePr } = require('./lib/pr');

const SERVER_INFO = { name: 'doc-contrib', version: '1.0.0' };
const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'lint_page',
    description:
      'Run the Numspot doc compliance linter (the same one CI runs) on a documentation page or directory. Returns a per-file score (>= 90 required) and the violations to fix. Always run this after editing or creating a page.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Page (.md/.mdx) or directory, relative to the repository root, e.g. docs/docs/compute/vms/actions/create-vm.mdx',
        },
        type: {
          type: 'string',
          enum: ['action', 'concept'],
          description: 'Optional page type override (auto-detected from the path otherwise).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_contribution_process',
    description:
      'Return the contribution process rulebook (AGENTS.md): git workflow, commit conventions, frontmatter rules, changelog rules, PR requirements. Call it before editing any documentation page, full or filtered to one section.',
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          description:
            'Optional: return only the H2 section whose heading matches (e.g. "Changelog Updates", "Git Workflow", "URL Slug Rules").',
        },
      },
    },
  },
  {
    name: 'get_conventions',
    description:
      'Return the writing conventions to respect: standards (titles, formatting, backticks), tone of voice, official glossary, and the golden page exemplar of the given page type — pass "type" to select it (the action model when omitted). Call it before writing or reviewing content.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: PAGE_TYPES,
          description:
            'Type of page being written. "action" (or omitted) also returns the golden action page.',
        },
      },
    },
  },
  {
    name: 'search_docs',
    description:
      'Full-text search over the documentation sources (US English docs plus French translations), returning the most relevant pages with title, path and matching headings. Searches the working tree, so uncommitted edits are visible. Terms are AND-ed; "-term" excludes; "quoted phrases" must appear verbatim; "title:term" restricts a term to matching the page title.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms, e.g. "control plane kubernetes", "cluster -autoscaling", title:registry.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Maximum results (default 10).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'prepare_pr',
    description:
      'Return the pre-PR checklist for this repository (branching, commit conventions, last_update, changelog, redirects, linter, PR language). Optionally also lint the files changed vs a base branch — the same check CI runs.',
    inputSchema: {
      type: 'object',
      properties: {
        lint: { type: 'boolean', description: 'Also run the changed-files lint (default false).' },
        base: { type: 'string', description: 'Git ref to diff against (default "main").' },
      },
    },
  },
];

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

// Tool results are returned as MCP text content carrying a JSON document:
// agents parse it more reliably than prose.
function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function clampLimit(limit) {
  if (limit === undefined) return 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error('limit must be an integer between 1 and 25.');
  }
  return limit;
}

function callTool(name, args = {}) {
  switch (name) {
    case 'lint_page':
      return lintPage(args);
    case 'get_contribution_process':
      return getContributionProcess(args);
    case 'get_conventions':
      return getConventions(args);
    case 'search_docs':
      return { query: args.query, results: searchDocs(args.query, { limit: clampLimit(args.limit) }) };
    case 'prepare_pr':
      return preparePr(args);
    default:
      throw new Error(`Unknown tool: ${name}. Available: ${TOOLS.map((tool) => tool.name).join(', ')}.`);
  }
}

function handleMessage(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      return sendResult(id, {
        // Echo the client's requested version when present: the spec says the
        // server must answer with a version it supports — the client's own
        // proposal is by definition one it understands.
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          'Use these tools to contribute to the Numspot public documentation: search_docs to locate pages, get_contribution_process and get_conventions before writing, lint_page after editing, prepare_pr before opening the PR. A page is compliant when its linter score is >= 90.',
      });

    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // notifications never get a response

    case 'ping':
      return sendResult(id, {});

    case 'tools/list':
      return sendResult(id, { tools: TOOLS });

    case 'tools/call': {
      const name = params && params.name;
      try {
        return sendResult(id, textResult(callTool(name, (params && params.arguments) || {})));
      } catch (error) {
        return sendResult(id, {
          content: [{ type: 'text', text: String((error && error.message) || error) }],
          isError: true,
        });
      }
    }

    default:
      if (isNotification) return;
      return sendError(id, -32601, `Method not found: ${method}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return sendError(null, -32700, 'Parse error: line is not valid JSON');
  }
  try {
    handleMessage(message);
  } catch (error) {
    if (message && message.id !== undefined && message.id !== null) {
      sendError(message.id, -32603, String((error && error.message) || error));
    }
  }
});
rl.on('close', () => process.exit(0));
