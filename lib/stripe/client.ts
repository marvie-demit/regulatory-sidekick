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

/**
 * Is a stored customer id usable against the CURRENT key? Returns it when yes,
 * null when the caller should mint a fresh one.
 *
 * A stored id goes bad in two ways, and they FAIL DIFFERENTLY:
 *
 *   · DELETED in the dashboard — retrieve() succeeds and returns
 *     `{ deleted: true }`.
 *   · ABSENT from this account or mode — retrieve() THROWS 404
 *     `resource_missing`.
 *
 * Only the first was handled originally, and the second is the one that
 * actually happens: a customer id belongs to one account AND one mode, so
 * pointing a deployment at live keys makes every id minted in sandbox vanish.
 * Every workspace that had already bought something then failed at checkout
 * with "Could not start checkout", which names the symptom and hides the cause.
 *
 * Anything that is NOT resource_missing is rethrown. A bad key or a network
 * failure must not be quietly reinterpreted as "no customer here" — that would
 * turn an outage into a silent stream of duplicate customer records.
 */
export async function usableCustomerId(
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  try {
    const customer = await getStripe().customers.retrieve(id);
    return customer.deleted ? null : id;
  } catch (e) {
    if ((e as { code?: string })?.code === "resource_missing") return null;
    throw e;
  }
}
