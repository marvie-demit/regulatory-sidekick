"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StatusDropdown } from "@/components/content/StatusDropdown";
import { hasFullAccess, SAMPLE_ACTIVITY_ID } from "@/lib/auth/access";
import { toast } from "@/lib/toast";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { actInScope } from "@/lib/content/scope";

export type CKActivity = {
  id: string;
  statement: string;
  phaseN: number;
  qse: string;
  dur: number;
  clause?: string;
  mods: string[];
  reg?: string[];
  docIds: string[];
  tasks: { t: string; d: string }[];
};

const STATUSES = ["Not started", "In progress", "Done", "N-A"];
function stcls(s: string) {
  return s === "Done"
    ? "done"
    : s === "In progress"
      ? "prog"
      : s === "N-A"
        ? "na"
        : "";
}

// Action menu used by the bulk bar (Select by status / Set selected to).
function StatusMenu({
  label,
  onPick,
}: {
  label: string;
  onPick: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className={"dd dd-mini" + (open ? " open" : "")} ref={ref}>
      <button
        type="button"
        className="dd-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dd-val">{label}</span>
        <svg
          className="dd-chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="dd-menu" role="menu">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={"dd-opt " + stcls(s)}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPick(s);
            }}
          >
            <span className="dd-dot" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChecklistView({
  activities,
  plan,
}: {
  activities: CKActivity[];
  plan?: string;
}) {
  const {
    status,
    tasks,
    profile,
    setStatus,
    bulkSet: ctxBulkSet,
    toggleTask: ctxToggleTask,
    reset: ctxReset,
  } = useOrgState();
  const [scope, setScope] = useState("all");
  const [view, setView] = useState("phase");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Record<string, 1>>({});
  const [gcol, setGcol] = useState<Record<string, boolean>>({
    Done: true,
    "N-A": true,
  });

  const full = hasFullAccess(plan);
  const inScope = (a: CKActivity) => actInScope(a, profile);
  const scoped = activities.filter(
    (a) => inScope(a) && (scope === "all" || "p" + a.phaseN === scope),
  );

  const tc = (a: CKActivity) => {
    const o = tasks[a.id] || {};
    let n = 0;
    for (let i = 0; i < a.tasks.length; i++) if (o[i]) n++;
    return n;
  };

  const done = scoped.filter((a) => status[a.id] === "Done").length;
  const prog = scoped.filter((a) => status[a.id] === "In progress").length;
  const na = scoped.filter((a) => status[a.id] === "N-A").length;
  const tot = scoped.length;
  const base = tot - na;
  const pct = base ? Math.round((done / base) * 100) : 0;
  const notStarted = tot - done - prog - na;
  let tdone = 0;
  let ttot = 0;
  scoped.forEach((a) => {
    ttot += a.tasks.length;
    tdone += tc(a);
  });
  const tpct = ttot ? Math.round((tdone / ttot) * 100) : 0;
  const hidden = activities.filter((a) => !inScope(a)).length;

  let list = scoped;
  if (view === "status") {
    const RK: Record<string, number> = {
      "In progress": 0,
      "Not started": 1,
      Done: 2,
      "N-A": 3,
    };
    list = scoped
      .map((a, i) => ({ a, i }))
      .sort(
        (x, y) =>
          RK[status[x.a.id] || "Not started"] -
            RK[status[y.a.id] || "Not started"] || x.i - y.i,
      )
      .map((z) => z.a);
  }

  const selCount = Object.keys(sel).length;
  function selToggle(id: string, on: boolean) {
    setSel((p) => {
      const n = { ...p };
      if (on) n[id] = 1;
      else delete n[id];
      return n;
    });
  }
  function selAll(on: boolean) {
    if (on) {
      const n: Record<string, 1> = {};
      scoped.forEach((a) => (n[a.id] = 1));
      setSel(n);
    } else setSel({});
  }
  function selByStatus(s: string) {
    const n: Record<string, 1> = {};
    scoped.forEach((a) => {
      if ((status[a.id] || "Not started") === s) n[a.id] = 1;
    });
    setSel(n);
  }
  function bulkSet(v: string) {
    const ids = Object.keys(sel);
    if (!ids.length) {
      toast("Select activities first");
      return;
    }
    ctxBulkSet(ids, v);
    setSel({});
    toast(
      ids.length + " activit" + (ids.length === 1 ? "y" : "ies") + " set to " + v,
    );
  }

  function toggleTask(id: string, i: number, checked: boolean) {
    const wasNotStarted = (status[id] || "Not started") === "Not started";
    ctxToggleTask(id, i, checked);
    if (checked && wasNotStarted) toast("Status set to In progress");
  }

  function markDone(id: string) {
    setStatus(id, "Done");
    toast("Marked Done");
  }

  function expandAll(on: boolean) {
    if (on) {
      const m: Record<string, boolean> = {};
      scoped.forEach((a) => (m[a.id] = true));
      setOpen(m);
    } else setOpen({});
  }
  function reset() {
    if (
      !window.confirm(
        "Reset every saved status and checklist item across all phases? This cannot be undone.",
      )
    )
      return;
    ctxReset();
    toast("All statuses & checks reset");
  }

  function Row({ a }: { a: CKActivity }) {
    const locked = !full && a.id !== SAMPLE_ACTIVITY_ID;
    if (locked) {
      return (
        <Link
          href="/pricing"
          className="ck locked"
          style={{ textDecoration: "none", alignItems: "center" }}
        >
          <div className="body">
            <span className="cid">{a.id}</span>
            <span className="tg" style={{ marginLeft: 6 }}>
              {a.qse}
            </span>
            <span className="tg dchip" style={{ marginLeft: 5 }}>
              {a.dur}d
            </span>
            <h4>
              <span className="cktitle">{a.statement}</span>
            </h4>
          </div>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9aa39d"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ marginTop: 2, flexShrink: 0 }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </Link>
      );
    }
    const st = status[a.id] || "Not started";
    const cls = stcls(st);
    const o = tasks[a.id] || {};
    const tcount = tc(a);
    const isOpen = !!open[a.id];
    const selected = !!sel[a.id];
    return (
      <div
        className={
          "ck " + cls + (selected ? " selrow" : "") + (isOpen ? " expanded" : "")
        }
      >
        <input
          type="checkbox"
          className="ckchk"
          aria-label={"Select " + a.id}
          checked={selected}
          onChange={(e) => selToggle(a.id, e.target.checked)}
        />
        <div className="body">
          <Link className="cid" href={`/activity/${a.id}`}>
            {a.id}
          </Link>
          <span className="tg" style={{ marginLeft: 6 }}>
            {a.qse}
          </span>
          <span className="tg dchip" title="estimated duration" style={{ marginLeft: 5 }}>
            {a.dur}d
          </span>
          <span className="sb">{st}</span>
          <h4>
            <Link className="cktitle" href={`/activity/${a.id}`}>
              {a.statement}
            </Link>
          </h4>
          <div className="docs">
            Verify:{" "}
            {a.docIds.length
              ? a.docIds.map((d, i) => (
                  <span key={d}>
                    {i > 0 ? ", " : ""}
                    <Link className="lnk" href={`/library/${d}`}>
                      {d}
                    </Link>
                  </span>
                ))
              : "—"}
            {a.clause ? <> · {a.clause}</> : null} ·{" "}
            <Link className="lnk" href={`/activity/${a.id}`}>
              view activity →
            </Link>
          </div>
          {a.tasks.length > 0 && (
            <>
              <button
                type="button"
                className="ckexp"
                aria-expanded={isOpen}
                onClick={() => setOpen((p) => ({ ...p, [a.id]: !p[a.id] }))}
              >
                <span className="ckchev">▸</span> Checklist{" "}
                <span className="ckcount">
                  {tcount}/{a.tasks.length}
                </span>
              </button>
              <div className={"cksub" + (isOpen ? " open" : "")}>
                {a.tasks.map((tk, i) => {
                  const on = !!o[i];
                  return (
                    <label key={i} className={"cktask" + (on ? " done" : "")}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggleTask(a.id, i, e.target.checked)}
                      />
                      <span className="cktt">
                        <b>{tk.t}</b>
                        {tk.d ? <> — {tk.d}</> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          {a.tasks.length > 0 &&
            tcount === a.tasks.length &&
            st === "In progress" && (
              <button
                type="button"
                className="donenudge"
                onClick={() => markDone(a.id)}
              >
                ✓ All tasks complete — mark Done?
              </button>
            )}
        </div>
        <StatusDropdown id={a.id} />
      </div>
    );
  }

  const ORDER = ["In progress", "Not started", "Done", "N-A"];
  const bk: Record<string, CKActivity[]> = {};
  scoped.forEach((a) => {
    const s = status[a.id] || "Not started";
    (bk[s] = bk[s] || []).push(a);
  });

  return (
    <main className="px-7 py-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Implementation checklist
      </h1>
      <p className="lead">
        Set a status per activity, and <b>expand any row</b> to work through its
        detailed, individually-checkable items. Everything saves automatically;
        print it as a granular self-assessment / internal-audit record.
      </p>

      <div className="filters">
        <label className="sr-only" htmlFor="ckscope">
          Filter by phase
        </label>
        <select
          id="ckscope"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setSel({});
          }}
        >
          <option value="all">All phases</option>
          <option value="p1">Phase 1</option>
          <option value="p2">Phase 2</option>
          <option value="p3">Phase 3</option>
          <option value="p4">Phase 4</option>
        </select>
        <label className="sr-only" htmlFor="cksort">
          View
        </label>
        <select id="cksort" value={view} onChange={(e) => setView(e.target.value)}>
          <option value="phase">View: roadmap list</option>
          <option value="status">View: in-progress first</option>
          <option value="group">View: grouped by status</option>
        </select>
        <button className="btn ghost" onClick={() => expandAll(true)}>
          Expand all
        </button>
        <button className="btn ghost" onClick={() => expandAll(false)}>
          Collapse all
        </button>
        <button className="btn ghost" onClick={() => window.print()}>
          Print / export
        </button>
        <button className="btn ghost" onClick={reset}>
          Reset all
        </button>
      </div>

      {profile && hidden ? (
        <div className="scopebar">
          <span>
            Scoped to your{" "}
            <Link className="lnk" href="/profile">
              device profile
            </Link>{" "}
            - {hidden} out-of-scope activit{hidden === 1 ? "y" : "ies"} hidden.
          </span>
        </div>
      ) : null}

      <div className="mb-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-card px-4 py-2.5">
        <div className="flex items-center gap-2" title={`${done} of ${base} applicable activities done`}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
            Activities
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cream2">
            <div
              className="h-full rounded-full bg-[var(--ok)]"
              style={{ width: pct + "%" }}
            />
          </div>
          <span className="text-[13px] font-bold text-teal-900">{pct}%</span>
          <span className="text-[11px] text-muted">
            {done}/{base}
          </span>
        </div>
        <div className="flex items-center gap-2" title={`${tdone} of ${ttot} granular checks done`}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">
            Checks
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cream2">
            <div
              className="h-full rounded-full bg-[var(--ok)]"
              style={{ width: tpct + "%" }}
            />
          </div>
          <span className="text-[13px] font-bold text-teal-900">{tpct}%</span>
          <span className="text-[11px] text-muted">
            {tdone}/{ttot}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
          <span>
            <b className="font-semibold text-teal-800">{done}</b> done
          </span>
          <span className="text-line">·</span>
          <span>
            <b className="font-semibold text-teal-800">{prog}</b> in progress
          </span>
          <span className="text-line">·</span>
          <span>
            <b className="font-semibold text-teal-800">{notStarted}</b> not started
          </span>
          <span className="text-line">·</span>
          <span>
            <b className="font-semibold text-teal-800">{na}</b> N-A
          </span>
        </div>
      </div>

      <div className={"bulk" + (selCount ? " has" : "")}>
        <label className="bchk">
          <input
            type="checkbox"
            checked={tot > 0 && selCount === tot}
            onChange={(e) => selAll(e.target.checked)}
          />{" "}
          Select all
        </label>
        <span className="bcount">{selCount} selected</span>
        <StatusMenu label="Select by status" onPick={selByStatus} />
        <span className="bspacer" />
        <div className="setwrap">
          <span className="bsep">Set selected to</span>
          <StatusMenu label="Choose status" onPick={bulkSet} />
          <button className="bclear" onClick={() => setSel({})}>
            Clear selection
          </button>
        </div>
      </div>

      {view === "group" ? (
        ORDER.filter((s) => bk[s]).length ? (
          ORDER.filter((s) => bk[s]).map((s) => {
            const items = bk[s];
            const col = !!gcol[s];
            return (
              <div className="ckgrp" key={s}>
                <div className={"ckgh " + stcls(s) + (col ? " col" : "")}>
                  <button
                    type="button"
                    className="ckgt"
                    aria-expanded={!col}
                    onClick={() => setGcol((g) => ({ ...g, [s]: !g[s] }))}
                  >
                    <span className="ckgchev">▸</span>
                    <span className="dd-dot" />
                    {s}
                    <span className="ckgn">{items.length}</span>
                  </button>
                  <button
                    type="button"
                    className="ckgsel"
                    onClick={() => selByStatus(s)}
                  >
                    Select group
                  </button>
                </div>
                {col ? null : items.map((a) => <Row key={a.id} a={a} />)}
              </div>
            );
          })
        ) : (
          <p className="empty">No activities match this scope.</p>
        )
      ) : list.length ? (
        list.map((a) => <Row key={a.id} a={a} />)
      ) : (
        <p className="empty">No activities match this scope.</p>
      )}
    </main>
  );
}
