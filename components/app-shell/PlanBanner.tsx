import Link from "next/link";

// Persistent banner warning that a paid plan is about to lapse, or has lapsed
// (the effective plan has already fallen back to Explore). Server-rendered from
// the org's plan_expires_at. Nothing shows for free or non-expiring plans.
const DAY = 86_400_000;

export function PlanBanner({
  planExpiresAt,
}: {
  planExpiresAt: string | null;
}) {
  if (!planExpiresAt) return null;
  const days = Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / DAY);

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
