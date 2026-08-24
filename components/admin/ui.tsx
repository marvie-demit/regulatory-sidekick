"use client";

import { useState } from "react";

// Shared chrome for the platform-admin console. Extracted so AdminConsole and
// PartnersSection can't drift apart visually — they are one screen.

export const card = "rounded-2xl border border-line bg-card p-6 shadow-sm";
export const input =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-teal-900 outline-none transition focus:border-teal-500";
export const coral =
  "rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
export const subtle =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60";
export const smallBtn =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-teal-800 transition hover:bg-white disabled:opacity-60";
export const errCls =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";
export const okCls =
  "rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800";
export const warnCls =
  "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800";

export const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

export function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={smallBtn}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

// Download a client-built file. Used for code-batch CSV export — the rows are
// already in props, so there is no endpoint and nothing is written server-side.
export function DownloadBtn({
  filename,
  content,
  label,
  mime = "text/csv;charset=utf-8",
}: {
  filename: string;
  content: string;
  label: string;
  mime?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = URL.createObjectURL(new Blob([content], { type: mime }));
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className={smallBtn}
    >
      {label}
    </button>
  );
}

/** RFC-4180-ish quoting: enough for notes containing commas or quotes. */
export function csvRow(cells: (string | number | null)[]): string {
  return cells
    .map((c) => {
      const s = c === null ? "" : String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

// ---------------------------------------------------------------------------
// Tabs.
//
// The console used to be one continuous scroll of six sections, which is how
// minting a code ended up three sections away from the list of codes it makes.
// These live here rather than in AdminConsole for the reason at the top of this
// file: the admin screens share chrome so they cannot drift apart.
//
// State lives in the URL, not in useState. A console is a place you send
// somebody a link to ("look at this org"), and a tab you cannot link to is a
// tab you have to describe in words instead.
// ---------------------------------------------------------------------------

export type TabKey =
  | "applications"
  | "organizations"
  | "codes"
  | "partners"
  | "tools";

export const TABS: { key: TabKey; label: string }[] = [
  // Applications first: it is the only queue where somebody is actively waiting
  // on a decision before they can pay.
  { key: "applications", label: "Applications" },
  { key: "organizations", label: "Organizations" },
  { key: "codes", label: "Codes" },
  { key: "partners", label: "Partners" },
  { key: "tools", label: "Tools" },
];

/** Anything unrecognised falls back rather than rendering an empty console. */
export function parseTab(v: string | null): TabKey {
  const hit = TABS.find((t) => t.key === v);
  return hit ? hit.key : "organizations";
}

export function TabStrip({
  active,
  counts,
  onSelect,
}: {
  active: TabKey;
  /** Badge per tab. Omit or 0 to show none. */
  counts?: Partial<Record<TabKey, number>>;
  onSelect: (key: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Admin sections"
      className="flex flex-wrap gap-1.5 border-b border-line pb-3"
    >
      {TABS.map((t) => {
        const on = t.key === active;
        const n = counts?.[t.key] ?? 0;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onSelect(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              on
                ? "bg-coral text-white"
                : "border border-line bg-card text-teal-800 hover:border-coral"
            }`}
          >
            {t.label}
            {n > 0 ? (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  on ? "bg-white/25 text-white" : "bg-cream2 text-teal-800"
                }`}
              >
                {n}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * What needs attention, read on arrival.
 *
 * Deliberately NOT a tab. It is the first thing you should see, and a summary
 * you have to click to reach is not a summary. When everything is clear it says
 * so in one quiet line rather than disappearing — an element that vanishes when
 * empty is one you stop trusting is there at all.
 */
export function TriageBar({
  items,
}: {
  items: { label: string; onClick: () => void }[];
}) {
  if (items.length === 0)
    return (
      <p className="rounded-xl border border-line bg-tint px-4 py-2.5 text-sm text-muted">
        Nothing waiting — no open applications, no idle agent subscriptions.
      </p>
    );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-coral/40 bg-cream px-4 py-2.5">
      {items.map((it, i) => (
        <span key={it.label} className="flex items-center gap-2">
          {i > 0 ? <span className="text-line">·</span> : null}
          <button
            type="button"
            onClick={it.onClick}
            className="text-sm font-semibold text-coral underline-offset-2 hover:underline"
          >
            {it.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The result of minting a code.
//
// Shared chrome because BOTH tabs mint: the Codes tab from its own form, and the
// Organizations tab from "Create code" on a single org. Two copies of this would
// be two places for the batch/CSV behaviour to drift.
// ---------------------------------------------------------------------------

export type MintResult = {
  code?: string;
  codeUrl?: string;
  codes?: string[];
};

export function CodeResult({ state }: { state: MintResult }) {
  if (!state.code || !state.codeUrl) return null;
  const all = state.codes ?? [state.code];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = all.map((c) => `${origin}/redeem/${c}`);

  // A single code keeps the original one-line result. A batch gets the list,
  // copy-all and a CSV — all built from what the action already returned, so
  // there's no endpoint and nothing written server-side.
  if (all.length === 1)
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2 sm:flex-row sm:items-center">
        <code className="flex-1 truncate font-mono text-xs text-teal-800">
          {state.code}
        </code>
        <div className="flex gap-2">
          <CopyBtn value={state.code} label="Copy code" />
          <CopyBtn value={state.codeUrl} label="Copy link" />
        </div>
      </div>
    );

  const csv = [csvRow(["code", "redeem_url"]), ...all.map((c, i) => csvRow([c, links[i]]))].join("\n");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-teal-800">
          {all.length} codes
        </span>
        <div className="flex gap-2">
          <CopyBtn value={links.join("\n")} label="Copy all links" />
          <DownloadBtn filename="access-codes.csv" content={csv} label="Download CSV" />
        </div>
      </div>
      <textarea
        readOnly
        rows={Math.min(all.length, 8)}
        value={links.join("\n")}
        className="w-full resize-y rounded-lg border border-teal-200 bg-white p-2 font-mono text-[11px] text-teal-800"
      />
      <p className="text-xs text-muted">
        These stay available in the list below — codes are stored, so you can
        re-export this batch any time.
      </p>
    </div>
  );
}
