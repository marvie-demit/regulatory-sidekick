"use client";

import { useEffect, useRef, useState } from "react";
import { useOrgState } from "@/components/app-shell/StateProvider";
import { toast } from "@/lib/toast";

const OPTS = ["Not started", "In progress", "Done", "N-A"];

export function stcls(v: string) {
  return v === "Done"
    ? "done"
    : v === "In progress"
      ? "prog"
      : v === "N-A"
        ? "na"
        : "";
}

// Custom status dropdown (.dd), backed by the org-state context (keyed by id).
export function StatusDropdown({ id }: { id: string }) {
  const { status, setStatus } = useOrgState();
  const cur = status[id] || "Not started";
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

  function pick(v: string) {
    setOpen(false);
    setStatus(id, v);
    toast("Saved");
  }

  return (
    <div className={"dd" + (open ? " open" : "")} ref={ref}>
      <button
        type="button"
        className={"dd-btn " + stcls(cur)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={"Status: " + cur}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dd-dot" />
        <span className="dd-val">{cur}</span>
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
      <div className="dd-menu" role="listbox" aria-label="Set status">
        {OPTS.map((o) => (
          <button
            key={o}
            type="button"
            className={"dd-opt " + stcls(o) + (o === cur ? " sel" : "")}
            role="option"
            aria-selected={o === cur}
            onClick={() => pick(o)}
          >
            <span className="dd-dot" />
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
