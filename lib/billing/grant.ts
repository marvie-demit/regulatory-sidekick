import type { SupabaseClient } from "@supabase/supabase-js";

// Switching access on after a payment. Kept separate from the webhook so the
// grant rule lives in one place — the same reasoning as setOrgPlan() in
// lib/admin/actions.ts, which is the manual equivalent of this.
//
// Two deliberate choices:
//
// 1. plan_expires_at is set to NULL — access is PERPETUAL. The "12 months of
//    updates" in the pricing copy is a maintenance/renewal concept, not an
//    access expiry. getMemberships() downgrades an expired org to 'explore',
//    so putting a date here would silently revoke a paying customer's access
//    to their own QMS documents a year after they bought it. Don't.
//
// 2. An 'enterprise' org is never downgraded to 'full'. Enterprise is granted
//    out of band (platform admin), and a customer who later buys a Standard
//    licence through checkout must not lose the higher tier.

/**
 * Switch the agent add-on on, or roll it forward another month.
 *
 * `expiresAt` comes from the STRIPE PERIOD END and is the only thing that moves
 * it. That one rule covers every case without a branch for any of them:
 *
 *   · a paid month rolls the date forward
 *   · a failed payment does not extend it — the date arrives on its own
 *   · a cancellation runs to period end — the date is already right
 *
 * It NEVER touches `plan`. Buying the add-on must not grant a licence, and the
 * cheapest way to guarantee that is for the code that grants it to have no
 * expression that could. Migration 0020 enforces the same thing from the other
 * side, by making `plan` un-writable on an agent purchase row.
 *
 * A little slack past the period end is deliberate: Stripe bills at the
 * boundary and the webhook can be seconds or minutes late. Without it a
 * customer in good standing sees a lapse every month while the payment they
 * already made is being processed.
 */
const RENEWAL_GRACE_HOURS = 36;

export async function grantAgentAccess(
  admin: SupabaseClient,
  orgId: string,
  periodEnd: Date,
  detail: Record<string, unknown>,
): Promise<{ error?: string; expiresAt: string }> {
  const expiresAt = new Date(
    periodEnd.getTime() + RENEWAL_GRACE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: org, error: readErr } = await admin
    .from("organizations")
    .select("agentic_expires_at")
    .eq("id", orgId)
    .single();
  if (readErr || !org) return { error: "Organization not found.", expiresAt };

  // Never move the date BACKWARDS. Stripe redelivers events, and out-of-order
  // delivery is normal — an older invoice arriving after a newer one would
  // otherwise shorten a subscription the customer has already paid to extend.
  const current = org.agentic_expires_at ? new Date(org.agentic_expires_at) : null;
  const keep = current && current > new Date(expiresAt);
  const nextExpiry = keep ? current.toISOString() : expiresAt;

  const { error } = await admin
    .from("organizations")
    .update({ agentic_enabled: true, agentic_expires_at: nextExpiry })
    .eq("id", orgId);
  if (error) return { error: error.message, expiresAt: nextExpiry };

  await admin.from("audit_log").insert({
    org_id: orgId,
    actor_id: null,
    action: "agentic.granted",
    entity_type: "organization",
    entity_id: orgId,
    detail: {
      ...detail,
      agentic_expires_at: nextExpiry,
      ...(keep ? { note: "kept the later existing expiry (out-of-order event)" } : {}),
    },
  });

  return { expiresAt: nextExpiry };
}

export async function grantPurchasedAccess(
  admin: SupabaseClient,
  orgId: string,
  plan: "full" | "enterprise",
  detail: Record<string, unknown>,
): Promise<{ error?: string; granted: boolean }> {
  const { data: org, error: readErr } = await admin
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  if (readErr || !org) return { error: "Organization not found.", granted: false };

  if (org.plan === "enterprise" && plan !== "enterprise") {
    // Already on a higher tier — record the purchase, change nothing.
    await admin.from("audit_log").insert({
      org_id: orgId,
      actor_id: null,
      action: "plan.purchase_noop",
      entity_type: "organization",
      entity_id: orgId,
      detail: { ...detail, reason: "already enterprise" },
    });
    return { granted: false };
  }

  const { error } = await admin
    .from("organizations")
    .update({ plan, plan_expires_at: null })
    .eq("id", orgId);
  if (error) return { error: error.message, granted: false };

  // actor_id is null: the actor is Stripe, not a signed-in user.
  await admin.from("audit_log").insert({
    org_id: orgId,
    actor_id: null,
    action: "plan.purchase",
    entity_type: "organization",
    entity_id: orgId,
    detail: { ...detail, plan, plan_expires_at: null },
  });

  return { granted: true };
}
