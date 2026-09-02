"use client";

import { useActionState, useEffect, useState } from "react";
import { createAccessCode, revokeAccessCode } from "@/lib/admin/actions";
import type { AccessCode, AdminOrg } from "@/lib/admin/data";
import type { AdminPartner } from "@/lib/partners/data";
import {
  card,
  CodeResult,
  coral,
  CopyBtn,
  errCls,
  fmtDate,
  input,
  okCls,
  subtle,
} from "./ui";

// Minting an access code, and the list of codes minting produces.
//
// These are ONE tab on purpose. They used to be sections one and four of a
// six-section scroll, with Partners and Auth Links between them — so the most
// common follow-up to minting a code (checking it exists, copying the link) was
// three sections and a scroll away from the form that made it.

const planLabel = (p: string | null) =>
  p === "enterprise" ? "Enterprise" : p === "full" ? "Full" : "Explore";

/**
 * What a code actually grants. Since 0023 that is a licence, agent access, or
 * both — and `plan` is null on an agent-only code, so "Explore" would be a
 * plainly wrong label rather than a harmless default.
 */
const grantsLabel = (c: { plan: string | null; agentic: boolean; agenticDays: number | null }) => {
  const parts: string[] = [];
  if (c.plan) parts.push(planLabel(c.plan));
  if (c.agentic) parts.push(`Agent ${c.agenticDays ? `${c.agenticDays}d` : "∞"}`);
  return parts.join(" + ") || "—";
};

type Res = {
  error?: string;
  message?: string;
  code?: string;
  codeUrl?: string;
  linkUrl?: string;
  codes?: string[];
};

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

function MintForm({ partners }: { partners: AdminPartner[] }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    createAccessCode,
    {},
  );
  const [partnerId, setPartnerId] = useState("");
  const partner = partners.find((p) => p.id === partnerId) ?? null;
  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Mint access codes
        </h2>
        <p className="mt-1 text-sm text-muted">
          Not tied to any org; whoever you send one to redeems it for their own
          workspace. Attribute a batch to a partner to spend their licence
          allowance. (To lock a code to one customer, use “Create code” on their
          row below.)
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
          Partner
          <select
            name="partnerId"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className={input}
          >
            <option value="">— none (platform) —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id} disabled={p.status !== "active"}>
                {p.name}
                {p.status !== "active"
                  ? " (suspended)"
                  : ` — ${p.remaining} left`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Plan
          <select
            name="plan"
            defaultValue="full"
            disabled={!!partner}
            title={
              partner ? "Partner codes always grant full access." : undefined
            }
            className={input}
          >
            <option value="full">Full</option>
            <option value="enterprise">Enterprise</option>
            {/* An agent-only code leaves the licence untouched, which is what
                makes a trial possible for a customer who already has one. */}
            <option value="none">None (agent only)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Agent access
          <span className="flex h-[34px] items-center gap-2">
            <input type="checkbox" name="agentic" className="accent-coral" />
            <input
              name="agenticDays"
              placeholder="days (blank = ∞)"
              inputMode="numeric"
              className={`${input} flex-1`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          How many codes
          <input
            name="count"
            defaultValue="1"
            inputMode="numeric"
            title="Mint up to 200 codes in one batch"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Uses per code
          <input name="maxUses" defaultValue="1" inputMode="numeric" className={input} />
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
          Note
          <input name="note" placeholder="Customer / cohort" className={input} />
        </label>
      </div>
      {partner ? (
        <p className="text-xs text-muted">
          Spends <b>{partner.name}</b>&apos;s allowance,{" "}
          {partner.remaining} of {partner.licenceAllowance} licences remaining.
          One licence per use, so 10 codes × 2 uses costs 20.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${coral} self-start`}>
        {pending ? "Creating…" : "Create code"}
      </button>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.message ? <p className={okCls}>{state.message}</p> : null}
      <CodeResult state={state} />
    </form>
  );
}

function CodeRow({
  c,
  targetName,
  partnerName,
}: {
  c: AccessCode;
  targetName: string | null;
  partnerName: string | null;
}) {
  const [state, action, pending] = useActionState<Res, FormData>(
    revokeAccessCode,
    {},
  );
  const spent = c.usedCount >= c.maxUses;
  const revoked = !!c.revokedAt;
  return (
    <li
      className={`flex flex-col gap-2 border-b border-line py-3 last:border-0 ${revoked ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-teal-900">
            {c.note || "(no note)"} · {grantsLabel(c)}
            {c.plan ? (c.grantDays ? ` · ${c.grantDays}d` : " · ∞") : ""}
            {partnerName ? (
              <span className="text-teal-700"> · via {partnerName}</span>
            ) : null}
            {targetName ? (
              <span className="text-teal-700"> · for {targetName}</span>
            ) : c.targetOrgId ? (
              <span className="text-teal-700"> · org-locked</span>
            ) : null}
          </div>
          <div className="text-xs text-muted">
            {c.usedCount}/{c.maxUses} used · {fmtDate(c.createdAt)} ·{" "}
            {revoked ? (
              <span className="font-medium text-red-600">
                revoked {fmtDate(c.revokedAt)}
              </span>
            ) : spent ? (
              <span className="text-muted">spent</span>
            ) : (
              <Countdown iso={c.expiresAt} />
            )}
          </div>
        </div>
        {!revoked ? (
          <form action={action}>
            <input type="hidden" name="codeId" value={c.id} />
            <button type="submit" disabled={pending} className={subtle}>
              {pending ? "…" : "Revoke"}
            </button>
          </form>
        ) : null}
      </div>
      {c.code ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-tint p-2 sm:flex-row sm:items-center">
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
          Minted before code storage. Revoke it and mint a new one to get a
          copyable code/link.
        </div>
      )}
      {state.error ? <p className={errCls}>{state.error}</p> : null}
    </li>
  );
}

export function CodesTab({
  codes,
  orgs,
  partners,
}: {
  codes: AccessCode[];
  orgs: AdminOrg[];
  partners: AdminPartner[];
}) {
  const nameOf = (id: string | null) =>
    id ? (orgs.find((o) => o.id === id)?.name ?? null) : null;
  const partnerNameOf = (id: string | null) =>
    id ? (partners.find((p) => p.id === id)?.name ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <MintForm partners={partners} />

      <section className={card}>
        <h2 className="mb-1 font-display text-lg font-semibold text-teal-900">
          Access codes
        </h2>
        {codes.length > 0 ? (
          <ul className="flex flex-col">
            {codes.map((c) => (
              <CodeRow
                key={c.id}
                c={c}
                targetName={nameOf(c.targetOrgId)}
                partnerName={partnerNameOf(c.partnerId)}
              />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted">
            No codes yet. Mint one above, or “Create code” on an organization to
            lock it to that customer.
          </p>
        )}
      </section>
    </div>
  );
}
