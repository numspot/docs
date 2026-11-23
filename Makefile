.PHONY: spec-update

# Refresh the same-origin OpenAPI mirror (static/files/openapi.yaml) from the
# live production spec. See src/pages/openapi.js and PROBLEMS.md.
spec-update:
	node scripts/update-openapi-mirror.mjs
