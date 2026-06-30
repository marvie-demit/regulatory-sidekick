import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Create your account
      </h1>
      <p className="mb-5 mt-1.5 text-sm text-muted">
        Start a guided QMS implementation for your medical-device team.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
