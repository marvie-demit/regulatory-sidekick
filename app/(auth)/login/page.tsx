import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { FlashNotice } from "@/components/app-shell/FlashNotice";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect(next?.startsWith("/") ? next : "/dashboard");
  }

  return (
    <>
      <FlashNotice className="mb-4" />
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Welcome back
      </h1>
      <p className="mb-5 mt-1.5 text-sm text-muted">
        Sign in to continue your ISO 13485 / EU MDR implementation.
      </p>
      <AuthForm mode="login" next={next} />
    </>
  );
}
