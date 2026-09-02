"use client";

import { useActionState, useState } from "react";
import {
  createPartner,
  deletePartner,
  invitePartnerAdmin,
  setPartnerAgenticAllowance,
  setPartnerAllowance,
  setPartnerBranding,
  setPartnerStatus,
  updatePartner,
} from "@/lib/admin/actions";
import type { AdminPartner } from "@/lib/partners/data";
import {
  card,
  coral,
  CopyBtn,
  errCls,
  fmtDate,
  input,
  okCls,
  smallBtn,
  subtle,
  warnCls,
} from "./ui";

type Res = {
  error?: string;
  message?: string;
  warning?: string;
  linkUrl?: string;
};

const KIND_LABEL: Record<string, string> = {
  accelerator: "Accelerator",
  incubator: "Incubator",
  investor: "Investor",
  other: "Partner",
};

/** Allowance bar. Over-allocation is a real state, not an error — show it plainly. */
function AllowanceBar({ p }: { p: AdminPartner }) {
  const pct = p.licenceAllowance
    ? Math.min((p.consumed / p.licenceAllowance) * 100, 100)
    : 0;
  const over = p.overBy > 0;
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${over ? "bg-coral" : "bg-teal-500"}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-muted">
        {p.consumed} of {p.licenceAllowance} licences ·{" "}
        {p.agenticConsumed} of {p.agenticAllowance} agent seats issued ·{" "}
        {over ? (
          <span className="font-medium text-coral">over by {p.overBy}</span>
        ) : (
          <span className="text-teal-700">{p.remaining} remaining</span>
        )}
      </div>
    </div>
  );
}

function CreatePartnerForm() {
  const [state, action, pending] = useActionState<Res, FormData>(createPartner, {});
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Add a partner
        </h2>
        <p className="mt-1 text-sm text-muted">
          Accelerators, incubators and investors who pass access to their
          portfolio companies. You set the licence allowance; they mint codes
          against it. The slug becomes their subdomain later, so pick it once and
          keep it.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Name
          <input name="name" placeholder="Acme Ventures" className={input} required />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Slug
          <input
            name="slug"
            placeholder="acme"
            pattern="[a-z0-9][a-z0-9-]{1,30}"
            title="Lowercase letters, numbers and hyphens"
            className={input}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Type
          <select name="kind" defaultValue="accelerator" className={input}>
            <option value="accelerator">Accelerator</option>
            <option value="incubator">Incubator</option>
            <option value="investor">Investor</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Licences
          <input
            name="licenceAllowance"
            defaultValue="0"
            inputMode="numeric"
            title="Seats this partner may hand out in total"
            className={input}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
          Contact email
          <input name="contactEmail" type="email" className={input} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
          Note
          <input name="note" placeholder="Cohort / deal" className={input} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${coral} self-start`}>
        {pending ? "Creating…" : "Add partner"}
      </button>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.message ? <p className={okCls}>{state.message}</p> : null}
    </form>
  );
}

function PartnerRow({ p }: { p: AdminPartner }) {
  const [allowState, allowAction, allowPending] = useActionState<Res, FormData>(
    setPartnerAllowance,
    {},
  );
  // A separate action for a separate allowance (0023) — agent seats are never
  // licence seats, and one form setting both would invite exactly that
  // confusion.
  const [agentState, agentAction, agentPending] = useActionState<Res, FormData>(
    setPartnerAgenticAllowance,
    {},
  );
  const [statusState, statusAction, statusPending] = useActionState<Res, FormData>(
    setPartnerStatus,
    {},
  );
  const [settingsState, settingsAction, settingsPending] = useActionState<
    Res,
    FormData
  >(updatePartner, {});
  const [delState, delAction, delPending] = useActionState<Res, FormData>(
    deletePartner,
    {},
  );
  const [inviteState, inviteAction, invitePending] = useActionState<Res, FormData>(
    invitePartnerAdmin,
    {},
  );
  const [brandState, brandAction, brandPending] = useActionState<Res, FormData>(
    setPartnerBranding,
    {},
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const suspended = p.status !== "active";
  const branded = !!(
    p.brandPrimary ||
    p.brandMid ||
    p.brandAccent ||
    p.brandSurface ||
    p.logoUrl ||
    p.wordmark
  );

  return (
    <li className="border-b border-line py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-teal-900">{p.name}</span>
            <span className="rounded-full bg-cream2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
              {KIND_LABEL[p.kind] ?? "Partner"}
            </span>
            <code className="font-mono text-xs text-muted">{p.slug}</code>
            {suspended ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                Suspended
              </span>
            ) : null}
          </div>
          <AllowanceBar p={p} />
          <div className="mt-1 text-xs text-muted">
            {p.liveCodes} live code{p.liveCodes === 1 ? "" : "s"}
            {p.revokedCodes ? ` · ${p.revokedCodes} revoked` : ""} ·{" "}
            {p.redemptions} redeemed ·{" "}
            <button
              type="button"
              onClick={() => setShowStaff((v) => !v)}
              className="underline decoration-dotted underline-offset-2 transition hover:text-teal-800"
            >
              {p.staff.length}/{p.staffLimit} staff {showStaff ? "▾" : "▸"}
            </button>{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="underline decoration-dotted underline-offset-2 transition hover:text-teal-800"
            >
              limits {showSettings ? "▾" : "▸"}
            </button>{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => setShowBrand((v) => !v)}
              className="underline decoration-dotted underline-offset-2 transition hover:text-teal-800"
            >
              branding{branded ? " ●" : ""} {showBrand ? "▾" : "▸"}
            </button>{" "}
            · joined {fmtDate(p.createdAt)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={allowAction} className="flex items-center gap-2">
            <input type="hidden" name="partnerId" value={p.id} />
            <input
              name="licenceAllowance"
              defaultValue={String(p.licenceAllowance)}
              inputMode="numeric"
              title="Total licences this partner may hand out"
              className={`${input} w-20 py-1.5`}
            />
            <button type="submit" disabled={allowPending} className={smallBtn}>
              {allowPending ? "…" : "Set licences"}
            </button>
          </form>
          <form action={agentAction} className="flex items-center gap-2">
            <input type="hidden" name="partnerId" value={p.id} />
            <input
              name="agenticAllowance"
              defaultValue={String(p.agenticAllowance)}
              inputMode="numeric"
              title="Agent seats this partner may hand out — separate from licences"
              className={`${input} w-20 py-1.5`}
            />
            <button type="submit" disabled={agentPending} className={smallBtn}>
              {agentPending ? "…" : "Set agent seats"}
            </button>
          </form>
          <form action={statusAction}>
            <input type="hidden" name="partnerId" value={p.id} />
            <input
              type="hidden"
              name="status"
              value={suspended ? "active" : "suspended"}
            />
            <button type="submit" disabled={statusPending} className={smallBtn}>
              {statusPending ? "…" : suspended ? "Reactivate" : "Suspend"}
            </button>
          </form>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={subtle}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {showStaff ? (
        <div className="mt-3 rounded-lg border border-line bg-cream px-3 py-2">
          <ul>
            {p.staff.length === 0 ? (
              <li className="py-1 text-xs text-muted">
                No staff yet. Invite their first admin below. After that they
                invite their own colleagues from the partner console.
              </li>
            ) : (
              p.staff.map((s, i) => (
                <li
                  key={`${s.email ?? "unknown"}-${i}`}
                  className="flex justify-between py-1 text-xs"
                >
                  <span className="truncate text-teal-900">
                    {s.email ?? "(unknown user)"}
                  </span>
                  <span className="text-muted">{s.role}</span>
                </li>
              ))
            )}
          </ul>
          <form
            action={inviteAction}
            className="mt-2 flex flex-wrap items-end gap-2 border-t border-line pt-2"
          >
            <input type="hidden" name="partnerId" value={p.id} />
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
              Invite email
              <input
                name="email"
                type="email"
                required
                placeholder="lead@acme.vc"
                className={`${input} py-1.5`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Role
              <select name="role" defaultValue="admin" className={`${input} py-1.5`}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
            </label>
            <button type="submit" disabled={invitePending} className={smallBtn}>
              {invitePending ? "…" : "Create invite"}
            </button>
          </form>
          {inviteState.error ? (
            <p className={`${errCls} mt-2`}>{inviteState.error}</p>
          ) : null}
          {inviteState.linkUrl ? (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2 sm:flex-row sm:items-center">
              <code className="flex-1 truncate font-mono text-[11px] text-teal-800">
                {inviteState.linkUrl}
              </code>
              <CopyBtn value={inviteState.linkUrl} label="Copy link" />
            </div>
          ) : null}
        </div>
      ) : null}

      {showSettings ? (
        <form
          action={settingsAction}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-cream px-3 py-3"
        >
          <input type="hidden" name="partnerId" value={p.id} />
          <label className="flex flex-col gap-1 text-xs text-muted">
            Staff seats
            <input
              name="staffLimit"
              defaultValue={String(p.staffLimit)}
              inputMode="numeric"
              className={`${input} w-20 py-1.5`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Default access days
            <input
              name="defaultGrantDays"
              defaultValue={p.defaultGrantDays ? String(p.defaultGrantDays) : ""}
              placeholder="blank = ∞"
              inputMode="numeric"
              className={`${input} w-28 py-1.5`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Max access days
            <input
              name="maxGrantDays"
              defaultValue={p.maxGrantDays ? String(p.maxGrantDays) : ""}
              placeholder="blank = ∞"
              title="Ceiling the partner cannot mint above"
              inputMode="numeric"
              className={`${input} w-28 py-1.5`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Default redeem-by
            <input
              name="defaultRedeemDays"
              defaultValue={p.defaultRedeemDays ? String(p.defaultRedeemDays) : ""}
              placeholder="blank = none"
              inputMode="numeric"
              className={`${input} w-28 py-1.5`}
            />
          </label>
          <button type="submit" disabled={settingsPending} className={smallBtn}>
            {settingsPending ? "…" : "Save"}
          </button>
          {settingsState.error ? (
            <p className={`${errCls} w-full`}>{settingsState.error}</p>
          ) : null}
          {settingsState.message ? (
            <p className={`${okCls} w-full`}>{settingsState.message}</p>
          ) : null}
        </form>
      ) : null}

      {showBrand ? (
        <form
          action={brandAction}
          className="mt-3 rounded-lg border border-line bg-cream px-3 py-3"
        >
          <input type="hidden" name="partnerId" value={p.id} />
          <p className="mb-3 text-xs text-muted">
            Four colours drive the whole theme; the rest is derived. Leave any
            blank to keep the house palette. Semantic colours (amber in progress,
            green done) and the rendered SOP templates stay neutral on purpose:
            those documents are the customer&apos;s controlled records, not
            marketing.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            {(
              [
                ["brandPrimary", "Primary", p.brandPrimary, "Titles, sidebar"],
                ["brandMid", "Secondary", p.brandMid, "Links, chips"],
                ["brandAccent", "Accent", p.brandAccent, "Buttons, focus"],
                ["brandSurface", "Surface", p.brandSurface, "Page background"],
              ] as const
            ).map(([name, label, value, hint]) => (
              <label key={name} className="flex flex-col gap-1 text-xs text-muted">
                {label}
                <span className="flex items-center gap-1.5">
                  <input
                    type="color"
                    defaultValue={value ?? "#0b2a26"}
                    onChange={(e) => {
                      const text = document.getElementById(
                        `${name}-${p.id}`,
                      ) as HTMLInputElement | null;
                      if (text) text.value = e.target.value;
                    }}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5"
                    aria-label={`${label} colour picker`}
                  />
                  <input
                    id={`${name}-${p.id}`}
                    name={name}
                    defaultValue={value ?? ""}
                    placeholder="#000000"
                    pattern="#[0-9a-fA-F]{6}"
                    title={hint}
                    className={`${input} w-24 py-1.5 font-mono`}
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Wordmark
              <input
                name="wordmark"
                defaultValue={p.wordmark ?? ""}
                placeholder={p.name}
                maxLength={40}
                title="Shown when there's no logo, and in the browser tab"
                className={`${input} w-44 py-1.5`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Logo (PNG/SVG, &lt; 512 KB)
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className={`${input} w-64 py-1.5 text-xs`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Logo alt text
              <input
                name="logoAlt"
                defaultValue={p.logoAlt ?? ""}
                placeholder={p.name}
                className={`${input} w-44 py-1.5`}
              />
            </label>
            <button type="submit" disabled={brandPending} className={smallBtn}>
              {brandPending ? "Saving…" : "Save branding"}
            </button>
          </div>
          {p.logoUrl ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              Current logo:
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.logoUrl}
                alt={p.logoAlt || p.name}
                style={{ height: 28, width: "auto" }}
                className="rounded border border-line bg-white p-1"
              />
            </div>
          ) : null}
          {brandState.error ? (
            <p className={`${errCls} mt-2`}>{brandState.error}</p>
          ) : null}
          {brandState.message ? (
            <p className={`${okCls} mt-2`}>{brandState.message}</p>
          ) : null}
        </form>
      ) : null}

      {confirming ? (
        <form
          action={delAction}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3"
        >
          <input type="hidden" name="partnerId" value={p.id} />
          <span className="text-xs text-red-700">
            Type <strong>{p.name}</strong> to delete. A partner who has issued
            codes can&apos;t be deleted; suspend them instead.
          </span>
          <input
            name="confirmName"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={`${input} w-48 py-1.5`}
          />
          <button
            type="submit"
            disabled={delPending || typed.trim() !== p.name}
            className={subtle}
          >
            {delPending ? "…" : "Delete partner"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setTyped("");
            }}
            className={smallBtn}
          >
            Cancel
          </button>
        </form>
      ) : null}

      {allowState.error ? <p className={`${errCls} mt-2`}>{allowState.error}</p> : null}
      {allowState.message ? (
        <p className={`${okCls} mt-2`}>{allowState.message}</p>
      ) : null}
      {agentState.error ? <p className={`${errCls} mt-2`}>{agentState.error}</p> : null}
      {agentState.message ? (
        <p className={`${okCls} mt-2`}>{agentState.message}</p>
      ) : null}
      {agentState.warning ? (
        <p className={`${warnCls} mt-2`}>{agentState.warning}</p>
      ) : null}
      {allowState.warning ? (
        <p className={`${warnCls} mt-2`}>{allowState.warning}</p>
      ) : null}
      {statusState.error ? (
        <p className={`${errCls} mt-2`}>{statusState.error}</p>
      ) : null}
      {statusState.message ? (
        <p className={`${okCls} mt-2`}>{statusState.message}</p>
      ) : null}
      {delState.error ? <p className={`${errCls} mt-2`}>{delState.error}</p> : null}
      {delState.message ? <p className={`${okCls} mt-2`}>{delState.message}</p> : null}
    </li>
  );
}

export function PartnersSection({ partners }: { partners: AdminPartner[] }) {
  return (
    <>
      <CreatePartnerForm />
      <section className={card}>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Partners
        </h2>
        <p className="mt-1 text-sm text-muted">
          {partners.length === 0
            ? "No partners yet."
            : `${partners.length} partner${partners.length === 1 ? "" : "s"}. Mint codes for one from the form above.`}
        </p>
        <ul className="mt-3">
          {partners.map((p) => (
            <PartnerRow key={p.id} p={p} />
          ))}
        </ul>
      </section>
    </>
  );
}
