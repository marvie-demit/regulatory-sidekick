"use server";

import { requestOrigin } from "@/lib/http/origin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import {
  agentPriceId,
  getTier,
  offeredOptions,
  priceIdFor,
} from "@/lib/billing/catalog";
import { getLiveApplication } from "@/lib/startup/queries";

export type CheckoutRes = { error?: string; url?: string };

// Stripe's success/cancel URLs must return the customer to the host they
// checked out from. This used to prefer NEXT_PUBLIC_SITE_URL, which .env.local
// told you to set in production — meaning a customer who paid on a partner
// subdomain was bounced to the canonical host afterwards, where their
// host-scoped session doesn't exist, and a successful payment looked like a
// failed one. The env var is no longer consulted.
const origin = requestOrigin;

// Create a Stripe Checkout Session for the active workspace and hand the URL
// back to the client to navigate to. We deliberately do NOT grant access here —
// a session being created means nothing. Access is granted only by the webhook,
// on a payment Stripe has actually confirmed.
export async function startCheckout(
  _prev: CheckoutRes,
  formData: FormData,
): Promise<CheckoutRes> {
  if (!stripeConfigured())
    return { error: "Online checkout isn't configured yet — please get in touch." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "admin")
    return { error: "Only a workspace admin can purchase access." };
  if (hasFullAccess(org.plan))
    return { error: `${org.name} already has full access.` };

  const tier = getTier(String(formData.get("tier") || ""));
  if (!tier) return { error: "Unknown product." };

  const optionId = String(formData.get("option") || "once");
  const option = offeredOptions(tier).find((o) => o.id === optionId);
  if (!option)
    return { error: "That payment option isn't available — pick another." };

  const priceId = priceIdFor(option);
  if (!priceId) return { error: "That payment option isn't available — pick another." };

  // The §6 gate, now a REVIEWED one. This used to be a checkbox on the form;
  // it is now an approved application, which the browser has no way to fake.
  //
  // Worth knowing why this single lookup is sufficient: no RLS policy in 0021
  // permits a workspace to write status = 'approved' — the only path is
  // decide_startup_application(), which re-checks authorisation inside the
  // function. So "an approved row exists" cannot have been produced by the
  // applicant, and this does not need to re-derive who approved it.
  let applicationId: string | null = null;
  if (tier.requiresApproval) {
    const application = await getLiveApplication(org.id);
    if (!application || application.status !== "approved")
      return {
        error:
          application?.status === "submitted"
            ? "Your Startup Programme application is still under review — we'll email you as soon as it's decided."
            : "The Startup Programme is available once your application has been approved.",
      };
    applicationId = application.id;
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  const base = await origin();

  try {
    // Reuse this workspace's Customer if it has one, so a repeat purchase keeps
    // the same billing history, saved VAT ID and address.
    const { data: orgRow } = await admin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", org.id)
      .single();

    let customerId: string | null = orgRow?.stripe_customer_id ?? null;
    if (customerId) {
      // A customer deleted in the Stripe dashboard would otherwise 400 every
      // future checkout for this workspace. Fall back to minting a new one.
      const existing = await stripe.customers.retrieve(customerId);
      if (existing.deleted) customerId = null;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: org.name,
        metadata: { org_id: org.id, org_name: org.name },
      });
      customerId = customer.id;
      await admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
    }

    const isInstalment = option.installments !== null;
    // Carried on the session AND (for instalments) on the subscription, because
    // later invoice.* events don't see the session's metadata.
    const metadata: Record<string, string> = {
      org_id: org.id,
      org_name: org.name,
      tier: tier.id,
      plan: tier.plan,
      payment_option: option.id,
      installments: String(option.installments ?? 0),
      ...(applicationId ? { startup_application_id: applicationId } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: isInstalment ? "subscription" : "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: org.id,
      metadata,
      ...(isInstalment ? { subscription_data: { metadata } } : {}),
      // VAT from the first sale (§8): Stripe Tax computes the rate, and
      // tax_id_collection lets an EU business enter a VAT number so B2B reverse
      // charge applies. Retrofitting this later means reissuing invoices.
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      // Solo QA/RA practitioners and consultants no longer have a tier of their
      // own — they get a discount code against Standard instead. Without this
      // the code field never appears and the discount cannot be redeemed.
      //
      // Deliberately NOT offered on a gated tier. The Startup Programme is
      // already ~70% off and reviewed one application at a time; letting a code
      // stack on top of it would discount the discount, and the audience the
      // codes exist for is precisely the one that is NOT on that tier. Coupons
      // can also be restricted to a product in Stripe — this is the same rule
      // enforced here, so it holds even if a coupon is created unrestricted.
      ...(tier.requiresApproval ? {} : { allow_promotion_codes: true }),
      // Required when passing an existing customer with automatic_tax — Stripe
      // needs permission to write back the address it computes tax from.
      customer_update: { address: "auto", name: "auto" },
      success_url: `${base}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
    });

    if (!session.url) return { error: "Stripe did not return a checkout URL." };

    // Record the intent. Best-effort: the webhook upserts on stripe_session_id,
    // so a failure here costs us the "abandoned checkout" row, not the sale.
    await admin.from("purchases").insert({
      org_id: org.id,
      tier: tier.id,
      plan: tier.plan,
      payment_option: option.id,
      mode: isInstalment ? "subscription" : "payment",
      status: "pending",
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
      currency: session.currency,
      email: user.email ?? null,
      installments_total: option.installments,
      startup_application_id: applicationId,
    });

    return { url: session.url };
  } catch (e) {
    // Stripe errors carry customer-hostile detail (price ids, account state).
    // Log the real one, show a short one.
    console.error("[stripe] checkout session failed", e);
    return { error: "Could not start checkout — please try again or get in touch." };
  }
}

// ---------------------------------------------------------------------------
// The agent add-on — a real monthly subscription, unlike the capped instalment
// plans above which stop after N invoices.
// ---------------------------------------------------------------------------

/**
 * Start a subscription to agent access for the active workspace.
 *
 * The licence check is the important line. This is an ADD-ON: a workspace
 * without full access that somehow reached this action would be charged monthly
 * for an entitlement `hasAgenticAccess()` refuses to honour, because that helper
 * requires the plan first. Charging for something structurally inert is the
 * worst failure available here, so it is checked before Stripe is touched.
 *
 * As with startCheckout, no access is granted here — a created session means
 * nothing. Only a payment Stripe confirms, via the webhook, moves the date.
 */
export async function startAgentSubscription(
  // Required by useActionState's (prevState, payload) contract even though this
  // action takes no input — there is exactly one thing to buy. startCheckout's
  // own `_prev` escapes the lint rule only because a later parameter is used.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: CheckoutRes,
): Promise<CheckoutRes> {
  if (!stripeConfigured())
    return { error: "Online checkout isn't configured yet — please get in touch." };

  const priceId = agentPriceId();
  if (!priceId)
    return { error: "The agent subscription isn't available to buy yet — please get in touch." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "admin")
    return { error: "Only a workspace admin can subscribe." };
  if (!hasFullAccess(org.plan))
    return {
      error:
        "Agent access is an add-on to a Regulatory Sidekick licence. Buy the licence first — the agent has nothing to work on without it.",
    };

  const admin = createAdminClient();
  const base = await origin();

  try {
    // Already subscribed? Send them to the billing portal rather than creating
    // a second subscription — two live subscriptions bill twice and roll the
    // same date forward, so the customer pays double for nothing.
    const { data: orgRow } = await admin
      .from("organizations")
      .select("stripe_customer_id, agentic_subscription_id")
      .eq("id", org.id)
      .single();

    if (orgRow?.agentic_subscription_id) {
      const sub = await getStripe()
        .subscriptions.retrieve(orgRow.agentic_subscription_id)
        .catch(() => null);
      if (sub && (sub.status === "active" || sub.status === "trialing"))
        return {
          error: "This workspace already has an agent subscription. Manage it from the Agent page.",
        };
    }

    const stripe = getStripe();
    let customerId: string | null = orgRow?.stripe_customer_id ?? null;
    if (customerId) {
      const existing = await stripe.customers.retrieve(customerId);
      if (existing.deleted) customerId = null;
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: org.name,
        metadata: { org_id: org.id, org_name: org.name },
      });
      customerId = customer.id;
      await admin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
    }

    // `kind` is what the webhook branches on. It rides on the SUBSCRIPTION as
    // well as the session, because invoice.* events for month two onwards never
    // see the session's metadata — and a renewal that arrives without it would
    // be handled as an instalment of a licence.
    const metadata: Record<string, string> = {
      org_id: org.id,
      org_name: org.name,
      kind: "agent",
      tier: "agent",
      payment_option: "monthly",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: org.id,
      metadata,
      subscription_data: { metadata },
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      success_url: `${base}/agent?subscription=success`,
      cancel_url: `${base}/agent?subscription=cancelled`,
    });

    if (!session.url) return { error: "Stripe did not return a checkout URL." };

    // Best-effort, same as startCheckout: the webhook upserts on the session id.
    // `plan` is omitted rather than set to null for emphasis — 0020's CHECK
    // would reject a value here, which is the point.
    await admin.from("purchases").insert({
      org_id: org.id,
      kind: "agent",
      tier: "agent",
      payment_option: "monthly",
      mode: "subscription",
      status: "pending",
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
      currency: session.currency,
      email: user.email ?? null,
    });

    return { url: session.url };
  } catch (e) {
    console.error("[stripe] agent subscription session failed", e);
    return { error: "Could not start checkout — please try again or get in touch." };
  }
}
