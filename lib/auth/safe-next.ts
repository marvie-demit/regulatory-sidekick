// Sanitises a `?next=` redirect target. Only same-origin relative paths are
// allowed; protocol-relative ("//evil.com") and backslash ("/\\evil.com")
// forms — which browsers resolve to an EXTERNAL host — are rejected. Used by
// the auth server actions and the /auth/callback + /auth/confirm handlers.
export function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "";
  return /^\/(?![/\\])/.test(n) ? n : "/dashboard";
}
