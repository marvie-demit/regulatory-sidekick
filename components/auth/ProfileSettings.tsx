"use client";

import { useActionState } from "react";
import { updatePassword, updateProfile } from "@/lib/auth/actions";

type Res = { error?: string; message?: string };

const inputCls =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";
const cardCls =
  "flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm";
const btnCls =
  "self-start rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";

function Note({ state }: { state: Res }) {
  if (state.error)
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
        {state.message}
      </p>
    );
  return null;
}

export function ProfileSettings({
  email,
  fullName,
}: {
  email: string;
  fullName: string;
}) {
  const [nameState, nameAction, namePending] = useActionState<Res, FormData>(
    updateProfile,
    {},
  );
  const [pwState, pwAction, pwPending] = useActionState<Res, FormData>(
    updatePassword,
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={nameAction} className={cardCls}>
        <div>
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Profile
          </h2>
          <p className="mt-1 text-sm text-muted">Your name and sign-in email.</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Email</span>
          <input
            value={email}
            disabled
            className={`${inputCls} cursor-not-allowed bg-[#f4f7f5] text-muted`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Full name</span>
          <input
            name="fullName"
            defaultValue={fullName}
            required
            minLength={2}
            maxLength={80}
            placeholder="Your name"
            className={inputCls}
          />
        </label>
        <Note state={nameState} />
        <button type="submit" disabled={namePending} className={btnCls}>
          {namePending ? "Saving…" : "Save name"}
        </button>
      </form>

      <form action={pwAction} className={cardCls}>
        <div>
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Password
          </h2>
          <p className="mt-1 text-sm text-muted">
            Set a new password for your account.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
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
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Confirm new password</span>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat password"
            className={inputCls}
          />
        </label>
        <Note state={pwState} />
        <button type="submit" disabled={pwPending} className={btnCls}>
          {pwPending ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
