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
