import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerRole } from "@/lib/partners/context";

// Partner staff + pending invites. Mirrors lib/auth/members.ts getTeam(): the
// rows come through RLS with the user's client, and emails are resolved with the
// service role because they live in auth.users, not a public table.

export type PartnerStaffMember = {
  userId: string;
  email: string;
  name: string;
  role: PartnerRole;
  isYou: boolean;
};
export type PartnerPendingInvite = {
  id: string;
  email: string;
  role: PartnerRole;
  expiresAt: string;
};
export type PartnerTeam = {
  members: PartnerStaffMember[];
  invites: PartnerPendingInvite[];
  seatsUsed: number;
  seatLimit: number;
};

export async function getPartnerTeam(
  partnerId: string,
  staffLimit: number,
): Promise<PartnerTeam> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? null;

  const [{ data: mems }, { data: invs }] = await Promise.all([
    supabase
      .from("partner_members")
      .select("user_id, role, created_at")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: true }),
    // Pending invites are admin-only via the ptinv_admin policy (0015) — a
    // non-admin simply gets an empty list rather than an error.
    supabase
      .from("partner_invitations")
      .select("id, email, role, expires_at")
      .eq("partner_id", partnerId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true }),
  ]);

  const admin = createAdminClient();
  const members: PartnerStaffMember[] = [];
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
      role: (m.role === "admin" ? "admin" : "member") as PartnerRole,
      isYou: m.user_id === me,
    });
  }

  const invites: PartnerPendingInvite[] = (invs ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: (i.role === "admin" ? "admin" : "member") as PartnerRole,
    expiresAt: i.expires_at as string,
  }));

  return {
    members,
    invites,
    seatsUsed: members.length + invites.length,
    seatLimit: staffLimit,
  };
}
