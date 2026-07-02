import { redirect } from "next/navigation";
import { getActivityLog } from "@/lib/db/activity-log";
import { getActiveOrg } from "@/lib/auth/org";

export const metadata = { title: "Activity log" };

// Audit trails are unambiguous in UTC; format deterministically to avoid
// server/client hydration drift.
function fmt(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export default async function ActivityLogPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");
  const entries = await getActivityLog(org.id, 100);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Activity log
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        A record of changes in{" "}
        <span className="font-medium text-teal-800">{org.name}</span> — status
        updates, document downloads, and team &amp; plan changes. Newest first,
        times in UTC.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-line bg-cream px-5 py-10 text-center text-sm text-muted">
          No activity recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-cream text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-4 py-2.5 font-semibold">Who</th>
                <th className="px-4 py-2.5 font-semibold">Action</th>
                <th className="px-4 py-2.5 font-semibold">Item</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {fmt(e.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-ink">{e.actorEmail ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink">
                    {e.label}
                    {e.detail ? (
                      <span className="ml-1.5 text-muted">· {e.detail}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    {e.entityId ? (
                      <span className="rounded-md border border-line bg-card px-1.5 py-0.5 text-[12px] font-medium text-teal-700">
                        {e.entityId}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
