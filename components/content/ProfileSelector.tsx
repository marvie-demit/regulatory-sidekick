"use client";

import { useOrgState } from "@/components/app-shell/StateProvider";
import type { ModuleDef } from "@/lib/content/types";

export function ProfileSelector({
  modules,
  modCounts,
  acts,
  docModules,
  totalDocs,
  totalActs,
}: {
  modules: ModuleDef[];
  modCounts: Record<string, number>;
  acts: { mods: string[] }[];
  docModules: string[];
  totalDocs: number;
  totalActs: number;
}) {
  const { profile, setProfile } = useOrgState();

  const isActive = (code: string) => !profile || !!profile[code];
  const inScopeAct = (a: { mods: string[] }) =>
    !profile ||
    !a.mods.length ||
    a.mods.indexOf("Core") >= 0 ||
    a.mods.some((m) => profile[m]);
  const inScopeDoc = (m: string) => !profile || m === "Core" || !!profile[m];
  const docsInScope = docModules.filter(inScopeDoc).length;
  const actsInScope = acts.filter(inScopeAct).length;
  const activeCodes = profile
    ? modules.filter((m) => profile[m.code]).map((m) => m.code)
    : [];

  function save(p: Record<string, number> | null) {
    setProfile(p);
  }
  function toggle(code: string) {
    const base: Record<string, number> = profile
      ? { ...profile }
      : (() => {
          const o: Record<string, number> = {};
          modules.forEach((m) => (o[m.code] = 1));
          return o;
        })();
    if (base[code]) delete base[code];
    else base[code] = 1;
    save(base);
  }
  function allOn() {
    const o: Record<string, number> = {};
    modules.forEach((m) => (o[m.code] = 1));
    save(o);
  }

  return (
    <>
      <div className="scopebar" style={{ marginTop: 14 }}>
        {profile ? (
          <>
            Active: <b>Core</b>
            {activeCodes.length ? " + " + activeCodes.join(", ") : " only"}
          </>
        ) : (
          <>
            <b>Not configured</b> - everything is shown
          </>
        )}{" "}
        · <b>{docsInScope}</b> / {totalDocs} documents · <b>{actsInScope}</b> /{" "}
        {totalActs} activities in scope
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {modules.map((m) => {
          const on = isActive(m.code);
          return (
            <button
              key={m.code}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggle(m.code)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${on ? "border-teal-600 bg-[#eef5f2]" : "border-line bg-card hover:border-teal-600"}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${on ? "justify-end bg-teal-600" : "justify-start bg-line"}`}
              >
                <span className="h-4 w-4 rounded-full bg-white shadow" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-teal-900">{m.label}</span>
                {m.q && <span className="text-[12px] text-muted">{m.q}</span>}
                <span className="mt-1 text-[11px] text-muted">
                  {m.std} · {modCounts[m.code] || 0} documents
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn ghost" onClick={allOn}>
          Select all modules
        </button>
        <button type="button" className="btn ghost" onClick={() => save({})}>
          Core only
        </button>
        {profile ? (
          <button type="button" className="btn ghost" onClick={() => save(null)}>
            Reset (show everything)
          </button>
        ) : null}
      </div>

      <p className="mt-5 rounded-lg bg-cream px-4 py-3 text-[13px] text-muted">
        Your selection is saved as your organisation&apos;s device profile and
        scopes the roadmap, checklist, matrix and library for everyone on your
        team.
      </p>
    </>
  );
}
