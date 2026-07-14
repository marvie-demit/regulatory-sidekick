"use client";

import { useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import type { ModuleDef } from "@/lib/content/types";
import { actInScope, docInScope, euRoute } from "@/lib/content/scope";

type Prof = Record<string, number>;

export function ProfileSelector({
  modules,
  modCounts,
  acts,
  docScopes,
  totalDocs,
  totalActs,
}: {
  modules: ModuleDef[];
  modCounts: Record<string, number>;
  acts: { mods: string[]; reg?: string[] }[];
  docScopes: { module: string; reg?: string[] }[];
  totalDocs: number;
  totalActs: number;
}) {
  const { profile, setProfile } = useOrgState();
  // Locked once set: a configured profile opens read-only; "Change" re-opens it
  // so the device profile is fixed for the project unless deliberately changed.
  const [editing, setEditing] = useState(
    () => !(profile && Object.keys(profile).length > 0),
  );

  // characteristics only — the EU route (MDR/IVDR) and FDA market are their own
  // controls, so IVD/FDA are pulled out of the generic module grid.
  const charModules = modules.filter(
    (m) => m.code !== "IVD" && m.code !== "FDA",
  );
  const route = euRoute(profile); // "MDR" | "IVDR" | null
  const fdaOn = !!profile?.FDA;

  const docsInScope = docScopes.filter((d) => docInScope(d, profile)).length;
  const actsInScope = acts.filter((a) => actInScope(a, profile)).length;

  const base = (): Prof => (profile ? { ...profile } : {});

  function setRoute(r: "MDR" | "IVDR" | null) {
    const p = base();
    delete p.MDR;
    delete p.IVDR;
    delete p.IVD;
    if (r === "MDR") p.MDR = 1;
    if (r === "IVDR") {
      p.IVDR = 1;
      p.IVD = 1; // an IVDR device IS an IVD → enable IVD-specific content
    }
    setProfile(p);
  }
  function setFda(on: boolean) {
    const p = base();
    if (on) p.FDA = 1;
    else delete p.FDA;
    setProfile(p);
  }
  function toggleChar(code: string) {
    const p = base();
    if (p[code]) {
      delete p[code];
      if (code === "SW") delete p.AI; // AI can't exist without software
    } else {
      p[code] = 1;
      if (code === "AI") p.SW = 1; // an AI/ML component implies software
    }
    setProfile(p);
  }

  const routeBtn =
    "flex-1 rounded-xl border-2 px-4 py-3 text-left transition min-w-[180px]";
  const on = "border-teal-700 bg-[#eef5f2]";
  const off = "border-line bg-card hover:border-teal-600";

  return (
    <>
      <div className="scopebar" style={{ marginTop: 14 }}>
        {profile ? (
          <>
            {route ? (
              <b>EU {route}</b>
            ) : (
              <b>No EU route</b>
            )}
            {fdaOn ? " + US FDA" : ""}
          </>
        ) : (
          <>
            <b>Not configured</b> - everything is shown
          </>
        )}{" "}
        · <b>{docsInScope}</b> / {totalDocs} documents · <b>{actsInScope}</b> /{" "}
        {totalActs} activities in scope
      </div>

      {!editing && (
        <div className="mt-6 rounded-xl border-2 border-teal-700 bg-[#eef5f2] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">
              Device profile · locked for this project
            </span>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setEditing(true)}
            >
              Change device profile
            </button>
          </div>
          <p className="mt-2 text-[13px] text-muted">
            Your device profile is set. Changing it re-scopes the roadmap,
            checklist, matrix and library for everyone on your team.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-teal-700 bg-card px-3 py-1 text-[12px] font-medium text-teal-800">
              {route ? `EU ${route}` : "No EU route"}
            </span>
            {fdaOn ? (
              <span className="rounded-full border border-line bg-card px-3 py-1 text-[12px] font-medium text-teal-800">
                US FDA
              </span>
            ) : null}
            {charModules
              .filter((m) => profile && profile[m.code])
              .map((m) => (
                <span
                  key={m.code}
                  className="rounded-full border border-line bg-card px-3 py-1 text-[12px] font-medium text-teal-800"
                >
                  {m.label}
                </span>
              ))}
          </div>
        </div>
      )}

      {editing && (
        <>
      {/* --- Regulatory route (EU) --- */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">
        EU regulatory route
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        A product is regulated under one route — pick the one that applies. It
        decides classification, technical documentation and market access.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          role="radio"
          aria-checked={route === "MDR"}
          onClick={() => setRoute(route === "MDR" ? null : "MDR")}
          className={`${routeBtn} ${route === "MDR" ? on : off}`}
        >
          <div className="font-medium text-teal-900">EU MDR</div>
          <div className="text-[12px] text-muted">
            Medical device (Regulation 2017/745)
          </div>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={route === "IVDR"}
          onClick={() => setRoute(route === "IVDR" ? null : "IVDR")}
          className={`${routeBtn} ${route === "IVDR" ? on : off}`}
        >
          <div className="font-medium text-teal-900">EU IVDR</div>
          <div className="text-[12px] text-muted">
            In-vitro diagnostic (Regulation 2017/746)
          </div>
        </button>
      </div>

      {/* --- US market --- */}
      <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">
        Other markets
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          role="switch"
          aria-checked={fdaOn}
          onClick={() => setFda(!fdaOn)}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${fdaOn ? "border-teal-600 bg-[#eef5f2]" : off}`}
        >
          <span
            className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${fdaOn ? "justify-end bg-teal-600" : "justify-start bg-line"}`}
          >
            <span className="h-4 w-4 rounded-full bg-white shadow" />
          </span>
          <span className="flex flex-col">
            <span className="font-medium text-teal-900">US FDA</span>
            <span className="text-[12px] text-muted">
              Adds the US pathway (510(k)/PMA, QMSR) & reporting. Can be combined
              with an EU route, or used on its own.
            </span>
          </span>
        </button>
      </div>

      {/* --- Device characteristics --- */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">
        Device characteristics
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {charModules.map((m) => {
          const active = !profile || !!profile[m.code];
          return (
            <button
              key={m.code}
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => toggleChar(m.code)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${active ? "border-teal-600 bg-[#eef5f2]" : off}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${active ? "justify-end bg-teal-600" : "justify-start bg-line"}`}
              >
                <span className="h-4 w-4 rounded-full bg-white shadow" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-teal-900">{m.label}</span>
                {m.q && <span className="text-[12px] text-muted">{m.q}</span>}
                <span className="mt-1 text-[11px] text-muted">
                  {m.std} · {modCounts[m.code] || 0} documents
                  {m.code === "AI" ? " · requires Software" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {profile && Object.keys(profile).length > 0 ? (
          <button
            type="button"
            className="rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            onClick={() => setEditing(false)}
          >
            Done — lock profile
          </button>
        ) : null}
        {profile ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => setProfile(null)}
          >
            Reset (show everything)
          </button>
        ) : null}
      </div>

      <p className="mt-5 rounded-lg bg-cream px-4 py-3 text-[13px] text-muted">
        Your selection is saved as your organisation&apos;s device profile and
        scopes the roadmap, checklist, matrix and library for everyone on your
        team. <b>ISO 13485 (Core) always applies.</b>
      </p>
        </>
      )}
    </>
  );
}
