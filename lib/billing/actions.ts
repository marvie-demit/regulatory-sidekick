"use server";

import { requestOrigin } from "@/lib/http/origin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import {
  ELIGIBILITY_STATEMENT,
  getTier,
  offeredOptions,
  priceIdFor,
} from "@/lib/billing/catalog";

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

  // The §6 gate. Enforced server-side: a checkbox the browser never sent is a
  // declaration that was never made, whatever the form looked like.
  const declared = String(formData.get("eligibility") || "") === "on";
  if (tier.requiresEligibility && !declared)
    return {
      error: "Please confirm you meet the Practitioner eligibility criteria.",
    };

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
      eligibility_declared: String(declared),
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
      eligibility_declared: declared,
      eligibility_statement: declared ? ELIGIBILITY_STATEMENT : null,
    });

    return { url: session.url };
  } catch (e) {
    // Stripe errors carry customer-hostile detail (price ids, account state).
    // Log the real one, show a short one.
    console.error("[stripe] checkout session failed", e);
    return { error: "Could not start checkout — please try again or get in touch." };
  }
}
