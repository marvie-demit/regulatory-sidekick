// Host -> partner slug. A pure function, deliberately: it runs in the proxy on
// every request, and Next's proxy docs warn against relying on shared modules or
// globals there (no caching, no I/O). Resolving the slug is string work; looking
// the partner up is the app's job, once per request, behind React cache().

/**
 * The apex this deployment serves. Partner subdomains are one label below it.
 * Falls back to the production host so a missing env var degrades to "no partner
 * subdomains" rather than to "every host is a partner".
 */
export function appHost(): string {
  return (
    process.env.NEXT_PUBLIC_APP_HOST?.trim().toLowerCase() ||
    "regulatory-sidekick.notjustany.tech"
  );
}

// Must stay in step with the CHECK constraint on partners.slug (0015) and
// RESERVED_SLUGS in lib/admin/actions.ts. A partner holding `www` or `api` would
// shadow an infrastructure hostname.
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "auth", "mail", "static", "assets",
  "cdn", "docs", "status", "dev", "staging", "test", "support", "help",
]);

const SLUG = /^[a-z0-9][a-z0-9-]{1,30}$/;

/**
 * "acme.regulatory-sidekick.notjustany.tech" -> "acme"
 * the apex itself, "www.", a vercel.app preview, anything else  -> null
 *
 * Local development: "acme.localhost:3100" -> "acme", which Chrome and Firefox
 * resolve without a hosts-file entry.
 */
export function partnerSlugFromHost(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(":")[0].trim().toLowerCase();
  if (!host) return null;

  const apex = appHost().split(":")[0];
  let label: string | null = null;

  if (host === apex || host === `www.${apex}`) return null;
  if (host.endsWith(`.${apex}`)) {
    label = host.slice(0, -(apex.length + 1));
  } else if (host.endsWith(".localhost")) {
    label = host.slice(0, -".localhost".length);
  } else {
    // Unknown host — a preview deployment, the bare vercel.app domain, an IP.
    // Not a partner, and guessing would be worse than not.
    return null;
  }

  // Multi-level (a.b.apex) is not a partner: one label, or nothing.
  if (!label || label.includes(".")) return null;
  if (!SLUG.test(label) || RESERVED_SLUGS.has(label)) return null;
  return label;
}
