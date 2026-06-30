import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { StateProvider } from "@/components/app-shell/StateProvider";
import { Toaster } from "@/components/app-shell/Toaster";
import { PENDING_INVITE_COOKIE } from "@/lib/constants";
import { getActiveOrg } from "@/lib/auth/org";
import { isPlatformAdminEmail } from "@/lib/auth/platform";
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
  const platformAdmin = isPlatformAdminEmail(
    (data.claims as { email?: string }).email,
  );

  // Require an organization; new users create one first — unless they arrived
  // via an invite link, in which case finish joining the org that invited them.
  const org = await getActiveOrg();
  if (!org) {
    const pending = (await cookies()).get(PENDING_INVITE_COOKIE)?.value;
    if (pending) redirect(`/accept-invite/${pending}`);
    redirect("/onboarding");
  }

  const state = await getOrgState(org.id);

  return (
    <StateProvider initial={state}>
      <div className="flex">
        <Sidebar
          orgName={org.name}
          role={org.role}
          plan={org.plan}
          isPlatformAdmin={platformAdmin}
        />
        <div className="min-h-screen min-w-0 flex-1">{children}</div>
        <Toaster />
      </div>
    </StateProvider>
  );
}
