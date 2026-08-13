// QMS-FACTS.yml — facts asked once and reused across all 275 documents.
//
// The category rule, from docs/agentic/SPEC.md §6:
//
//   A · already known      company name, country, device profile   → look it up
//   B · true but unrecorded device name, role holders              → ask ONCE
//   C · not yet true       approval date, signature, test result   → NEVER ask
//
// Category C is the one that bites. "When was this approved?" feels helpful and
// is not: the document has not been approved, so there is no date to learn.
// Asking invites the user to invent one, and an invented value that arrives
// through a question looks sourced.
//
// The deny-list below is a SECOND, independent gate on that rule. The prompt
// states it; this enforces it. Worth the few lines: one fabricated approval date
// persisted here would silently contaminate every document that follows, and
// the validator would never catch it — by then it is a "known fact".

import { parse, stringify } from "yaml";
import { atomicWrite, FACTS_FILE, readIfExists, resolveReadable } from "./qms.ts";

export type Facts = Record<string, unknown>;

/** Key fragments that mean "this is a fact that does not exist yet". */
export const FORBIDDEN_KEY_PATTERNS: RegExp[] = [
  /date/i,
  /signature|signed|signatory/i,
  /approv/i,
  /result|outcome|verdict|pass|fail/i,
  /batch|lot\b|serial/i,
  /effective/i,
  /issued|released/i,
];

export function forbiddenReason(key: string): string | null {
  for (const re of FORBIDDEN_KEY_PATTERNS) {
    if (re.test(key))
      return (
        `"${key}" looks like a fact that has not happened yet. Those never go in ${FACTS_FILE} — ` +
        "they belong to the moment they actually occur. Leave a [[NEEDS INPUT: …]] marker in the document instead."
      );
  }
  return null;
}

/** Flatten nested facts to dotted keys, so the deny-list sees the real name. */
export function flatten(obj: unknown, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v))
        Object.assign(out, flatten(v, key));
      else out[key] = v;
    }
  }
  return out;
}

function setDotted(target: Facts, dotted: string, value: unknown): void {
  const parts = dotted.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!node[p] || typeof node[p] !== "object") node[p] = {};
    node = node[p] as Facts;
  }
  node[parts[parts.length - 1]] = value;
}

export function readFacts(root: string): Facts {
  const raw = readIfExists(root, FACTS_FILE);
  if (!raw) return {};
  try {
    const parsed = parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Facts) : {};
  } catch {
    // A human edits this file. A syntax error must not take the agent down —
    // it should say so and carry on with nothing known.
    return {};
  }
}

/** Only the facts that actually have a value — a scaffolded file is all blanks. */
export function knownFacts(root: string): Record<string, string> {
  const flat = flatten(readFacts(root));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) out[k] = s;
  }
  return out;
}

export type RecordResult = {
  written: string[];
  refused: { key: string; reason: string }[];
};

export function recordFacts(root: string, facts: Record<string, unknown>): RecordResult {
  const written: string[] = [];
  const refused: { key: string; reason: string }[] = [];

  const current = readFacts(root);
  for (const [key, value] of Object.entries(facts)) {
    const reason = forbiddenReason(key);
    if (reason) {
      refused.push({ key, reason });
      continue;
    }
    // A role must be a title, not a person. We cannot detect every name, but
    // the obvious shapes are worth refusing at the door.
    if (/^roles?\./i.test(key) && looksLikeAPersonName(String(value ?? ""))) {
      refused.push({
        key,
        reason: `"${value}" looks like a person's name. Record the ROLE — "Head of Quality" — so the document survives them leaving.`,
      });
      continue;
    }
    setDotted(current, key, value);
    written.push(key);
  }

  if (written.length)
    atomicWrite(resolveReadable(root, FACTS_FILE), serialise(current));

  return { written, refused };
}

function serialise(facts: Facts): string {
  const header = [
    "# Facts reused across every document. Asked once, recorded here.",
    "#",
    "# NEVER put approval dates, signatures or results in this file. Those belong",
    "# to the moment they actually happen, not to a config file.",
    "",
  ].join("\n");
  return header + stringify(facts);
}

const TITLE_WORDS =
  /\b(head|lead|manager|director|officer|engineer|representative|owner|specialist|coordinator|chief|qmr|quality|regulatory|clinical|technical)\b/i;

export function looksLikeAPersonName(v: string): boolean {
  const s = v.trim();
  if (!s || TITLE_WORDS.test(s)) return false;
  // "Anna Schmidt", "J. Smith", "Dr Anna Schmidt"
  return (
    /^(?:Dr|Mr|Ms|Mrs|Prof)\.?\s+[A-Z]/.test(s) ||
    /^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(s) ||
    /^[A-Z]\.\s?[A-Z][a-z]+$/.test(s)
  );
}
