import Link from "next/link";
import { ApplicationForm } from "@/components/startup/ApplicationForm";
import { getActiveOrg } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";
import { ELIGIBILITY_STATEMENT } from "@/lib/billing/catalog";
import { getRequestBrand } from "@/lib/partners/brand";
import { getLatestApplication, getLiveApplication } from "@/lib/startup/queries";

export const metadata = { title: "Startup Programme" };

const CONTACT = "regulatory.sidekick@notjustany.tech";

export default async function StartupProgrammePage() {
  const org = await getActiveOrg();

  if (!org)
    return (
      <main className="px-8 py-10">
        <p className="lead">No active workspace.</p>
      </main>
    );

  // Already bought? There is nothing to apply for, and a form that leads
  // nowhere is worse than a sentence saying so.
  if (hasFullAccess(org.plan))
    return (
      <main className="px-8 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
          Startup Programme
        </h1>
        <p className="lead">
          {org.name} already has full access, so there&rsquo;s nothing to apply
          for.
        </p>
        <Link href="/dashboard" className="lnk mt-4 inline-block text-sm">
          ← Back to the dashboard
        </Link>
      </main>
    );

  const live = await getLiveApplication(org.id);
  const latest = live ?? (await getLatestApplication(org.id));
  const brand = await getRequestBrand();

  const declined = !live && latest?.status === "declined";

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Startup Programme
      </h1>
      <p className="lead">
        €1,800 instead of €6,000, for early startups that genuinely can&rsquo;t
        fund CE marking yet. Four short sections, about five minutes.
      </p>

      {org.role !== "admin" ? (
        <p className="mt-6 rounded-lg border border-line bg-tint px-4 py-3 text-sm text-muted">
          Only a workspace admin can apply. Ask an admin of {org.name} to
          complete this.
        </p>
      ) : declined ? (
        <div className="mt-6 rounded-lg border border-line bg-cream px-4 py-3 text-sm text-ink">
          <b>Your previous application wasn&rsquo;t approved.</b>
          {latest?.decision_note ? (
            <p className="mt-1 text-muted">{latest.decision_note}</p>
          ) : null}
          <p className="mt-2">
            You&rsquo;re welcome to apply again below if things have changed, or{" "}
            <a className="lnk" href={`mailto:${CONTACT}`}>
              talk to us
            </a>
            .
          </p>
        </div>
      ) : null}

      {org.role === "admin" ? (
        <ApplicationForm
          application={live}
          partnerName={brand?.name ?? null}
          declaration={ELIGIBILITY_STATEMENT}
        />
      ) : null}
    </main>
  );
}
