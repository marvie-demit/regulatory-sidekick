import { notFound, redirect } from "next/navigation";
import { getScopedPartner } from "@/lib/partners/context";
import { getBrandForPartner, getRequestPartnerSlug } from "@/lib/partners/brand";
import { getMemberships } from "@/lib/auth/org";
import { createClient } from "@/lib/supabase/server";
import { BrandScope } from "@/components/brand/BrandScope";
import { PartnerShell } from "@/components/partner/PartnerShell";

// The partner console lives OUTSIDE the (app) group on purpose: that layout
// requires an organization and renders the customer QMS shell (StateProvider,
// PlanBanner, roadmap nav), none of which means anything for a partner.
export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session check first — defense in depth over the proxy, same as (app).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // getScopedPartner pins to the HOST on a partner subdomain and falls back to
  // the active-partner cookie on ours. The pages and every partner server action
  // resolve through the same function, so the layout can't gate one partner
  // while a page loads another.
  const hostSlug = await getRequestPartnerSlug();
  const partner = await getScopedPartner();

  if (!partner) {
    // On a partner host, a non-member gets a 404 rather than a redirect — the
    // existence of a partner at this address isn't something to confirm.
    if (hostSlug) notFound();
    // On our own host, send them wherever they actually belong.
    const orgs = await getMemberships();
    redirect(orgs.length > 0 ? "/dashboard" : "/onboarding");
  }

  const [orgs, brand] = await Promise.all([
    getMemberships(),
    getBrandForPartner(partner.id),
  ]);

  return (
    <BrandScope brand={brand}>
      <PartnerShell
        name={partner.name}
        kind={partner.kind}
        role={partner.role}
        suspended={partner.status !== "active"}
        hasWorkspace={orgs.length > 0}
        brand={brand}
      >
        {children}
      </PartnerShell>
    </BrandScope>
  );
}
