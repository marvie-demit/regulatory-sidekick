"use client";

import { useActionState } from "react";
import { adminAuthLink } from "@/lib/admin/actions";
import { card, coral, CopyBtn, errCls, input, okCls, smallBtn } from "./ui";

// Sign-in and password-recovery links for a user.
//
// Last tab on purpose: real, and occasionally the only way to unstick someone,
// but rarely the reason you opened the console.

type Res = {
  error?: string;
  message?: string;
  code?: string;
  codeUrl?: string;
  linkUrl?: string;
  codes?: string[];
};

export function ToolsTab() {
  const [state, action, pending] = useActionState<Res, FormData>(
    adminAuthLink,
    {},
  );
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Sign-in &amp; recovery links
        </h2>
        <p className="mt-1 text-sm text-muted">
          Generate a one-time link for any user — a <b>recovery link</b> lets them
          set a new password, a <b>magic link</b> signs them straight in. Copy it
          and send it however you like. Both are single-use and expire in about an
          hour.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          User email
          <input
            name="email"
            type="email"
            required
            placeholder="person@company.com"
            autoComplete="off"
            className={input}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            name="kind"
            value="recovery"
            disabled={pending}
            className={smallBtn}
          >
            {pending ? "…" : "Recovery link"}
          </button>
          <button
            type="submit"
            name="kind"
            value="magiclink"
            disabled={pending}
            className={coral}
          >
            {pending ? "…" : "Magic link"}
          </button>
        </div>
      </div>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.message ? <p className={okCls}>{state.message}</p> : null}
      {state.linkUrl ? (
        <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate font-mono text-xs text-teal-800">
            {state.linkUrl}
          </code>
          <CopyBtn value={state.linkUrl} label="Copy link" />
        </div>
      ) : null}
    </form>
  );
}
