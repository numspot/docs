// Canonical documentation roots, shared by every tool that scans the
// documentation trees (the linter CLI, the MCP server's working-tree search).
// One definition so a tree move or a new translation root is registered once.
const DOC_ROOTS = ['docs/docs', 'i18n/fr/docusaurus-plugin-content-docs/current/docs'];

module.exports = { DOC_ROOTS };
