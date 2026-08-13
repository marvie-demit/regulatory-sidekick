// What is actually available to a customer RIGHT NOW.
//
// The REST API (/api/v1) is live and documented — anyone can point a client at
// it today with a key. The MCP server package and the Claude Desktop bundle are
// built in later slices (see docs/agentic/BUILD.md). Until each is genuinely
// published, the Agent page says "coming" instead of printing an install command
// that 404s, which is the kind of small lie that costs a support ticket and a
// bit of trust.
//
// Flipping each flag is the last step of the slice that ships it.

/** npm package that provides the MCP server (BUILD.md Slice 3). */
export const MCP_PACKAGE = "@notjustany/regulatory-sidekick-mcp";

/** True once MCP_PACKAGE is published to npm. */
export const MCP_AVAILABLE = false;

/**
 * True once the .mcpb bundle is uploaded and /api/agent/bundle exists.
 *
 * Uploaded 2026-08-13: regulatory-sidekick-0.1.0.mcpb, sha256 8d34a9d1…, to the
 * private `releases` bucket. Verified byte-identical through a signed URL, and
 * unreachable without one.
 *
 * NOT yet installed on a clean machine. Everything verified is structural — a
 * valid zip, a correct manifest, a byte-identical server that runs when
 * extracted. The premise it rests on, that Claude Desktop ships its own Node so
 * a customer needs no runtime, comes from Anthropic's documentation rather than
 * from watching it work. See OPERATIONS.md.
 */
export const BUNDLE_AVAILABLE = true;

/**
 * Version policy for installed clients.
 *
 * There is no auto-updater, deliberately: a binary that silently replaces
 * itself on the machine that writes a manufacturer's QMS is a question in their
 * supplier assessment nobody wants to answer. Staleness is made VISIBLE instead
 * — the client sends X-RSK-Client on every call, warns below `latest`, and
 * refuses to run below `minimum`.
 *
 * `minimum` is the kill switch for a bad release. Raising it strands every
 * client below it, so it moves only when a version is genuinely unsafe to keep
 * using — a validator bug that let a falsified record through, say. Warning is
 * the normal tool; this is not.
 */
export const CLIENT_LATEST = "0.1.0";
export const CLIENT_MINIMUM = "0.1.0";

/** The object key in the private `releases` bucket. */
export const bundleObject = (version: string) =>
  `regulatory-sidekick-${version}.mcpb`;

/**
 * The one-liner a Claude Code user pastes, run from their QMS folder.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *  • `--scope local` keeps the key in ~/.claude.json keyed to that project —
 *    NOT in a .mcp.json inside the QMS folder. The QMS folder is frequently
 *    inside OneDrive or Google Drive, and .mcp.json is also the file teams
 *    commit; either would leak a live workspace credential.
 *  • `--scope local --transport stdio` must sit between the last `--env` and the
 *    server name. Claude Code reads a name immediately after `--env` as another
 *    KEY=value pair and rejects it — silently, from the user's point of view.
 *
 * RSK_QMS_ROOT is deliberately omitted: the server defaults to its working
 * directory, which is the folder they ran this in. One less thing to paste.
 */
export function claudeCodeCommand(apiKey: string, baseUrl?: string): string {
  const base = baseUrl ? ` --env RSK_BASE_URL=${baseUrl}` : "";
  return (
    `claude mcp add --env RSK_API_KEY=${apiKey}${base}` +
    ` --scope local --transport stdio` +
    ` regulatory-sidekick -- npx -y ${MCP_PACKAGE}`
  );
}
