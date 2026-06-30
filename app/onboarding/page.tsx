import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getMemberships } from "@/lib/auth/org";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Create your organization" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // Already has an organization → straight into the app.
  const orgs = await getMemberships();
  if (orgs.length > 0) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <span className="font-display text-lg font-semibold text-teal-900">
        NotJustAnyQMS
      </span>
      <div className="mt-6 w-full max-w-md rounded-2xl border border-line bg-card p-7 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-teal-900">
          Create your organization
        </h1>
        <p className="mb-5 mt-1.5 text-sm text-muted">
          This is your team&apos;s workspace — your QMS implementation, progress
          and evidence live here. You can invite teammates and set your device
          profile next.
        </p>
        <OnboardingForm />
      </div>
      <p className="mt-6 text-xs text-muted">ISO 13485 / EU MDR · multi-tenant QMS</p>
    </main>
  );
}
