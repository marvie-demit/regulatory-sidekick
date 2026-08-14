"use client";

import { useActionState, useEffect } from "react";
import { startAgentSubscription } from "@/lib/billing/actions";

type Res = { error?: string; url?: string };

/**
 * The buy button for the agent add-on.
 *
 * Navigates on success rather than returning a link to click: a checkout URL
 * the customer has to click a second time is a step where demand leaks away,
 * and the action already refuses everything it should before returning one.
 *
 * When no Stripe price is configured this renders the contact route instead of
 * a button that fails on click. A dead button at the moment someone decides to
 * buy is worse than an honest mailto.
 */
export function SubscribeButton({
  buyable,
  contact,
  orgName,
}: {
  buyable: boolean;
  contact: string;
  orgName: string;
}) {
  const [state, act, pending] = useActionState<Res, FormData>(
    startAgentSubscription,
    {},
  );

  useEffect(() => {
    if (state.url) window.location.href = state.url;
  }, [state.url]);

  if (!buyable)
    return (
      <>
        <a
          href={`mailto:${contact}?subject=${encodeURIComponent("Agent access")}`}
          className="mt-5 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Get agent access
        </a>
        <p className="mt-2 text-xs text-muted">
          We&apos;ll switch it on for {orgName} and walk you through setup.
        </p>
      </>
    );

  return (
    <form action={act} className="mt-5">
      <button
        type="submit"
        disabled={pending || !!state.url}
        className="inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {pending || state.url ? "Opening checkout…" : "Subscribe to agent access"}
      </button>
      <p className="mt-2 text-xs text-muted">
        Monthly, cancel any time — it runs to the end of the period you have
        paid for. Billed to {orgName}.
      </p>
      {state.error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
