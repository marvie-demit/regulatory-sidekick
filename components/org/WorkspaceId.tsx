"use client";

import { useState } from "react";

// The workspace ID is organizations.id — the same value that scopes every row
// of your data. Safe to share with support; it is an identifier, not a secret.
export function WorkspaceId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-teal-900">
        Workspace ID
      </h2>
      <p className="mt-1 text-sm text-muted">
        Identifies this workspace everywhere your data is stored. Not a secret —
        quote it when you contact us.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={id}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-lg border border-line bg-white px-3.5 py-2.5 font-mono text-xs text-teal-900 outline-none"
        />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(id);
            setCopied(true);
          }}
          className="shrink-0 rounded-full bg-teal-800 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
