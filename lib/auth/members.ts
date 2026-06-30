import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgRole } from "@/lib/auth/org";

// Total users (active members + pending invites) allowed per full-access org.
export const SEAT_LIMIT = 3;

export type Member = {
  userId: string;
  email: string;
  name: string;
  role: OrgRole;
  isYou: boolean;
};
export type PendingInvite = {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
};
export type Team = {
  members: Member[];
  invites: PendingInvite[];
  seatsUsed: number;
  seatLimit: number;
};

// Members (visible to any co-member via RLS) + pending invites (admin-only via
// RLS; non-admins simply get an empty list). Member emails/names are resolved
// with the service-role client since they live in auth.users, not a public table.
export async function getTeam(orgId: string): Promise<Team> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? null;

  const { data: mems } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const { data: invs } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  const admin = createAdminClient();
  const members: Member[] = [];
  for (const m of mems ?? []) {
    let email = "";
    let name = "";
    try {
      const { data } = await admin.auth.admin.getUserById(m.user_id as string);
      email = data.user?.email ?? "";
      name = (data.user?.user_metadata?.full_name as string | undefined) ?? "";
    } catch {
      // ignore — still show the row (role) even if identity lookup fails
    }
    members.push({
      userId: m.user_id as string,
      email,
      name,
      role: m.role as OrgRole,
      isYou: m.user_id === me,
    });
  }

  const invites: PendingInvite[] = (invs ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: i.role as OrgRole,
    expiresAt: i.expires_at as string,
  }));

  return {
    members,
    invites,
    seatsUsed: members.length + invites.length,
    seatLimit: SEAT_LIMIT,
  };
}
