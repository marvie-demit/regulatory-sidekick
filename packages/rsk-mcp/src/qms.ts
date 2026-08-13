// The customer's QMS folder, and the rules about writing into it.
//
// skills.md rule 3: never create, edit, move or delete anything under
// 00_Controlled/ or 10_Records/ — even to fix something obviously wrong. Here
// that is enforced by construction rather than by instruction: there is exactly
// one writable root, and every path is resolved and then checked for
// containment. A prompt can be argued with; a path check cannot.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const DRAFTS = "20_Drafts";
export const CONTROLLED = "00_Controlled";
export const RECORDS = "10_Records";
export const WORKING = join(DRAFTS, "_working");
export const OPEN_QUESTIONS = "OPEN-QUESTIONS.md";
export const AGENT_LOG = "AGENT-LOG.md";
export const FACTS_FILE = "QMS-FACTS.yml";

export class QmsPathError extends Error {}

/** True when `child` is inside `parent` (or is it). Symlink-aware via resolve. */
export function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel));
}

/**
 * Resolve a path the agent may WRITE to.
 *
 * Deliberately not a `startsWith` on the raw input: "20_Drafts/../00_Controlled"
 * starts with the right prefix and escapes anyway. Resolve first, compare after.
 */
export function resolveWritable(root: string, relPath: string): string {
  const abs = resolve(root, relPath);
  const draftsRoot = resolve(root, DRAFTS);
  if (!isInside(draftsRoot, abs))
    throw new QmsPathError(
      `Refusing to write outside ${DRAFTS}/ — "${relPath}" resolves to ${abs}. ` +
        `${CONTROLLED}/ and ${RECORDS}/ are read-only; report the problem instead of fixing it.`,
    );
  return abs;
}

/** Resolve a path the agent may READ. Anywhere in the QMS folder, nowhere else. */
export function resolveReadable(root: string, relPath: string): string {
  const abs = resolve(root, relPath);
  if (!isInside(resolve(root), abs))
    throw new QmsPathError(`"${relPath}" is outside the QMS folder.`);
  return abs;
}

/** Where a drafted document lands, mirroring the controlled structure. */
export function draftPathFor(docId: string, domain: string): string {
  return join(DRAFTS, domain || "_misc", `${docId}.html`);
}

export function workingNotePath(activityId: string): string {
  return join(WORKING, `${activityId}.md`);
}

/**
 * Write via a temp file in the same directory, then rename.
 *
 * The QMS folder is frequently inside OneDrive or Google Drive, and a sync
 * client will happily upload a file it catches mid-write. Rename is atomic on
 * the same volume, so a reviewer never sees half a document.
 */
export function atomicWrite(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${process.pid}`;
  writeFileSync(tmp, content, "utf8");
  try {
    renameSync(tmp, abs);
  } catch (e) {
    // A sync client can hold a lock briefly. One retry, then give up honestly.
    try {
      renameSync(tmp, abs);
    } catch {
      try {
        unlinkSync(tmp);
      } catch {}
      throw e;
    }
  }
}

export type ScaffoldResult = { created: string[]; existing: string[] };

/** The layout skills.md specifies. Never overwrites anything. */
export function scaffold(root: string, seed?: Record<string, string>): ScaffoldResult {
  const created: string[] = [];
  const existing: string[] = [];
  const dir = (p: string) => {
    const abs = join(root, p);
    if (existsSync(abs)) existing.push(p);
    else {
      mkdirSync(abs, { recursive: true });
      created.push(p);
    }
  };
  const file = (p: string, body: string) => {
    const abs = join(root, p);
    if (existsSync(abs)) existing.push(p);
    else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body, "utf8");
      created.push(p);
    }
  };

  dir(CONTROLLED);
  dir(RECORDS);
  dir(DRAFTS);
  dir(WORKING);

  file(
    OPEN_QUESTIONS,
    "# Open questions\n\nFacts the agent needs from a human. Each entry comes from a\n`[[NEEDS INPUT: …]]` marker left in a draft.\n",
  );
  file(
    AGENT_LOG,
    "# Agent log\n\nAppended each session: what was drafted, what could not be completed, and why.\n",
  );

  const facts = [
    "# Facts reused across every document. Asked once, recorded here.",
    "#",
    "# NEVER put approval dates, signatures or results in this file. Those belong",
    "# to the moment they actually happen, not to a config file — one invented",
    "# date here would quietly contaminate every document that follows.",
    "",
    `organisation: ${seed?.organisation ?? ""}`,
    `country: ${seed?.country ?? ""}`,
    "device:",
    "  name:",
    "  version:",
    "  intended_purpose:",
    "roles: # ROLE TITLES, never a person's name",
    "  management_representative:",
    "document_control:",
    "  location:",
    "",
  ].join("\n");
  file(FACTS_FILE, facts);

  return { created, existing };
}

// ---------------------------------------------------------------------------
// Sync-folder hazards. We build no cloud integration — the folder is a plain
// path — but a synced folder introduces failure modes that would otherwise
// surface as mysterious bugs, so `doctor` names them.
// ---------------------------------------------------------------------------

export type SyncWarning = { kind: string; message: string };

const SYNC_MARKERS = ["onedrive", "google drive", "googledrive", "dropbox", "icloud"];

export function syncWarnings(root: string): SyncWarning[] {
  const out: SyncWarning[] = [];
  const abs = resolve(root);
  const lower = abs.toLowerCase();

  // Only warn when THIS FOLDER is inside a sync root — not merely because the
  // machine has OneDrive installed. Warning every Windows user about a folder
  // on D:\ is how a diagnostic gets ignored, and then the real warning is
  // ignored with it.
  let provider = SYNC_MARKERS.find((m) => lower.includes(m));
  if (!provider)
    for (const envRoot of [process.env.OneDrive, process.env.OneDriveCommercial])
      if (envRoot && isInside(envRoot, abs)) provider = "OneDrive";

  if (provider) {
    out.push({
      kind: "files-on-demand",
      message:
        `This folder is inside ${provider}. ` +
        "That is fine and often how a reviewer sees the drafts — but mark the QMS folder " +
        '"Always keep on this device". With Files On-Demand a file can appear to exist ' +
        `while not actually being on disk, and ${CONTROLLED}/ is the first thing the agent reads.`,
    });
  }

  // Conflict copies silently create a second draft, and a reviewer can promote
  // the wrong one.
  const conflicts: string[] = [];
  const scan = (dirAbs: string, relDir: string) => {
    if (!existsSync(dirAbs)) return;
    for (const e of readdirSync(dirAbs, { withFileTypes: true })) {
      const rel = join(relDir, e.name);
      if (e.isDirectory()) scan(join(dirAbs, e.name), rel);
      else if (
        /conflicted copy|\(\d+\)\.|\s-\sCopy|\(conflict/i.test(e.name)
      )
        conflicts.push(rel);
    }
  };
  scan(join(root, DRAFTS), DRAFTS);
  if (conflicts.length)
    out.push({
      kind: "conflict-copies",
      message:
        `Sync conflict copies found — a reviewer could promote the wrong one:\n  ` +
        conflicts.slice(0, 10).join("\n  "),
    });

  // Windows' 260-char path limit, minus room for a nested document filename.
  if (process.platform === "win32" && resolve(root).length > 150)
    out.push({
      kind: "long-path",
      message:
        `The QMS folder path is ${resolve(root).length} characters. Windows caps a full path at 260, ` +
        "so deeply nested drafts may fail to write. Consider a shorter root.",
    });

  return out;
}

/** Read a file under the QMS root, or null. */
export function readIfExists(root: string, relPath: string): string | null {
  const abs = resolveReadable(root, relPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) return null;
  return readFileSync(abs, "utf8");
}

/** Shallow listing of a directory under the QMS root. */
export function listDir(root: string, relPath: string): { name: string; dir: boolean }[] {
  const abs = resolveReadable(root, relPath);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .map((e) => ({ name: e.name, dir: e.isDirectory() }))
    .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
}

/** Append a block to OPEN-QUESTIONS.md, replacing any existing block for the doc. */
export function writeOpenQuestions(
  root: string,
  docId: string,
  title: string,
  questions: { question: string; section?: string }[],
): string {
  const abs = resolveReadable(root, OPEN_QUESTIONS);
  const existing = existsSync(abs) ? readFileSync(abs, "utf8") : "# Open questions\n";

  // Parsed into blocks rather than regexed. A regex over the whole file has to
  // express "up to the next ## or end of input", and JS has no \Z — the obvious
  // spelling silently matches a literal Z and appends a duplicate block every
  // run instead of replacing.
  const preamble: string[] = [];
  const blocks: { head: string; body: string[] }[] = [];
  let cur: { head: string; body: string[] } | null = null;
  for (const line of existing.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      if (cur) blocks.push(cur);
      cur = { head: line, body: [] };
    } else if (cur) cur.body.push(line);
    else preamble.push(line);
  }
  if (cur) blocks.push(cur);

  const head = `## ${docId} — ${title}`;
  const body = questions.map(
    (q) => `- [ ] ${q.question}${q.section ? ` (needed: ${q.section})` : ""}`,
  );
  const at = blocks.findIndex((b) => b.head.startsWith(`## ${docId} `));
  if (at >= 0) blocks[at] = { head, body };
  else blocks.push({ head, body });

  const out = [
    preamble.join("\n").trimEnd(),
    "",
    ...blocks.map((b) => [b.head, ...b.body].join("\n").trimEnd() + "\n"),
  ].join("\n");
  atomicWrite(abs, out.trimEnd() + "\n");
  return OPEN_QUESTIONS;
}
