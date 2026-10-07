# Numspot Documentation

Source code of [docs.numspot.com](https://docs.numspot.com/), the public
documentation for Numspot, the sovereign French cloud platform. The site is
built with [Docusaurus](https://docusaurus.io/) and served in English
(en-GB), with a French translation generated from the `i18n/` directory.

## Quick start

Requirements: **Node 20+** and **Yarn 1.22+** (the package manager is pinned in
`packageManager`).

```bash
yarn        # install dependencies
yarn start  # dev server with live reload -> http://localhost:3000
```

The site is up in under two minutes. All changes are hot-reloaded.

## Commands

| Command            | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `yarn start`       | Development server with live reload                      |
| `yarn build`       | Production build (English at `/`, French at `/fr/`)      |
| `yarn serve`       | Serve the production build locally                       |
| `yarn typecheck`   | TypeScript type checking                                 |
| `yarn clear`       | Clear the Docusaurus cache                               |
| `yarn lint:docs`   | Lint the documentation pages changed against `main`      |
| `yarn lint:docs:all` | Lint every documentation page                          |

## Project structure

```
/
├── docs/docs/       # Documentation content (.mdx), English, source of truth
├── i18n/            # French translation
├── linter/          # Documentation compliance linter (zero dependency)
├── static/          # Static assets
├── docusaurus.config.ts
└── sidebars.ts
```

The content is written in English first. French versions live under
`i18n/fr/docusaurus-plugin-content-docs/current/` and must stay in sync with
the English source.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup, the writing standards and the review process.

## Security

See [SECURITY.md](SECURITY.md) before reporting a security issue. Please do
not open public issues for security reports.

## License

The documentation content is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — see the verbatim
text in [LICENSE](LICENSE). Code is licensed under the
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) — see
[LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt). The full dual-licensing
terms are described in [LICENSES/README.md](LICENSES/README.md).
