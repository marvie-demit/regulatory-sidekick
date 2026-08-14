import { NextResponse, type NextRequest } from "next/server";
import { getActiveOrg } from "@/lib/auth/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/stripe/client";

// GET /api/agent/billing — Stripe's billing portal for this workspace.
//
// Cancelling, changing card, and downloading invoices all live in Stripe's own
// portal rather than being rebuilt here. That is not laziness: a cancel button
// of our own would have to keep our idea of the subscription in step with
// Stripe's, and the two drift the moment anything happens in the dashboard.
// The portal is always right by construction.
//
// Admin-only. A member cancelling the workspace's subscription is the same
// class of action as revoking an agent key, and that is already admin-gated.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims)
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent("/agent")}`, origin),
    );

  const org = await getActiveOrg();
  if (!org) return NextResponse.redirect(new URL("/agent", origin));
  if (org.role !== "admin")
    return NextResponse.redirect(new URL("/agent?billing=admin_only", origin));

  if (!stripeConfigured())
    return NextResponse.redirect(new URL("/agent?billing=unavailable", origin));

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", org.id)
    .maybeSingle();

  // No Stripe customer means nothing was ever bought through checkout — an
  // entitlement switched on by hand, most likely. There is no portal to show,
  // and sending them to a Stripe error page would be worse than saying so.
  if (!row?.stripe_customer_id)
    return NextResponse.redirect(new URL("/agent?billing=none", origin));

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${origin}/agent`,
    });
    return NextResponse.redirect(session.url);
  } catch (e) {
    console.error("[stripe] billing portal failed", e);
    return NextResponse.redirect(new URL("/agent?billing=error", origin));
  }
}
