import Link from "next/link";
import { LOCKED_BLURB } from "@/lib/auth/access";

// Server-rendered "this is locked" panel. The real protection is that the caller
// never loads the locked content — this is just what a free org sees instead.
export function LockedNotice({
  title,
  blurb = LOCKED_BLURB,
}: {
  title?: string;
  blurb?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-8 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream2">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0f3b35"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      {title ? (
        <div className="mt-4 text-sm font-bold text-teal-800">{title}</div>
      ) : null}
      <h2 className="font-display mt-1 text-xl font-semibold text-teal-900">
        Part of Full access
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{blurb}</p>
      <Link
        href="/pricing"
        className="mt-5 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
      >
        Purchase for full access
      </Link>
    </div>
  );
}
