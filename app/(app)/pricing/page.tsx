import { CheckoutForm } from "@/components/billing/CheckoutForm";
import { RedeemField } from "@/components/auth/RedeemField";
import { hasFullAccess } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { counts } from "@/lib/content/content";
import type { ContentCounts } from "@/lib/content/content";
import {
  ELIGIBILITY_STATEMENT,
  getTier,
  offeredOptions,
  type Tier,
} from "@/lib/billing/catalog";
import { stripeConfigured } from "@/lib/stripe/client";

export const metadata = { title: "Pricing" };

// Fallback route while Stripe is unconfigured, and the way consultants get in
// touch regardless — the partner licence is negotiated, not self-served.
const CONTACT = "regulatory.sidekick@notjustany.tech";

// Built from the live corpus counts, not hand-written — on a product sold on
// depth, a stale depth claim is both a conversion and a credibility problem.
function features(n: ContentCounts): string[] {
  return [
    `All ${n.activities} activities and ${n.subActivities} deep sub-activities`,
    `All ${n.documents} controlled-document templates — view, customise, download`,
    "Checklist progress, Gantt timeline, and up to 3 team members",
    "Per-activity evidence uploads (private to your workspace)",
    "Standards matrix, process map, device-profile scoping",
    "12 months of updates and support included",
  ];
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink">
      <span className="mt-0.5 font-bold text-teal-600">✓</span>
      <span>{children}</span>
    </li>
  );
}

// One card per tier. Self-serve checkout appears only when Stripe is configured
// AND this tier has at least one price wired up; otherwise the original mailto:
// flow stays in place, so the page never shows a button that cannot complete.
function TierCard({
  tier,
  full,
  isAdmin,
  featured,
  subtitle,
  instalmentCopy,
  mailSubject,
  cta,
}: {
  tier: Tier;
  full: boolean;
  isAdmin: boolean;
  featured: boolean;
  subtitle: React.ReactNode;
  instalmentCopy: string;
  mailSubject: string;
  cta: string;
}) {
  const options = stripeConfigured() ? offeredOptions(tier) : [];
  const canBuy = options.length > 0;

  return (
    <div
      className={
        featured
          ? "relative rounded-xl border-2 border-coral bg-card p-6 shadow-sm"
          : "rounded-xl border border-line bg-card p-6 shadow-sm"
      }
    >
      {featured ? (
        <span className="absolute right-4 top-4 rounded-full bg-coral px-2.5 py-0.5 text-[11px] font-bold text-white">
          Save 70%
        </span>
      ) : null}
      <div
        className={`text-xs font-bold uppercase tracking-wide ${featured ? "text-coral" : "text-teal-800"}`}
      >
        {tier.label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold text-teal-900">
          {tier.headline}
        </span>
        <span className="text-sm text-muted">one-time</span>
      </div>
      <div className="mt-1 text-sm text-muted">{instalmentCopy}</div>
      <p className="mt-3 text-sm text-ink">{subtitle}</p>

      {full ? (
        <div className="mt-5 inline-flex rounded-full bg-cream2 px-5 py-2.5 text-sm font-semibold text-teal-800">
          Active
        </div>
      ) : canBuy && !isAdmin ? (
        // Buying sets the plan for the whole workspace, and startCheckout
        // rejects non-admins server-side. Say so instead of offering a button
        // that will only fail.
        <p className="mt-5 rounded-lg border border-line bg-cream px-3.5 py-2.5 text-sm text-muted">
          Ask a workspace admin to purchase access.
        </p>
      ) : canBuy ? (
        <CheckoutForm
          tier={tier.id}
          options={options.map((o) => ({ id: o.id, label: o.label }))}
          requiresEligibility={tier.requiresEligibility}
          eligibilityStatement={ELIGIBILITY_STATEMENT}
          cta={cta}
          variant={featured ? "primary" : "secondary"}
        />
      ) : (
        <a
          href={`mailto:${CONTACT}?subject=${encodeURIComponent(mailSubject)}`}
          className={
            featured
              ? "mt-5 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
              : "mt-5 inline-flex rounded-full border border-line bg-card px-6 py-2.5 text-sm font-semibold text-teal-800 transition hover:border-coral"
          }
        >
          {cta}
        </a>
      )}
    </div>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const org = await getActiveOrg();
  const full = hasFullAccess(org?.plan);
  const isAdmin = org?.role === "admin";

  const practitioner = getTier("practitioner")!;
  const standard = getTier("standard")!;
  const anySelfServe =
    stripeConfigured() &&
    (offeredOptions(practitioner).length > 0 || offeredOptions(standard).length > 0);

  return (
    <main className="px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Full access
      </h1>
      <p className="lead">
        One purchase unlocks the entire implementation. Same features whichever
        price you qualify for — only the price and who it&apos;s for differ.
      </p>

      {/* Access is granted by the Stripe webhook, not by this redirect, so the
          success banner promises activation rather than asserting it. */}
      {checkout === "success" && !full ? (
        <div className="mb-6 max-w-3xl rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-800">
          <b>Payment received — thank you.</b> We&apos;re activating your
          workspace now; it usually takes a few seconds. Refresh this page, and
          if access hasn&apos;t appeared within a couple of minutes email{" "}
          <a className="font-medium hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </div>
      ) : null}
      {checkout === "cancelled" ? (
        <div className="mb-6 max-w-3xl rounded-xl border border-line bg-cream px-5 py-4 text-sm text-ink">
          Checkout cancelled — nothing was charged.
        </div>
      ) : null}

      {full ? (
        <div className="mb-6 inline-flex rounded-full bg-ok px-5 py-2 text-sm font-semibold text-white">
          ✓ Your organisation has Full access
        </div>
      ) : null}

      <div className="sect-h">Everything you get</div>
      <ul className="grid max-w-3xl gap-2.5 sm:grid-cols-2">
        {features(counts()).map((f, i) => (
          <Check key={i}>{f}</Check>
        ))}
      </ul>

      <div className="sect-h">Choose your price</div>
      <div className="grid max-w-3xl items-start gap-5 sm:grid-cols-2">
        <TierCard
          tier={practitioner}
          full={full}
          isAdmin={isAdmin}
          featured
          instalmentCopy="or €600 × 3 · €300 × 6"
          cta="Buy Practitioner"
          mailSubject="Practitioner access application"
          subtitle={
            <>
              For <b className="text-teal-900">startups</b> (pre-seed) and{" "}
              <b className="text-teal-900">
                individual QA/RA managers or solo practitioners
              </b>{" "}
              — your own organisation, up to 3 users.
            </>
          }
        />
        <TierCard
          tier={standard}
          full={full}
          isAdmin={isAdmin}
          featured={false}
          instalmentCopy="or €2,000 × 3 · €1,000 × 6"
          cta="Buy Standard"
          mailSubject="Full access purchase"
          subtitle={
            <>
              For <b className="text-teal-900">companies and teams</b> rolling
              out their own QMS.
            </>
          }
        />
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
        Prices exclude VAT; the applicable rate is calculated at checkout and EU
        businesses can enter a VAT number for reverse charge. 12 months of
        updates and support are included; then an optional €2,000 / year keeps
        them coming.{" "}
        {anySelfServe
          ? "Practitioner pricing is self-declared at checkout — see the eligibility criteria on the card."
          : "Practitioner pricing is by application (proof of stage). Online checkout is being set up — for now, get in touch and we'll activate your account."}
      </p>
    </main>
  );
}
