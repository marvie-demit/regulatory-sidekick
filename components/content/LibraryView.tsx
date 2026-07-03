"use client";

import Link from "next/link";
import { useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { hasFullAccess, SAMPLE_DOC_GROUP } from "@/lib/auth/access";
import { docInScope } from "@/lib/content/scope";

type Doc = {
  id: string;
  title: string;
  cls: string;
  module: string;
  domain: string;
  reg?: string[];
  status?: string;
  page?: boolean;
};
type Proc = { name: string; module?: string };

const CR: Record<string, number> = {
  SOP: 0,
  WI: 1,
  TPL: 2,
  FOR: 3,
  LIS: 4,
  POL: 5,
  MAN: 6,
};
const uniq = (a: string[]) => Array.from(new Set(a));

function DocCard({ d }: { d: Doc }) {
  const inner = (
    <>
      <div className="did">
        {d.id}
        {d.page ? <span className="badge">view</span> : null}
      </div>
      <div className="dt">{d.title}</div>
      <div className="tags">
        <span className="tg">{d.module}</span>
        <span className="tg">{d.cls}</span>
        {d.status ? <span className="tg open">{d.status}</span> : null}
        {d.page ? null : <span className="tg np">no preview</span>}
      </div>
    </>
  );
  return d.page ? (
    <Link href={`/library/${d.id}`} className="doc has">
      {inner}
    </Link>
  ) : (
    <div className="doc">{inner}</div>
  );
}

export function LibraryView({
  documents,
  procs,
  procOrder,
  totalDocs,
  plan,
}: {
  documents: Doc[];
  procs: Record<string, Proc>;
  procOrder: string[];
  totalDocs: number;
  plan?: string;
}) {
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("");
  const [cls, setCls] = useState("");
  const [view, setView] = useState("group");
  const [libAll, setLibAll] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { profile } = useOrgState();

  const full = hasFullAccess(plan);
  const modules = uniq(documents.map((d) => d.module));
  const types = uniq(documents.map((d) => d.cls));
  const ql = q.toLowerCase();
  const ds = documents.filter(
    (d) =>
      (libAll || docInScope(d, profile)) &&
      (!mod || d.module === mod) &&
      (!cls || d.cls === cls) &&
      (!ql ||
        d.id.toLowerCase().indexOf(ql) >= 0 ||
        (d.title || "").toLowerCase().indexOf(ql) >= 0),
  );
  const hidden = documents.filter((d) => !docInScope(d, profile)).length;

  const byDom: Record<string, Doc[]> = {};
  ds.forEach((d) => (byDom[d.domain] = byDom[d.domain] || []).push(d));
  const order = procOrder.filter((dm) => byDom[dm]);
  Object.keys(byDom).forEach((dm) => {
    if (order.indexOf(dm) < 0) order.push(dm);
  });
  const anyOpen = order.some((dm) => !collapsed[dm]);

  function toggleAll() {
    if (anyOpen) {
      const c: Record<string, boolean> = {};
      order.forEach((dm) => (c[dm] = true));
      setCollapsed(c);
    } else setCollapsed({});
  }

  return (
    <main className="px-7 py-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Document library
      </h1>
      <p className="lead">
        {totalDocs} controlled documents, grouped by process - the SOP first,
        then its templates, forms and registers. Every document opens as a live
        page; select any card to read it.
      </p>

      <div className="filters">
        <label className="sr-only" htmlFor="q">
          Search documents
        </label>
        <input
          id="q"
          placeholder="Search by ID or title..."
          aria-label="Search documents by ID or title"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="sr-only" htmlFor="mod">
          Filter by module
        </label>
        <select
          id="mod"
          aria-label="Filter by module"
          value={mod}
          onChange={(e) => setMod(e.target.value)}
        >
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="cls">
          Filter by type
        </label>
        <select
          id="cls"
          aria-label="Filter by type"
          value={cls}
          onChange={(e) => setCls(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="libview">
          View
        </label>
        <select
          id="libview"
          aria-label="View"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          <option value="group">Group by process</option>
          {full ? <option value="flat">Flat A-Z</option> : null}
        </select>
        {view === "group" && ds.length ? (
          <button type="button" className="btn ghost" onClick={toggleAll}>
            {anyOpen ? "Collapse all" : "Expand all"}
          </button>
        ) : null}
      </div>

      {profile &&
        (libAll ? (
          <div className="scopebar">
            <span>
              Showing all {documents.length} documents.{" "}
              <button className="lnk" onClick={() => setLibAll(false)}>
                Scope to my profile
              </button>
            </span>
          </div>
        ) : hidden ? (
          <div className="scopebar">
            <span>
              Scoped to your{" "}
              <Link className="lnk" href="/profile">
                device profile
              </Link>{" "}
              - {hidden} out-of-scope document{hidden === 1 ? "" : "s"} hidden.{" "}
              <button className="lnk" onClick={() => setLibAll(true)}>
                Show all
              </button>
            </span>
          </div>
        ) : null)}

      {!ds.length ? (
        <p className="empty">No documents match your search.</p>
      ) : view === "flat" && full ? (
        <div className="lib">
          {ds.map((d) => (
            <DocCard key={d.id} d={d} />
          ))}
        </div>
      ) : (
        <div>
          {order.map((dm) => {
            const items = byDom[dm].slice().sort((a, b) => {
              const ra = CR[a.cls] == null ? 7 : CR[a.cls];
              const rb = CR[b.cls] == null ? 7 : CR[b.cls];
              return ra - rb || a.id.localeCompare(b.id);
            });
            const p = procs[dm] || { name: dm, module: "" };
            if (!full && dm !== SAMPLE_DOC_GROUP) {
              return (
                <div className="libgrp" key={dm}>
                  <Link
                    href="/pricing"
                    className="libgh locked"
                    style={{ textDecoration: "none" }}
                  >
                    <span className="libgn">{p.name}</span>
                    <span className="libgdom">{dm}</span>
                    {p.module ? <span className="tg">{p.module}</span> : null}
                    <span className="libgc">{items.length}</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9aa39d"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginLeft: 6 }}
                      aria-hidden="true"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </Link>
                </div>
              );
            }
            const col = !!collapsed[dm];
            return (
              <div className="libgrp" key={dm}>
                <div className={"libgh" + (col ? " col" : "")}>
                  <button
                    type="button"
                    className="libgt"
                    aria-expanded={!col}
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [dm]: !c[dm] }))
                    }
                  >
                    <span className="ckgchev">▸</span>
                    <span className="libgn">{p.name}</span>
                  </button>
                  <span className="libgdom">{dm}</span>
                  {p.module ? <span className="tg">{p.module}</span> : null}
                  <span className="libgc">{items.length}</span>
                </div>
                {col ? null : (
                  <div className="lib">
                    {items.map((d) => (
                      <DocCard key={d.id} d={d} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
