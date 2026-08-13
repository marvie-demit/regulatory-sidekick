// Negative fixtures: one per rule, each asserting that THAT rule fires.
//
// A rule with no negative fixture is not a rule — it is a comment that happens
// to compile. Equally important is the first test below: a correctly filled
// draft must PASS. A validator nothing can satisfy is worse than none, because
// people route around it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateFragment, type FillMode } from "../src/validate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = join(here, "..", "..", "..", "content", "docs");
const read = (id: string) => readFileSync(join(DOCS, `${id}.html`), "utf8");

const SOP = "RSK-SOP-01";
const FOR = "CAP-FOR-01";
const LIS = "AUD-LIS-01";

/**
 * What a well-behaved agent produces: guidance stripped, header band filled,
 * unknown facts marked. Scaffold docs keep every "[ ]" untouched.
 */
function goodDraft(html: string, mode: FillMode): string {
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
  if (mode === "author") {
    // An author fills the blanks; a scaffold must not.
    s = s.replace(/>\[ \]</g, ">Defined in the risk-management plan.<");
    s = s.replace(/\[DOMAIN\]/g, "RSK").replace(/\[Y\/N\]/g, "Yes");
  }
  return s;
}

function run(id: string, mode: FillMode, mutate: (s: string) => string) {
  const skeleton = read(id);
  const draft = mutate(goodDraft(skeleton, mode));
  return validateFragment({ docId: id, skeleton, draft, fillMode: mode });
}

const rules = (r: ReturnType<typeof run>) =>
  r.issues.filter((i) => i.severity === "error").map((i) => i.rule);

/** The fixture must fire `rule`, and must not be passed off as valid. */
function expectRule(r: ReturnType<typeof run>, rule: string) {
  assert.ok(
    rules(r).includes(rule),
    `expected ${rule}; got: ${rules(r).join(", ") || "(none)"}`,
  );
  assert.equal(r.ok, false);
}

test("corpus fixtures exist", () => {
  for (const id of [SOP, FOR, LIS])
    assert.ok(existsSync(join(DOCS, `${id}.html`)), `${id} missing`);
});

// ---------------------------------------------------------------------------
// The one that matters most: a correct draft passes.
// ---------------------------------------------------------------------------

test("a correctly filled author draft passes", () => {
  const r = run(SOP, "author", (s) => s);
  assert.deepEqual(rules(r), [], JSON.stringify(r.issues, null, 2));
  assert.equal(r.ok, true);
});

test("a correctly scaffolded form passes", () => {
  const r = run(FOR, "scaffold", (s) => s);
  assert.deepEqual(rules(r), [], JSON.stringify(r.issues, null, 2));
  assert.equal(r.ok, true);
});

test("a correctly scaffolded register passes", () => {
  const r = run(LIS, "scaffold", (s) => s);
  assert.deepEqual(rules(r), [], JSON.stringify(r.issues, null, 2));
  assert.equal(r.ok, true);
});

// AES-FOR-01's title BEGINS with a standard reference — "IEC 60601 Test Report".
// That is where a loose clause pattern starts matching and fails to stop: it
// runs on through the header band and reads as one invented citation. The bug
// hides from the three fixtures above (none of their titles start with a
// standard) and, worse, hides from a verbatim copy of the blank itself —
// skeleton and draft produce the same garbled string, so it is permitted. It
// surfaces only once the guidance block is deleted, which every draft must do.
//
// The other three tests pass no allowedClauses, so checkClauses returns early
// and never runs. This one must pass them or it asserts nothing.
test("a blank whose title starts with a standard passes once guidance is stripped", () => {
  const id = "AES-FOR-01";
  const skeleton = read(id);
  const r = validateFragment({
    docId: id,
    skeleton,
    draft: goodDraft(skeleton, "scaffold"),
    fillMode: "scaffold",
    allowedClauses: [
      "IEC 60601-1 Basic safety & essential performance",
      "IEC 60601-1 Applicable collateral (-1-x) and particular (-2-xx) standards",
      "EU MDR Annex I GSPR (safety & performance)",
    ],
  });
  assert.deepEqual(rules(r), [], JSON.stringify(r.issues, null, 2));
  assert.equal(r.ok, true);
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

test("tag.allowed — a list is not in the corpus vocabulary", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<ul><li>x</li></ul><h2>")),
    "tag.allowed",
  );
});

test("attr.allowed — style is the injection surface", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", '<h2 style="color:red">')),
    "attr.allowed",
  );
});

test("attr.allowed — href is rejected too", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<p>", '<p href="https://x.test">')),
    "attr.allowed",
  );
});

test("class.allowed — an unstyled class renders as nothing", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace('<table class="grid">', '<table class="fancy">')),
    "class.allowed",
  );
});

test("html.balanced — an unclosed element", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("</table>", "")),
    "html.balanced",
  );
});

test("entities — a bare ampersand", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<h2>Risk & Safety ")),
    "entities",
  );
});

test("doc.title — the title is identity, not copy", () => {
  expectRule(
    run(SOP, "author", (s) =>
      s.replace(/<h1 class="doc-title">[^<]*<\/h1>/, '<h1 class="doc-title">Our Risk Doc</h1>'),
    ),
    "doc.title",
  );
});

// ---------------------------------------------------------------------------
// Guidance removal
// ---------------------------------------------------------------------------

test("guidance.removed — author guidance left in", () => {
  const skeleton = read(SOP);
  const r = validateFragment({
    docId: SOP,
    skeleton,
    draft: skeleton, // the blank, untouched
    fillMode: "author",
  });
  expectRule(r, "guidance.removed");
});

test("guidance.no-orphan-prose — tag removed, words kept", () => {
  expectRule(
    run(SOP, "author", (s) =>
      s.replace("<h2>", "<p>Guidance (delete before release): fill this in.</p><h2>"),
    ),
    "guidance.no-orphan-prose",
  );
});

// ---------------------------------------------------------------------------
// Header band
// ---------------------------------------------------------------------------

test("headerband.present — the band is removed", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace(/<table class="headerband">[\s\S]*?<\/table>/, "")),
    "headerband.present",
  );
});

test("headerband.identity — wrong document id", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace(`<td>${SOP}</td>`, "<td>RSK-SOP-99</td>")),
    "headerband.identity",
  );
});

test("headerband.version — a controlled version is a human act", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("0.1-DRAFT", "1.0")),
    "headerband.version",
  );
});

test("headerband.effective-no-date — THE rule", () => {
  expectRule(
    run(SOP, "author", (s) =>
      s.replace("[[NEEDS INPUT: approval date]]", "2026-03-12"),
    ),
    "headerband.effective-no-date",
  );
});

test("headerband.no-stock-placeholder — a stock token survives in the band", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("0.1-DRAFT", "[01]")),
    "headerband.no-stock-placeholder",
  );
});

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------

test("outline.preserved — a section is dropped", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace(/<h2>[^<]*<\/h2>/, "")),
    "outline.preserved",
  );
});

test("outline.no-additions — an invented section", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<h2>0  Our Extra Section</h2><h2>")),
    "outline.no-additions",
  );
});

// ---------------------------------------------------------------------------
// Scaffold — forms and registers are structures, not records
// ---------------------------------------------------------------------------

test("scaffold.brackets-untouched — filling a form fabricates a record", () => {
  expectRule(
    run(FOR, "scaffold", (s) => s.replace(">[ ]<", ">Passed<")),
    "scaffold.brackets-untouched",
  );
});

test("scaffold.tbody-row-count — inventing a row", () => {
  expectRule(
    run(FOR, "scaffold", (s) => {
      // the LAST table is a data grid; the first is the header band
      const at = s.lastIndexOf("</table>");
      return s.slice(0, at) + "<tr><td>1</td><td>x</td></tr>" + s.slice(at);
    }),
    "scaffold.tbody-row-count",
  );
});

test("scaffold.emptyreg-preserved — the blank-register row is removed", () => {
  expectRule(
    run(LIS, "scaffold", (s) => s.replace(/<tr><td colspan="\d+" class="emptyreg">[\s\S]*?<\/tr>/, "")),
    "scaffold.emptyreg-preserved",
  );
});

// ---------------------------------------------------------------------------
// No-invention — scoped to text the draft ADDED
// ---------------------------------------------------------------------------

test("invent.no-date — a date in new prose", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<p>Approved on 2026-03-12.</p><h2>")),
    "invent.no-date",
  );
});

test("invent.no-person-name — a person, not a role", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<p>Chaired by Dr Anna Schmidt.</p><h2>")),
    "invent.no-person-name",
  );
});

test("invent.no-signature — an invented approval", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<p>Approved by: J. Smith</p><h2>")),
    "invent.no-signature",
  );
});

test("invent.no-identifier — an invented batch number", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<p>Batch no: AB-2291</p><h2>")),
    "invent.no-identifier",
  );
});

// The counterpart: text that was ALREADY in the blank must not trip these.
// Without diff-scoping, a register's own column legend sets them all off.
test("no-invention rules ignore text that was already in the blank", () => {
  const r = run(LIS, "scaffold", (s) => s);
  assert.deepEqual(
    rules(r).filter((x) => x.startsWith("invent.")),
    [],
    "the blank's own legend must not read as invention",
  );
});

// ---------------------------------------------------------------------------
// Markers, placeholders, clauses
// ---------------------------------------------------------------------------

test("needsinput.wellformed — a malformed marker", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("<h2>", "<p>[[NEEDS INPUT]]</p><h2>")),
    "needsinput.wellformed",
  );
});

test("needsinput.logged — a marker with no open question", () => {
  const skeleton = read(SOP);
  const draft = goodDraft(skeleton, "author");
  const r = validateFragment({
    docId: SOP,
    skeleton,
    draft,
    fillMode: "author",
    openQuestions: [], // nothing logged, but the band carries a marker
  });
  expectRule(r, "needsinput.logged");
});

test("needsinput.logged — passes when the question IS logged", () => {
  const skeleton = read(SOP);
  const draft = goodDraft(skeleton, "author");
  const r = validateFragment({
    docId: SOP,
    skeleton,
    draft,
    fillMode: "author",
    openQuestions: ["approval date once signed"],
  });
  assert.deepEqual(
    rules(r).filter((x) => x.startsWith("needsinput.")),
    [],
  );
});

test("placeholder.no-stock — an unfilled stock token in an author draft", () => {
  expectRule(
    run(SOP, "author", (s) => s.replace("Acme Medical GmbH", "[Organisation]")),
    "placeholder.no-stock",
  );
});

test("clause.not-invented — citing outside the clause map", () => {
  const skeleton = read(SOP);
  const draft = goodDraft(skeleton, "author").replace(
    "<h2>",
    "<p>Required by ISO 27001 A.5.1.</p><h2>",
  );
  const r = validateFragment({
    docId: SOP,
    skeleton,
    draft,
    fillMode: "author",
    allowedClauses: ["ISO 14971 4"],
  });
  expectRule(r, "clause.not-invented");
});

// ---------------------------------------------------------------------------
// Render safety
// ---------------------------------------------------------------------------

test("render.tscroll — a wide register outside its scroll wrapper", () => {
  expectRule(
    run(LIS, "scaffold", (s) =>
      s.replace('<div class="tscroll">', "").replace("</div>", ""),
    ),
    "render.tscroll",
  );
});

test("render.colspan — a colspan wider than the table", () => {
  expectRule(
    run(SOP, "author", (s) =>
      s.replace("<tr><td>", '<tr><td colspan="99">'),
    ),
    "render.colspan",
  );
});
