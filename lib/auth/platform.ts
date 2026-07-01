import { createClient } from "@/lib/supabase/server";

// Platform owner / "instance admin" — the operator of Regulatory Sidekick,
// completely separate from per-org roles. Identity is a SERVER-ONLY env
// allowlist so it can never be escalated through the database.
//   PLATFORM_ADMIN_EMAILS="you@co.com, staff@co.com"
// Built-in platform owner(s) — always allowed, even if PLATFORM_ADMIN_EMAILS is
// unset or misconfigured on the host. The env var adds any *additional* admins.
const BUILT_IN_ADMINS = ["regulatory.sidekick@notjustany.tech"];

function adminEmails(): string[] {
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...BUILT_IN_ADMINS.map((e) => e.toLowerCase()), ...fromEnv];
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// True if the currently signed-in user is a platform admin.
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isPlatformAdminEmail(user?.email);
}
