"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Surfaces the outcome query-params that routes emit (redeem/invite/download/
// error) as a dismissible banner. Without this, those redirects were silent
// dead-ends. Dismissing strips the param from the URL so it doesn't reappear.
type Tone = "ok" | "attn";
const MESSAGES: Record<string, Record<string, { tone: Tone; text: string }>> = {
  redeem: {
    ok: { tone: "ok", text: "Access code applied - your plan is now active." },
    notadmin: {
      tone: "attn",
      text: "Only an organisation admin can redeem an access code.",
    },
    invalid: {
      tone: "attn",
      text: "That access code is invalid, expired, or already used.",
    },
  },
  invite: {
    invalid: {
      tone: "attn",
      text: "That invitation link is invalid or has expired. Ask your admin for a fresh one.",
    },
  },
  download: {
    locked: {
      tone: "attn",
      text: "Document downloads are included with full access.",
    },
    unavailable: {
      tone: "attn",
      text: "There is no downloadable file for this document yet.",
    },
    error: {
      tone: "attn",
      text: "Sorry, the download couldn't be prepared. Please try again.",
    },
  },
  error: {
    callback: { tone: "attn", text: "We couldn't complete sign-in. Please try again." },
    confirm: {
      tone: "attn",
      text: "That confirmation link is invalid or has expired. Sign in or request a new one.",
    },
  },
};

function FlashInner({ className }: { className: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  let hitKey = "";
  let entry: { tone: Tone; text: string } | undefined;
  for (const key of Object.keys(MESSAGES)) {
    const val = params.get(key);
    if (val && MESSAGES[key][val]) {
      hitKey = key;
      entry = MESSAGES[key][val];
      break;
    }
  }
  if (!entry) return null;

  const dismiss = () => {
    const p = new URLSearchParams(params.toString());
    p.delete(hitKey);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const ok = entry.tone === "ok";
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-sm text-ink ${
        ok ? "border-ok" : "border-coral"
      } ${className}`}
    >
      <span>
        <b className={ok ? "text-ok" : "text-coral"}>{ok ? "✓ " : "! "}</b>
        {entry.text}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded px-1 leading-none text-muted transition hover:text-ink"
      >
        {"×"}
      </button>
    </div>
  );
}

export function FlashNotice({ className = "" }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <FlashInner className={className} />
    </Suspense>
  );
}
