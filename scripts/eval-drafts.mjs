// Is the document contract SATISFIABLE?
//
//   node --import ./scripts/alias-register.mjs scripts/eval-drafts.mjs
//   node --import ./scripts/alias-register.mjs scripts/eval-drafts.mjs --verbose
//   node --import ./scripts/alias-register.mjs scripts/eval-drafts.mjs AES-FOR-01
//
// This does NOT evaluate a model. It applies the transformation the prompt
// literally instructs — delete the guidance, fill the header band, replace the
// stock placeholders, leave "[ ]" alone in scaffold mode — and then validates
// the result against that document's own contract.
//
// Why that is the measurement worth having first: if a mechanical, perfectly
// rule-following draft cannot pass, then no agent can, and any error rate you
// measure afterwards is dominated by our bugs rather than the model's. Slice 5
// asks for a first-attempt error rate; this establishes the floor that rate is
// measured against.
//
// It found two real defects the day it was written (a corpus/metadata Module
// mismatch, and a clause pattern that swallowed prose), which is the argument
// for keeping it in CI-able shape rather than as a one-off.
//
// What it deliberately CANNOT tell you: whether a draft that validates clean is
// actually any good. That is the false-negative question, and it needs a human
// who knows ISO 13485. See --verbose to read what a passing draft looks like.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const { buildPromptVars, allowedClauses, isProForma, looksProForma } = await import(
  "@/lib/docgen/prompt-vars"
);
const { validateFragment } = await import("@notjustany/doc-contract");

const content = JSON.parse(
  readFileSync(join(process.cwd(), "content", "content.json"), "utf8"),
);

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const only = args.find((a) => !a.startsWith("--"));

// No profile: every document is in scope, so the sweep covers all 275 rather
// than one device's slice.
const PROFILE = null;

/**
 * The prompt's instructions, applied mechanically.
 *
 * Kept deliberately literal. Every substitution below corresponds to a bullet
 * the prompt actually states — if this function needs a rule the prompt does
 * not give, that is a finding about the prompt, not a licence to be clever here.
 */
function ruleFollowingDraft(html, fillMode) {
  let s = html
    .replace(/<p class="guidance">[\s\S]*?<\/p>\s*/g, "")
    .replace(/<div class="manual-banner">[\s\S]*?<\/div>\s*/g, "")
    .replace(/<table class="manual">[\s\S]*?<\/table>\s*/g, "");

  s = s
    .replace(/\[01\]/g, "0.1-DRAFT")
    .replace(/\[YYYY-MM-DD\]/g, "[[NEEDS INPUT: approval date]]")
    .replace(/\[role\]/g, "Quality Manager")
    .replace(/\[Role\]/g, "Quality Manager")
    .replace(/\[Organisation\]/g, "Acme Medical GmbH");

  if (fillMode === "author") {
    // An author fills the blanks; a scaffold must not. Every "[ ]", not only a
    // cell that is nothing else: ISM-TPL-01 writes them inline ("A.5.x [ ]"),
    // and the prompt says "[ ] × N → fill" without qualification.
    s = s.replace(/\[ \]/g, "Defined in the procedure above.");
    s = s.replace(/\[DOMAIN\]/g, "QMS").replace(/\[Y\/N\]/g, "Yes");
  }
  return s;
}

const QUESTIONS = ["approval date"];

function evaluate(doc) {
  const vars = buildPromptVars({ docId: doc.id, profile: PROFILE });
  if (!vars) return { id: doc.id, skipped: "no prompt vars" };

  const draft = ruleFollowingDraft(vars.html, vars.fillMode);
  const r = validateFragment({
    docId: doc.id,
    skeleton: vars.html,
    draft,
    fillMode: vars.fillMode,
    title: doc.title,
    module: doc.module,
    allowedClauses: allowedClauses(vars.activity?.clauses ?? []),
    openQuestions: QUESTIONS,
  });
  return {
    id: doc.id,
    cls: doc.cls,
    proForma: isProForma(doc.id),
    looksProForma: looksProForma(vars.contract),
    skeleton: vars.contract.hasHeaderband ? "A" : "B",
    fillMode: vars.fillMode,
    ok: r.ok,
    errors: r.issues.filter((i) => i.severity === "error"),
    warnings: r.issues.filter((i) => i.severity === "warning"),
    draft,
  };
}

if (only) {
  const doc = content.documents.find((d) => d.id === only);
  if (!doc) {
    console.error(`No document "${only}".`);
    process.exit(1);
  }
  const r = evaluate(doc);
  console.log(`${r.id} · ${r.cls} · skeleton ${r.skeleton} · ${r.fillMode}`);
  console.log(r.ok ? "PASS" : "FAIL");
  for (const e of r.errors) console.log(`  [${e.rule}] ${e.message}`);
  for (const w of r.warnings) console.log(`  warn [${w.rule}] ${w.message}`);
  if (verbose) console.log(`\n--- draft ---\n${r.draft}`);
  process.exit(r.ok ? 0 : 1);
}

// --- the sweep -------------------------------------------------------------

const results = content.documents.map(evaluate).filter((r) => !r.skipped);
const failed = results.filter((r) => !r.ok);

const tally = (key) => {
  const m = new Map();
  for (const r of results) {
    const k = r[key];
    const t = m.get(k) ?? { n: 0, fail: 0 };
    t.n += 1;
    if (!r.ok) t.fail += 1;
    m.set(k, t);
  }
  return m;
};

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0");

console.log(
  `\nRule-following drafts: ${results.length - failed.length}/${results.length} pass ` +
    `(${pct(results.length - failed.length, results.length)}%)\n`,
);

for (const [label, key] of [
  ["By class", "cls"],
  ["By skeleton", "skeleton"],
  ["By fill mode", "fillMode"],
]) {
  console.log(label);
  for (const [k, t] of [...tally(key)].sort((a, b) => b[1].n - a[1].n))
    console.log(
      `   ${String(k).padEnd(10)} ${String(t.n).padStart(3)} docs   ` +
        (t.fail ? `${t.fail} FAIL` : "all pass"),
    );
  console.log();
}

if (failed.length) {
  const byRule = new Map();
  for (const r of failed)
    for (const e of r.errors)
      byRule.set(e.rule, [...(byRule.get(e.rule) ?? []), r.id]);

  console.log("Failures by rule");
  for (const [rule, ids] of [...byRule].sort((a, b) => b[1].length - a[1].length))
    console.log(`   ${rule.padEnd(32)} ${ids.length}  ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? " …" : ""}`);

  if (verbose) {
    console.log("\nEvery failure");
    for (const r of failed) {
      console.log(`\n  ${r.id} (${r.cls}, skeleton ${r.skeleton}, ${r.fillMode})`);
      for (const e of r.errors) console.log(`     [${e.rule}] ${e.message}`);
    }
  }
}

// PRO_FORMA_DOCS is a curated list; looksProForma() is what one looks like.
// Nothing decides anything from the second — it exists so a disagreement is a
// build failure rather than a customer's silently empty draft. Both directions
// matter: a corpus that grows a third pro-forma, and a document that grows a
// bracket in its title for an unrelated reason.
const drift = results.filter((r) => r.proForma !== r.looksProForma);
if (drift.length) {
  console.log("\nPRO-FORMA DRIFT");
  for (const r of drift)
    console.log(
      `   ${r.id.padEnd(12)} listed=${r.proForma}  looks=${r.looksProForma}` +
        (r.looksProForma
          ? "  → add it to PRO_FORMA_DOCS, or remove the placeholder from its identity"
          : "  → it is listed but no longer looks like one; it will never be filled in"),
    );
}

const warned = results.filter((r) => r.ok && r.warnings.length);
if (warned.length)
  console.log(`\n${warned.length} document(s) pass with warnings.`);

console.log(
  failed.length
    ? `\n✗ ${failed.length} document(s) cannot be drafted by following the rules.`
    : "\n✓ Every document is draftable by following the stated rules.",
);
process.exit(failed.length ? 1 : 0);
