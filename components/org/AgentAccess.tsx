"use client";

import { useActionState, useState } from "react";
import {
  createAgentToken,
  approveAgentToken,
  revokeAgentToken,
} from "@/lib/auth/agent-token-actions";
import {
  AGENT_TOKEN_LIMIT,
  AGENT_TOKEN_TTL_DAYS,
  SCOPE_LABELS,
  type AgentToken,
} from "@/lib/auth/agent-tokens";

type Res = { error?: string; message?: string; token?: string; name?: string };

const card = "rounded-2xl border border-line bg-card p-6 shadow-sm";
const input =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const coral =
  "rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const subtle =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60";
const goBtn =
  "shrink-0 rounded-full bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60";
const errCls =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";
const okCls =
  "rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={`${input} flex-1 font-mono text-xs`}
      />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
        }}
        className={goBtn}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function StatusChip({ t }: { t: AgentToken }) {
  const [bg, fg, label] =
    t.status === "active" && !t.expired
      ? ["#e7f0ec", "#1d6e62", "Active"]
      : t.status === "pending"
        ? ["#fdf0e9", "#b4471f", "Awaiting approval"]
        : t.expired && t.status === "active"
          ? ["#f1f1f1", "#6b6b6b", "Expired"]
          : ["#f1f1f1", "#6b6b6b", "Revoked"];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function CreateForm({ atLimit, isAdmin }: { atLimit: boolean; isAdmin: boolean }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    createAgentToken,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="Claude implementation agent"
          disabled={atLimit}
          className={`${input} flex-1`}
        />
        <button type="submit" disabled={pending || atLimit} className={coral}>
          {pending ? "Creating…" : "Create key"}
        </button>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-teal-900">
        <input
          type="checkbox"
          name="write"
          defaultChecked
          disabled={atLimit}
          className="mt-0.5 h-4 w-4 accent-[var(--t6)]"
        />
        <span>
          Let the agent update progress
          <span className="block text-xs text-muted">
            {SCOPE_LABELS["write:status"]}. Unchecked, the key is read-only.
          </span>
        </span>
      </label>

      {state.error ? <p className={errCls}>{state.error}</p> : null}

      {state.token ? (
        <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-sm text-teal-800">
            <span className="font-semibold">{state.message}</span> Copy the key
            now — it&apos;s shown only once and can&apos;t be recovered.
          </p>
          <CopyField value={state.token} />
        </div>
      ) : state.message ? (
        <p className={okCls}>{state.message}</p>
      ) : null}

      {!isAdmin ? (
        <p className="text-xs text-muted">
          A workspace admin has to approve the key before it works.
        </p>
      ) : null}
    </form>
  );
}

function TokenRow({
  t,
  isAdmin,
  writeLimit,
}: {
  t: AgentToken;
  isAdmin: boolean;
  writeLimit: number;
}) {
  const [apState, approve, approving] = useActionState<Res, FormData>(
    approveAgentToken,
    {},
  );
  const [rvState, revoke, revoking] = useActionState<Res, FormData>(
    revokeAgentToken,
    {},
  );
  const dead = t.status === "revoked";
  const canRevoke = !dead && (isAdmin || t.createdByYou);

  return (
    <li
      className={
        "flex flex-col gap-2 border-t border-line py-3 first:border-t-0 " +
        (dead ? "opacity-55" : "")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-teal-900">{t.name}</span>
        <StatusChip t={t} />
        <code className="rounded bg-[#f2f5f3] px-1.5 py-0.5 font-mono text-[11px] text-muted">
          {t.prefix}…
        </code>
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && t.status === "pending" ? (
            <form action={approve}>
              <input type="hidden" name="tokenId" value={t.id} />
              <button type="submit" disabled={approving} className={goBtn}>
                {approving ? "Approving…" : "Approve"}
              </button>
            </form>
          ) : null}
          {canRevoke ? (
            <form action={revoke}>
              <input type="hidden" name="tokenId" value={t.id} />
              <button type="submit" disabled={revoking} className={subtle}>
                {revoking ? "…" : t.status === "pending" ? "Withdraw" : "Revoke"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <div className="text-xs text-muted">
        {t.scopes.includes("write:status")
          ? "Read + update progress"
          : "Read only"}{" "}
        · created by {t.createdByYou ? "you" : t.createdByEmail} ·{" "}
        {t.approvedAt
          ? `approved by ${t.approvedByEmail || "an admin"} ${fmt(t.approvedAt)}`
          : "not yet approved"}{" "}
        · expires {fmt(t.expiresAt)} · last used{" "}
        {t.lastUsedAt ? fmt(t.lastUsedAt) : "never"}
        {!dead && t.scopes.includes("write:status") ? (
          <>
            {" "}
            ·{" "}
            <span className={t.writeUsed >= writeLimit ? "text-red-600" : ""}>
              {t.writeUsed}/{writeLimit} writes today
            </span>
          </>
        ) : null}
      </div>
      {apState.error ? <p className={errCls}>{apState.error}</p> : null}
      {rvState.error ? <p className={errCls}>{rvState.error}</p> : null}
    </li>
  );
}

export function AgentAccess({
  tokens,
  isAdmin,
  isFull,
  baseUrl,
  rateLimit,
  writeLimit,
  isEnabled,
}: {
  tokens: AgentToken[];
  isAdmin: boolean;
  isFull: boolean;
  baseUrl: string;
  rateLimit: number;
  writeLimit: number;
  /** the separately-sold agent add-on — off by default */
  isEnabled: boolean;
}) {
  const live = tokens.filter((t) => t.status !== "revoked");
  const atLimit = live.length >= AGENT_TOKEN_LIMIT;
  const pending = tokens.filter((t) => t.status === "pending").length;

  return (
    <section className={`${card} mt-6 flex flex-col gap-5`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Agent access
        </h2>
        <p className="mt-1 text-sm text-muted">
          Give an AI agent a scoped key so it can work this workspace&apos;s
          implementation — read what&apos;s next and mark activities done. Keys
          are inert until an admin approves them, expire after{" "}
          {AGENT_TOKEN_TTL_DAYS} days, and every action lands in your{" "}
          <span className="font-medium text-teal-800">Activity log</span>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Each key is budgeted at{" "}
          <span className="font-medium text-teal-800">
            {rateLimit} requests/minute
          </span>{" "}
          and{" "}
          <span className="font-medium text-teal-800">
            {writeLimit} writes/day
          </span>
          , so a looping agent can&apos;t churn your records. Over budget returns{" "}
          <code className="font-mono">429</code>. Need more? Get in touch — the
          limit is set by us, not from here.
        </p>
      </div>

      {!isFull ? (
        <p className="rounded-lg border border-line bg-[#f7faf8] px-3 py-2 text-sm text-muted">
          Agent access requires full access.
        </p>
      ) : !isEnabled ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-sm font-medium text-teal-900">
            Agent access isn&apos;t switched on for this workspace.
          </p>
          <p className="mt-1 text-sm text-teal-800">
            It&apos;s a separate add-on to your licence — get in touch and
            we&apos;ll enable it. Any keys below stay exactly as they are and
            start working again the moment it&apos;s on.
          </p>
        </div>
      ) : (
        <>
          <CreateForm atLimit={atLimit} isAdmin={isAdmin} />
          {atLimit ? (
            <p className="text-xs text-muted">
              {AGENT_TOKEN_LIMIT} keys is the limit — revoke one to add another.
            </p>
          ) : null}
        </>
      )}

      {pending && isAdmin ? (
        <p className={okCls}>
          {pending} key{pending === 1 ? "" : "s"} waiting for your approval.
        </p>
      ) : null}

      {tokens.length ? (
        <ul className="flex flex-col">
          {tokens.map((t) => (
            <TokenRow
              key={t.id}
              t={t}
              isAdmin={isAdmin}
              writeLimit={writeLimit}
            />
          ))}
        </ul>
      ) : null}

      <details className="rounded-xl border border-line bg-[#f7faf8] p-3">
        <summary className="cursor-pointer text-sm font-medium text-teal-800">
          How an agent connects
        </summary>
        <p className="mt-2 text-xs text-muted">
          The key identifies the workspace on its own — the agent never sends a
          workspace ID. Point it at these endpoints with the header{" "}
          <code className="font-mono">Authorization: Bearer rsk_…</code>
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-teal-900">
          {`GET   ${baseUrl}/api/v1/next
GET   ${baseUrl}/api/v1/activities/{id}
PATCH ${baseUrl}/api/v1/activities/{id}
      { "status": "Done" }
      { "tasks": { "0": true, "1": true } }`}
        </pre>
      </details>
    </section>
  );
}
