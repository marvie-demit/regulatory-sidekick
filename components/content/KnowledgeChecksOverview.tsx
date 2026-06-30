"use client";

import Link from "next/link";
import { useOrgState } from "@/components/app-shell/StateProvider";

const PC = ["var(--t5)", "var(--t6)", "var(--t8)", "var(--t9)"];

export function KnowledgeChecksOverview({
  counts,
  totalQ,
}: {
  counts: { phase: number; focus: string; n: number }[];
  totalQ: number;
}) {
  const { quiz: scores } = useOrgState();

  const attempted = counts.filter((c) => scores[c.phase] != null).length;
  let bestSum = 0;
  counts.forEach((c) => {
    if (scores[c.phase] != null) bestSum += scores[c.phase];
  });

  const kpis = [
    { l: "Self-tests", v: "4", s: totalQ + " questions in total" },
    { l: "Phases attempted", v: attempted + " / 4", s: "knowledge checks taken" },
    { l: "Best score", v: bestSum + " / " + totalQ, s: "across all questions" },
  ];

  return (
    <>
      <div className="kpis">
        {kpis.map((k, i) => (
          <div key={i} className="kpi">
            <div className="kl">{k.l}</div>
            <div className="kv">{k.v}</div>
            <div className="ks">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="pgrid" style={{ marginTop: 14 }}>
        {counts.map((c, i) => {
          const b = scores[c.phase];
          const badge =
            b != null ? (
              b === c.n ? (
                <span className="qzbadge pass">
                  Passed · {b}/{c.n}
                </span>
              ) : (
                <span className="qzbadge">
                  Best {b}/{c.n}
                </span>
              )
            ) : (
              <span className="qzbadge none">Not taken yet</span>
            );
          return (
            <Link
              key={c.phase}
              href={`/knowledge-checks/${c.phase}`}
              className="pgcard"
              aria-label={`Phase ${c.phase} knowledge check, ${c.n} questions`}
            >
              <div className="bar" style={{ background: PC[i] }} />
              <div className="bd">
                <div className="ph">PHASE {c.phase}</div>
                <h3>{c.focus}</h3>
                <div className="qzrow">
                  {badge}
                  <span className="qzm">{c.n} questions</span>
                </div>
                <div className="qzstart">Start check →</div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
