import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { partnerSlugFromHost } from "@/lib/partners/host";
import { PARTNER_SLUG_HEADER } from "@/lib/partners/brand";

// Renamed from middleware.ts: the `middleware` file convention is deprecated in
// this Next version and the build warns about it. Proxy runs on the Node.js
// runtime (the `runtime` option is unavailable here and edge is unsupported).
// Exactly one export — a named `proxy` — per the file convention.

export async function proxy(request: NextRequest) {
  const slug = partnerSlugFromHost(request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);
  // ALWAYS write, never trust. Without the delete, `curl -H 'x-rs-partner-slug:
  // acme'` against the canonical host would impersonate a tenant — the same
  // class of bug as trusting an inbound x-forwarded-* header.
  //
  // Even so, this header must never grant anything. It selects a colour scheme.
  // Authorisation is partner_members + RLS, so assume it is attacker-controlled
  // and nothing changes.
  requestHeaders.delete(PARTNER_SLUG_HEADER);
  if (slug) requestHeaders.set(PARTNER_SLUG_HEADER, slug);

  return updateSession(request, requestHeaders);
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|docs/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
