"use client";

import { useActionState, useEffect, useState } from "react";
import {
  adminAuthLink,
  createAccessCode,
  deleteOrg,
  revokeAccessCode,
  setOrgAgentLimits,
  setOrgPlan,
} from "@/lib/admin/actions";
import type { AccessCode, AdminOrg } from "@/lib/admin/data";
import {
  DEFAULT_AGENT_RATE_LIMIT,
  DEFAULT_AGENT_WRITE_LIMIT,
} from "@/lib/auth/agent-tokens";

type Res = {
  error?: string;
  message?: string;
  code?: string;
  codeUrl?: string;
  linkUrl?: string;
};

const card = "rounded-2xl border border-line bg-card p-6 shadow-sm";
const input =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const coral =
  "rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const subtle =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60";
const smallBtn =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-teal-800 transition hover:bg-white disabled:opacity-60";
const errCls =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";
const okCls =
  "rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800";
const planLabel = (p: string) =>
  p === "enterprise" ? "Enterprise" : p === "full" ? "Full" : "Explore";
const fmtDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

// Live redeem-by countdown for an access code. null = no deadline.
function Countdown({ iso }: { iso: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return <span className="text-muted">no redeem deadline</span>;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return <span className="font-medium text-red-600">expired</span>;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const label =
    d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`;
  const urgent = ms < 24 * 3600 * 1000;
  return (
    <span className={urgent ? "font-medium text-coral" : "text-teal-700"}>
      redeem within {label}
    </span>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={smallBtn}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function CodeResult({ state }: { state: Res }) {
  if (!state.code || !state.codeUrl) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2 sm:flex-row sm:items-center">
      <code className="flex-1 truncate font-mono text-xs text-teal-800">
        {state.code}
      </code>
      <div className="flex gap-2">
        <CopyBtn value={state.code} label="Copy code" />
        <CopyBtn value={state.codeUrl} label="Copy link" />
      </div>
    </div>
  );
}

function MintForm() {
  const [state, action, pending] = useActionState<Res, FormData>(
    createAccessCode,
    {},
  );
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Mint a generic access code
        </h2>
        <p className="mt-1 text-sm text-muted">
          Not tied to any org — anyone you send it to redeems it for their own
          workspace. (To lock a code to one customer, use “Create code” on their
          row below.)
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Plan
          <select name="plan" defaultValue="full" className={input}>
            <option value="full">Full</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Access days
          <input
            name="grantDays"
            defaultValue="365"
            inputMode="numeric"
            title="How long the plan lasts once redeemed (blank = no expiry)"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Redeem within
          <input
            name="redeemDays"
            defaultValue="14"
            inputMode="numeric"
            title="Days the code stays redeemable before it self-expires (blank = no deadline)"
            className={input}
          />
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
      {state.message ? <p className={okCls}>{state.message}</p> : null}
      <CodeResult state={state} />
    </form>
  );
}

function UserLinksForm() {
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

function CodeRow({ c, targetName }: { c: AccessCode; targetName: string | null }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    revokeAccessCode,
    {},
  );
  const spent = c.usedCount >= c.maxUses;
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-teal-900">
            {c.note || "(no note)"} · {planLabel(c.plan)}
            {c.grantDays ? ` · ${c.grantDays}d` : " · ∞"}
            {targetName ? (
              <span className="text-teal-700"> · for {targetName}</span>
            ) : c.targetOrgId ? (
              <span className="text-teal-700"> · org-locked</span>
            ) : null}
          </div>
          <div className="text-xs text-muted">
            {c.usedCount}/{c.maxUses} used · {fmtDate(c.createdAt)} ·{" "}
            {spent ? (
              <span className="text-muted">spent</span>
            ) : (
              <Countdown iso={c.expiresAt} />
            )}
          </div>
        </div>
        <form action={action}>
          <input type="hidden" name="codeId" value={c.id} />
          <button type="submit" disabled={pending} className={subtle}>
            {pending ? "…" : "Delete"}
          </button>
        </form>
      </div>
      {c.code ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-[#f7faf8] p-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate font-mono text-xs text-teal-800">
            {c.code}
          </code>
          <div className="flex gap-2">
            <CopyBtn value={c.code} label="Copy code" />
            <CopyBtn
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/redeem/${c.code}`}
              label="Copy link"
            />
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted">
          Minted before code storage — delete and mint a new one to get a
          copyable code/link.
        </div>
      )}
      {state.error ? <p className={errCls}>{state.error}</p> : null}
    </li>
  );
}

function OrgRow({ o }: { o: AdminOrg }) {
  const [applyState, applyAction, applyPending] = useActionState<Res, FormData>(
    setOrgPlan,
    {},
  );
  const [codeState, codeAction, codePending] = useActionState<Res, FormData>(
    createAccessCode,
    {},
  );
  const [delState, delAction, delPending] = useActionState<Res, FormData>(
    deleteOrg,
    {},
  );
  const [limitState, limitAction, limitPending] = useActionState<Res, FormData>(
    setOrgAgentLimits,
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-teal-900">{o.name}</div>
          {o.ownerEmail ? (
            <div className="truncate text-xs text-muted">{o.ownerEmail}</div>
          ) : null}
          <div className="text-xs text-muted">
            {planLabel(o.plan)}
            {o.planExpiresAt ? ` · until ${fmtDate(o.planExpiresAt)}` : ""} ·{" "}
            <button
              type="button"
              onClick={() => setShowMembers((v) => !v)}
              className="underline decoration-dotted underline-offset-2 transition hover:text-teal-800"
            >
              {o.members} member{o.members === 1 ? "" : "s"} {showMembers ? "▾" : "▸"}
            </button>{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => setShowLimits((v) => !v)}
              className="underline decoration-dotted underline-offset-2 transition hover:text-teal-800"
            >
              agent {o.agentRateLimit ?? DEFAULT_AGENT_RATE_LIMIT}/min ·{" "}
              {o.agentWriteLimit ?? DEFAULT_AGENT_WRITE_LIMIT} writes/day{" "}
              {showLimits ? "▾" : "▸"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={applyAction} className="flex items-center gap-2">
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
            <button type="submit" disabled={applyPending} className={smallBtn}>
              {applyPending ? "…" : "Apply"}
            </button>
          </form>
          <form action={codeAction}>
            <input type="hidden" name="targetOrgId" value={o.id} />
            <input type="hidden" name="plan" value="full" />
            <input type="hidden" name="grantDays" value="365" />
            <button type="submit" disabled={codePending} className={smallBtn}>
              {codePending ? "…" : "Create code"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setConfirming((v) => !v);
              setTyped("");
            }}
            className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            {confirming ? "Cancel" : "Delete"}
          </button>
        </div>
      </div>
      {showLimits ? (
        <form
          action={limitAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-[#f7faf8] p-2"
        >
          <input type="hidden" name="orgId" value={o.id} />
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">
              Requests / minute
            </span>
            <input
              name="agentRateLimit"
              defaultValue={o.agentRateLimit ?? ""}
              placeholder={String(DEFAULT_AGENT_RATE_LIMIT)}
              inputMode="numeric"
              className={`${input} w-24 py-1.5`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">
              Writes / day
            </span>
            <input
              name="agentWriteLimit"
              defaultValue={o.agentWriteLimit ?? ""}
              placeholder={String(DEFAULT_AGENT_WRITE_LIMIT)}
              inputMode="numeric"
              className={`${input} w-24 py-1.5`}
            />
          </label>
          <button type="submit" disabled={limitPending} className={smallBtn}>
            {limitPending ? "…" : "Set budget"}
          </button>
          <span className="text-[11px] text-muted">
            Blank = default. Only settable here — a workspace can&apos;t raise
            its own ceiling.
          </span>
          {limitState.error ? (
            <p className="w-full text-xs text-red-600">{limitState.error}</p>
          ) : limitState.message ? (
            <p className="w-full text-xs text-teal-700">{limitState.message}</p>
          ) : null}
        </form>
      ) : null}
      {showMembers ? (
        o.memberList.length ? (
          <ul className="flex flex-col gap-1 rounded-lg border border-line bg-[#f7faf8] p-2">
            {o.memberList.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate text-teal-900">
                  {m.email ?? "(unknown user)"}
                </span>
                <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">No members yet.</p>
        )
      ) : null}
      {applyState.error ? <p className={errCls}>{applyState.error}</p> : null}
      {applyState.message ? <p className={okCls}>{applyState.message}</p> : null}
      {codeState.error ? <p className={errCls}>{codeState.error}</p> : null}
      <CodeResult state={codeState} />
      {confirming ? (
        <form
          action={delAction}
          className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <div className="text-xs text-red-700">
            Permanently delete <b>{o.name}</b> and everything in it — members,
            progress, evidence files, and audit history. This can&apos;t be undone.
            Type the name to confirm.
          </div>
          <input type="hidden" name="orgId" value={o.id} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="confirmName"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={o.name}
              autoComplete="off"
              className={`${input} min-w-[10rem] flex-1`}
            />
            <button
              type="submit"
              disabled={delPending || typed.trim() !== o.name}
              className="shrink-0 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
            >
              {delPending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
          {delState.error ? <p className={errCls}>{delState.error}</p> : null}
        </form>
      ) : null}
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
  const nameOf = (id: string | null) =>
    id ? (orgs.find((o) => o.id === id)?.name ?? null) : null;
  const filtered = orgs.filter((o) =>
    (
      o.name +
      " " +
      (o.ownerEmail ?? "") +
      " " +
      o.memberList.map((m) => m.email ?? "").join(" ")
    )
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-6">
      <MintForm />

      <UserLinksForm />

      <section className={card}>
        <h2 className="mb-1 font-display text-lg font-semibold text-teal-900">
          Access codes
        </h2>
        {codes.length > 0 ? (
          <ul className="flex flex-col">
            {codes.map((c) => (
              <CodeRow key={c.id} c={c} targetName={nameOf(c.targetOrgId)} />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted">
            No codes yet — mint a generic one above, or “Create code” on an org
            below to lock it to that customer.
          </p>
        )}
      </section>

      <section className={card}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Organizations
          </h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / email…"
            className={`${input} w-48`}
          />
        </div>
        <p className="mb-2 text-xs text-muted">
          Grant full access two ways: <b>Apply</b> to activate it now, or{" "}
          <b>Create code</b> to send them a link they redeem themselves.
        </p>
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
