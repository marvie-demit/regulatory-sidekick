"use client";

import { useActionState, useState } from "react";
import {
  createAccessCode,
  revokeAccessCode,
  setOrgPlan,
} from "@/lib/admin/actions";
import type { AccessCode, AdminOrg } from "@/lib/admin/data";

type Res = { error?: string; message?: string; code?: string; codeUrl?: string };

const card = "rounded-2xl border border-line bg-card p-6 shadow-sm";
const input =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const coral =
  "rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const subtle =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60";
const errCls =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";
const okCls =
  "rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800";
const planLabel = (p: string) =>
  p === "enterprise" ? "Enterprise" : p === "full" ? "Full" : "Explore";
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

function MintForm() {
  const [state, action, pending] = useActionState<Res, FormData>(
    createAccessCode,
    {},
  );
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Mint an access code
        </h2>
        <p className="mt-1 text-sm text-muted">
          Generates a one-time code + link to grant full access. Shown once.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Plan
          <select name="plan" defaultValue="full" className={input}>
            <option value="full">Full</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Days (blank = ∞)
          <input name="grantDays" defaultValue="365" inputMode="numeric" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Max uses
          <input name="maxUses" defaultValue="1" inputMode="numeric" className={input} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted sm:col-span-1">
          Note
          <input name="note" placeholder="Customer / deal" className={input} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${coral} self-start`}>
        {pending ? "Creating…" : "Create code"}
      </button>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.codeUrl ? (
        <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-sm text-teal-800">{state.message}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={state.codeUrl}
              onFocus={(e) => e.currentTarget.select()}
              className={`${input} flex-1 font-mono text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(state.codeUrl!);
                setCopied(true);
              }}
              className="shrink-0 rounded-full bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="font-mono text-xs text-teal-700">Code: {state.code}</p>
        </div>
      ) : null}
    </form>
  );
}

function CodeRow({ c }: { c: AccessCode }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    revokeAccessCode,
    {},
  );
  const spent = c.usedCount >= c.maxUses;
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="truncate text-sm text-teal-900">
          {c.note || "(no note)"} · {planLabel(c.plan)}
          {c.grantDays ? ` · ${c.grantDays}d` : " · ∞"}
        </div>
        <div className="text-xs text-muted">
          {c.usedCount}/{c.maxUses} used · {fmtDate(c.createdAt)}
          {spent ? " · spent" : ""}
        </div>
      </div>
      <form action={action}>
        <input type="hidden" name="codeId" value={c.id} />
        <button type="submit" disabled={pending} className={subtle}>
          {pending ? "…" : "Delete"}
        </button>
      </form>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
    </li>
  );
}

function OrgRow({ o }: { o: AdminOrg }) {
  const [state, action, pending] = useActionState<Res, FormData>(setOrgPlan, {});
  return (
    <li className="flex flex-col gap-1 border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-teal-900">{o.name}</div>
          <div className="text-xs text-muted">
            {planLabel(o.plan)}
            {o.planExpiresAt ? ` · until ${fmtDate(o.planExpiresAt)}` : ""} ·{" "}
            {o.members} member{o.members === 1 ? "" : "s"}
          </div>
        </div>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="orgId" value={o.id} />
          <select name="plan" defaultValue={o.plan} className={`${input} py-1.5`}>
            <option value="explore">Explore</option>
            <option value="full">Full</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input
            name="grantDays"
            defaultValue="365"
            inputMode="numeric"
            title="Days of access (0 = no expiry)"
            className={`${input} w-14 py-1.5`}
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-teal-800 transition hover:bg-white disabled:opacity-60"
          >
            {pending ? "…" : "Apply"}
          </button>
        </form>
      </div>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.message ? <p className={okCls}>{state.message}</p> : null}
    </li>
  );
}

export function AdminConsole({
  codes,
  orgs,
}: {
  codes: AccessCode[];
  orgs: AdminOrg[];
}) {
  const [q, setQ] = useState("");
  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-6">
      <MintForm />
      {codes.length > 0 ? (
        <section className={card}>
          <h2 className="mb-1 font-display text-lg font-semibold text-teal-900">
            Access codes
          </h2>
          <ul className="flex flex-col">
            {codes.map((c) => (
              <CodeRow key={c.id} c={c} />
            ))}
          </ul>
        </section>
      ) : null}
      <section className={card}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Organizations
          </h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className={`${input} w-40`}
          />
        </div>
        <ul className="flex flex-col">
          {filtered.map((o) => (
            <OrgRow key={o.id} o={o} />
          ))}
        </ul>
        {filtered.length === 0 ? (
          <p className="py-3 text-sm text-muted">No organizations match.</p>
        ) : null}
      </section>
    </div>
  );
}
