"use client";

import { useState } from "react";
import Link from "next/link";
import { hasFullAccess, SAMPLE_ACTIVITY_ID } from "@/lib/auth/access";
import type { Standard } from "@/lib/content/types";

const PH = ["P1", "P2", "P3", "P4"];
const COLS = "grid grid-cols-[minmax(150px,1.5fr)_repeat(4,1fr)] gap-px";

export function MatrixView({
  standards,
  plan,
}: {
  standards: Standard[];
  plan?: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const anyClosed = standards.some((s) => !open[s.std]);
  const full = hasFullAccess(plan);

  function toggleAll() {
    if (anyClosed) {
      const o: Record<string, boolean> = {};
      standards.forEach((s) => (o[s.std] = true));
      setOpen(o);
    } else setOpen({});
  }

  return (
    <>
      <div className="filters mt-4">
        <button type="button" className="btn ghost" onClick={toggleAll}>
          {anyClosed ? "Expand all" : "Collapse all"}
        </button>
      </div>
      <div className="overflow-x-auto">
      <div className="min-w-[680px] overflow-hidden rounded-lg border border-line">
        <div className={`${COLS} bg-line text-xs font-semibold`}>
          <div className="bg-teal-800 px-3 py-2 text-white">
            Standard / clause
          </div>
          {[1, 2, 3, 4].map((nn) => (
            <div key={nn} className="bg-teal-800 px-3 py-2 text-center text-white">
              Phase {nn}
            </div>
          ))}
        </div>

        {standards.map((s) => {
          const isOpen = !!open[s.std];
          return (
            <div key={s.std}>
              <div className={`${COLS} bg-line`}>
                <button
                  onClick={() =>
                    setOpen((p) => ({ ...p, [s.std]: !p[s.std] }))
                  }
                  className="flex items-center gap-2 bg-cream px-3 py-2 text-left text-sm font-semibold text-teal-900"
                >
                  <span
                    className={`inline-block text-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▸
                  </span>
                  {s.std}
                </button>
                {PH.map((p) => {
                  const c = (s.phaseActs[p] || []).length;
                  return (
                    <div
                      key={p}
                      className={`flex items-center justify-center bg-card px-3 py-2 text-sm ${c ? "font-semibold text-teal-800" : "text-line"}`}
                    >
                      {c || "·"}
                    </div>
                  );
                })}
              </div>

              {isOpen &&
                s.clauses.map((cl, ci) => (
                  <div key={ci} className={`${COLS} bg-line`}>
                    <div className="bg-card px-3 py-1.5 pl-8 text-[12px] text-muted">
                      {cl.c}
                    </div>
                    {PH.map((p) => {
                      const ids = cl.acts[p] || [];
                      return (
                        <div
                          key={p}
                          className="flex flex-wrap items-center justify-center gap-1 bg-card px-2 py-1.5"
                        >
                          {ids.map((id) =>
                            !full && id !== SAMPLE_ACTIVITY_ID ? (
                              <Link
                                key={id}
                                href="/pricing"
                                className="rounded bg-[#edefec] px-1.5 text-[10px] font-semibold text-[#9aa39d]"
                              >
                                {id}
                              </Link>
                            ) : (
                              <Link
                                key={id}
                                href={`/activity/${id}`}
                                className="rounded bg-cream2 px-1.5 text-[10px] font-semibold text-teal-700 hover:text-coral"
                              >
                                {id}
                              </Link>
                            ),
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
