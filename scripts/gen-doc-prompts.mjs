// Render the per-document prompts.
//
//   node --import ./scripts/alias-register.mjs scripts/gen-doc-prompts.mjs --check
//   node --import ./scripts/alias-register.mjs scripts/gen-doc-prompts.mjs DOC-SOP-01
//
// --check renders ALL 275 and fails on any prompt that came out missing a
// section it should have had. That is the guard against a template variable
// silently resolving to undefined for some corner of the corpus — a class with
// no lean bar, a document no activity references — which would otherwise ship
// as a quietly worse prompt for a handful of documents and never be noticed.
//
// Prompts are NOT written to disk by default. A prompt carries its document's
// outline, header-band labels and fill points, which is a meaningful
// compression of the corpus; 275 of them on disk is the same leak as bundling
// the templates. Pass an id to print one to stdout while authoring.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const { buildPromptVars } = await import("@/lib/docgen/prompt-vars");
const { renderDocPrompt } = await import("@/lib/docgen/prompt-template");

const content = JSON.parse(
  readFileSync(join(process.cwd(), "content", "content.json"), "utf8"),
);
const documents = content.documents;

const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.find((a) => !a.startsWith("--"));

// A representative profile so scoping-dependent variables actually resolve.
const PROFILE = { SW: 1, MDR: 1 };

if (!check && only) {
  const vars = buildPromptVars({ docId: only, profile: PROFILE });
  if (!vars) {
    console.error(`No document "${only}".`);
    process.exit(1);
  }
  console.log(renderDocPrompt(vars));
  process.exit(0);
}

let rendered = 0;
const problems = [];

for (const d of documents) {
  let prompt;
  try {
    const vars = buildPromptVars({ docId: d.id, profile: PROFILE });
    if (!vars) {
      problems.push(`${d.id}: buildPromptVars returned null`);
      continue;
    }
    prompt = renderDocPrompt(vars);
  } catch (e) {
    problems.push(`${d.id}: threw — ${e instanceof Error ? e.message : e}`);
    continue;
  }
  rendered++;

  // Nothing may leak an unresolved value into a prompt a model will follow.
  if (/undefined|\[object Object\]|NaN/.test(prompt))
    problems.push(`${d.id}: prompt contains an unresolved value`);

  // Every prompt must carry the contract — that is the part that makes the
  // output validate.
  for (const need of ["## The skeleton contract", "## When you're done"])
    if (!prompt.includes(need)) problems.push(`${d.id}: missing "${need}"`);

  // A form or register must lead with the scaffold warning, first, so it
  // cannot be buried under the rest of the prompt.
  const scaffold = d.cls === "FOR" || d.cls === "LIS";
  const hasWarning = prompt.includes("BUILD THE SCAFFOLD, NOT THE RECORD");
  if (scaffold && !hasWarning)
    problems.push(`${d.id}: ${d.cls} without the scaffold-only warning`);
  if (!scaffold && hasWarning)
    problems.push(`${d.id}: ${d.cls} wrongly carries the scaffold-only warning`);
}

const byClass = documents.reduce((m, d) => {
  m[d.cls] = (m[d.cls] ?? 0) + 1;
  return m;
}, {});
console.log(
  `gen-doc-prompts: rendered ${rendered}/${documents.length} · ` +
    Object.entries(byClass)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · "),
);

if (problems.length) {
  console.error(`\n✗ ${problems.length} prompt problem(s):\n`);
  problems.slice(0, 25).forEach((p) => console.error(`  · ${p}`));
  if (problems.length > 25) console.error(`  … and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("✓ every document renders a complete prompt");
