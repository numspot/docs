const fs = require("fs");
const path = require("path");

/**
 * Removes stray NUL bytes (U+0000) from the generated HTML at the end of the build.
 *
 * Root cause (upstream, not cleanly fixable on our side):
 * Docusaurus 3.10 renders each page via `react-dom/server` `renderToPipeableStream`
 * (see `@docusaurus/core/lib/client/renderToHtml.js`). When a 2-byte UTF-8
 * character (é, à, ô…) straddles the boundary of React Fizz's internal 2048-byte
 * buffer, a stray NUL byte is inserted just BEFORE that
 * character (the character itself remains intact). See React facebook/react#31134
 * and facebook/docusaurus#9985.
 *
 * Symptoms: a few pages (~15) contain 1 to 3 NUL bytes. The file is then seen
 * as "binary" by text tools (grep, strict crawlers…) and is not strictly
 * valid HTML. The number of affected pages depends on byte offsets, hence on
 * content: it varies from build to build.
 *
 * Fix: a NUL is never valid in HTML text and here it is only
 * INSERTED (the accented character is intact), so removing it restores exactly the
 * text, with no loss. We clean every .html file after static generation.
 *
 * ---
 * SAST note (eslint.detect-non-literal-fs-filename, GitLab/Semgrep):
 * the rule flags any `fs.*` call whose filename is not a string
 * literal, without tracing its origin. Here no path comes from untrusted
 * input:
 *   - `outDir` is the build directory provided by Docusaurus (postBuild hook);
 *   - `readdirSync` only returns base names — never `.`, `..`, nor a
 *     path separator — so `path.join(dir, entry.name)` cannot
 *     structurally escape `outDir`;
 *   - the plugin only runs at build time, on HTML the same process just
 *     generated: no request or user input ever reaches it.
 * The only real vector of this class was symlink following; it is
 * closed by the `entry.isFile()` guard below (see its comment).
 */
module.exports = function stripNullBytesPlugin() {
  return {
    name: "strip-null-bytes",
    async postBuild({ outDir }) {
      let filesFixed = 0;
      let bytesRemoved = 0;

      const walk = (dir) => {
              // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.isFile() && entry.name.endsWith(".html")) {
            // `isFile()` (like `isDirectory()`) relies on lstat: it is false
            // for a symlink. Without this guard, a symlink named `*.html`
            // planted in the build would be followed, and the rewrite would
            // land on its target, outside outDir. Testing it costs nothing
            // and closes the only real directory-escape vector of this script.
            // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
            const buf = fs.readFileSync(full);
            if (buf.includes(0)) {
              const cleaned = buf.filter((b) => b !== 0);
        // nosemgrep: eslint.detect-non-literal-fs-filename -- see "SAST note"
              fs.writeFileSync(full, cleaned);
              filesFixed += 1;
              bytesRemoved += buf.length - cleaned.length;
            }
          }
        }
      };

      walk(outDir);

      if (bytesRemoved > 0) {
        console.log(
          `[strip-null-bytes] ${bytesRemoved} octet(s) NUL parasite(s) retiré(s) de ${filesFixed} fichier(s) HTML.`
        );
      }
    },
  };
};
