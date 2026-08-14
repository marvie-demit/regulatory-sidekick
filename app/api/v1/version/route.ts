import { NextResponse } from "next/server";
import { CLIENT_LATEST, CLIENT_MINIMUM } from "@/lib/agent/release";

export const dynamic = "force-dynamic";

// GET /api/v1/version — what the installed client should be running.
//
// Deliberately UNAUTHENTICATED, unlike everything else under /api/v1. Two
// reasons, and they both come from what this endpoint is for:
//
//  • It is the kill switch. If a release turns out to falsify records, we raise
//    `minimum` and every client below it must stop — including one whose key
//    has lapsed or been revoked. Gating the stop signal behind a working key
//    means the clients most likely to be neglected are the ones that never
//    hear it.
//  • It costs nothing to leak. Two version numbers we publish anyway.
//
// It also must not consume the write budget or an audit row: a client polls
// this on startup, and a diagnostic that eats a customer's quota is a
// diagnostic they will be told to turn off.
export function GET() {
  return NextResponse.json(
    {
      latest: CLIENT_LATEST,
      minimum: CLIENT_MINIMUM,
      package: "@notjustany/regulatory-sidekick-mcp",
    },
    // Short cache: long enough that a fleet of clients does not hammer it,
    // short enough that raising `minimum` takes effect within the hour.
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
