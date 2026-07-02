import { Fragment } from "react";
import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/org";
import {
  phaseMatrix,
  modelStats,
  PHASE_LABELS,
  TIERS,
} from "@/lib/content/process";

export const metadata = { title: "Process map" };

const MATURITY_STYLE: Record<string, string> = {
  lean: "text-teal-600",
  full: "text-teal-700",
  govern: "text-coral",
  sustain: "text-coral",
};

export default async function ProcessMapPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  const rows = phaseMatrix();
  const stats = modelStats();

  return (
    <main className="px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Process map
      </h1>
      <p className="lead">
        How the {stats.processes} processes interact across the four phases (the
        ISO&nbsp;13485 §4.1.2 process-interaction map). Each cell is the step a
        process runs in that phase — starting lean and maturing toward
        certification. Every step produces controlled documents: {stats.steps}{" "}
        steps · {stats.docs} documents, with none unaccounted for.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        {[1, 2, 3, 4].map((p) => (
          <span
            key={p}
            className="rounded-full border border-line bg-cream px-2.5 py-0.5 font-medium text-teal-800"
          >
            Phase {p} · {PHASE_LABELS[p]}
          </span>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-48 border-b border-line bg-cream px-3 py-2.5 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted">
                Process
              </th>
              {[1, 2, 3, 4].map((p) => (
                <th
                  key={p}
                  className="border-b border-l border-line bg-cream px-3 py-2.5 text-left align-bottom"
                >
                  <div className="text-xs font-semibold text-teal-900">
                    Phase {p}
                  </div>
                  <div className="text-[11px] font-normal text-muted">
                    {PHASE_LABELS[p]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => {
              const tr = rows.filter((r) => r.tier === tier.key);
              if (!tr.length) return null;
              return (
                <Fragment key={tier.key}>
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-line bg-cream px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800"
                    >
                      {tier.label}
                    </td>
                  </tr>
                  {tr.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="border-b border-line/60 px-3 py-2.5">
                        <div className="font-medium text-teal-900">{r.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted">
                          {r.standards.join(" · ")}
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                          {r.docCount} docs
                        </div>
                      </td>
                      {r.cells.map((c, i) => (
                        <td
                          key={i}
                          className="border-b border-l border-line/50 px-2 py-2"
                        >
                          {c.steps.length ? (
                            c.steps.map((s) => (
                              <div
                                key={s.id}
                                title={s.produces.join(", ")}
                                className="mb-1.5 rounded-md border border-line bg-cream px-2 py-1 last:mb-0"
                              >
                                <div className="text-[12px] leading-snug text-teal-900">
                                  {s.title}
                                </div>
                                <div
                                  className={`mt-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                    MATURITY_STYLE[s.maturity] ?? "text-muted"
                                  }`}
                                >
                                  {s.maturity}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-line">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        This is the full library map. Your device profile determines which of
        these processes and steps apply to you — the same profile that scopes
        your roadmap and document library.
      </p>
    </main>
  );
}
