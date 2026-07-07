"use client";

import { useActionState } from "react";
import { updateOrgProfile } from "@/lib/auth/actions";

export type OrgProfile = {
  name: string;
  website: string;
  linkedin: string;
  industry: string;
  country: string;
  about: string;
};

type State = { error?: string; message?: string };

const inputCls =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500 disabled:bg-[#f7faf8] disabled:text-muted";
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";

export function OrgProfileForm({
  profile,
  canEdit,
}: {
  profile: OrgProfile;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    updateOrgProfile,
    {},
  );
  const ro = !canEdit;

  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      {!canEdit ? (
        <p className="rounded-lg border border-line bg-[#f7faf8] px-3 py-2 text-sm text-muted">
          Only workspace admins can edit these details.
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>Company / workspace name</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={profile.name}
          disabled={ro}
          className={inputCls}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Website</span>
          <input
            name="website"
            type="text"
            inputMode="url"
            placeholder="acme.com"
            defaultValue={profile.website}
            disabled={ro}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>LinkedIn</span>
          <input
            name="linkedin"
            type="text"
            inputMode="url"
            placeholder="linkedin.com/company/acme"
            defaultValue={profile.linkedin}
            disabled={ro}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Industry</span>
          <input
            name="industry"
            placeholder="Medical devices — IVD"
            defaultValue={profile.industry}
            disabled={ro}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Country</span>
          <input
            name="country"
            placeholder="Germany"
            defaultValue={profile.country}
            disabled={ro}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>About</span>
        <textarea
          name="about"
          rows={4}
          placeholder="A sentence or two about the company and what you're building."
          defaultValue={profile.about}
          disabled={ro}
          className={`${inputCls} resize-y`}
        />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {state.message}
        </p>
      ) : null}

      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      ) : null}
    </form>
  );
}
