import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The apex partner subdomains hang off. Kept in step with lib/partners/host.ts,
// which does the same fallback — this file can't import from there because the
// config is evaluated before path aliases resolve.
const APP_HOST =
  process.env.NEXT_PUBLIC_APP_HOST?.trim().toLowerCase() ||
  "regulatory-sidekick.notjustany.tech";

const nextConfig: NextConfig = {
  // Pinned explicitly now that this is an npm workspace root. Next otherwise
  // INFERS the tracing root from lockfile position, and outputFileTracingIncludes
  // below resolves against it — if that inference ever moves, the 275 templates
  // stop shipping to the serverless functions and /library 404s in production
  // while passing locally. Not a failure mode worth leaving to inference.
  outputFileTracingRoot: here,

  // Server code reads content/content.json AND the doc fragments (content/docs/*.html)
  // via fs, so force-include content/** for production (not auto-traced). The docs were
  // moved OUT of public/ so they can't be fetched directly — they're served only
  // through the plan-gated /library/[docId] route.
  outputFileTracingIncludes: {
    "/**": ["./content/**"],
  },

  experimental: {
    serverActions: {
      // This app is Server Actions end to end. Next compares each action
      // request's Origin against the host and 403s on a mismatch, so WITHOUT the
      // wildcard below every form on a partner subdomain fails — including
      // sign-in. This is the single hard blocker for partner hosts.
      //
      // The list is a build-time constant, which is exactly why partners get a
      // subdomain rather than their own domain: one wildcard covers every
      // partner we will ever add, with no redeploy. Never widen this to a bare
      // "*" — that would disable the CSRF check entirely.
      allowedOrigins: [
        APP_HOST,
        `*.${APP_HOST}`,
        "localhost:3100",
        "*.localhost:3100",
      ],
    },
  },
};

export default nextConfig;
