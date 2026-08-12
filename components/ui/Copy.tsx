"use client";

import { useState } from "react";

// Copy-to-clipboard leaves. Kept here rather than in a feature folder because
// the Agent page needs them in three places.
//
// (components/admin/ui.tsx has its own CopyBtn with 12 call sites across the
// admin and partner consoles. Deliberately left alone — consolidating it is a
// tidy-up, not a fix, and not worth touching five console files mid-feature.)

const field =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const btn =
  "shrink-0 rounded-full bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110";

/** One-line value in a readonly input, select-on-focus, with a Copy button. */
export function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={`${field} min-w-0 flex-1 ${mono ? "font-mono text-xs" : ""}`}
      />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
        }}
        className={btn}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Multi-line block (a shell command, a JSON snippet) with a Copy button. */
export function CopyBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-white p-3 pr-20 font-mono text-[11px] leading-relaxed text-teal-900">
        {value}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`absolute right-2 top-2 ${btn}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
