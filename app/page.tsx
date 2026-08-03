import Link from "next/link";
import { ImmersiveBackground } from "@/components/landing/ImmersiveBackground";
import { counts } from "@/lib/content/content";

export default function Home() {
  const n = counts();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <ImmersiveBackground />
      <p className="font-display text-xs font-medium uppercase tracking-[0.35em] text-teal-600">
        ISO 13485 · EU MDR · IVDR
      </p>
      <h1 className="font-display mt-4 text-5xl font-semibold tracking-tight text-teal-900 sm:text-7xl">
        Regulatory Sidekick
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
        A stepwise implementation for EU&nbsp;MDR and IVDR — including the setup
        of a QMS under ISO&nbsp;13485 and key FDA requirements — made for
        manufacturers, by manufacturers.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <a
          href="/dashboard"
          className="rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Open the platform
        </a>
        <a
          href="/login"
          className="rounded-full border border-line bg-card px-6 py-3 text-sm font-medium text-teal-800 transition hover:bg-white"
        >
          Sign in
        </a>
      </div>
      <p className="mt-5 text-sm text-muted">
        {n.activities} activities · {n.phases} phases · {n.documents} documents
      </p>

      {/* The legibility veil is sized to the copy column and fades out well
          before the bottom edge, so the footer carries its own cream scrim —
          otherwise these links would sit directly on the helices. */}
      <footer className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 bg-gradient-to-t from-cream via-cream/90 to-transparent px-6 pb-6 pt-12 text-xs">
        <Link
          href="/impressum"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Impressum
        </Link>
        <span className="text-muted" aria-hidden="true">
          ·
        </span>
        <Link
          href="/privacy"
          className="font-semibold text-teal-800 transition hover:text-coral"
        >
          Datenschutz / Privacy
        </Link>
      </footer>
    </main>
  );
}
