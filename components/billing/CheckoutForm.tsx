"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutRes } from "@/lib/billing/actions";

// Serialisable shape — the pricing page is a server component and resolves the
// offered options (which depend on server-only price env vars) before passing
// them down. This component never sees a Stripe id.
export type OptionChoice = { id: string; label: string };

export function CheckoutForm({
  tier,
  options,
  requiresEligibility,
  eligibilityStatement,
  cta,
  variant = "primary",
}: {
  tier: string;
  options: OptionChoice[];
  requiresEligibility: boolean;
  eligibilityStatement: string;
  cta: string;
  variant?: "primary" | "secondary";
}) {
  const [state, action, pending] = useActionState<CheckoutRes, FormData>(
    async (prev, formData) => {
      const res = await startCheckout(prev, formData);
      // Stripe Checkout is a full-page redirect to their domain, so we navigate
      // rather than router.push — this leaves the app entirely.
      if (res.url) window.location.assign(res.url);
      return res;
    },
    {},
  );

  const button =
    variant === "primary"
      ? "bg-coral text-white hover:brightness-95"
      : "border border-line bg-card text-teal-800 hover:border-coral";

  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="tier" value={tier} />

      {options.length > 1 ? (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-xs font-semibold text-muted">
            How would you like to pay?
          </legend>
          <div className="flex flex-col gap-1.5">
            {options.map((o, i) => (
              <label key={o.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="option"
                  value={o.id}
                  defaultChecked={i === 0}
                  className="accent-coral"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="option" value={options[0]?.id ?? "once"} />
      )}

      {requiresEligibility ? (
        <label className="mb-4 flex items-start gap-2 text-xs leading-relaxed text-ink">
          <input
            type="checkbox"
            name="eligibility"
            required
            className="mt-0.5 shrink-0 accent-coral"
          />
          <span>{eligibilityStatement}</span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`inline-flex rounded-full px-6 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${button}`}
      >
        {pending ? "Opening checkout…" : cta}
      </button>

      {state.error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
