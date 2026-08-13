// THE one parameterised prompt, rendered per document from PromptVars.
//
// Rendered server-side at request time and returned on the template endpoint —
// never committed, never shipped. A prompt carries that document's outline,
// header-band labels and fill points, which is a meaningful compression of the
// corpus; 275 prompt files on disk is the same leak as bundling the templates.
//
// One template, 275 renderings. Hand-writing them would go stale the moment the
// external pipeline regenerates the corpus.

import type { PromptVars } from "./prompt-vars.ts";

const bullets = (xs: string[], prefix = "- ") =>
  xs.filter(Boolean).map((x) => `${prefix}${x}`).join("\n");

/** The block that must appear FIRST for a form or register, so it can't be buried. */
function scaffoldBlock(v: PromptVars): string {
  const kind = v.doc.cls === "FOR" ? "form" : "register";
  const brackets = v.contract.tables.reduce((n, t) => n + t.bracketAt.length, 0);
  const hasBlankRow = v.contract.tables.some((t) => t.emptyregColspan !== null);
  const lines = [
    `> ## THIS IS A ${kind.toUpperCase()} — BUILD THE SCAFFOLD, NOT THE RECORD`,
    ">",
    "> You are producing an empty structure.",
    brackets
      ? `> Leave every one of the ${brackets} \`[ ]\` cells exactly as it is. Do not add rows.`
      : "> Do not add rows.",
    hasBlankRow ? "> Do not remove the blank-register row." : "",
    "> **No dates, no names, no signatures, no results, no batch numbers — none.**",
    ">",
    "> The only prose you may write is the Scope & Identification section.",
    `> If you find yourself typing a value into a cell, stop: a filled ${kind} is a`,
    "> falsified quality record, and the validator will reject it.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function renderDocPrompt(v: PromptVars): string {
  const a = v.activity;
  const out: string[] = [];

  out.push(`# Draft ${v.doc.id} — ${v.doc.title}`);
  out.push("");

  if (v.fillMode === "scaffold") {
    out.push(scaffoldBlock(v));
    out.push("");
  }

  // ---- what this document is ----------------------------------------------
  out.push("## What this document is");
  out.push(
    `A **${v.role}** (${v.doc.cls}) in the ${v.doc.domain} process, module ${v.doc.module}.`,
  );
  if (v.producedIn)
    out.push(
      `Produced in **${v.producedIn.pn} → ${v.producedIn.st}** (Phase ${v.producedIn.ph}, ${v.producedIn.m} maturity).`,
    );
  if (v.implementedBy.length)
    out.push(`Implements: ${v.implementedBy.join(", ")}.`);
  if (a) {
    out.push("");
    out.push(`**Why this activity matters.** ${a.why}`);
    if (a.what) out.push(`**What it produces.** ${a.what}`);
  }
  out.push("");

  // ---- the device ----------------------------------------------------------
  out.push("## This device");
  out.push(
    v.device.modules.length
      ? `${v.device.modules.join(" · ")}${v.device.route ? ` · EU route: ${v.device.route}` : ""}. Write for THIS device, not a generic one.`
      : "No device profile set yet — keep the document general and mark anything device-specific as [[NEEDS INPUT: …]].",
  );
  out.push("");

  // ---- before you write ----------------------------------------------------
  out.push("## Before you write");
  out.push(
    `- Check whether **${v.doc.id}** already exists in \`00_Controlled/\`. If it does, draft a *revision* that preserves what is still valid and marks what changed — never silently rewrite something they have been operating under.`,
  );
  out.push(
    "- Read one or two existing controlled documents first and match their voice, their role titles and their device name.",
  );
  if (v.inputs.length) {
    out.push("- These are inputs to this document and should already exist:");
    out.push(bullets(v.inputs.map((d) => `${d.id} — ${d.title}`), "  - "));
  }
  if (v.siblings.length) {
    out.push(
      `- Drafted alongside this one (don't duplicate their content): ${v.siblings.map((d) => d.id).join(", ")}.`,
    );
  }
  out.push("");

  // ---- the lean bar --------------------------------------------------------
  if (a?.leanBar.length) {
    out.push("## The lean bar — your acceptance criteria");
    out.push(
      "Draft to exactly this. Anything beyond it goes in your summary as a note for later, not into the document. A three-page procedure they follow beats a forty-page one they do not.",
    );
    out.push("");
    out.push(bullets(a.leanBar));
    out.push("");
  }

  // ---- the skeleton contract ----------------------------------------------
  const c = v.contract;
  out.push("## The skeleton contract — non-negotiable");
  out.push(
    `- Title line, exactly: \`${c.h1Text}\``,
  );
  if (c.outline.length) {
    // Text is compared whitespace-collapsed, because HTML renders it that way —
    // so the corpus's double space after a number is a convention, not a
    // contract, and claiming otherwise would fail drafts over a difference
    // nobody can see. What IS enforced is the wording, level and order.
    out.push(
      "- Exactly these headings, at these levels, in this order — same wording, same numbering, nothing added or removed:",
    );
    out.push(bullets(c.outline.map((o) => `\`<${o.tag}>\` ${o.text}`), "  - "));
  }
  out.push(
    `- **Delete** every \`<p class="guidance">\`, the \`.manual-banner\`, and the whole \`<table class="manual">\`. Removing the tag but keeping the words is also a failure.`,
  );
  out.push(
    "- Allowed tags: `h1 h2 h3 p div table thead tbody tr td th br b`. No `<ul>`, no `<li>`, no `<a>`, no `<style>`. Bullets inside a cell are `• text<br>• text`.",
  );
  out.push(
    "- Allowed classes: `doc-title`, `headerband`, `grid`, `grid reg`, `tscroll`, `emptyreg`. Nothing else is styled.",
  );
  out.push("- Never emit a bare `&` — write `&amp;`.");
  if (c.hasHeaderband) {
    out.push(
      `- Header band rows, in this order: ${c.headerbandRows.map((r) => `\`${r.label}\``).join(", ")}. Fill them so:`,
    );
    out.push("  - `Document ID`, `Title` and `Module` are copied from above — never altered.");
    out.push("  - `Version` is `0.1-DRAFT`. Never `1.0`; issuing a controlled version is a human act.");
    out.push(
      "  - `Effective date` is `[[NEEDS INPUT: approval date]]`. **Never a date.** This document has not been approved, so there is no date to know.",
    );
    out.push("  - Any role field is a role title, never a person's name.");
  }
  out.push("");

  // ---- fill points ---------------------------------------------------------
  const fills = Object.entries(c.placeholders);
  if (fills.length) {
    out.push("## Fill points in this document");
    out.push(
      bullets(
        fills.map(([token, n]) => {
          const how =
            token === "[ ]"
              ? v.fillMode === "scaffold"
                ? "**leave every one untouched**"
                : "replace with real content, or `n/a` plus a reason"
              : token === "[YYYY-MM-DD]"
                ? "`[[NEEDS INPUT: approval date]]` — never a date"
                : token === "[01]"
                  ? "`0.1-DRAFT`"
                  : token === "[Organisation]"
                    ? "the company's name"
                    : token.includes("role") || token.includes("Role")
                      ? "a role title, never a person"
                      : "replace, or mark `[[NEEDS INPUT: …]]`";
          return `\`${token}\` × ${n} → ${how}`;
        }),
      ),
    );
    out.push("");
  }

  // ---- clauses -------------------------------------------------------------
  if (a?.clauses.length) {
    out.push("## Clauses you may cite");
    out.push(
      bullets(a.clauses.map((cm) => `**${cm.std}** — ${cm.refs.join(", ")}`)),
    );
    out.push("");
    out.push(
      "Citing anything outside this list fails validation. If you cannot cite a requirement, say so rather than asserting it.",
    );
    out.push("");
  }

  // ---- watch-outs ----------------------------------------------------------
  if (a?.tips.length) {
    out.push("## Watch-outs from practitioners");
    out.push(bullets(a.tips));
    out.push("");
  }

  if (a?.records.length) {
    out.push("## Records this activity should end up with");
    out.push(bullets(a.records));
    out.push("");
  }

  // ---- the finish ----------------------------------------------------------
  out.push("## When you're done");
  out.push(
    "1. `validate_draft` — fix every error, repeat until it passes. Do not save a draft that fails.",
  );
  out.push("2. `save_draft` — it lands in `20_Drafts/` and is reported to the workspace.");
  out.push("3. `log_open_questions` — every `[[NEEDS INPUT: …]]` gets an entry.");
  out.push(
    "4. `update_progress` — `In progress`, and tick only the tasks genuinely done. Never `Done`.",
  );

  return out.join("\n");
}
