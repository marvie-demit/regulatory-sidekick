"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/lib/auth/actions";

type State = { error?: string; message?: string };

const inputCls =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    updatePassword,
    {},
  );

  if (state.message) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {state.message}
        </p>
        <Link
          href="/dashboard"
          className="rounded-full bg-coral px-6 py-2.5 text-center text-sm font-semibold text-white transition hover:brightness-95"
        >
          Continue to dashboard
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-left">
        <span className={labelCls}>New password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-left">
        <span className={labelCls}>Confirm password</span>
        <input
          type="password"
          name="confirm"
          required
          autoComplete="new-password"
          placeholder="Re-type it"
          className={inputCls}
        />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
