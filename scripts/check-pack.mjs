// CI guard: the 275-document corpus must never leave in a published artefact.
//
// Why this exists. docs/agentic/BUILD.md argues at length against bundling the
// templates into the MCP package: a published tarball hands anyone the whole
// corpus with no account and no trace, and — worse — bundled files SURVIVE
// REVOCATION, defeating the per-request entitlement check that exists so
// switching agent access off is immediate.
//
// The subtle part: `npm pack` can only reach inside a package directory, and
// the corpus lives at the repo root. So the TARBALL is safe almost by
// construction. The ARTEFACT is not — a bundling script can copy anything it
// likes into dist/. That is the real risk, and it is what the content scan
// below is for.
//
// Detection is by COUNT, not by string. The validator legitimately contains
// "doc-title" and "Guidance (delete before release)" because detecting them is
// its job; the corpus contains them 275 times. Volume is the honest signal.
//
// Pure Node, no dependencies — same shape as check-process-model.mjs, and runs
// in the Vercel build, which is the CI this repo already has.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

const PACKAGES = "packages";

/** Strings that appear a handful of times in code and ~275 times in the corpus. */
const FINGERPRINTS = [
  { needle: 'class="doc-title"', max: 5 },
  { needle: "Blank register template", max: 5 },
  { needle: "HOW TO USE THIS DOCUMENT", max: 5 },
  { needle: 'class="headerband"', max: 5 },
];

/** A bundled stdio server is ~1-2 MB. The corpus alone is several times that. */
const MAX_ARTEFACT_BYTES = 4 * 1024 * 1024;

const problems = [];
const notes = [];

function countOf(hay, needle) {
  let n = 0;
  let i = 0;
  for (;;) {
    const j = hay.indexOf(needle, i);
    if (j === -1) return n;
    n++;
    i = j + needle.length;
  }
}

function filesUnder(dir) {
  const out = [];
  const rec = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) rec(p);
      else out.push(p);
    }
  };
  if (existsSync(dir)) rec(dir);
  return out;
}

const pkgDirs = existsSync(PACKAGES)
  ? readdirSync(PACKAGES, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(PACKAGES, e.name))
  : [];

for (const dir of pkgDirs) {
  const manifestPath = join(dir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  const label = pkg.name ?? dir;

  // 1. A publishable package must declare `files`, and must not carry an
  //    .npmignore — which silently OVERRIDES `files` and is the classic way
  //    this guard gets defeated.
  if (!pkg.private) {
    if (!Array.isArray(pkg.files) || pkg.files.length === 0)
      problems.push(`${label}: publishable but declares no "files" allowlist.`);
    if (existsSync(join(dir, ".npmignore")))
      problems.push(
        `${label}: has an .npmignore, which overrides "files". Delete it.`,
      );
  } else {
    notes.push(`${label}: private, never published`);
  }

  // 2. Nothing in the package tree may be corpus content, published or not —
  //    a private package today is a published one after one edit.
  for (const f of filesUnder(dir)) {
    if (f.includes(`${PACKAGES}${join("/", "")}`) && /[\\/]node_modules[\\/]/.test(f))
      continue;
    if (/[\\/]node_modules[\\/]/.test(f)) continue;
    if (/\.html$/.test(f) && !/[\\/]test[\\/]/.test(f))
      problems.push(`${label}: ships an .html file (${f}). The corpus stays at the repo root.`);
    if (/content\.json$|docs\.manifest\.json$|process-model\.json$/.test(f))
      problems.push(`${label}: ships generated content (${f}).`);
  }

  // 3. The built artefact — the thing a bundler could have copied into.
  const dist = join(dir, "dist");
  for (const f of filesUnder(dist)) {
    const size = statSync(f).size;
    if (size > MAX_ARTEFACT_BYTES)
      problems.push(
        `${label}: ${f} is ${(size / 1024 / 1024).toFixed(1)} MB — over the ${MAX_ARTEFACT_BYTES / 1024 / 1024} MB ceiling. Corpus copied in?`,
      );
    // A .mcpb is a zip, and it is the artefact this check exists for: it sits
    // on a customer's laptop indefinitely and would SURVIVE REVOCATION, so
    // corpus content inside one can never be taken back. Read its entries.
    if (/\.mcpb$/.test(f)) {
      for (const entry of zipEntries(readFileSync(f))) {
        if (/\.html$/.test(entry.name))
          problems.push(`${label}: ${f} contains ${entry.name} — the corpus must not ship in a bundle.`);
        const text = entry.data.toString("utf8");
        for (const { needle, max } of FINGERPRINTS) {
          const n = countOf(text, needle);
          if (n > max)
            problems.push(
              `${label}: ${f}!${entry.name} contains "${needle}" ${n} times (max ${max}) — that is corpus content.`,
            );
        }
      }
      continue;
    }

    if (!/\.(js|mjs|cjs|json|map|d\.ts)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    for (const { needle, max } of FINGERPRINTS) {
      const n = countOf(text, needle);
      if (n > max)
        problems.push(
          `${label}: ${f} contains "${needle}" ${n} times (max ${max}) — that is corpus content, not code.`,
        );
    }
  }
}

/**
 * Read a zip's entries. Walks the central directory rather than scanning for
 * local headers, so a file whose CONTENT happens to contain the local-header
 * magic cannot fabricate an entry — and a bundle is mostly a 1.6 MB JavaScript
 * file, which is exactly the sort of thing that contains arbitrary bytes.
 */
function zipEntries(buf) {
  const out = [];
  // End of central directory: scan back for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) return out;

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    // The local header repeats the name/extra lengths, and its extra field can
    // differ from the central one — read the body's start from IT, not from here.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const body = buf.subarray(start, start + compSize);

    let data;
    try {
      data = method === 8 ? inflateRawSync(body) : Buffer.from(body);
    } catch {
      data = Buffer.alloc(0);
    }
    out.push({ name, data });

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

console.log(
  `check-pack: ${pkgDirs.length} workspace package(s)${notes.length ? ` · ${notes.join(" · ")}` : ""}`,
);

if (problems.length) {
  console.error("\n✗ check-pack FAILED — the corpus must not ship:\n");
  problems.forEach((p) => console.error(`  · ${p}`));
  console.error(
    "\nThe corpus is served through the gated /api/v1/documents endpoint, never bundled.\n",
  );
  process.exit(1);
}
console.log("✓ check-pack OK — no package carries corpus content");
