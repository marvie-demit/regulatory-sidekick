import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password" };

// Reached via the recovery link → /auth/callback (which sets a recovery session)
// → here. A valid session is what lets updateUser({ password }) succeed; without
// one the link is invalid/expired, so we point back to request a fresh one.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold text-teal-900">
          Link expired
        </h1>
        <p className="mb-5 mt-1.5 text-sm text-muted">
          This password-reset link is invalid or has already been used. Request a
          fresh one and try again.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Set a new password
      </h1>
      <p className="mb-5 mt-1.5 text-sm text-muted">
        Choose a new password for your account.
      </p>
      <ResetPasswordForm />
    </>
  );
}
