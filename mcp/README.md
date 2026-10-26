# Doc MCP Server (`doc-contrib`)

A Model Context Protocol server that exposes this repository's contribution
toolchain to AI agents. It lets an agent guided by the repo's own rules find a
page, follow the writing conventions and process, lint its edits and prepare a
compliant pull request — the "corrector" use case.

Like the linter, the server is **vanilla Node.js with zero external
dependencies** and speaks the MCP stdio transport (newline-delimited JSON-RPC
2.0) directly.

## Tools

| Tool                        | What it does                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `search_docs`               | Full-text search over the Markdown sources (EN + FR), title/heading weighted, accent-insensitive, `-term` exclusions, `"quoted phrases"` and `title:term` filters. |
| `get_contribution_process`  | The `AGENTS.md` rulebook — full text, or a single H2 section via `{ "section": "Changelog Updates" }`.                |
| `get_conventions`           | Writing standards, tone of voice, glossary (projected), plus the golden page of the given type (8 types — `lab` follows the guide model). Optional `{ type }` filter.  |
| `lint_page`                 | Run the compliance linter on a page/directory — the exact CLI CI runs, so scores always match the pipeline.           |
| `prepare_pr`                | The pre-PR checklist (branching, commits, changelog, redirects…) + optional changed-files lint vs `main`.             |

`prepare_pr` deliberately encodes no rules: each step points at the
authoritative `AGENTS.md` section (read verbatim through
`get_contribution_process`) and the compliance threshold is imported from
`linter/index.js`, so nothing normative is duplicated in the server. The
documentation trees scanned by `search_docs` come from the same
`linter/utils/doc-roots.js` constant the linter CLI scans, and are re-scanned
on every call — no cache — so edits made during the session are always visible.

Success criterion: an agent told *"the Kubernetes control
plane characteristics are wrong in the docs"* should locate the page with
`search_docs`, propose and apply the fix, reach a linter score >= 90 with
`lint_page`, and open the pull request — or redirect to the existing content
when the request is a question, not a correction.

## Agent setup

Agents that read `.mcp.json` (Claude Code, Cursor, …) get the server offered
automatically — the config is committed at the repository root. For OpenCode,
add to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "doc-contrib": {
        "type": "local",
        "command": ["node", "mcp/server.js"]
      }
    }
  }
}
```

Manual smoke test:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node mcp/server.js
```

## Development

```
mcp/
├── server.js          # stdio transport + tool catalogue and dispatch
├── lib/
│   ├── lint.js        # wrapper around linter/cli.js (spawn, JSON parse)
│   ├── consigns.js    # consigns/ references + AGENTS.md section extraction
│   ├── search.js      # working-tree full-text search (EN + FR sources)
│   └── pr.js          # pre-PR checklist
└── tests/
    └── server.test.js # protocol-level smoke tests (node:test)
```

Run the tests (also wired into `yarn test` and the CI `tests` job):

```bash
node --test mcp/tests/*.test.js
```
