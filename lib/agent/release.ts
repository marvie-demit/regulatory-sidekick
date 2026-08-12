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

/** True once the .mcpb bundle is uploaded and /api/agent/bundle exists (Slice 3d). */
export const BUNDLE_AVAILABLE = false;

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
