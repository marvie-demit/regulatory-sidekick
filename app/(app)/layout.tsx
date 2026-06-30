import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { StateProvider } from "@/components/app-shell/StateProvider";
import { Toaster } from "@/components/app-shell/Toaster";
import { getActiveOrg } from "@/lib/auth/org";
import { getOrgState } from "@/lib/db/state";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Require a session (middleware also gates, this is defense in depth).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // Require an organization; new users go create one first.
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  const state = await getOrgState(org.id);

  return (
    <StateProvider initial={state}>
      <div className="flex">
        <Sidebar orgName={org.name} role={org.role} plan={org.plan} />
        <div className="min-h-screen min-w-0 flex-1">{children}</div>
        <Toaster />
      </div>
    </StateProvider>
  );
}
