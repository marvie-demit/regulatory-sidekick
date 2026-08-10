import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes that never require auth.
const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  // Partner staff invites: a logged-out invitee must reach the route handler so
  // it can stash the token before bouncing them to /login.
  "/accept-partner-invite",
  "/redeem",
  "/auth",
  // Legal pages must be reachable without an account — an Impressum behind a
  // login is not an Impressum.
  "/impressum",
  "/privacy",
  // Machine API: authenticated by bearer token inside the route (withAgentAuth),
  // not by a session cookie. Exempt here so an agent gets a JSON 401 instead of
  // an HTML redirect to /login. (/api/docs/* stays session-gated.)
  "/api/v1",
  // Stripe webhook: authenticated by the request signature inside the route.
  // Stripe has no session cookie, so without this exemption every event gets a
  // 307 to /login and silently fails.
  "/api/stripe",
];

function isPublic(path: string) {
  return PUBLIC_PREFIXES.some(
    (p) => path === p || (p !== "/" && path.startsWith(p + "/")),
  );
}

// Route gating is live now that /login exists. (Still no-ops automatically if
// the Supabase env keys are ever absent — see the guard below.)
const GATE_ENABLED = true;

export async function updateSession(
  request: NextRequest,
  // Request headers the proxy wants the app to see (the partner slug). Passed
  // via `NextResponse.next({ request: { headers } })` — NOT `next({ headers })`,
  // which would expose them to the client instead.
  requestHeaders?: Headers,
) {
  const forward = requestHeaders ? { headers: requestHeaders } : undefined;
  const next = () =>
    forward ? NextResponse.next({ request: forward }) : NextResponse.next({ request });

  if (
    !GATE_ENABLED ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return next();
  }

  let supabaseResponse = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Rebuilt here on cookie refresh — must carry the forwarded request
          // headers too, or the partner slug is lost on exactly the requests
          // where Supabase rotates the session.
          supabaseResponse = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between creating the client and this call —
  // it avoids intermittent session loss.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const path = request.nextUrl.pathname;
  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
