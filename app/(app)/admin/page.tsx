import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { listAccessCodes, listOrgs } from "@/lib/admin/data";
import { listPartners } from "@/lib/partners/data";
import { isPlatformAdmin } from "@/lib/auth/platform";

export const metadata = { title: "Platform admin" };

export default async function AdminPage() {
  if (!(await isPlatformAdmin())) redirect("/dashboard");
  const [codes, orgs, partners] = await Promise.all([
    listAccessCodes(),
    listOrgs(),
    listPartners(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Platform admin
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Manage partners and their licence allowances, mint access codes, grant or
        revoke full access for any organization, and generate sign-in or
        password-recovery links for users.
      </p>
      <AdminConsole codes={codes} orgs={orgs} partners={partners} />
    </main>
  );
}
