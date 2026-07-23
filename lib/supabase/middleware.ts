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
  "/redeem",
  "/auth",
  // Machine API: authenticated by bearer token inside the route (withAgentAuth),
  // not by a session cookie. Exempt here so an agent gets a JSON 401 instead of
  // an HTML redirect to /login. (/api/docs/* stays session-gated.)
  "/api/v1",
];

function isPublic(path: string) {
  return PUBLIC_PREFIXES.some(
    (p) => path === p || (p !== "/" && path.startsWith(p + "/")),
  );
}

// Route gating is live now that /login exists. (Still no-ops automatically if
// the Supabase env keys are ever absent — see the guard below.)
const GATE_ENABLED = true;

export async function updateSession(request: NextRequest) {
  if (
    !GATE_ENABLED ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
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
