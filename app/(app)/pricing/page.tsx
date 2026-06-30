import { RedeemField } from "@/components/auth/RedeemField";
import { hasFullAccess } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";

export const metadata = { title: "Pricing" };

// Where "Apply" / "Contact" go until Stripe checkout exists. Swap for a real
// sales address or form before a public launch.
const CONTACT = "marvie.demit@vividsolutions.io";

const FEATURES = [
  "All 53 activities and 197 deep sub-activities",
  "All 275 controlled-document templates — view, customise, download",
  "Checklist progress, Gantt timeline, evidence uploads, full team",
  "Standards matrix, knowledge checks, device-profile scoping",
  "12 months of updates and support included",
];

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink">
      <span className="mt-0.5 font-bold text-teal-600">✓</span>
      <span>{children}</span>
    </li>
  );
}

export default async function PricingPage() {
  const org = await getActiveOrg();
  const full = hasFullAccess(org?.plan);

  return (
    <main className="px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Full access
      </h1>
      <p className="lead">
        One purchase unlocks the entire implementation. Same features whichever
        price you qualify for — only the price and who it&apos;s for differ.
      </p>

      {full ? (
        <div className="mb-6 inline-flex rounded-full bg-ok px-5 py-2 text-sm font-semibold text-white">
          ✓ Your organisation has Full access
        </div>
      ) : null}

      <div className="sect-h">Everything you get</div>
      <ul className="grid max-w-3xl gap-2.5 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <Check key={i}>{f}</Check>
        ))}
      </ul>

      <div className="sect-h">Choose your price</div>
      <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
        {/* Practitioner — prominent */}
        <div className="relative rounded-xl border-2 border-coral bg-card p-6 shadow-sm">
          <span className="absolute right-4 top-4 rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-bold text-white">
            Save 70%
          </span>
          <div className="text-xs font-bold uppercase tracking-wide text-coral">
            Practitioner
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold text-teal-900">
              €1,800
            </span>
            <span className="text-sm text-muted">one-time</span>
          </div>
          <div className="mt-1 text-sm text-muted">or €600 × 3 · €300 × 6</div>
          <p className="mt-3 text-sm text-ink">
            For <b className="text-teal-900">startups</b> (pre-seed) and{" "}
            <b className="text-teal-900">
              individual QA/RA managers or solo practitioners
            </b>{" "}
            — your own organisation, one user. By application.
          </p>
          {full ? (
            <div className="mt-5 inline-flex rounded-full bg-cream2 px-5 py-2.5 text-sm font-semibold text-teal-800">
              Active
            </div>
          ) : (
            <a
              href={`mailto:${CONTACT}?subject=Practitioner%20access%20application`}
              className="mt-5 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Apply for Practitioner
            </a>
          )}
        </div>

        {/* Standard */}
        <div className="rounded-xl border border-line bg-card p-6 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-teal-800">
            Standard
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold text-teal-900">
              €6,000
            </span>
            <span className="text-sm text-muted">one-time</span>
          </div>
          <div className="mt-1 text-sm text-muted">or €2,000 × 3 · €1,000 × 6</div>
          <p className="mt-3 text-sm text-ink">
            For <b className="text-teal-900">companies and teams</b> rolling out
            their own QMS.
          </p>
          {full ? (
            <div className="mt-5 inline-flex rounded-full bg-cream2 px-5 py-2.5 text-sm font-semibold text-teal-800">
              Active
            </div>
          ) : (
            <a
              href={`mailto:${CONTACT}?subject=Full%20access%20purchase`}
              className="mt-5 inline-flex rounded-full border border-line bg-card px-6 py-2.5 text-sm font-semibold text-teal-800 transition hover:border-coral"
            >
              Contact to purchase
            </a>
          )}
        </div>
      </div>

      {!full ? <RedeemField /> : null}

      <div className="mt-6 max-w-3xl rounded-xl border border-line bg-cream px-5 py-4 text-sm text-ink">
        <b className="text-teal-900">Independent consultant?</b> We run a partner
        programme with a licence that covers delivery to your clients —{" "}
        <a
          href={`mailto:${CONTACT}?subject=Consultant%20partner%20programme`}
          className="font-medium text-teal-700 hover:underline"
        >
          get in touch
        </a>{" "}
        and we&apos;ll set you up.
      </div>

      <p className="mt-4 max-w-3xl text-xs text-muted">
        12 months of updates and support are included; then an optional €2,000 /
        year keeps them coming. Practitioner pricing is by application (proof of
        stage). Online checkout is being set up — for now, get in touch and
        we&apos;ll activate your account.
      </p>
    </main>
  );
}
