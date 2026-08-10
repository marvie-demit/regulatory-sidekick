import { redirect } from "next/navigation";
import { getScopedPartner } from "@/lib/partners/context";
import { getPartnerTeam } from "@/lib/partners/members";
import { PartnerTeamManager } from "@/components/partner/PartnerTeamManager";

export const metadata = { title: "Partner team" };

export default async function PartnerTeamPage() {
  const partner = await getScopedPartner();
  if (!partner) redirect("/dashboard");

  const team = await getPartnerTeam(partner.id, partner.staffLimit);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">Team</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        People at {partner.name} who can create codes and see your portfolio.
        These seats are separate from the seats inside a customer&apos;s
        workspace.
      </p>
      <PartnerTeamManager
        team={team}
        isAdmin={partner.role === "admin"}
        suspended={partner.status !== "active"}
      />
    </main>
  );
}
