"use client";

import { useActionState } from "react";
import {
  createAgentToken,
  approveAgentToken,
  revokeAgentToken,
} from "@/lib/auth/agent-token-actions";
import {
  AGENT_TOKEN_LIMIT,
  SCOPE_LABELS,
  SCOPE_SHORT,
  type AgentToken,
} from "@/lib/auth/agent-tokens";
import { claudeCodeCommand } from "@/lib/agent/release";
import { CopyField, CopyBlock } from "@/components/ui/Copy";

type Res = { error?: string; message?: string; token?: string; name?: string };

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

export function CreateKeyForm({
  atLimit,
  isAdmin,
  baseUrl,
  showCommand,
}: {
  atLimit: boolean;
  isAdmin: boolean;
  baseUrl: string;
  /** print the paste-ready install command alongside the raw key */
  showCommand: boolean;
}) {
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
      <div className="flex flex-col gap-2.5">
        <label className="flex items-start gap-2.5 text-sm text-teal-900">
          <input
            type="checkbox"
            name="documents"
            defaultChecked
            disabled={atLimit}
            className="mt-0.5 h-4 w-4 accent-[var(--t6)]"
          />
          <span>
            Let the agent fetch document templates
            <span className="block text-xs text-muted">
              {SCOPE_LABELS["read:documents"]}. Without this it can read the plan
              but not draft anything.
            </span>
          </span>
        </label>
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
              {SCOPE_LABELS["write:status"]}. Unchecked, it cannot write at all.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-teal-900">
          <input
            type="checkbox"
            name="drafts"
            defaultChecked
            disabled={atLimit}
            className="mt-0.5 h-4 w-4 accent-[var(--t6)]"
          />
          <span>
            Report which documents it has drafted
            <span className="block text-xs text-muted">
              {SCOPE_LABELS["write:drafts"]}. Unchecked, it still drafts — you
              just won&apos;t see it in the app without opening the folder.
            </span>
          </span>
        </label>
      </div>

      {state.error ? <p className={errCls}>{state.error}</p> : null}

      {/* The ONLY moment the raw key exists. Everything the customer has to
          paste is rendered here, with the key already in it — so the next step
          is a paste, not a hunt. Never persist this to make setup "easier". */}
      {state.token ? (
        <div className="flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-sm text-teal-800">
            <span className="font-semibold">{state.message}</span> Copy it now —
            it&apos;s shown only once and can&apos;t be recovered.
          </p>
          <CopyField value={state.token} />
          {showCommand ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-teal-800">
                Or paste this in your QMS folder — the key is already in it:
              </p>
              <CopyBlock value={claudeCodeCommand(state.token, baseUrl)} />
            </div>
          ) : null}
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
        <code className="rounded bg-tint px-1.5 py-0.5 font-mono text-[11px] text-muted">
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
      {/* Scopes are listed explicitly, not summarised, because 0018 and 0019
          each added one: a key minted before either will 403 on the endpoint it
          missed, and the only fix is a NEW key — scopes cannot be granted to an
          existing one. Saying so per key is cheaper than a support queue.
          Ordered so the more fundamental gap is named first: a key that cannot
          fetch templates cannot draft, which makes reporting moot. */}
      {!dead && !t.scopes.includes("read:documents") ? (
        <p className="rounded-lg border border-line bg-tint px-2.5 py-1.5 text-xs text-muted">
          This key can&apos;t fetch document templates. Create a new one with{" "}
          <b className="text-teal-800">Let the agent fetch document templates</b>{" "}
          ticked if you want it to draft.
        </p>
      ) : !dead && !t.scopes.includes("write:drafts") ? (
        <p className="rounded-lg border border-line bg-tint px-2.5 py-1.5 text-xs text-muted">
          This key can draft, but can&apos;t tell the workspace it did — drafts
          won&apos;t appear in your library. Create a new one with{" "}
          <b className="text-teal-800">
            Report which documents it has drafted
          </b>{" "}
          ticked.
        </p>
      ) : null}
      <div className="text-xs text-muted">
        {t.scopes.map((s) => SCOPE_SHORT[s] ?? s).join(" + ")} · created by{" "}
        {t.createdByYou ? "you" : t.createdByEmail} ·{" "}
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

export function KeyList({
  tokens,
  isAdmin,
  writeLimit,
}: {
  tokens: AgentToken[];
  isAdmin: boolean;
  writeLimit: number;
}) {
  if (!tokens.length)
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
        No keys yet. Create one above to connect an agent.
      </p>
    );

  const pending = tokens.filter((t) => t.status === "pending").length;
  return (
    <div className="flex flex-col gap-3">
      {pending && isAdmin ? (
        <p className={okCls}>
          {pending} key{pending === 1 ? "" : "s"} waiting for your approval.
        </p>
      ) : null}
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
      {tokens.filter((t) => t.status !== "revoked").length >=
      AGENT_TOKEN_LIMIT ? (
        <p className="text-xs text-muted">
          {AGENT_TOKEN_LIMIT} keys is the limit — revoke one to add another.
        </p>
      ) : null}
    </div>
  );
}
