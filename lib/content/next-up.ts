// "What can we actually start now?" — the SINGLE source of truth for the
// Next-up recommendation. Shared by the dashboard and the agent API so a
// connected agent works the same order a human sees on screen.
//
// Pure: a function of (activities, status, device profile). No I/O.

import { actInScope, type ScopeProfile } from "@/lib/content/scope";

export type PlannableAct = {
  id: string;
  phaseN: number;
  wave: number;
  ord: number;
  depends: string;
  mods?: string[];
  reg?: string[];
};

export type Recommendation<T> = { a: T; blockers: string[] };

export type Plan<T> = {
  /** activities that apply to this device profile */
  scoped: T[];
  /** earliest phase that still has unfinished work (1–4) */
  currentPhase: number;
  /** current-phase, not-started, every in-scope dependency closed */
  ready: Recommendation<T>[];
  /** current-phase, not-started, still waiting on something */
  blocked: Recommendation<T>[];
};

export const isClosed = (s: string | undefined) => s === "Done" || s === "N-A";
export const isNotStarted = (s: string | undefined) => !s || s === "Not started";

export function planNextUp<T extends PlannableAct>(
  acts: T[],
  status: Record<string, string>,
  profile: ScopeProfile,
): Plan<T> {
  const scoped = acts.filter((a) => actInScope(a, profile));
  const inScopeIds = new Set(scoped.map((a) => a.id));

  const closed = (id: string) => isClosed(status[id]);
  // Dependencies outside the device profile can never close, so they must not
  // block — only in-scope, unfinished predecessors count.
  const blockersOf = (a: T) =>
    (a.depends || "")
      .split(",")
      .map((s) => s.trim())
      .filter((d) => d && d !== "-" && inScopeIds.has(d) && !closed(d));

  // Scoping to the current phase matters: a dependency-free Phase-4 activity is
  // technically unblocked but is not what to do today.
  const currentPhase =
    [1, 2, 3, 4].find((n) =>
      scoped.some((a) => a.phaseN === n && !closed(a.id)),
    ) ?? 4;

  const recommended = scoped
    .filter((a) => a.phaseN === currentPhase && isNotStarted(status[a.id]))
    .sort((x, y) => x.wave - y.wave || x.ord - y.ord)
    .map((a) => ({ a, blockers: blockersOf(a) }));

  return {
    scoped,
    currentPhase,
    ready: recommended.filter((r) => !r.blockers.length),
    blocked: recommended.filter((r) => r.blockers.length),
  };
}
