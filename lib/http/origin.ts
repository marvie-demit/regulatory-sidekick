import { headers } from "next/headers";

/**
 * The origin THIS request arrived on.
 *
 * Every generated link — sign-up confirmation, password reset, invite, redeem,
 * Stripe return — must point back at the host the user is actually using. On a
 * partner subdomain, sending them to the canonical host would drop them
 * somewhere their session doesn't exist, because Supabase auth cookies are
 * host-scoped.
 *
 * Prefers x-forwarded-* (correct behind Vercel and any reverse proxy), then
 * Host. The old copy-pasted version preferred the `Origin` header, which is
 * absent on GET navigations — it worked only because every call site happened to
 * run inside a Server Action.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host =
    h.get("x-forwarded-host")?.split(",")[0].trim() ||
    h.get("host") ||
    "localhost:3100";
  return `${proto}://${host}`;
}
