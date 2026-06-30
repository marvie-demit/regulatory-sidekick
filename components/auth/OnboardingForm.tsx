"use client";

import { useActionState } from "react";
import { createOrg } from "@/lib/auth/actions";

type State = { error?: string };

export function OnboardingForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    createOrg,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-teal-800">
          Organization name
        </span>
        <input
          name="orgName"
          required
          minLength={2}
          autoFocus
          placeholder="Acme Medical Devices Ltd."
          className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500"
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
        {pending ? "Creating…" : "Create organization"}
      </button>
    </form>
  );
}
