"use client";

import { Fragment, useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import {
  PHASE_LABELS,
  TIERS,
  MATURITY_STYLE,
  profileToScope,
  stepApplies,
  type MatrixRow,
} from "@/lib/content/process-scope";

export function ProcessMapView({ rows }: { rows: MatrixRow[] }) {
  const { profile } = useOrgState();
  const configured = profile !== null;
  const [scoped, setScoped] = useState(configured);
  const scope = profileToScope(profile as Record<string, unknown> | null);

  const view: MatrixRow[] =
    scoped && configured
      ? rows
          .map((r) => {
            const cells = r.cells.map((c) => ({
              steps: c.steps.filter((s) => stepApplies(s.appliesWhen, scope)),
            }));
            const docCount = cells.reduce(
              (n, c) => n + c.steps.reduce((x, s) => x + s.produces.length, 0),
              0,
            );
            return { ...r, cells, docCount };
          })
          .filter((r) => r.cells.some((c) => c.steps.length))
      : rows;

  const shownSteps = view.reduce(
    (n, r) => n + r.cells.reduce((x, c) => x + c.steps.length, 0),
    0,
  );
  const shownDocs = view.reduce((n, r) => n + r.docCount, 0);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {configured ? (
          <div className="inline-flex rounded-full border border-line bg-card p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setScoped(true)}
              className={
                "rounded-full px-3 py-1 font-medium transition " +
                (scoped ? "bg-teal-800 text-white" : "text-teal-800")
              }
            >
              My device
            </button>
            <button
              type="button"
              onClick={() => setScoped(false)}
              className={
                "rounded-full px-3 py-1 font-medium transition " +
                (!scoped ? "bg-teal-800 text-white" : "text-teal-800")
              }
            >
              Full library
            </button>
          </div>
        ) : null}
        <span className="text-xs text-muted">
          {scoped && configured
            ? `Scoped to your device (${scope.regulation}${
                scope.characteristics.length
                  ? " · " + scope.characteristics.join(", ")
                  : ""
              }) — `
            : "Full library — "}
          {view.length} processes · {shownSteps} steps · {shownDocs} documents
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {[1, 2, 3, 4].map((p) => (
          <span
            key={p}
            className="rounded-full border border-line bg-cream px-2.5 py-0.5 font-medium text-teal-800"
          >
            Phase {p} · {PHASE_LABELS[p]}
          </span>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
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
              const tr = view.filter((r) => r.tier === tier.key);
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
    </>
  );
}
