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
