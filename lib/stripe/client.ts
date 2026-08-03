import Stripe from "stripe";

// Stripe SDK singleton — SERVER ONLY. The secret key is never NEXT_PUBLIC_.
//
// No `apiVersion` is passed on purpose: the SDK pins the version its bundled
// types were generated against (22.3.1 -> 2026-06-24.dahlia). Overriding it
// with a hand-typed string is how you get code that compiles but disagrees with
// what the API actually returns.

let cached: Stripe | null = null;

// Whether online checkout is switched on at all. The pricing page falls back to
// the mailto: flow when this is false, so the app stays usable before the keys
// exist and if they are ever pulled.
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key)
    throw new Error(
      "STRIPE_SECRET_KEY is not set — online checkout is not configured.",
    );
  cached = new Stripe(key, {
    appInfo: { name: "Regulatory Sidekick", url: "https://notjustany.tech" },
  });
  return cached;
}
