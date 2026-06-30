import { redirect } from "next/navigation";
import { MembersManager } from "@/components/auth/MembersManager";
import { hasFullAccess } from "@/lib/auth/access";
import { getTeam } from "@/lib/auth/members";
import { getActiveOrg } from "@/lib/auth/org";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");
  const team = await getTeam(org.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Members
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Everyone with access to{" "}
        <span className="font-medium text-teal-800">{org.name}</span>.
      </p>
      <MembersManager
        team={team}
        isAdmin={org.role === "admin"}
        isFull={hasFullAccess(org.plan)}
      />
    </main>
  );
}
