import { redirect } from "next/navigation";
import { getScopedPartner } from "@/lib/partners/context";
import {
  getPartnerApplications,
  getPartnerOverview,
  getPartnerPortfolio,
  listPartnerCodes,
} from "@/lib/partners/console";
import { ApplicationReview } from "@/components/startup/ApplicationReview";
import { PartnerConsole } from "@/components/partner/PartnerConsole";

export const metadata = { title: "Partner console" };

export default async function PartnerPage() {
  const partner = await getScopedPartner();
  if (!partner) redirect("/dashboard");

  const [overview, codes, portfolio, applications] = await Promise.all([
    getPartnerOverview(partner.id),
    listPartnerCodes(partner.id),
    getPartnerPortfolio(partner.id),
    getPartnerApplications(partner.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        {partner.name}
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Create access codes for your portfolio companies and track how many
        licences you have left.
      </p>
      <PartnerConsole
        partnerName={partner.name}
        isAdmin={partner.role === "admin"}
        suspended={partner.status !== "active"}
        defaultGrantDays={partner.defaultGrantDays}
        maxGrantDays={partner.maxGrantDays}
        defaultRedeemDays={partner.defaultRedeemDays}
        overview={overview}
        codes={codes}
        portfolio={portfolio}
      />
      {/* Only admins decide. Staff can see the queue — they already see the
          portfolio — but the buttons would be refused by the RPC. */}
      {partner.role === "admin" ? (
        <ApplicationReview
          items={applications.map((a) => ({ ...a, subject: a.workspaceName }))}
        />
      ) : null}
    </main>
  );
}
