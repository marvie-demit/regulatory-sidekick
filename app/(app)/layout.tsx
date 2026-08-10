import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { StateProvider } from "@/components/app-shell/StateProvider";
import { Toaster } from "@/components/app-shell/Toaster";
import { FlashNotice } from "@/components/app-shell/FlashNotice";
import { PlanBanner } from "@/components/app-shell/PlanBanner";
import {
  PENDING_INVITE_COOKIE,
  PENDING_PARTNER_INVITE_COOKIE,
  PENDING_REDEEM_COOKIE,
} from "@/lib/constants";
import { getActiveOrg } from "@/lib/auth/org";
import { hasPartnerAccess } from "@/lib/partners/context";
import { getRequestBrand } from "@/lib/partners/brand";
import { BrandScope } from "@/components/brand/BrandScope";
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
  const cookieStore = await cookies();
  const org = await getActiveOrg();
  if (!org) {
    const pendingInvite = cookieStore.get(PENDING_INVITE_COOKIE)?.value;
    if (pendingInvite) redirect(`/accept-invite/${pendingInvite}`);
    const pendingPartnerInvite = cookieStore.get(
      PENDING_PARTNER_INVITE_COOKIE,
    )?.value;
    if (pendingPartnerInvite)
      redirect(`/accept-partner-invite/${pendingPartnerInvite}`);
    // Partner staff have no membership, so without this they'd be funnelled into
    // /onboarding and would create a junk QMS workspace. Checked only when there
    // is no org, so nothing changes for an ordinary customer — and a person who
    // is both keeps landing in their workspace, reaching /partner from the nav.
    if (await hasPartnerAccess()) redirect("/partner");
    redirect("/onboarding");
  }
  const isPartner = await hasPartnerAccess();
  // Someone who opened a redeem link while logged out lands here after signing
  // up + creating a workspace — apply the code now that an org exists.
  const pendingRedeem = cookieStore.get(PENDING_REDEEM_COOKIE)?.value;
  if (pendingRedeem) redirect(`/redeem/${pendingRedeem}`);

  // Whose brand is this host wearing? Null on our own domain, and resolving that
  // costs no query at all — so ordinary traffic pays nothing for white-labelling.
  const [state, brand] = await Promise.all([
    getOrgState(org.id),
    getRequestBrand(),
  ]);

  return (
    <StateProvider initial={state}>
      <BrandScope brand={brand}>
        <div className="flex">
          <Sidebar
            orgName={org.name}
            role={org.role}
            plan={org.plan}
            isPlatformAdmin={platformAdmin}
            isPartner={isPartner}
            brand={brand}
          />
          <div className="min-h-screen min-w-0 flex-1">
            <PlanBanner planExpiresAt={org.planExpiresAt} />
            <FlashNotice className="mx-8 mt-4" />
            {children}
          </div>
          <Toaster />
        </div>
      </BrandScope>
    </StateProvider>
  );
}
