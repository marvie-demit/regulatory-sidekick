"use client";

import { useActionState } from "react";
import { redeemCode } from "@/lib/auth/redeem";

type Res = { error?: string; message?: string };

export function RedeemField() {
  const [state, action, pending] = useActionState<Res, FormData>(redeemCode, {});
  return (
    <form
      action={action}
      className="mt-6 max-w-3xl rounded-xl border border-line bg-card p-5 shadow-sm"
    >
      <div className="text-sm font-semibold text-teal-900">
        Have an access code?
      </div>
      <p className="mt-1 text-sm text-muted">
        Paste the code we sent you to activate full access for your workspace.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          name="code"
          required
          placeholder="RS-…"
          className="flex-1 rounded-lg border border-line bg-white px-3.5 py-2.5 font-mono text-sm text-teal-900 outline-none transition focus:border-teal-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Activating…" : "Activate"}
        </button>
      </div>
      {state.error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="mt-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
