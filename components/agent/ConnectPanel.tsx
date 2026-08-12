import { CopyBlock } from "@/components/ui/Copy";
import { MCP_AVAILABLE, BUNDLE_AVAILABLE, MCP_PACKAGE } from "@/lib/agent/release";

// The setup instructions. Server-rendered so `baseUrl` is the host the customer
// is actually on — AGENT_API.md documents that the wrong host 308-redirects and
// strips the Authorization header, turning a valid key into "Missing bearer
// token". Copying URLs from here is therefore always safe.

const stepNum =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-bold text-white";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className={stepNum}>{n}</span>
      <div className="min-w-0 flex-1 pb-5">
        <h4 className="font-display text-base font-semibold text-teal-900">
          {title}
        </h4>
        {children ? <div className="mt-1.5">{children}</div> : null}
      </div>
    </li>
  );
}

function Soon() {
  return (
    <span className="ml-2 rounded-full bg-cream2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a5a2b]">
      Coming soon
    </span>
  );
}

export function ConnectPanel({ baseUrl }: { baseUrl: string }) {
  return (
    <div className="flex flex-col gap-6">
      {/* --- primary path: the desktop bundle --- */}
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-teal-900">
          Claude Desktop {BUNDLE_AVAILABLE ? null : <Soon />}
        </h3>
        <p className="mt-1 text-sm text-muted">
          The simplest route — no terminal, and no separate Node install:
          Claude Desktop ships its own.
        </p>
        <ol className="mt-4 flex flex-col">
          <Step n={1} title="Create a key above">
            <p className="text-sm text-muted">
              It&apos;s shown once. Leave the tab open — you&apos;ll paste it in
              step 3.
            </p>
          </Step>
          <Step n={2} title="Download and open the extension">
            <p className="text-sm text-muted">
              Double-click the file. Claude Desktop shows what it can access
              before anything is installed.
            </p>
          </Step>
          <Step n={3} title="Paste your key and pick your QMS folder">
            <p className="text-sm text-muted">
              The key is stored in your operating system&apos;s keychain, not in
              a file. The folder is where drafts will be written — it can live
              in OneDrive or Google Drive if you want your reviewer to see them.
            </p>
          </Step>
          <Step n={4} title="Ask Claude what to work on next">
            <p className="text-sm text-muted">
              &ldquo;What should I work on next in our QMS?&rdquo;
            </p>
          </Step>
        </ol>
        {!BUNDLE_AVAILABLE ? (
          <p className="rounded-lg border border-line bg-tint px-3 py-2 text-xs text-muted">
            The one-click extension is being finished. In the meantime the API
            below is live — point any MCP client or your own integration at it
            with a key from above.
          </p>
        ) : null}
      </section>

      {/* --- secondary path: Claude Code --- */}
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-teal-900">
          Claude Code {MCP_AVAILABLE ? null : <Soon />}
        </h3>
        <p className="mt-1 text-sm text-muted">
          One command, run from your QMS folder. Creating a key above prints it
          with your key already filled in.
        </p>
        <div className="mt-3">
          <CopyBlock
            value={`claude mcp add --env RSK_API_KEY=rsk_… --scope local --transport stdio \\
  regulatory-sidekick -- npx -y ${MCP_PACKAGE}`}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          <code className="font-mono">--scope local</code> keeps the key in your
          own Claude config rather than writing it into the QMS folder — so it
          is never synced to cloud storage and never committed to a repository.
        </p>
      </section>

      {/* --- always live: the REST API --- */}
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-teal-900">
          Any other client
        </h3>
        <p className="mt-1 text-sm text-muted">
          The API is live today. Send{" "}
          <code className="font-mono text-xs">Authorization: Bearer rsk_…</code>{" "}
          — the key identifies the workspace on its own, so never send a
          workspace ID.
        </p>
        <div className="mt-3">
          <CopyBlock
            value={`GET   ${baseUrl}/api/v1/next
GET   ${baseUrl}/api/v1/activities/{id}
PATCH ${baseUrl}/api/v1/activities/{id}
      { "status": "In progress" }
      { "tasks": { "0": true, "1": true } }`}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          An agent can open work but never close it —{" "}
          <code className="font-mono">Done</code> and{" "}
          <code className="font-mono">N-A</code> are rejected. Closing an
          activity stays a person&apos;s decision, here in the app.
        </p>
      </section>
    </div>
  );
}
