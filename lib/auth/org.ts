import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "admin" | "member" | "viewer";
export type OrgMembership = {
  id: string;
  name: string;
  role: OrgRole;
  plan: string;
};

// All organizations the current user belongs to (RLS scopes this to them).
export async function getMemberships(): Promise<OrgMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, organizations(id, name, plan)")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as any[])
    .map((r) => {
      const o = Array.isArray(r.organizations)
        ? r.organizations[0]
        : r.organizations;
      return o
        ? {
            id: o.id as string,
            name: o.name as string,
            role: r.role as OrgRole,
            plan: (o.plan as string) ?? "explore",
          }
        : null;
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
