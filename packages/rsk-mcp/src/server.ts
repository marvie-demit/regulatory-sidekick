// Regulatory Sidekick MCP server.
// (No shebang here — scripts/bundle.mjs adds it, so it stays on line 1.)
//
//   regulatory-sidekick-mcp            stdio server (what a client spawns)
//   regulatory-sidekick-mcp init       scaffold the QMS folder
//   regulatory-sidekick-mcp doctor     check the setup
//
// stdio, deliberately: the key is read from the environment of a process the
// customer owns and never crosses a network boundary it doesn't have to, the
// server needs local filesystem access anyway, and no inbound listener means no
// new attack surface on a manufacturer's machine — which will come up in their
// own supplier assessment of you.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { validateFragment } from "@notjustany/doc-contract";

import { createClient, DEFAULT_BASE_URL, RskError, type TemplateResponse } from "./client.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";
import { formatReport, runDoctor } from "./doctor.ts";
import { knownFacts, recordFacts } from "./facts.ts";
import {
  DRAFTS,
  OPEN_QUESTIONS,
  atomicWrite,
  draftPathFor,
  listDir,
  readIfExists,
  resolveWritable,
  scaffold,
  syncWarnings,
  workingNotePath,
  QmsPathError,
} from "./qms.ts";

declare const __RSK_VERSION__: string;
const VERSION = typeof __RSK_VERSION__ === "string" ? __RSK_VERSION__ : "0.0.0-dev";

const API_KEY = process.env.RSK_API_KEY ?? "";
const BASE_URL = process.env.RSK_BASE_URL?.trim() || DEFAULT_BASE_URL;
const ROOT = process.env.RSK_QMS_ROOT?.trim() || process.cwd();

const client = createClient({ apiKey: API_KEY, baseUrl: BASE_URL, version: VERSION });

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));
const fail = (s: string) => ({ ...text(s), isError: true as const });

/** Turn any thrown thing into prose the model can act on. */
function asMessage(e: unknown): string {
  if (e instanceof RskError || e instanceof QmsPathError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

// Templates are cached per process so validate_draft and save_draft do not
// re-fetch (and re-audit) the blank the model just looked at.
const templates = new Map<string, TemplateResponse>();
async function getTemplate(docId: string): Promise<TemplateResponse> {
  const hit = templates.get(docId);
  if (hit) return hit;
  const t = await client.template(docId);
  templates.set(docId, t);
  return t;
}

// ---------------------------------------------------------------------------

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "regulatory-sidekick", version: VERSION },
    { instructions: SYSTEM_PROMPT },
  );

  // ---- the plan -----------------------------------------------------------
  server.registerTool(
    "get_next_work",
    {
      title: "What to work on next",
      description:
        "Where this workspace stands and what is startable now. Work `ready` top-down — the order encodes real dependencies. `blocked` is informational; do not start it.",
      inputSchema: {},
    },
    async () => {
      try {
        return json(await client.nextWork());
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "get_activity_brief",
    {
      title: "How to do one activity",
      description:
        "Why it matters, what it produces, the lean bar (your acceptance criteria), the clause map, its documents, and `mode` — author, assist or handoff. Read `mode` before writing anything.",
      inputSchema: { activityId: z.string().describe('e.g. "RSK.plan"') },
    },
    async ({ activityId }) => {
      try {
        return json(await client.activity(activityId));
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "update_progress",
    {
      title: "Report progress",
      description:
        "Set an activity to In progress and tick sub-tasks you genuinely completed. Done and N-A are not available: closing an activity is a human sign-off.",
      inputSchema: {
        activityId: z.string(),
        // Done / N-A are absent from the schema so the model cannot express
        // them. The server enforces it too — this is an affordance, not the
        // control.
        status: z.enum(["Not started", "In progress"]).optional(),
        tasks: z
          .record(z.string(), z.boolean())
          .optional()
          .describe('task index → done, e.g. {"0": true, "3": true}'),
      },
    },
    async ({ activityId, status, tasks }) => {
      try {
        return json(await client.updateProgress(activityId, { status, tasks }));
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  // ---- templates ----------------------------------------------------------
  server.registerTool(
    "get_document_template",
    {
      title: "Get a blank template and its drafting prompt",
      description:
        "The blank fragment, the skeleton contract derived from it, and the prompt for drafting this specific document. Read the prompt before writing.",
      inputSchema: { docId: z.string().describe('e.g. "RSK-SOP-01"') },
    },
    async ({ docId }) => {
      try {
        const t = await getTemplate(docId);
        return json({
          id: t.id,
          title: t.title,
          fillMode: t.fillMode,
          skeleton: t.skeleton,
          contract: t.contract,
          allowedClauses: t.allowedClauses,
          prompt: t.prompt,
          html: t.html,
        });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  // ---- validate / save ----------------------------------------------------
  server.registerTool(
    "validate_draft",
    {
      title: "Check a draft against its skeleton",
      description:
        "Run before saving. Returns every rule the draft breaks. Fix them all — save_draft refuses anything that fails.",
      inputSchema: {
        docId: z.string(),
        html: z.string().describe("the complete fragment"),
        openQuestions: z
          .array(z.string())
          .optional()
          .describe("questions you will log, so NEEDS INPUT markers can be matched"),
      },
    },
    async ({ docId, html, openQuestions }) => {
      try {
        const t = await getTemplate(docId);
        const r = validateFragment({
          docId,
          skeleton: t.html,
          draft: html,
          fillMode: t.fillMode,
          title: t.title,
          module: t.module,
          allowedClauses: t.allowedClauses,
          openQuestions,
        });
        return json({
          ok: r.ok,
          errors: r.issues.filter((i) => i.severity === "error"),
          warnings: r.issues.filter((i) => i.severity === "warning"),
          stats: r.stats,
        });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "save_draft",
    {
      title: "Save a validated draft",
      description:
        "Writes to 20_Drafts/ and reports the draft to the workspace (path and counts only — the document text never leaves this machine). Refuses anything that fails validation.",
      inputSchema: {
        docId: z.string(),
        html: z.string(),
        openQuestions: z.array(z.string()).optional(),
      },
    },
    async ({ docId, html, openQuestions }) => {
      try {
        const t = await getTemplate(docId);
        const r = validateFragment({
          docId,
          skeleton: t.html,
          draft: html,
          fillMode: t.fillMode,
          title: t.title,
          module: t.module,
          allowedClauses: t.allowedClauses,
          openQuestions,
        });
        if (!r.ok)
          return fail(
            "Not saved — the draft does not pass its own contract:\n" +
              r.issues
                .filter((i) => i.severity === "error")
                .map((i) => `· [${i.rule}] ${i.message}`)
                .join("\n"),
          );

        const rel = draftPathFor(docId, t.domain);
        const abs = resolveWritable(ROOT, rel);
        atomicWrite(abs, html);
        return json({
          saved: rel,
          bytes: html.length,
          warnings: r.issues.filter((i) => i.severity === "warning").length,
          note: "Reported to the workspace as metadata only once the draft registry ships.",
        });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "save_working_note",
    {
      title: "Save a working note (assist mode)",
      description:
        "For an activity that produces no controlled document. Markdown, not HTML — a fragment exists only where there is a skeleton to validate it against.",
      inputSchema: { activityId: z.string(), markdown: z.string() },
    },
    async ({ activityId, markdown }) => {
      try {
        const rel = workingNotePath(activityId);
        atomicWrite(resolveWritable(ROOT, rel), markdown);
        return json({ saved: rel, bytes: markdown.length });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  // ---- the QMS folder -----------------------------------------------------
  server.registerTool(
    "read_qms",
    {
      title: "Read the company's own QMS folder",
      description:
        "List a directory or read a file. Read-only, always: 00_Controlled/ and 10_Records/ are theirs. Use it to match their voice and to check whether a document already exists.",
      inputSchema: {
        path: z.string().optional().describe('relative, e.g. "00_Controlled"'),
      },
    },
    async ({ path }) => {
      try {
        const rel = path ?? ".";
        const body = readIfExists(ROOT, rel);
        if (body !== null) return text(body.slice(0, 40_000));
        return json({ path: rel, entries: listDir(ROOT, rel) });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "list_drafts",
    {
      title: "What is already drafted",
      description:
        "Check before drafting, so a second session does not redo work a reviewer has already started on.",
      inputSchema: {},
    },
    async () => {
      try {
        const out: string[] = [];
        const walk = (rel: string) => {
          for (const e of listDir(ROOT, rel)) {
            const child = join(rel, e.name);
            if (e.dir) walk(child);
            else if (e.name.endsWith(".html") || e.name.endsWith(".md"))
              out.push(child.split("\\").join("/"));
          }
        };
        walk(DRAFTS);
        return json({ drafts: out });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "log_open_questions",
    {
      title: "Log the questions a human must answer",
      description:
        "Every [[NEEDS INPUT: …]] marker in a draft gets an entry. This list is the deliverable a reviewer actually works from — hunting placeholders across twenty documents is the drudgery they bought you to avoid.",
      inputSchema: {
        docId: z.string(),
        title: z.string(),
        questions: z.array(
          z.object({ question: z.string(), section: z.string().optional() }),
        ),
      },
    },
    async ({ docId, title, questions }) => {
      try {
        const { writeOpenQuestions } = await import("./qms.ts");
        return json({ updated: writeOpenQuestions(ROOT, docId, title, questions) });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  // ---- facts --------------------------------------------------------------
  server.registerTool(
    "get_facts",
    {
      title: "What is already known about this company and device",
      description:
        "Read before asking anything. Facts already here must never be asked for again. Approval dates, signatures and results are NOT facts — they have not happened yet and stay [[NEEDS INPUT: …]] markers.",
      inputSchema: {},
    },
    async () => json({ known: knownFacts(ROOT), file: "QMS-FACTS.yml" }),
  );

  server.registerTool(
    "record_facts",
    {
      title: "Record facts the user just gave you",
      description:
        "Dotted keys, e.g. {\"device.name\": \"Acme Insulin Pump\"}. Recorded once and reused across all 275 documents. Keys that name something which has not happened yet — dates, signatures, results — are refused.",
      inputSchema: { facts: z.record(z.string(), z.string()) },
    },
    async ({ facts }) => {
      try {
        const r = recordFacts(ROOT, facts);
        return json(r);
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  // ---- setup --------------------------------------------------------------
  server.registerTool(
    "init_qms_folder",
    {
      title: "Set up the QMS folder",
      description:
        "Creates 00_Controlled/, 10_Records/, 20_Drafts/, OPEN-QUESTIONS.md and QMS-FACTS.yml. Never overwrites anything.",
      inputSchema: {},
    },
    async () => {
      try {
        const r = scaffold(ROOT);
        return json({ root: ROOT, ...r, warnings: syncWarnings(ROOT) });
      } catch (e) {
        return fail(asMessage(e));
      }
    },
  );

  server.registerTool(
    "run_doctor",
    {
      title: "Check the setup",
      description:
        "Verifies the folder, the key, the connection and the permissions, and explains any failure in plain language. Run this when anything is not working.",
      inputSchema: {},
    },
    async () => {
      const r = await runDoctor({
        client,
        root: ROOT,
        apiKeyPresent: !!API_KEY,
        version: VERSION,
      });
      return text(formatReport(r));
    },
  );

  return server;
}

// ---------------------------------------------------------------------------
// CLI: the secondary path. On the primary path (a desktop extension) there is
// no terminal, which is why init and doctor are also tools above.
// ---------------------------------------------------------------------------

async function main() {
  const cmd = process.argv[2];

  if (cmd === "init") {
    const r = scaffold(ROOT);
    console.log(`QMS folder: ${ROOT}`);
    r.created.forEach((p) => console.log(`  created  ${p.split("\\").join("/")}`));
    r.existing.forEach((p) => console.log(`  exists   ${p.split("\\").join("/")}`));
    syncWarnings(ROOT).forEach((w) => console.log(`\n!  ${w.message}`));
    console.log("\nNext: paste your key, then ask your assistant what to work on.");
    return;
  }

  if (cmd === "doctor") {
    const r = await runDoctor({
      client,
      root: ROOT,
      apiKeyPresent: !!API_KEY,
      version: VERSION,
    });
    console.log(formatReport(r));
    process.exitCode = r.ok ? 0 : 1;
    return;
  }

  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }

  // Default: serve. Never write to stdout here — it is the transport.
  if (!API_KEY)
    console.error(
      "RSK_API_KEY is not set. The server will start, but every call will fail until it is.",
    );
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error(asMessage(e));
  process.exit(1);
});

export { buildServer };
