// Bundle the server into ONE file with zero transitive dependencies.
//
// `npx -y @notjustany/regulatory-sidekick-mcp` then resolves a single tarball —
// no MCP SDK download, no dependency resolution at all. That matters because
// the machine running this belongs to a medical-device manufacturer and may sit
// behind a proxy with an npm allowlist. It also means the byte-identical
// artefact is what a desktop bundle wraps: one build, two channels, one thing
// to test.
//
// The cost, stated plainly: bundling the SDK means we own its update cadence.
// --legal-comments=eof keeps third-party licence text in the output.

import { build } from "esbuild";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const out = join(pkgDir, "dist", "server.js");

await build({
  entryPoints: [join(pkgDir, "src", "server.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "eof",
  // The banner owns line 1. It carries the shebang AND a createRequire shim:
  // some dependencies still ship CJS that calls require("process"), and in ESM
  // output esbuild's stub throws "Dynamic require is not supported" at RUNTIME
  // — a failure that only appears when the built artefact is executed, not when
  // it is built. src/server.ts therefore carries no shebang of its own.
  banner: {
    js:
      "#!/usr/bin/env node\n" +
      'import { createRequire as __rskCreateRequire } from "node:module";\n' +
      "const require = __rskCreateRequire(import.meta.url);",
  },
  define: { __RSK_VERSION__: JSON.stringify(pkg.version) },
  // Node built-ins stay external; everything else is inlined.
  external: ["node:*"],
  logLevel: "warning",
});

// npm sets the executable bit from "bin" on install, but a locally-built
// artefact should be runnable too.
try {
  chmodSync(out, 0o755);
} catch {}

const bytes = readFileSync(out).length;
console.log(
  `rsk-mcp: bundled dist/server.js — ${(bytes / 1024).toFixed(0)} KB, v${pkg.version}`,
);

// Ship a minimal README so the npm page is not blank. Deliberately no corpus,
// no prompts, no template content — see scripts/check-pack.mjs.
writeFileSync(
  join(pkgDir, "README.md"),
  `# Regulatory Sidekick — MCP server

Work your ISO 13485 / EU MDR implementation with your own AI assistant: read the
plan, draft controlled documents into a folder on your machine, and report
progress back to your workspace.

Requires a Regulatory Sidekick licence **and** the agent add-on, plus an
MCP-capable assistant (your own subscription).

    npx -y ${pkg.name} init      # set up the QMS folder
    npx -y ${pkg.name} doctor    # check the setup

Configure it with \`RSK_API_KEY\` (from the Agent page), optionally
\`RSK_BASE_URL\` and \`RSK_QMS_ROOT\`.

Your documents never leave your machine. The platform records that a draft
exists — its path, size and validation result — never its content.
`,
);
