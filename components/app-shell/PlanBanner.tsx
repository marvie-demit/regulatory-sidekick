import Link from "next/link";

// Persistent banner warning that a paid plan is about to lapse, or has lapsed
// (the effective plan has already fallen back to Explore). Nothing shows for
// free or non-expiring plans.
//
// Takes the day count rather than the date. Deriving it here meant calling
// Date.now() during render, which the React Compiler rejects — and rightly:
// "how many days until X" is a fact about when the request happened, not about
// the component. The layout knows the request time; this only knows how to say
// it. That also makes the component trivially testable at any day count.
const DAY = 86_400_000;

// Falsy, not `=== null`: the original guard was `if (!planExpiresAt)`, so an
// empty string meant "no expiry". Under a strict null check it would instead
// reach new Date("") and yield NaN, which compares false against every
// threshold — the banner would silently never appear.
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  return Number.isFinite(days) ? days : null;
}

export function PlanBanner({ daysRemaining }: { daysRemaining: number | null }) {
  if (daysRemaining === null) return null;
  const days = daysRemaining;

  if (days < 0) {
    return (
      <div
        role="status"
        className="mx-8 mt-6 rounded-lg border border-coral bg-white px-4 py-3 text-sm text-ink"
      >
        <b className="text-coral">Full access has expired.</b> Your workspace is
        back on the Explore plan.{" "}
        <Link href="/pricing" className="font-medium text-teal-700 hover:underline">
          Renew access
        </Link>
        .
      </div>
    );
  }
  if (days <= 14) {
    return (
      <div
        role="status"
        className="mx-8 mt-6 rounded-lg border border-coral bg-white px-4 py-3 text-sm text-ink"
      >
        <b className="text-teal-900">
          Full access ends in {days} day{days === 1 ? "" : "s"}.
        </b>{" "}
        <Link href="/pricing" className="font-medium text-teal-700 hover:underline">
          Renew to keep everything
        </Link>
        .
      </div>
    );
  }
  return null;
}
