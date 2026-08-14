// Validate a generated fragment against its blank template.
//
// Every rule compares the draft to facts derived from THAT document's skeleton
// (skeleton.ts) — nothing is hardcoded per document, so a regenerated corpus is
// covered without anyone writing new rules.
//
// The safety property this file exists for: a model drafting a quality record is
// most tempted to be helpful exactly where being helpful is falsification —
// filling in an approval date, ticking a form, inventing a signatory. Those
// failures are indistinguishable from good output by eye. They are trivially
// detectable mechanically.

import { tokenize } from "./parse.ts";
import {
  buildTree,
  deriveSkeleton,
  elText,
  isEl,
  walk,
  countOccurrences,
  STOCK_PLACEHOLDERS,
  CLAUSE_RE,
  type El,
  type SkeletonFacts,
} from "./skeleton.ts";

export type Severity = "error" | "warning";
export type Issue = {
  rule: string;
  severity: Severity;
  message: string;
  at?: string;
};

export type FillMode = "author" | "scaffold";

export type ValidateInput = {
  docId: string;
  /** the blank template */
  skeleton: string;
  /** the generated fragment */
  draft: string;
  fillMode: FillMode;
  /** from byDocId — checked against the header band */
  title?: string;
  module?: string;
  /** the activity's clausemap, flattened. Citing outside it fails. */
  allowedClauses?: string[];
  /** entries logged in OPEN-QUESTIONS.md, to match against NEEDS INPUT markers */
  openQuestions?: string[];
  options?: { allowExtraSubsections?: boolean };
};

export type ValidateResult = {
  ok: boolean;
  issues: Issue[];
  stats: {
    needsInput: number;
    newSegments: number;
    draftBytes: number;
    skeletonBytes: number;
  };
};

const NEEDS_INPUT_RE = /\[\[NEEDS INPUT:\s*([^\[\]]{3,120}?)\s*\]\]/g;
const NEEDS_INPUT_LOOSE = /\[\[\s*NEEDS[ _-]?INPUT[^\]]*\]?\]?/gi;

const DATE_RES: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/,
  /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/i,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i,
];

const PERSON_RES: RegExp[] = [
  /\b[A-Z][a-z]{1,15}\s+[A-Z]\.\s?[A-Z][a-z]{1,15}\b/,
  /\b(?:Dr|Mr|Ms|Mrs|Prof)\.?\s+[A-Z][a-z]+/,
];

const SIGNATURE_RES: RegExp[] = [
  /\b(?:signed|signature|approved by|reviewed by|authorised by|authorized by)\b\s*[:\-]\s*\S/i,
  /\/s\//,
];

const IDENTIFIER_RES: RegExp[] = [
  /\b(?:batch|lot|serial)\s*(?:no\.?|number|#)?\s*[:\-]?\s*[A-Z0-9][A-Z0-9-]{2,}/i,
];

export function validateFragment(input: ValidateInput): ValidateResult {
  const issues: Issue[] = [];
  const add = (rule: string, severity: Severity, message: string, at?: string) =>
    issues.push({ rule, severity, message, at });

  const sk = deriveSkeleton(input.skeleton, input.docId);
  const { tokens, issues: parseIssues } = tokenize(input.draft);
  const draft = buildTree(tokens);

  // ---- structure: whatever the tokenizer refused ---------------------------
  parseIssues.forEach((p) => add(p.rule, "error", p.message));

  const draftFacts = deriveSkeleton(input.draft, input.docId);

  // ---- title ---------------------------------------------------------------
  if (!draftFacts.h1Text)
    add("doc.title", "error", "Missing the <h1 class=\"doc-title\"> line.");
  else if (draftFacts.h1Text !== sk.h1Text)
    add(
      "doc.title",
      "error",
      `Title changed. Expected exactly "${sk.h1Text}", got "${draftFacts.h1Text}".`,
    );

  // ---- guidance must be gone ----------------------------------------------
  if (draftFacts.guidanceCount)
    add(
      "guidance.removed",
      "error",
      `${draftFacts.guidanceCount} <p class="guidance"> block(s) left in. Author guidance is not part of the document.`,
    );
  if (draftFacts.manualBannerCount)
    add("manual.removed", "error", "The .manual-banner is still present.");
  if (draftFacts.manualTableCount)
    add("manual.removed", "error", "The <table class=\"manual\"> is still present.");

  const draftText = draftFacts.normalizedText;
  if (/Guidance \(delete before release\)/i.test(draftText))
    add(
      "guidance.no-orphan-prose",
      "error",
      "Guidance text remains after its tag was removed — delete the words too.",
    );
  // Case-SENSITIVE, and it must carry the banner's own tail. The banner reads
  // "HOW TO USE THIS DOCUMENT — guidance, delete before release" in capitals;
  // a case-insensitive match on the phrase alone also catches a document that
  // legitimately WRITES about the convention. QMN-MAN-02, the Quality Manual,
  // does exactly that — "a 'How to use this document' block explaining its
  // purpose, who fills it in…" — and could not be drafted at all.
  if (/HOW TO USE THIS DOCUMENT[\s—–-]*guidance, delete before release/.test(draftText))
    add("guidance.no-orphan-prose", "error", "The \"how to use\" prose remains.");

  // ---- header band ---------------------------------------------------------
  if (sk.hasHeaderband) checkHeaderband(sk, draftFacts, input, add);

  // ---- outline -------------------------------------------------------------
  checkOutline(sk, draftFacts, input, add);

  // ---- scaffold-only documents (FOR / LIS) ---------------------------------
  if (input.fillMode === "scaffold") checkScaffold(sk, draftFacts, add);

  // ---- no-invention, scoped to text the draft ADDED ------------------------
  const newSegments = newText(sk, draftFacts);
  checkInvention(newSegments, add);

  // ---- NEEDS INPUT markers -------------------------------------------------
  const markers = collectMarkers(draftText);
  checkMarkers(draftText, markers, input, add);

  // ---- leftover stock placeholders ----------------------------------------
  checkPlaceholders(sk, draftText, input, add);

  // ---- clauses -------------------------------------------------------------
  checkClauses(sk, draftFacts, input, add);

  // ---- render safety -------------------------------------------------------
  checkRenderSafety(draft, add);

  // ---- size sanity ---------------------------------------------------------
  const ratio = input.draft.length / Math.max(1, input.skeleton.length);
  if (ratio < 0.2)
    add("render.size", "warning", `Draft is ${Math.round(ratio * 100)}% of the blank — truncated?`);
  else if (ratio > 4)
    add("render.size", "warning", `Draft is ${Math.round(ratio * 100)}% of the blank — runaway generation?`);

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    stats: {
      needsInput: markers.length,
      newSegments: newSegments.length,
      draftBytes: input.draft.length,
      skeletonBytes: input.skeleton.length,
    },
  };
}

// ---------------------------------------------------------------------------

function checkHeaderband(
  sk: SkeletonFacts,
  df: SkeletonFacts,
  input: ValidateInput,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  if (!df.hasHeaderband) {
    add("headerband.present", "error", "The header band is missing.");
    return;
  }
  const skLabels = sk.headerbandRows.map((r) => r.label);
  const dfLabels = df.headerbandRows.map((r) => r.label);
  if (skLabels.join("|") !== dfLabels.join("|")) {
    add(
      "headerband.rows",
      "error",
      `Header-band rows changed. Expected [${skLabels.join(", ")}], got [${dfLabels.join(", ")}].`,
    );
    return; // per-row checks below would be noise
  }

  const value = (label: string) =>
    df.headerbandRows.find((r) => r.label === label)?.value ?? "";

  const skValue = (label: string) =>
    sk.headerbandRows.find((r) => r.label === label)?.value ?? "";
  // A pro-forma blank carries a placeholder where its identity belongs
  // ("[DOMAIN]-SOP-NN"). Demanding that cell equal the document id asks for the
  // one edit that would destroy the master, so for those the rule becomes
  // "leave it exactly as it is" — which is still an identity check, just of the
  // thing that is actually true.
  const proForma = (s: string) => /\[[^\]\n]*\]/.test(s);

  const idCell = value("Document ID");
  const skId = skValue("Document ID");
  const isProForma = proForma(skId) || proForma(sk.h1Text);
  if (proForma(skId)) {
    if (idCell !== skId)
      add(
        "headerband.identity",
        "error",
        `Document ID is "${idCell}". This is a pro-forma blank — leave "${skId}" exactly as it is.`,
      );
  } else if (idCell && idCell !== input.docId)
    add("headerband.identity", "error", `Document ID is "${idCell}", expected "${input.docId}".`);

  if (input.title) {
    const t = value("Title");
    if (t && t !== input.title)
      add("headerband.identity", "error", `Title is "${t}", expected "${input.title}".`);
  }
  if (input.module) {
    const m = value("Module");
    const skM = skValue("Module");
    // Same reasoning as Document ID: DOC-TPL-01 offers a CHOICE in that cell
    // ("[Core / SEC / PRIV / AI / IVD / HW / SW]"), which is the pro-forma
    // doing its job.
    if (proForma(skM)) {
      if (m !== skM)
        add(
          "headerband.identity",
          "error",
          `Module is "${m}". This is a pro-forma blank — leave "${skM}" exactly as it is.`,
        );
    } else if (m && m !== input.module)
      add("headerband.identity", "error", `Module is "${m}", expected "${input.module}".`);
  }

  // A pro-forma master is not a drafted document and has no version to issue —
  // its "[01]" is the cell the cloning organisation will fill. Everything else
  // must be 0.x-DRAFT.
  const version = value("Version");
  const versionExempt = isProForma && version === skValue("Version");
  if (version && !versionExempt && !/^0\.\d+-DRAFT$/.test(version))
    add(
      "headerband.version",
      "error",
      `Version is "${version}". A drafted document is 0.x-DRAFT — issuing a controlled version is a human act.`,
    );

  // THE most important rule in this file. It is the mechanical form of "never
  // invent a fact", at the exact spot a model is most tempted to be helpful.
  const eff = value("Effective date");
  if (eff && DATE_RES.some((re) => re.test(eff)))
    add(
      "headerband.effective-no-date",
      "error",
      `Effective date is "${eff}". This document has not been approved, so there is no date to know — write [[NEEDS INPUT: approval date]].`,
    );

  // A PRO-FORMA's header band is supposed to keep its placeholders — they are
  // what the cloning organisation fills in later. Every OTHER document must
  // still replace [01] and [YYYY-MM-DD], which is the common case and the whole
  // point of the rule, so the exemption is scoped to the document rather than
  // to "the blank had one here" — the latter would excuse every document alive.

  for (const row of df.headerbandRows) {
    const skRow = sk.headerbandRows.find((r) => r.label === row.label)?.value ?? "";
    for (const p of STOCK_PLACEHOLDERS) {
      if (row.value.includes(p) && !(isProForma && skRow.includes(p)))
        add(
          "headerband.no-stock-placeholder",
          "error",
          `Header-band "${row.label}" still contains ${p}.`,
        );
    }
  }
}

function checkOutline(
  sk: SkeletonFacts,
  df: SkeletonFacts,
  input: ValidateInput,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  const key = (o: { tag: string; text: string }) => `${o.tag}|${o.text}`;
  const skKeys = sk.outline.map(key);
  const dfKeys = df.outline.map(key);
  if (skKeys.join("\n") === dfKeys.join("\n")) return;

  const missing = skKeys.filter((k) => !dfKeys.includes(k));
  const extra = dfKeys.filter((k) => !skKeys.includes(k));

  missing.forEach((k) =>
    add(
      "outline.preserved",
      "error",
      `Heading removed or altered: <${k.split("|")[0]}>${k.split("|")[1]}. Keep the numbering and the two spaces after the number.`,
    ),
  );

  extra.forEach((k) => {
    const [tag, text] = k.split("|");
    const allowed =
      input.options?.allowExtraSubsections === true && tag === "h3";
    add(
      "outline.no-additions",
      allowed ? "warning" : "error",
      `Heading added: <${tag}>${text}. Put extra material inside an existing section.`,
    );
  });

  if (!missing.length && !extra.length)
    add("outline.preserved", "error", "Headings are present but reordered.");
}

function checkScaffold(
  sk: SkeletonFacts,
  df: SkeletonFacts,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  if (df.tables.length !== sk.tables.length) {
    add(
      "scaffold.tbody-row-count",
      "error",
      `Table count changed (${sk.tables.length} → ${df.tables.length}).`,
    );
    return;
  }
  sk.tables.forEach((s, i) => {
    const d = df.tables[i];
    if (d.headerCells !== s.headerCells)
      add(
        "scaffold.header-cells",
        "error",
        `Table ${i + 1}: column count changed (${s.headerCells} → ${d.headerCells}).`,
      );
    if (s.cells[0] && d.cells[0] && s.cells[0].join("|") !== d.cells[0].join("|"))
      add("scaffold.header-cells", "error", `Table ${i + 1}: header row text changed.`);
    if (d.bodyRows !== s.bodyRows)
      add(
        "scaffold.tbody-row-count",
        "error",
        `Table ${i + 1}: ${d.bodyRows} body rows, blank has ${s.bodyRows}. A form records what happened — do not add rows.`,
      );
    if (s.bracketAt.join(",") !== d.bracketAt.join(","))
      add(
        "scaffold.brackets-untouched",
        "error",
        `Table ${i + 1}: "[ ]" cells were filled or moved. Filling a form in advance fabricates a quality record.`,
      );
    if (s.emptyregColspan !== null && d.emptyregColspan !== s.emptyregColspan)
      add(
        "scaffold.emptyreg-preserved",
        "error",
        `Table ${i + 1}: the blank-register row was changed or removed.`,
      );
  });
}

/**
 * Text present in the draft but NOT in the blank.
 *
 * This is what makes the no-invention rules usable rather than noise: a
 * register's own column legend ("Opened", "Closed", "Owner") lives in the
 * skeleton, so it never trips a date or identifier heuristic.
 */
const BRACKET_SPAN = /\[[^\]\n]*\]/g;

/**
 * Turn a skeleton block that contains placeholders into a pattern whose capture
 * groups are exactly the placeholders.
 *
 * "It applies to … from work-order release through in-process control to batch
 * release" is the blank's own prose. If it also contains [Organisation], filling
 * that placeholder changes the block, and a plain string comparison then calls
 * the WHOLE paragraph new — handing every word of the template's own prose to
 * the no-invention scan. PRO-SOP-01 failed exactly that way, on the phrase
 * "batch release", which the template wrote and the agent merely preserved.
 */
function blockPattern(block: string): { re: RegExp; literal: number } | null {
  if (!/\[[^\]\n]*\]/.test(block)) return null;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = "";
  let last = 0;
  let literal = 0;
  let m: RegExpExecArray | null;
  BRACKET_SPAN.lastIndex = 0;
  while ((m = BRACKET_SPAN.exec(block))) {
    const lit = block.slice(last, m.index);
    literal += lit.trim().length;
    out += esc(lit) + "([\\s\\S]*?)";
    last = m.index + m[0].length;
  }
  const tail = block.slice(last);
  literal += tail.trim().length;
  out += esc(tail);

  // A block that is NOTHING but a placeholder — the header band's "[01]" cell,
  // say — compiles to ^([\s\S]*?)$, which matches every string in the document.
  // Such a pattern cannot identify anything; it can only shadow the pattern that
  // would have, handing back a whole unrelated paragraph as "what was filled in".
  // That is precisely how PRO-SOP-01's scope paragraph kept reaching the
  // invention scan after the block-diff was supposedly fixed.
  if (literal === 0) return null;

  try {
    return { re: new RegExp(`^${out}$`), literal };
  } catch {
    return null;
  }
}

/**
 * The text the draft ADDED, as precisely as we can determine it.
 *
 * Exact block matches are known. A block that differs only where the blank had
 * a placeholder yields just the substituted text — so the scan sees what the
 * agent wrote and not what it inherited. Anything else is new in full, which is
 * the safe default: rewriting the surrounding prose defeats the pattern and the
 * whole block goes back under scrutiny.
 */
export function newText(sk: SkeletonFacts, df: SkeletonFacts): string[] {
  const known = new Set(sk.blocks);
  // Most literal text first, so the most specific blank wins when several could
  // match. Without the ordering, whichever block happened to come first in the
  // document would decide.
  const patterns = sk.blocks
    .map(blockPattern)
    .filter((p): p is { re: RegExp; literal: number } => p !== null)
    .sort((a, b) => b.literal - a.literal);

  const out: string[] = [];
  for (const b of df.blocks) {
    if (known.has(b)) continue;
    let filled: string[] | null = null;
    for (const p of patterns) {
      const m = p.re.exec(b);
      if (m) {
        filled = m.slice(1).filter((x) => x && x.trim());
        break;
      }
    }
    if (filled) out.push(...filled);
    else out.push(b);
  }
  return out;
}

function checkInvention(
  newSegments: string[],
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  // Markers are not inventions — strip them before scanning.
  const text = newSegments.join("  ").replace(NEEDS_INPUT_LOOSE, " ");
  const hit = (res: RegExp[]) => res.map((re) => re.exec(text)).find(Boolean);

  const d = hit(DATE_RES);
  if (d)
    add(
      "invent.no-date",
      "error",
      `Invented date "${d[0]}". A QMS records what happened — write [[NEEDS INPUT: …]] instead.`,
    );

  const p = hit(PERSON_RES);
  if (p)
    add(
      "invent.no-person-name",
      "error",
      `Looks like an invented person: "${p[0]}". Name the role, not the person.`,
    );

  const s = hit(SIGNATURE_RES);
  if (s)
    add("invent.no-signature", "error", `Invented approval or signature: "${s[0]}".`);

  const id = hit(IDENTIFIER_RES);
  if (id)
    add("invent.no-identifier", "error", `Invented identifier: "${id[0]}".`);
}

function collectMarkers(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  NEEDS_INPUT_RE.lastIndex = 0;
  while ((m = NEEDS_INPUT_RE.exec(text))) out.push(m[1].trim());
  return out;
}

function checkMarkers(
  text: string,
  markers: string[],
  input: ValidateInput,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  // Anything that looks like a marker but isn't well-formed.
  const loose = text.match(NEEDS_INPUT_LOOSE) ?? [];
  const wellFormed = new Set(
    (text.match(/\[\[NEEDS INPUT:\s*[^\[\]]{3,120}?\s*\]\]/g) ?? []).map((s) => s),
  );
  loose.forEach((l) => {
    if (!wellFormed.has(l))
      add(
        "needsinput.wellformed",
        "error",
        `Malformed marker "${l}". Use exactly [[NEEDS INPUT: what you need]].`,
      );
  });

  if (input.openQuestions) {
    const logged = input.openQuestions.map((q) => q.toLowerCase());
    markers.forEach((m) => {
      if (!logged.some((q) => q.includes(m.toLowerCase())))
        add(
          "needsinput.logged",
          "error",
          `"${m}" is marked in the document but not in OPEN-QUESTIONS.md. The question list is the deliverable a human acts on.`,
        );
    });
  }
}

function checkPlaceholders(
  sk: SkeletonFacts,
  draftText: string,
  input: ValidateInput,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  for (const p of STOCK_PLACEHOLDERS) {
    const inDraft = countOccurrences(draftText, p);
    if (!inDraft) continue;
    const allowed = input.fillMode === "scaffold" ? (sk.placeholders[p] ?? 0) : 0;
    if (inDraft > allowed)
      add(
        "placeholder.no-stock",
        "error",
        input.fillMode === "scaffold"
          ? `${p} appears ${inDraft} times, blank has ${allowed}.`
          : `${p} left unfilled (${inDraft}×). Replace it, or mark it [[NEEDS INPUT: …]].`,
      );
  }
}

function checkClauses(
  sk: SkeletonFacts,
  df: SkeletonFacts,
  input: ValidateInput,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  if (!input.allowedClauses) return;
  const norm = (c: string) => c.replace(/\s+/g, " ").trim().toLowerCase();
  const permitted = new Set([
    ...sk.clauses.map(norm),
    ...input.allowedClauses.map(norm),
  ]);
  df.clauses.forEach((c) => {
    if (!permitted.has(norm(c)))
      add(
        "clause.not-invented",
        "error",
        `Cites "${c}", which is not in the blank or this activity's clause map. If you cannot cite it, do not assert it.`,
      );
  });
}

function checkRenderSafety(
  draft: El,
  add: (r: string, s: Severity, m: string, at?: string) => void,
) {
  // A wide register outside its scroll wrapper blows the fixed-width .paper.
  const inTscroll = new Set<El>();
  const mark = (el: El, inside: boolean) => {
    const nowInside =
      inside || (el.tag === "div" && el.attrs.class === "tscroll");
    if (nowInside) inTscroll.add(el);
    el.children.filter(isEl).forEach((c) => mark(c, nowInside));
  };
  mark(draft, false);

  walk(draft, (e) => {
    if (e.tag === "table" && e.attrs.class === "grid reg" && !inTscroll.has(e))
      add(
        "render.tscroll",
        "error",
        'A <table class="grid reg"> must sit inside <div class="tscroll">, or it overflows the page.',
      );
    if (e.tag === "table") {
      const rows: El[] = [];
      walk(e, (x) => {
        if (x.tag === "tr") rows.push(x);
      });
      const cols = (rows[0]?.children.filter(isEl) ?? []).filter(
        (c) => c.tag === "td" || c.tag === "th",
      ).length;
      rows.forEach((r) => {
        r.children.filter(isEl).forEach((c) => {
          const cs = Number(c.attrs.colspan ?? "0");
          if (cs && cols && cs > cols)
            add(
              "render.colspan",
              "error",
              `colspan="${cs}" exceeds the table's ${cols} columns.`,
            );
        });
      });
    }
  });
}

export { elText, deriveSkeleton, CLAUSE_RE };
