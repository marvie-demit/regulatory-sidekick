"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "./org";
import { safeNext } from "./safe-next";

// Returned to useActionState in the auth form. (Not exported as a type — a
// "use server" module may only export async functions.)
type AuthResult = { error?: string; message?: string };

// ---- Company / workspace profile field helpers ----------------------------
function cleanField(v: FormDataEntryValue | null, max = 200): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
}
// Lenient: accept "acme.com" and store "https://acme.com". Empty stays null.
function normalizeUrl(v: string | null): string | null {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export async function signIn(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3100"}`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Where the confirmation email link returns to (must be allow-listed in
    // Supabase → Auth → URL Configuration). /auth/callback exchanges the code.
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };

  // Email confirmations OFF → a session is returned, go straight in.
  if (data.session) redirect("/dashboard");
  // Otherwise the user must click the link in the confirmation email.
  return {
    message:
      "Account created — check your email for a confirmation link, then sign in.",
  };
}

export async function requestPasswordReset(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email." };

  const supabase = await createClient();
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ?? `http://${hdrs.get("host") ?? "localhost:3100"}`;
  // The reset link returns to /auth/callback (PKCE), which sets a short recovery
  // session and forwards to /reset-password. Enumeration-safe: Supabase succeeds
  // even for unknown emails and we show the same message either way.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  return {
    message:
      "If an account exists for that email, a password-reset link is on its way. Check your inbox (and spam).",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createOrg(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const name = String(formData.get("orgName") || "").trim();
  if (name.length < 2)
    return { error: "Please enter your organization's name." };

  const supabase = await createClient();
  // SECURITY DEFINER RPC: creates the org + the creator's admin membership +
  // a default device profile, in one transaction (RLS would block the raw insert).
  const { data: orgId, error } = await supabase.rpc("create_org_with_owner", {
    p_name: name,
  });
  if (error || !orgId)
    return { error: error?.message ?? "Could not create the organization." };

  // Company profile (optional). The creator is now this org's admin, so the
  // org_update policy allows this. Best-effort: never fail org creation on it
  // (e.g. if migration 0010 isn't applied yet) — they can fill it in later.
  const profile: Record<string, string> = {};
  const website = normalizeUrl(cleanField(formData.get("website")));
  const linkedin = normalizeUrl(cleanField(formData.get("linkedin")));
  const industry = cleanField(formData.get("industry"), 80);
  const country = cleanField(formData.get("country"), 80);
  const about = cleanField(formData.get("about"), 600);
  if (website) profile.website = website;
  if (linkedin) profile.linkedin = linkedin;
  if (industry) profile.industry = industry;
  if (country) profile.country = country;
  if (about) profile.about = about;
  if (Object.keys(profile).length) {
    await supabase
      .from("organizations")
      .update(profile)
      .eq("id", orgId as string);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, String(orgId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}

// ---- Account settings (any authenticated user) -----------------------------

export async function updateProfile(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const fullName = String(formData.get("fullName") || "").trim();
  if (fullName.length < 2) return { error: "Please enter your name." };
  if (fullName.length > 80) return { error: "That name is too long." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { message: "Name updated." };
}

export async function updatePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { message: "Password updated." };
}

// ---- Company / workspace profile (admins of the active org) -----------------

export async function updateOrgProfile(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const org = await getActiveOrg();
  if (!org) return { error: "No active workspace." };
  if (org.role !== "admin")
    return { error: "Only workspace admins can edit the profile." };

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) return { error: "Enter the workspace name." };
  if (name.length > 80) return { error: "That name is too long." };

  const supabase = await createClient();
  // Full write (nulls included) so clearing a field actually clears it.
  // The org_update policy (admin) + this role check both gate it.
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      website: normalizeUrl(cleanField(formData.get("website"))),
      linkedin: normalizeUrl(cleanField(formData.get("linkedin"))),
      industry: cleanField(formData.get("industry"), 80),
      country: cleanField(formData.get("country"), 80),
      about: cleanField(formData.get("about"), 600),
    })
    .eq("id", org.id);
  if (error) {
    // Friendlier message if the code is deployed before migration 0010.
    if (/column .* does not exist/i.test(error.message))
      return {
        error:
          "Company-profile fields aren't available yet — apply database migration 0010, then try again.",
      };
    return { error: error.message };
  }

  revalidatePath("/", "layout"); // the workspace name shows in the sidebar
  return { message: "Workspace profile saved." };
}
