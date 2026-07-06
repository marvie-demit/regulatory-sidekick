"use client";

import { useState } from "react";
import { RoadmapGrid, type TAct } from "@/components/content/RoadmapGrid";
import { TimelineView, type TimelineAct } from "@/components/content/TimelineView";

// One "Plan" feature, two lenses: the start-order grid (what to do, in what order)
// and the Timeline/Gantt (how long, when). They read the same schedule (es/ef/dur)
// — the grid on a per-phase order axis, the Timeline on a whole-project time axis.

export function RoadmapViews({
  phaseActs,
  allActs,
  projectDays,
  critSet,
  plan,
  phase,
}: {
  phaseActs: TAct[];
  allActs: TimelineAct[];
  projectDays: number;
  critSet: Record<string, number>;
  plan?: string;
  phase: number;
}) {
  const [mode, setMode] = useState<"grid" | "timeline">("grid");
  const seg = (m: "grid" | "timeline", label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={
        "px-3 py-1.5 transition " +
        (mode === m
          ? "bg-teal-800 text-white"
          : "text-muted hover:text-teal-900")
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-line text-[12px] font-medium">
        {seg("grid", "Order grid")}
        {seg("timeline", "Timeline")}
      </div>
      {mode === "grid" ? (
        <RoadmapGrid acts={phaseActs} critSet={critSet} plan={plan} phase={phase} />
      ) : (
        <TimelineView acts={allActs} projectDays={projectDays} critSet={critSet} />
      )}
    </div>
  );
}
