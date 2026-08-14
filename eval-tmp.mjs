import { readFileSync } from "node:fs";
const { buildPromptVars, allowedClauses } = await import("@/lib/docgen/prompt-vars");
const { validateFragment } = await import("@notjustany/doc-contract");
const SP = "C:/Users/marvi/AppData/Local/Temp/claude/c--Users-marvi-Desktop-notjustanyqms/a7391fd0-51c6-40b2-a863-6d880faaad4f/scratchpad/eval";
const content = JSON.parse(readFileSync("content/content.json", "utf8"));

const id = process.argv[2];
const doc = content.documents.find((d) => d.id === id);
const vars = buildPromptVars({ docId: id, profile: { SW: 1, MDR: 1 } });
const draft = readFileSync(`${SP}/${id}.draft.html`, "utf8");

const r = validateFragment({
  docId: id,
  skeleton: vars.html,
  draft,
  fillMode: vars.fillMode,
  title: doc.title,
  module: doc.module,
  allowedClauses: allowedClauses(vars.activity?.clauses ?? []),
  openQuestions: ["approval date", "the 3-5 measurable quality objectives Top Management sets for the current period"],
});
console.log(`${id} — ${vars.fillMode} — ${r.ok ? "PASSES" : "FAILS"}`);
for (const i of r.issues) console.log(`   [${i.severity}] [${i.rule}] ${i.message}`);
console.log(`   stats: ${JSON.stringify(r.stats)}`);
