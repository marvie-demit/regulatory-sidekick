"use client";

// App-wide error boundary — replaces Next's default stack-trace screen.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-xs font-medium uppercase tracking-[0.35em] text-coral">
        Something went wrong
      </p>
      <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-teal-900">
        Unexpected error
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        Sorry — something broke on our side. You can try again, or head back to
        your dashboard.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-full border border-line bg-card px-6 py-2.5 text-sm font-medium text-teal-800 transition hover:bg-white"
        >
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
