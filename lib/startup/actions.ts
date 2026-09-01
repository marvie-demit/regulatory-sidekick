"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/auth/org";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { getRequestPartnerSlug } from "@/lib/partners/brand";
import { ELIGIBILITY_STATEMENT } from "@/lib/billing/catalog";
import {
  APPLICATION_COLS,
  LIMITS,
  REGULATIONS,
  int,
  missingFields,
  money,
  monthToDate,
  text,
  tooLong,
  type Regulation,
  type StartupApplication,
} from "@/lib/startup/application";

export type ApplicationRes = { error?: string; message?: string };

// Startup Programme applications.
//
// Two things here are load-bearing and easy to undo by accident:
//
// 1. `partner_id` is resolved from the REQUEST HOST, never from the form. A
//    partner_id the applicant could choose would let anyone post their funding
//    position into an arbitrary investor's review queue — and the whole reason
//    partner review is acceptable at all is that the applicant chose that
//    partner by applying through their subdomain.
//
// 2. Nothing here can write `status = 'approved'`. The RLS policies in 0021
//    forbid it and the decision path is a separate function. So a bug in this
//    file cannot mint a 70% discount; the worst it can do is fail to save.

/**
 * Which partner, if any, this request is being made through.
 *
 * The slug arrives via a header the proxy rewrites on every request (it deletes
 * any inbound copy first), so it reflects the Host and cannot be forged by a
 * client. Suspended partners resolve to null: their codes are already
 * unredeemable, and routing new applications to a suspended reviewer would
 * strand them.
 */
async function partnerFromRequest(): Promise<string | null> {
  const slug = await getRequestPartnerSlug();
  if (!slug) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

function parse(formData: FormData) {
  const over: string[] = [];
  const check = (key: string, max: number, label: string) => {
    if (tooLong(formData.get(key), max)) over.push(label);
  };
  check("legal_name", LIMITS.legalName, "legal name");
  check("website", LIMITS.website, "website");
  check("country", LIMITS.country, "country");
  check("risk_class", LIMITS.riskClass, "risk class");
  check("device_summary", LIMITS.deviceSummary, "what you're building");
  check("why_blocked", LIMITS.whyBlocked, "why CE marking is out of reach");

  const regulationRaw = text(formData.get("regulation"), 10);
  const regulation = REGULATIONS.includes(regulationRaw as Regulation)
    ? (regulationRaw as Regulation)
    : null;

  return {
    over,
    values: {
      legal_name: text(formData.get("legal_name"), LIMITS.legalName),
      website: text(formData.get("website"), LIMITS.website),
      country: text(formData.get("country"), LIMITS.country),
      founded_on: monthToDate(formData.get("founded_on")),
      employees: int(formData.get("employees"), 0, 10000),
      device_summary: text(formData.get("device_summary"), LIMITS.deviceSummary),
      regulation,
      risk_class: text(formData.get("risk_class"), LIMITS.riskClass),
      funding_dilutive_eur: money(formData.get("funding_dilutive_eur")),
      funding_non_dilutive_eur: money(formData.get("funding_non_dilutive_eur")),
      revenue_12m_eur: money(formData.get("revenue_12m_eur")),
      why_blocked: text(formData.get("why_blocked"), LIMITS.whyBlocked),
      declared: String(formData.get("declared") || "") === "on",
      updated_at: new Date().toISOString(),
    },
  };
}

/**
 * Save a draft, or save and submit.
 *
 * One action for both because the parsing is identical and duplicating it is
 * how the two paths drift — a validation added to submit but not to save is a
 * hole that only shows up once somebody submits a draft they saved yesterday.
 */
export async function saveApplication(
  _prev: ApplicationRes,
  formData: FormData,
): Promise<ApplicationRes> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "admin")
    return { error: "Only a workspace admin can apply to the Startup Programme." };

  const submitting = String(formData.get("intent") || "") === "submit";
  const { over, values } = parse(formData);

  // The server-side length check. maxLength on the input is a courtesy to
  // someone typing; this is what actually holds when the DOM is edited.
  if (over.length)
    return { error: `Too long: ${over.join(", ")}. Please shorten and try again.` };

  const { data: existing } = await supabase
    .from("startup_applications")
    .select(APPLICATION_COLS)
    .eq("org_id", org.id)
    .in("status", ["draft", "submitted", "approved"])
    .maybeSingle();
  const current = existing as StartupApplication | null;

  if (current?.status === "approved")
    return { error: "This application has already been approved." };

  // Completeness is enforced at SUBMIT, not at save — a draft is allowed to be
  // half-finished, which is the point of having one.
  if (submitting) {
    const missing = missingFields({ ...(current ?? {}), ...values } as StartupApplication);
    if (missing.length)
      return { error: `Still needed: ${missing.join(", ")}.` };
  }

  const row = {
    ...values,
    ...(submitting
      ? {
          status: "submitted" as const,
          submitted_at: new Date().toISOString(),
          declaration_text: ELIGIBILITY_STATEMENT,
        }
      : { status: (current?.status ?? "draft") as "draft" | "submitted" }),
  };

  if (current) {
    const { error } = await supabase
      .from("startup_applications")
      .update(row)
      .eq("id", current.id);
    if (error) return { error: "Could not save. Please try again." };
  } else {
    // partner_id is set ONCE, on creation, from the host. It is deliberately not
    // refreshed on later saves: an applicant who starts on a partner subdomain
    // and finishes on the canonical host has already been told who reviews it,
    // and silently re-routing a half-written application would break that.
    const { error } = await supabase.from("startup_applications").insert({
      ...row,
      org_id: org.id,
      partner_id: await partnerFromRequest(),
    });
    if (error) return { error: "Could not save. Please try again." };
  }

  revalidatePath("/startup-programme");
  revalidatePath("/pricing");
  return {
    message: submitting
      ? "Application submitted. We'll come back to you shortly."
      : "Draft saved.",
  };
}

/** Withdraw a submitted application so the workspace can start again. */
export async function withdrawApplication(
  // Required by useActionState's (prevState, payload) contract even though this
  // action takes no input — same as startAgentSubscription in lib/billing.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: ApplicationRes,
): Promise<ApplicationRes> {
  const supabase = await createClient();
  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "admin") return { error: "Only a workspace admin can do that." };

  const { error } = await supabase
    .from("startup_applications")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("org_id", org.id)
    .in("status", ["draft", "submitted"]);
  if (error) return { error: "Could not withdraw. Please try again." };

  revalidatePath("/startup-programme");
  revalidatePath("/pricing");
  return { message: "Application withdrawn." };
}

/**
 * Approve or decline.
 *
 * Two paths, and the split is the same one 0016 argues for. A PLATFORM admin is
 * an env allowlist — a handful of people — so the service role is proportionate.
 * A PARTNER admin is a row in partner_members and there will be many, so their
 * path goes through decide_startup_application(), which re-checks
 * app.has_partner_role inside the function. A gate bug in this file therefore
 * cannot give a partner admin anything the database would not already allow.
 */
export async function decideApplication(
  _prev: ApplicationRes,
  formData: FormData,
): Promise<ApplicationRes> {
  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const note = text(formData.get("note"), 500);
  if (!id) return { error: "Missing application." };
  if (decision !== "approved" && decision !== "declined")
    return { error: "Invalid decision." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };

  if (await isPlatformAdmin()) {
    const admin = createAdminClient();
    const { data: app } = await admin
      .from("startup_applications")
      .select("id, org_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!app) return { error: "Unknown application." };
    if (app.status !== "submitted")
      return { error: "Only a submitted application can be decided." };

    const { error } = await admin
      .from("startup_applications")
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        decision_note: note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      // Re-assert the state in the WHERE clause, so two reviewers clicking at
      // once cannot both write a decision.
      .eq("status", "submitted");
    if (error) return { error: "Could not record the decision." };

    await admin.from("audit_log").insert({
      org_id: app.org_id,
      actor_id: user.id,
      action: `startup_application.${decision}`,
      entity_type: "startup_application",
      entity_id: id,
      detail: { by: "platform_admin", note },
    });
  } else {
    // Partner admin. Authorisation lives inside the function.
    const { error } = await supabase.rpc("decide_startup_application", {
      p_app: id,
      p_decision: decision,
      p_note: note,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/partner");
  return { message: decision === "approved" ? "Approved." : "Declined." };
}
