"use client";

import { useOrgState } from "@/components/app-shell/StateProvider";
import { toast } from "@/lib/toast";

type Step = { t: string; d: string };
type Group = { role: string; steps: Step[] };

// Interactive task list for the activity page, backed by the org-state context.
export function ActivityTasks({ id, groups }: { id: string; groups: Group[] }) {
  const { tasks, status, toggleTask, setStatus } = useOrgState();
  const done = tasks[id] || {};
  const st = status[id] || "Not started";

  function onToggle(i: number, checked: boolean) {
    const wasNotStarted = (status[id] || "Not started") === "Not started";
    toggleTask(id, i, checked);
    if (checked && wasNotStarted) toast("Status set to In progress");
  }
  function markDone() {
    setStatus(id, "Done");
    toast("Marked Done");
  }

  // each group's starting flat index (matches the checklist's flatMap order)
  let off = 0;
  const grouped = groups.map((g) => {
    const start = off;
    off += g.steps.length;
    return { role: g.role, steps: g.steps, start };
  });
  const total = off;
  let doneCount = 0;
  for (let i = 0; i < total; i++) if (done[i]) doneCount++;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-[#e7f0ec] px-2 py-0.5 font-semibold text-teal-700">
          {doneCount}/{total}
        </span>
        done
      </div>
      <div className="space-y-4">
        {grouped.map((g, gi) => (
          <div key={gi}>
            <div className="mb-1 text-xs font-semibold text-teal-600">
              {g.role}
            </div>
            <ul className="space-y-0.5">
              {g.steps.map((s, si) => {
                const i = g.start + si;
                const on = !!done[i];
                return (
                  <li key={si}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 text-sm leading-relaxed hover:bg-cream/60">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => onToggle(i, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <span className={on ? "text-muted line-through" : ""}>
                        <b
                          className={
                            "font-semibold " + (on ? "" : "text-teal-900")
                          }
                        >
                          {s.t}
                        </b>
                        {s.d ? <> — {s.d}</> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {total > 0 && doneCount === total && st === "In progress" && (
        <button type="button" className="donenudge" onClick={markDone}>
          ✓ All tasks complete — mark activity Done?
        </button>
      )}
    </div>
  );
}
