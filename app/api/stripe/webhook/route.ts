import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantPurchasedAccess } from "@/lib/billing/grant";

// Stripe webhook — the ONLY place a purchase turns into access.
//
// Authenticated by Stripe's signature, not by a session cookie, so the path is
// exempted in lib/supabase/middleware.ts (otherwise Stripe gets a 307 to
// /login and every event fails). Same pattern as /api/v1 for agents.
//
// Contract with Stripe: return 2xx once the event is durably handled. Anything
// else is retried with backoff. We therefore claim the event id first (the
// stripe_events primary key makes a redelivery a no-op), and release the claim
// if handling throws, so a genuine failure is retried rather than swallowed.

// Never prerender or cache: this must run per request with the raw body intact.
export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

export async function POST(req: Request) {
  if (!stripeConfigured())
    return new Response("Stripe not configured", { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // Raw text, not req.json() — the signature is over the exact bytes sent.
  const payload = await req.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    // A bad signature is not our bug to retry — reject it.
    console.error("[stripe] signature verification failed", e);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createAdminClient();

  // Claim the event. A duplicate primary key means Stripe redelivered something
  // we already handled — acknowledge and do nothing.
  const claim = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (claim.error) {
    if (claim.error.code === "23505")
      return Response.json({ received: true, duplicate: true });
    console.error("[stripe] could not record event", claim.error);
    return new Response("Storage error", { status: 500 });
  }

  try {
    await handle(admin, stripe, event);
  } catch (e) {
    // Release the claim so Stripe's retry gets a real second attempt.
    console.error(`[stripe] handling ${event.type} (${event.id}) failed`, e);
    await admin.from("stripe_events").delete().eq("id", event.id);
    return new Response("Handler error", { status: 500 });
  }

  return Response.json({ received: true });
}

async function handle(admin: Admin, stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return onCheckoutCompleted(admin, event.data.object);
    case "checkout.session.expired":
      return onCheckoutExpired(admin, event.data.object);
    case "invoice.paid":
      return onInvoicePaid(admin, stripe, event.data.object);
    case "invoice.payment_failed":
      return onInvoiceFailed(admin, stripe, event.data.object);
    case "customer.subscription.deleted":
      return onSubscriptionEnded(admin, stripe, event.data.object);
    default:
      // Everything else is deliberately ignored, but stays recorded in
      // stripe_events so the delivery log and our table agree.
      return;
  }
}

// ---------------------------------------------------------------------------

async function onCheckoutCompleted(admin: Admin, s: Stripe.Checkout.Session) {
  const orgId = s.metadata?.org_id ?? s.client_reference_id;
  if (!orgId) {
    console.error("[stripe] session without org_id", s.id);
    return;
  }

  const plan = s.metadata?.plan === "enterprise" ? "enterprise" : "full";
  const isSubscription = s.mode === "subscription";

  // One-time payments must actually be paid. Subscriptions arrive here already
  // charged for the first period; later instalments come via invoice.paid.
  const settled = isSubscription || s.payment_status === "paid";
  if (!settled) return;

  const installments = Number(s.metadata?.installments ?? 0) || null;

  // Upsert, because the pending row from the checkout action is best-effort —
  // this reconstructs the purchase from metadata if that insert never landed.
  const { error } = await admin.from("purchases").upsert(
    {
      org_id: orgId,
      tier: s.metadata?.tier === "standard" ? "standard" : "practitioner",
      plan,
      payment_option: s.metadata?.payment_option ?? "once",
      mode: isSubscription ? "subscription" : "payment",
      status: isSubscription ? "active" : "paid",
      stripe_session_id: s.id,
      stripe_customer_id: idOf(s.customer),
      stripe_payment_intent_id: idOf(s.payment_intent),
      stripe_subscription_id: idOf(s.subscription),
      amount_total: s.amount_total,
      currency: s.currency,
      email: s.customer_details?.email ?? null,
      installments_total: installments,
      eligibility_declared: s.metadata?.eligibility_declared === "true",
      granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_session_id" },
  );
  if (error) throw new Error(`purchase upsert failed: ${error.message}`);

  const res = await grantPurchasedAccess(admin, orgId, plan, {
    source: "stripe.checkout",
    session_id: s.id,
    tier: s.metadata?.tier ?? null,
    payment_option: s.metadata?.payment_option ?? null,
    amount_total: s.amount_total,
    currency: s.currency,
  });
  if (res.error) throw new Error(`grant failed: ${res.error}`);
}

async function onCheckoutExpired(admin: Admin, s: Stripe.Checkout.Session) {
  // Abandoned checkout. Only touch rows still pending — never walk back a sale.
  await admin
    .from("purchases")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("stripe_session_id", s.id)
    .eq("status", "pending");
}

const PURCHASE_COLS =
  "id, org_id, plan, mode, installments_paid, installments_total, status";

type PurchaseRow = {
  id: string;
  org_id: string;
  plan: string;
  mode: string;
  installments_paid: number | null;
  installments_total: number | null;
  status: string;
};

// Find the purchase behind a subscription.
//
// The obvious lookup — by stripe_subscription_id — is not enough, because Stripe
// frequently delivers invoice.paid BEFORE checkout.session.completed, and it is
// the latter that writes the subscription id. Missing that first instalment
// would mean the count never reaches the agreed total, the subscription is never
// cancelled, and the customer is billed month after month forever.
//
// So on a miss we fall back to the subscription's own metadata (set via
// subscription_data at checkout) and claim this workspace's newest unlinked
// instalment row, attaching the subscription id as we go.
async function findPurchaseBySubscription(
  admin: Admin,
  stripe: Stripe,
  subId: string,
  metadata?: Stripe.Metadata | null,
): Promise<PurchaseRow | null> {
  const direct = await admin
    .from("purchases")
    .select(PURCHASE_COLS)
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (direct.data) return direct.data as PurchaseRow;

  let meta = metadata ?? null;
  if (!meta) {
    const sub = await stripe.subscriptions.retrieve(subId);
    meta = sub.metadata ?? null;
  }
  const orgId = meta?.org_id;
  if (!orgId) return null;

  const pending = await admin
    .from("purchases")
    .select(PURCHASE_COLS)
    .eq("org_id", orgId)
    .eq("mode", "subscription")
    .is("stripe_subscription_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pending.data) return null;

  const row = pending.data as PurchaseRow;
  const total = row.installments_total ?? (Number(meta?.installments ?? 0) || null);
  await admin
    .from("purchases")
    .update({
      stripe_subscription_id: subId,
      installments_total: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return { ...row, installments_total: total };
}

// Instalments. Stripe Checkout has no native "charge N times then stop", so the
// plan is sold as a monthly subscription and we end it ourselves once the agreed
// number of invoices has been paid.
async function onInvoicePaid(admin: Admin, stripe: Stripe, inv: Stripe.Invoice) {
  // v22 / API 2026-06-24: the subscription moved off the invoice root and onto
  // invoice.parent.subscription_details.
  const subId = idOf(inv.parent?.subscription_details?.subscription);
  if (!subId) return; // not a subscription invoice — nothing to count

  const purchase = await findPurchaseBySubscription(
    admin,
    stripe,
    subId,
    inv.parent?.subscription_details?.metadata,
  );
  if (!purchase) return;

  // Count what Stripe says has been paid rather than incrementing our own
  // counter: order-independent, and a redelivered or out-of-order event can
  // never double-count. Instalment plans are 3–6 invoices, so one page is ample.
  const invoices = await stripe.invoices.list({
    subscription: subId,
    status: "paid",
    limit: 100,
  });
  const paid = invoices.data.length;
  const total = purchase.installments_total ?? null;
  const finished = total !== null && paid >= total;

  await admin
    .from("purchases")
    .update({
      installments_paid: paid,
      status: finished ? "completed" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id);

  // Re-assert the grant. Cheap, and it self-heals a workspace whose
  // checkout.session.completed was lost.
  const res = await grantPurchasedAccess(
    admin,
    purchase.org_id,
    purchase.plan === "enterprise" ? "enterprise" : "full",
    { source: "stripe.invoice_paid", subscription_id: subId, installment: paid },
  );
  if (res.error) throw new Error(`grant failed: ${res.error}`);

  if (finished) {
    // The customer has paid in full — stop billing them. Access is already
    // perpetual, so cancelling here takes nothing away.
    await stripe.subscriptions.cancel(subId);
  }
}

async function onInvoiceFailed(admin: Admin, stripe: Stripe, inv: Stripe.Invoice) {
  const subId = idOf(inv.parent?.subscription_details?.subscription);
  if (!subId) return;

  const purchase = await findPurchaseBySubscription(
    admin,
    stripe,
    subId,
    inv.parent?.subscription_details?.metadata,
  );
  if (!purchase) return;

  await admin
    .from("purchases")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("id", purchase.id);

  // Deliberately NOT revoked. A regulated manufacturer losing access to its own
  // QMS documents over a failed card turns a billing hiccup into an audit
  // incident (BUSINESS-MODEL.md §4 / §8). Stripe runs its own dunning; this is
  // logged so the platform admin can chase it, and can revoke by hand if the
  // customer genuinely defaults.
  await admin.from("audit_log").insert({
    org_id: purchase.org_id,
    actor_id: null,
    action: "billing.instalment_failed",
    entity_type: "purchase",
    entity_id: purchase.id,
    detail: {
      subscription_id: subId,
      installments_paid: purchase.installments_paid,
      installments_total: purchase.installments_total,
      access: "retained",
    },
  });
}

async function onSubscriptionEnded(
  admin: Admin,
  stripe: Stripe,
  sub: Stripe.Subscription,
) {
  const purchase = await findPurchaseBySubscription(
    admin,
    stripe,
    sub.id,
    sub.metadata,
  );
  if (!purchase) return;

  // We cancel the subscription ourselves once the last instalment lands, so a
  // row already marked completed is the happy path, not a default.
  if (purchase.status === "completed") return;

  const paid = purchase.installments_paid ?? 0;
  const total = purchase.installments_total ?? 0;
  const shortfall = total > 0 && paid < total;

  await admin
    .from("purchases")
    .update({
      status: shortfall ? "cancelled" : "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchase.id);

  if (shortfall) {
    // Again: flagged, not revoked. This is the row a platform admin should look
    // at — the customer holds full access having paid part of the price.
    await admin.from("audit_log").insert({
      org_id: purchase.org_id,
      actor_id: null,
      action: "billing.instalment_plan_cancelled",
      entity_type: "purchase",
      entity_id: purchase.id,
      detail: {
        subscription_id: sub.id,
        installments_paid: paid,
        installments_total: total,
        access: "retained",
      },
    });
  }
}
