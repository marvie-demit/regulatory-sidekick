"use client";

import { useActionState } from "react";
import { createOrg } from "@/lib/auth/actions";

type State = { error?: string };

const fieldBase =
  "rounded-lg border border-line bg-white px-3.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
// Fixed height so focus / autofill / a browser-extension badge can't change the
// box and misalign the field beside it in the two-column row.
const inputCls = `${fieldBase} h-[42px]`;
const areaCls = `${fieldBase} py-2.5 resize-y`;
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";
// Opt single-line fields out of writing-assistant / password-manager overlays.
const noExt = { autoComplete: "off", "data-gramm": "false" } as const;

export function OnboardingForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    createOrg,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4 text-left">
      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Company / workspace name</span>
        <input
          name="orgName"
          required
          minLength={2}
          autoFocus
          placeholder="Acme Medical Devices Ltd."
          className={inputCls}
          {...noExt}
        />
      </label>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Website</span>
          <input
            name="website"
            type="text"
            inputMode="url"
            placeholder="acme.com"
            className={inputCls}
            {...noExt}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>LinkedIn</span>
          <input
            name="linkedin"
            type="text"
            inputMode="url"
            placeholder="linkedin.com/company/acme"
            className={inputCls}
            {...noExt}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Industry</span>
          <input
            name="industry"
            placeholder="Medical devices — IVD"
            className={inputCls}
            {...noExt}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Country</span>
          <input
            name="country"
            placeholder="Germany"
            className={inputCls}
            {...noExt}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>About</span>
        <textarea
          name="about"
          rows={3}
          placeholder="A sentence or two about the company and what you're building."
          className={areaCls}
        />
      </label>

      <p className="text-xs text-muted">
        Only the name is required — everything else is optional and editable
        later in your workspace profile.
      </p>

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
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
