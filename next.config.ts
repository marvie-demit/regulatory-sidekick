import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server code reads content/content.json AND the doc fragments (content/docs/*.html)
  // via fs, so force-include content/** for production (not auto-traced). The docs were
  // moved OUT of public/ so they can't be fetched directly — they're served only
  // through the plan-gated /library/[docId] route.
  outputFileTracingIncludes: {
    "/**": ["./content/**"],
  },
};

export default nextConfig;
