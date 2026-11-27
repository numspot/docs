#!/usr/bin/env node
// Refreshes the same-origin OpenAPI mirror (static/files/openapi.yaml) from the
// live production spec. Run via `make spec-update` (see src/pages/openapi.js).
//
// Why this exists: the /openapi page renders the live spec client-side on
// docs.numspot.com, but the live endpoint is CORS-restricted to that origin, so
// dev servers and GitLab Pages previews fall back to the committed mirror. A
// mirror left unrefreshed silently drifts from the API and misleads anyone
// (humans and AI agents alike) reading it as the source of truth — see
// PROBLEMS.md, "Static OpenAPI mirror drifts from the live spec".
//
// The mirror is written as pretty-printed JSON: JSON is valid YAML 1.2, so the
// .yaml extension keeps serving correctly while the script stays dependency-free.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep in sync with OPENAPI_URL_LIVE in src/pages/openapi.js.
const LIVE_SPEC_URL = "https://api.eu-west-2.numspot.com/openapi";

const MIRROR_PATH = new URL("../static/files/openapi.yaml", import.meta.url);

async function fetchLiveSpec() {
  const response = await fetch(LIVE_SPEC_URL, {
    headers: { "Accept-Encoding": "gzip" },
  });
  if (!response.ok) {
    throw new Error(`Live spec fetch failed: HTTP ${response.status} from ${LIVE_SPEC_URL}`);
  }
  return response.json();
}

async function readMirrorStats() {
  try {
    const raw = await readFile(MIRROR_PATH, "utf8");
    return { pathCount: Object.keys(JSON.parse(raw).paths ?? {}).length };
  } catch {
    return null;
  }
}

const spec = await fetchLiveSpec();
if (typeof spec.openapi !== "string") {
  throw new Error("Live spec has no openapi version string — refusing to overwrite the mirror");
}
if (typeof spec.paths !== "object" || spec.paths === null) {
  throw new Error("Live spec has no paths object — refusing to overwrite the mirror");
}

const previous = await readMirrorStats();
const pathCount = Object.keys(spec.paths).length;
if (pathCount === 0) {
  throw new Error("Live spec exposes zero paths — refusing to overwrite the mirror");
}

const serialized = `${JSON.stringify(spec, null, 2)}\n`;
await writeFile(MIRROR_PATH, serialized, "utf8");

console.log(`OpenAPI mirror updated: static/files/openapi.yaml`);
console.log(`  version: ${spec.info?.version ?? "unknown"}`);
console.log(`  paths:   ${pathCount}${previous ? ` (was ${previous.pathCount})` : ""}`);
