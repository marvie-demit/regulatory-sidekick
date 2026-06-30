import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "admin" | "member" | "viewer";
export type OrgMembership = {
  id: string;
  name: string;
  role: OrgRole;
  plan: string; // effective plan: a lapsed 'full'/'enterprise' is reported as 'explore'
  planExpiresAt: string | null;
};

// All organizations the current user belongs to (RLS scopes this to them).
export async function getMemberships(): Promise<OrgMembership[]> {
  const supabase = await createClient();
  let res: { data: unknown[] | null; error: unknown } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, plan, plan_expires_at)")
    .order("created_at", { ascending: true });
  // Backward-compatible: if migration 0004 (plan_expires_at) isn't applied yet,
  // retry without that column so existing users are never locked out.
  if (res.error) {
    res = await supabase
      .from("memberships")
      .select("role, organizations(id, name, plan)")
      .order("created_at", { ascending: true });
  }
  const { data, error } = res;
  if (error || !data) return [];
  return (data as any[])
    .map((r) => {
      const o = Array.isArray(r.organizations)
        ? r.organizations[0]
        : r.organizations;
      if (!o) return null;
      const expiresAt = (o.plan_expires_at as string | null) ?? null;
      const expired = !!expiresAt && new Date(expiresAt) < new Date();
      return {
        id: o.id as string,
        name: o.name as string,
        role: r.role as OrgRole,
        // Effective plan: a lapsed full/enterprise grant falls back to explore.
        plan: expired ? "explore" : ((o.plan as string) ?? "explore"),
        planExpiresAt: expiresAt,
      };
    })
    .filter((x): x is OrgMembership => x !== null);
}

// The active org: the cookie selection if still valid, else the first membership.
export async function getActiveOrg(): Promise<OrgMembership | null> {
  const orgs = await getMemberships();
  if (orgs.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  return orgs.find((o) => o.id === wanted) ?? orgs[0];
}
