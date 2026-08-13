// Build the Claude Desktop bundle: regulatory-sidekick-<version>.mcpb
//
//   node scripts/pack-mcpb.mjs
//
// A .mcpb is a zip. We write it directly rather than depend on a packaging
// library, for the same reason dist/server.js is bundled to a single file: the
// machine that ends up running this belongs to a medical-device manufacturer,
// and every dependency is a thing their IT has to allow and their supplier
// assessment has to cover. The format is old, stable and small.
//
// What goes in, deliberately:
//
//   manifest.json     — generated here so its version can never drift from
//                       package.json's; a bundle claiming the wrong version
//                       makes the staleness check in doctor lie.
//   server/index.js   — byte-identical to dist/server.js. One build, two
//                       channels (npx and bundle), one thing to test.
//   icon.png          — from scripts/make-icon.mjs
//   README.md
//
// What does NOT go in: the corpus, the prompts, any template content. A .mcpb
// sits on a laptop forever and would SURVIVE REVOCATION — which is the whole
// reason templates are served from the API. scripts/check-pack.mjs greps the
// built artefact for corpus fingerprints; this file is why that check scans the
// bundle and not only the npm tarball.
//
// The key is NOT baked in. Doing so would mean minting a token on a GET,
// writing a live credential to disk that outlives revocation, and breaking the
// shown-once model — the downloaded file would itself become a credential, and
// one forwarded email would compromise the workspace with no audit trail.
// user_config collects it at install time and Claude Desktop puts it in the OS
// keychain because api_key is marked sensitive.

import { deflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");
const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

const SERVER = join(pkgDir, "dist", "server.js");
const ICON = join(pkgDir, "assets", "icon.png");
const OUT = join(pkgDir, "dist", `regulatory-sidekick-${pkg.version}.mcpb`);

for (const [what, p] of [["dist/server.js", SERVER], ["assets/icon.png", ICON]])
  if (!existsSync(p))
    throw new Error(`Missing ${what} — run "npm run build" and "node scripts/make-icon.mjs" first.`);

// --- manifest --------------------------------------------------------------
// manifest_version is "0.3" (github.com/modelcontextprotocol/mcpb MANIFEST.md).
// Required: manifest_version, name, version, description, author, server.
const manifest = {
  manifest_version: "0.3",
  name: "regulatory-sidekick",
  display_name: "Regulatory Sidekick",
  version: pkg.version,
  description: pkg.description,
  author: { name: "Not Just Any" },
  icon: "icon.png",
  // Claude Desktop is macOS and Windows only. Linux takes the npx path — the
  // one case where the secondary route is the only route, which the Agent page
  // has to keep saying.
  compatibility: { platforms: ["darwin", "win32"] },
  server: {
    type: "node",
    entry_point: "server/index.js",
    mcp_config: {
      command: "node",
      args: [`\${__dirname}/server/index.js`],
      env: {
        RSK_API_KEY: "${user_config.api_key}",
        RSK_QMS_ROOT: "${user_config.qms_root}",
        RSK_BASE_URL: "${user_config.base_url}",
      },
    },
  },
  user_config: {
    api_key: {
      type: "string",
      title: "Workspace key",
      description:
        "From the Agent page in Regulatory Sidekick. Shown once when you create it.",
      // Routes it to Keychain / Credential Manager instead of a config file.
      sensitive: true,
      required: true,
    },
    qms_root: {
      type: "directory",
      title: "QMS folder",
      description:
        "Where your quality documents live. Drafts are written to 20_Drafts/ inside it; nothing else is ever written. A synced folder (OneDrive, Google Drive) is fine — mark it \"always keep on this device\".",
      required: true,
    },
    base_url: {
      type: "string",
      title: "Server (advanced)",
      description:
        "Leave this alone unless you were told otherwise. A wrong host drops the key on redirect and every call fails with \"missing bearer token\".",
      required: false,
      default: "https://regulatory-sidekick.notjustany.tech",
    },
  },
};

const README = `# Regulatory Sidekick

Work your ISO 13485 / EU MDR implementation with Claude: read the plan, draft
controlled documents into a folder on this machine, and report progress back to
your workspace.

**Your documents never leave your machine.** The platform records that a draft
exists — its path, size and open-question count — never its content.

Requires a Regulatory Sidekick licence and the agent add-on. Create a key on the
Agent page; you will be asked for it when this extension is installed.

Ask Claude "what should I work on next?" to begin, or "check my setup" if
something looks wrong.
`;

// --- zip -------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return ~c >>> 0;
}

/** Store entries with deflate (method 8) — a plain, maximally boring zip. */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    // Only compress if it actually helps; method 0 otherwise.
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10); // mod time
    lh.writeUInt16LE(0x21, 12); // mod date — fixed, so the build is reproducible
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4); // version made by
    ch.writeUInt16LE(20, 6); // version needed
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, end]);
}

const serverJs = readFileSync(SERVER);
const entries = [
  { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8") },
  { name: "server/index.js", data: serverJs },
  { name: "icon.png", data: readFileSync(ICON) },
  { name: "README.md", data: Buffer.from(README, "utf8") },
];

writeFileSync(OUT, zip(entries));

console.log(`mcpb: ${OUT.split(/[\\/]/).pop()} — ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
for (const e of entries)
  console.log(`   ${e.name.padEnd(16)} ${(e.data.length / 1024).toFixed(1)} KB`);
console.log(
  `\nserver/index.js is byte-identical to dist/server.js: ${
    serverJs.equals(readFileSync(SERVER)) ? "yes" : "NO"
  }`,
);
