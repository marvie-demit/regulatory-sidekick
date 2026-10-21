import Link from "next/link";
import { confirmConsent } from "@/lib/readiness/store";

// The double opt-in landing page: the half of consent that proves the address.
//
// A tick box on a public form says only that someone typed an address, which is
// not what Art. 7(1) GDPR asks us to be able to demonstrate. Opening a link
// sent TO the address is. So readiness_leads starts every request as `pending`
// and nothing but this page can make it real (migration 0025).
//
// Public by token, like the shared result. The write goes through
// readiness_confirm_consent() on the ordinary anon client — a security-definer
// function that flips one row's consent for a caller holding its 256-bit token
// and returns a bare boolean. Deliberately not the address: echoing it would
// turn a guessed token into a disclosure.
//
// Confirming on GET is the usual shape and the one people expect, at the known
// cost that a corporate email scanner which follows links can confirm on the
// recipient's behalf. The stricter version puts a button here and writes on
// POST. Worth revisiting if the list is ever used for anything a mis-confirmed
// address would make awkward; for a quarterly regulatory changelog the extra
// click loses more real subscribers than the scanner adds false ones.
//
// NOTE: nothing sends this link yet. The project has no transactional mailer
// (no provider in package.json), so the confirmation email is the one piece
// still missing — which means the list stays empty rather than unlawful. See
// docs/READINESS-PRIVACY-NOTE.md.

export const metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

export default async function ConfirmConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ok = await confirmConsent(token);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-sm font-semibold text-teal-600 hover:text-coral"
      >
        ← Regulatory Sidekick
      </Link>

      {ok ? (
        <section className="mt-10 rounded-xl border-2 border-teal-200 bg-teal-50 px-6 py-6">
          <h1 className="font-display text-2xl font-semibold text-teal-900">
            Confirmed — thank you.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            You will get the quarterly regulatory changelog: what changed in
            MDR/IVDR and ISO 13485 guidance, and which controlled documents it
            touches. Nothing else, and you can stop it at any time by replying
            to any one of them.
          </p>
        </section>
      ) : (
        <section className="mt-10 rounded-xl border border-line bg-cream px-6 py-6">
          <h1 className="font-display text-2xl font-semibold text-teal-900">
            That link didn&apos;t work.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            It may have been mistyped, or it may belong to a request that was
            already withdrawn. Nothing has changed, and you are not subscribed
            to anything.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            If you meant to ask for the changelog, the box at the end of the{" "}
            <Link
              href="/readiness"
              className="font-semibold text-teal-700 hover:underline"
            >
              readiness assessment
            </Link>{" "}
            is where to tick it.
          </p>
        </section>
      )}

      <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-6 text-xs">
        <Link
          href="/readiness"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Readiness assessment
        </Link>
        <Link
          href="/pricing"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Pricing
        </Link>
        <Link
          href="/privacy"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Privacy
        </Link>
      </footer>
    </main>
  );
}
