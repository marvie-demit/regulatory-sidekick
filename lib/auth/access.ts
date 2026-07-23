// Plan-based capability checks. The SINGLE source of truth for "what can this
// org see?" — used by server components, the doc route, and the gating UI.
// Gating is enforced on the SERVER; the UI lock state is just the visible half.

export type OrgPlan = "explore" | "full" | "enterprise";

export const PLAN_LABELS: Record<OrgPlan, string> = {
  explore: "Explore",
  full: "Full access",
  enterprise: "Enterprise",
};

// Purchase-to-activate copy (no "Pro" anywhere).
export const LOCKED_CTA = "Purchase for full access";
export const LOCKED_BLURB =
  "Purchase for full access — activate all 92 activities, 346 sub-activities and 275 templates.";

// The free Explore sample: ONE fully-open activity + ONE open document group.
// (Both are one-line changes — swap the sample here.)
// Activity ids are process-based (see content.json activities[].id, e.g. "DEV.establish").
export const SAMPLE_ACTIVITY_ID = "QMN.establish"; // "QMS manual, quality policy & guides" — foundational Phase-1 activity
export const SAMPLE_DOC_GROUP = "CHG"; // domain code for "Change Management" (the free sample group)

export function hasFullAccess(plan: string | null | undefined): boolean {
  return plan === "full" || plan === "enterprise";
}

export function planLabel(plan: string | null | undefined): string {
  return PLAN_LABELS[(plan as OrgPlan) ?? "explore"] ?? "Explore";
}

// Agent / MCP access is a SEPARATE paid offering, not part of the licence —
// switched on per workspace by the platform admin (migration 0013). Orthogonal
// to plan: full access is necessary but not sufficient.
export function hasAgenticAccess(org: {
  plan?: string | null;
  agenticEnabled?: boolean | null;
  agenticExpiresAt?: string | null;
}): boolean {
  if (!hasFullAccess(org.plan)) return false;
  if (!org.agenticEnabled) return false;
  // A lapsed subscription stops working the same way a lapsed licence does.
  if (org.agenticExpiresAt && new Date(org.agenticExpiresAt) < new Date())
    return false;
  return true;
}

// Can this plan open this activity in full (its sub-activities, checklist, docs)?
export function canViewActivity(
  plan: string | null | undefined,
  activityId: string,
): boolean {
  return hasFullAccess(plan) || activityId === SAMPLE_ACTIVITY_ID;
}

// Can this plan open documents in this library group?
export function canViewDocGroup(
  plan: string | null | undefined,
  group: string | null | undefined,
): boolean {
  return hasFullAccess(plan) || group === SAMPLE_DOC_GROUP;
}
