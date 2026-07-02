// CI guard: validates content/process-model.json against content/content.json.
// Fails the build (exit 1) if any document is unaccounted for, a reference is
// broken, or a step consumes a document produced only in a later phase.
// Runs in the Vercel build (pure Node), so the orphan class can never regress.
import { readFileSync } from "node:fs";

function load(p) {
  return JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
}

const model = load("content/process-model.json");
const content = load("content/content.json");

const docIds = new Set(content.documents.map((d) => d.id));
const steps = model.processes.flatMap((p) => p.steps);

const produced = new Map(); // docId -> [stepId]
const producePhase = new Map(); // docId -> earliest phase
for (const s of steps) {
  for (const d of s.produces) {
    if (!produced.has(d)) produced.set(d, []);
    produced.get(d).push(s.id);
    producePhase.set(d, Math.min(producePhase.get(d) ?? 99, s.phase));
  }
}

const orphans = [...docIds].filter((d) => !produced.has(d)).sort();
const typos = [...produced.keys()].filter((d) => !docIds.has(d)).sort();
const dups = [...produced].filter(([, ids]) => ids.length > 1);
const dangling = [];
const seq = [];
for (const s of steps) {
  for (const c of s.consumes) {
    if (!docIds.has(c)) dangling.push(`${s.id} consumes ${c} (not a document)`);
    else if (!produced.has(c)) dangling.push(`${s.id} consumes ${c} (never produced)`);
    else if (producePhase.get(c) > s.phase)
      seq.push(`${s.id}@P${s.phase} consumes ${c} produced@P${producePhase.get(c)}`);
  }
}

console.log(
  `process-model: ${model.processes.length} processes · ${steps.length} steps · ${produced.size} documents`,
);
console.log(
  `orphans ${orphans.length} · typos ${typos.length} · dup-producers ${dups.length} · dangling ${dangling.length} · sequencing ${seq.length}`,
);

const fail =
  orphans.length + typos.length + dups.length + dangling.length + seq.length;
if (fail) {
  if (orphans.length) console.error("\nORPHAN documents (no producing step):\n  " + orphans.join(", "));
  if (typos.length) console.error("\nPRODUCED ids not in content.json:\n  " + typos.join(", "));
  if (dups.length) console.error("\nDUPLICATE producers:\n  " + dups.map(([d, ids]) => `${d}: ${ids.join("/")}`).join("\n  "));
  if (dangling.length) console.error("\nDANGLING consumes:\n  " + dangling.join("\n  "));
  if (seq.length) console.error("\nSEQUENCING (used before produced):\n  " + seq.join("\n  "));
  console.error("\n✗ process-model check FAILED");
  process.exit(1);
}
console.log("✓ process-model check OK — every document is accounted for");
