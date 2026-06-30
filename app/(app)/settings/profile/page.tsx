import { ProfileSettings } from "@/components/auth/ProfileSettings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Account
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Manage your personal profile and password.
      </p>
      <ProfileSettings email={email} fullName={fullName} />
    </main>
  );
}
