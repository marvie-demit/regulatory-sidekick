// The two properties that must hold no matter what a model decides to do:
//
//   1. Nothing is ever written outside 20_Drafts/.
//   2. A fact that has not happened yet never gets recorded as if it had.
//
// Both are stated in the system prompt. A prompt can be argued with; these
// cannot, which is the point of testing them here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  QmsPathError,
  atomicWrite,
  draftPathFor,
  isInside,
  resolveReadable,
  resolveWritable,
  scaffold,
  syncWarnings,
  writeOpenQuestions,
} from "../src/qms.ts";
import {
  forbiddenReason,
  knownFacts,
  looksLikeAPersonName,
  recordFacts,
} from "../src/facts.ts";

const newRoot = () => mkdtempSync(join(tmpdir(), "rsk-qms-"));

// ---------------------------------------------------------------------------
// 1. Write containment
// ---------------------------------------------------------------------------

test("scaffold creates the layout skills.md specifies", () => {
  const root = newRoot();
  const r = scaffold(root, { organisation: "Acme Medical GmbH", country: "Germany" });
  for (const p of ["00_Controlled", "10_Records", "20_Drafts", "OPEN-QUESTIONS.md", "QMS-FACTS.yml"])
    assert.ok(r.created.includes(p), `missing ${p}`);
  assert.match(readFileSync(join(root, "QMS-FACTS.yml"), "utf8"), /Acme Medical GmbH/);
});

test("scaffold never overwrites an existing file", () => {
  const root = newRoot();
  scaffold(root);
  writeFileSync(join(root, "OPEN-QUESTIONS.md"), "MINE", "utf8");
  const second = scaffold(root);
  assert.ok(second.existing.includes("OPEN-QUESTIONS.md"));
  assert.equal(readFileSync(join(root, "OPEN-QUESTIONS.md"), "utf8"), "MINE");
});

test("a draft path inside 20_Drafts is allowed", () => {
  const root = newRoot();
  const p = resolveWritable(root, draftPathFor("RSK-SOP-01", "RSK"));
  assert.ok(isInside(join(root, "20_Drafts"), p));
});

test("traversal out of 20_Drafts is refused — the prefix looks right and escapes", () => {
  const root = newRoot();
  assert.throws(
    () => resolveWritable(root, "20_Drafts/../00_Controlled/RSK-SOP-01.html"),
    QmsPathError,
    "a startsWith check would have allowed this",
  );
});

test("writing directly to the controlled area is refused", () => {
  const root = newRoot();
  for (const p of [
    "00_Controlled/RSK-SOP-01.html",
    "10_Records/anything.html",
    "QMS-FACTS.yml",
    "../escape.html",
  ])
    assert.throws(() => resolveWritable(root, p), QmsPathError, `allowed ${p}`);
});

test("absolute paths outside the root are refused", () => {
  const root = newRoot();
  const elsewhere = join(newRoot(), "evil.html");
  assert.throws(() => resolveWritable(root, elsewhere), QmsPathError);
});

test("reads may reach the controlled area; writes may not", () => {
  const root = newRoot();
  scaffold(root);
  assert.ok(resolveReadable(root, "00_Controlled"));
  assert.throws(() => resolveReadable(root, "../outside"), QmsPathError);
});

test("atomicWrite leaves no partial file and no temp file behind", () => {
  const root = newRoot();
  scaffold(root);
  const abs = resolveWritable(root, draftPathFor("RSK-SOP-01", "RSK"));
  atomicWrite(abs, "<h1>hello</h1>");
  assert.equal(readFileSync(abs, "utf8"), "<h1>hello</h1>");
  assert.ok(!existsSync(`${abs}.tmp-${process.pid}`));
});

test("open questions are replaced per document, not accumulated", () => {
  const root = newRoot();
  scaffold(root);
  writeOpenQuestions(root, "RSK-SOP-01", "Risk Management", [
    { question: "Who chairs the risk review board?", section: "§2 Roles" },
  ]);
  writeOpenQuestions(root, "RSK-SOP-01", "Risk Management", [
    { question: "Who chairs the risk review board?", section: "§2 Roles" },
    { question: "Approval date once signed", section: "header" },
  ]);
  const md = readFileSync(join(root, "OPEN-QUESTIONS.md"), "utf8");
  assert.equal((md.match(/## RSK-SOP-01/g) ?? []).length, 1, "duplicated the block");
  assert.match(md, /Approval date once signed/);
});

test("sync conflict copies are detected", () => {
  const root = newRoot();
  scaffold(root);
  mkdirSync(join(root, "20_Drafts", "RSK"), { recursive: true });
  writeFileSync(
    join(root, "20_Drafts", "RSK", "RSK-SOP-01 (conflicted copy).html"),
    "x",
    "utf8",
  );
  const w = syncWarnings(root);
  assert.ok(
    w.some((x) => x.kind === "conflict-copies"),
    "a conflict copy must be surfaced — a reviewer could promote the wrong one",
  );
});

// ---------------------------------------------------------------------------
// 2. Facts — category C never gets recorded
// ---------------------------------------------------------------------------

test("category-C keys are refused however they are phrased", () => {
  for (const k of [
    "approval_date",
    "effective_date",
    "date_approved",
    "signature",
    "signed_by",
    "approvedBy",
    "test_result",
    "batch_number",
    "serial",
    "issued",
    "device.release_date",
  ])
    assert.ok(forbiddenReason(k), `should have refused "${k}"`);
});

test("legitimate category-B keys are accepted", () => {
  for (const k of ["device.name", "device.version", "organisation", "country", "roles.qmr"])
    assert.equal(forbiddenReason(k), null, `should have allowed "${k}"`);
});

test("recordFacts writes the good and refuses the forbidden, in one call", () => {
  const root = newRoot();
  scaffold(root);
  const r = recordFacts(root, {
    "device.name": "Acme Insulin Pump",
    "device.version": "2.0",
    approval_date: "2026-03-12",
  });
  assert.deepEqual(r.written.sort(), ["device.name", "device.version"]);
  assert.equal(r.refused.length, 1);
  assert.equal(r.refused[0].key, "approval_date");

  const known = knownFacts(root);
  assert.equal(known["device.name"], "Acme Insulin Pump");
  assert.ok(
    !Object.keys(known).some((k) => /approval/i.test(k)),
    "a refused fact must not reach the file",
  );
  assert.ok(
    !readFileSync(join(root, "QMS-FACTS.yml"), "utf8").includes("2026-03-12"),
    "the invented date must not be on disk anywhere",
  );
});

test("a role must be a title, not a person", () => {
  assert.ok(looksLikeAPersonName("Anna Schmidt"));
  assert.ok(looksLikeAPersonName("Dr Anna Schmidt"));
  assert.ok(looksLikeAPersonName("J. Smith"));
  assert.ok(!looksLikeAPersonName("Head of Quality"));
  assert.ok(!looksLikeAPersonName("Quality Manager"));

  const root = newRoot();
  scaffold(root);
  const r = recordFacts(root, { "roles.management_representative": "Anna Schmidt" });
  assert.equal(r.written.length, 0);
  assert.match(r.refused[0].reason, /ROLE/);
});

test("a human's syntax error in the facts file does not take the agent down", () => {
  const root = newRoot();
  scaffold(root);
  writeFileSync(join(root, "QMS-FACTS.yml"), "device:\n  name: [unclosed\n", "utf8");
  assert.deepEqual(knownFacts(root), {}, "should degrade to 'nothing known'");
});

test("blank scaffolded values do not count as known facts", () => {
  const root = newRoot();
  scaffold(root);
  assert.deepEqual(knownFacts(root), {}, "an empty scaffold knows nothing");
});

test("a folder outside any sync root is not warned about", () => {
  // OneDrive being installed on the machine must not warn about D:\QMS. A
  // diagnostic that fires for everyone gets ignored, and the real one with it.
  const root = newRoot();
  scaffold(root);
  assert.deepEqual(
    syncWarnings(root).filter((w) => w.kind === "files-on-demand"),
    [],
  );
});
