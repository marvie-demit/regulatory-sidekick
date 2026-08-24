"use client";

import { useActionState, useState } from "react";
import {
  createAccessCode,
  deleteOrg,
  setOrgAgentAccess,
  setOrgAgentLimits,
  setOrgPlan,
} from "@/lib/admin/actions";
import type { AdminOrg } from "@/lib/admin/data";
import {
  DEFAULT_AGENT_RATE_LIMIT,
  DEFAULT_AGENT_WRITE_LIMIT,
} from "@/lib/auth/agent-tokens";
// Pure helper, no server deps — safe in a client bundle.
import { timeAgo } from "@/lib/agent/connection";
import {
  card,
  CodeResult,
  errCls,
  fmtDate,
  input,
  okCls,
  smallBtn,
} from "./ui";

// The customer list and everything you can do to one workspace.

type Res = {
  error?: string;
  message?: string;
  code?: string;
  codeUrl?: string;
  linkUrl?: string;
  codes?: string[];
};

const planLabel = (p: string) =>
  p === "enterprise" ? "Enterprise" : p === "full" ? "Full" : "Explore";

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
  const [agState, agAction, agPending] = useActionState<Res, FormData>(
    setOrgAgentAccess,
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
          <div className="mt-1 text-xs">
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={
                o.agenticEnabled
                  ? { background: "#e7f0ec", color: "#1d6e62" }
                  : { background: "#f1f1f1", color: "#6b6b6b" }
              }
            >
              {o.agenticEnabled ? "Agent access ON" : "Agent access OFF"}
            </span>
            {o.agenticEnabled && o.agenticExpiresAt ? (
              <span className="ml-1.5 text-muted">
                until {fmtDate(o.agenticExpiresAt)}
              </span>
            ) : null}
            {/* Connection health. The coral case is the one that matters: they
                are paying for the add-on and have never once used it. That is a
                churn prediction and a support call you can make before they
                cancel — which is the whole reason this line exists. */}
            {o.agenticEnabled ? (
              <span className="ml-1.5">
                <span className="text-muted">
                  · {o.agentKeys} key{o.agentKeys === 1 ? "" : "s"}
                </span>
                {o.agentLastUsedAt ? (
                  <span className="ml-1.5 text-muted">
                    · connected {timeAgo(o.agentLastUsedAt)}
                  </span>
                ) : (
                  <span className="ml-1.5 font-semibold text-coral">
                    · NEVER CONNECTED
                  </span>
                )}
                {o.agentKeysPending ? (
                  <span className="ml-1.5 font-semibold text-[#b4471f]">
                    · {o.agentKeysPending} awaiting approval
                  </span>
                ) : null}
              </span>
            ) : null}
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
          <form action={agAction} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={o.id} />
            <input
              type="hidden"
              name="enabled"
              value={o.agenticEnabled ? "false" : "true"}
            />
            {!o.agenticEnabled ? (
              <input
                name="agenticDays"
                defaultValue="365"
                inputMode="numeric"
                title="Days of agent access (blank or 0 = no expiry)"
                className={`${input} w-14 py-1.5`}
              />
            ) : null}
            <button
              type="submit"
              disabled={agPending}
              className={
                o.agenticEnabled
                  ? "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  : smallBtn
              }
            >
              {agPending
                ? "…"
                : o.agenticEnabled
                  ? "Disable agent"
                  : "Enable agent"}
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
          className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-tint p-2"
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
          <ul className="flex flex-col gap-1 rounded-lg border border-line bg-tint p-2">
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
      {agState.error ? <p className={errCls}>{agState.error}</p> : null}
      {agState.message ? <p className={okCls}>{agState.message}</p> : null}
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

export function OrganizationsTab({
  orgs,
  idleOnly,
  onIdleOnlyChange,
}: {
  orgs: AdminOrg[];
  /**
   * "Paying for agent access and has never connected" — the churn list.
   *
   * Lifted to the parent rather than held here, because the triage bar needs to
   * be able to switch to this tab AND turn the filter on in one click. A filter
   * the summary can point at but not apply would make the count a dead end.
   */
  idleOnly: boolean;
  onIdleOnlyChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const idleCount = orgs.filter(
    (o) => o.agenticEnabled && !o.agentLastUsedAt,
  ).length;

  const filtered = orgs
    .filter((o) => !idleOnly || (o.agenticEnabled && !o.agentLastUsedAt))
    .filter((o) =>
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
    <section className={card}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Organizations
        </h2>
        <div className="flex items-center gap-3">
          {idleCount ? (
            <label
              className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-coral"
              title="Agent access is on but no key has ever been used"
            >
              <input
                type="checkbox"
                checked={idleOnly}
                onChange={(e) => onIdleOnlyChange(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--coral)]"
              />
              Paying · never connected ({idleCount})
            </label>
          ) : null}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / email…"
            className={`${input} w-48`}
          />
        </div>
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
  );
}
