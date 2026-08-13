// The setup self-check — ONE implementation, reachable two ways.
//
// docs/agentic/BUILD.md defined init and doctor as CLI commands. On the primary
// path there is no terminal: a QA manager who installed a desktop extension
// cannot run `npx … doctor`, and the whole point of that slice is "purchase to
// first draft without a support call". So both are also MCP tools, sharing this
// code. The customer types "check my setup" and the model calls it.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { RskError, type Client } from "./client.ts";
import { CONTROLLED, DRAFTS, FACTS_FILE, syncWarnings } from "./qms.ts";

export type CheckState = "ok" | "warn" | "fail";
export type Check = { name: string; state: CheckState; detail: string };

export type DoctorReport = {
  ok: boolean;
  checks: Check[];
  workspace?: { id: string; name: string; plan: string };
};

export async function runDoctor(opts: {
  client: Client;
  root: string;
  apiKeyPresent: boolean;
  version: string;
}): Promise<DoctorReport> {
  const checks: Check[] = [];
  const add = (name: string, state: CheckState, detail: string) =>
    checks.push({ name, state, detail });

  // ---- the folder ---------------------------------------------------------
  const missing = [DRAFTS, CONTROLLED].filter((d) => !existsSync(join(opts.root, d)));
  if (missing.length)
    add(
      "QMS folder",
      "fail",
      `${opts.root} is not set up (missing ${missing.join(", ")}). Run init, or ask me to "set up my QMS folder".`,
    );
  else add("QMS folder", "ok", opts.root);

  if (existsSync(join(opts.root, FACTS_FILE)))
    add("Facts file", "ok", `${FACTS_FILE} present`);
  else
    add(
      "Facts file",
      "warn",
      `${FACTS_FILE} is missing — I will have to ask for the device name and roles again each session.`,
    );

  for (const w of syncWarnings(opts.root)) add(`Sync (${w.kind})`, "warn", w.message);

  // ---- the key ------------------------------------------------------------
  if (!opts.apiKeyPresent) {
    add("API key", "fail", "RSK_API_KEY is not set. Create a key on the Agent page and paste it into the extension settings.");
    return { ok: false, checks };
  }

  // ---- the connection -----------------------------------------------------
  try {
    const next = (await opts.client.nextWork()) as {
      workspace?: { id: string; name: string; plan: string };
      progress?: { inScope: number; done: number; percent: number };
      currentPhase?: { n: number; name: string };
    };
    add("Connection", "ok", `Reached ${opts.client.baseUrl}`);
    if (next.workspace)
      add(
        "Workspace",
        "ok",
        `${next.workspace.name} (${next.workspace.plan})${
          next.progress ? ` · ${next.progress.done}/${next.progress.inScope} activities done` : ""
        }`,
      );

    // Templates are a separate grant, and its absence is the most likely
    // surprise: a key minted before that scope existed reads the plan happily
    // and then 403s the moment drafting starts.
    try {
      await opts.client.template("DOC-SOP-01");
      add("Document templates", "ok", "This key can fetch templates.");
    } catch (e) {
      if (e instanceof RskError && e.status === 403)
        add(
          "Document templates",
          "fail",
          'This key cannot fetch templates, so it cannot draft anything. Create a new key with "Let the agent fetch document templates" ticked.',
        );
      else if (e instanceof RskError && e.status === 404)
        add("Document templates", "ok", "Scope granted (sample document not in this device's profile).");
      else
        add("Document templates", "warn", e instanceof Error ? e.message : String(e));
    }

    // Reporting is a fourth grant, and its absence is quiet in the worst way:
    // drafting works perfectly and nothing ever appears in the workspace, so
    // the customer concludes the product is broken rather than the key.
    //
    // Probed with ok:false deliberately. That is the one request the endpoint
    // refuses on content grounds AFTER checking the scope, so 403 and 422
    // separate "you may not report" from "you may, and this particular report
    // was rejected" — without writing a row. Costs one write-budget unit per
    // doctor run out of 1000/day.
    try {
      await opts.client.reportDraft("DOC-SOP-01", {
        path: "20_Drafts/_probe/DOC-SOP-01.html",
        bytes: 0,
        ok: false as unknown as true,
        warnings: 0,
        openQuestions: 0,
      });
      add("Draft reporting", "warn", "Unexpected success on a probe that should be refused.");
    } catch (e) {
      if (e instanceof RskError && e.status === 422)
        add("Draft reporting", "ok", "This key can report drafts to the workspace.");
      else if (e instanceof RskError && e.status === 403)
        add(
          "Draft reporting",
          "fail",
          'This key can draft but cannot tell the workspace it did, so nothing will appear in the library. Create a new key with "Report which documents it has drafted" ticked.',
        );
      else if (e instanceof RskError && e.status === 503)
        add(
          "Draft reporting",
          "warn",
          "This deployment does not have draft reporting yet. Drafting works; the workspace just will not show it.",
        );
      else if (e instanceof RskError && e.status === 404)
        add("Draft reporting", "ok", "Scope granted (sample document not in this device's profile).");
      else add("Draft reporting", "warn", e instanceof Error ? e.message : String(e));
    }
  } catch (e) {
    add(
      "Connection",
      "fail",
      e instanceof RskError ? e.message : e instanceof Error ? e.message : String(e),
    );
  }

  add("Client version", "ok", `rsk-mcp/${opts.version}`);

  return { ok: !checks.some((c) => c.state === "fail"), checks };
}

export function formatReport(r: DoctorReport): string {
  const icon = (s: CheckState) => (s === "ok" ? "✓" : s === "warn" ? "!" : "✗");
  const lines = r.checks.map((c) => `${icon(c.state)} ${c.name}: ${c.detail}`);
  lines.push("");
  lines.push(
    r.ok
      ? "Setup looks good. Ask me what to work on next."
      : "Setup is not complete — fix the ✗ items above.",
  );
  return lines.join("\n");
}
