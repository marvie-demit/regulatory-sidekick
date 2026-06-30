"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

// Returned to useActionState in the auth form. (Not exported as a type — a
// "use server" module may only export async functions.)
type AuthResult = { error?: string; message?: string };

function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
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
