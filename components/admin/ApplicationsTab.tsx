"use client";

import {
  ApplicationReview,
  type ReviewItem,
} from "@/components/startup/ApplicationReview";
import type { AdminApplication } from "@/lib/admin/data";

// Startup Programme review queue, as the platform admin sees it.
//
// A thin wrapper on purpose. The queue itself is shared with the partner console
// (components/startup/ApplicationReview) — the two reviewers see and do the same
// thing, and the difference between them lives in the data layer, where one goes
// through the service role and the other through partner_startup_applications().
// Duplicating the UI here would be the easiest way to let those two drift.
export function ApplicationsTab({ items }: { items: AdminApplication[] }) {
  const rows: ReviewItem[] = items.map((a) => ({ ...a, subject: a.orgName }));
  return <ApplicationReview items={rows} spaced={false} />;
}
