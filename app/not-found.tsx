import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-xs font-medium uppercase tracking-[0.35em] text-teal-600">
        404
      </p>
      <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-teal-900">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Go to dashboard
        </Link>
        <Link
          href="/library"
          className="rounded-full border border-line bg-card px-6 py-2.5 text-sm font-medium text-teal-800 transition hover:bg-white"
        >
          Browse the library
        </Link>
      </div>
    </main>
  );
}
