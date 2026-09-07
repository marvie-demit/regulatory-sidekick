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
//
// THE ROW REPORTS STATE; CONTROLS ARE ONE CLICK AWAY. That is the whole shape,
// and it is a deliberate reversal of what this was.
//
// It used to put every control on the surface: a plan <select>, two unlabelled
// day fields, four buttons and Delete, all at equal weight in one row. Three
// problems came from that, and the first was a real bug:
//
//   · The <select defaultValue={o.plan}> LOOKED like the current plan but was a
//     form input. defaultValue only applies on mount, so after any action the
//     DOM kept whatever was last chosen and drifted from the truth — the row
//     could read "Explore" for an org on Full.
//   · Two "365" fields (plan days, agent days) with no labels, only one visible
//     at a time depending on state.
//   · Nothing said which control governed what, so the row could only be used
//     by someone who already knew.
//
// Now each concern is one labelled line showing its state as TEXT — text cannot
// drift and cannot be mistaken for a pending edit — and `open` reveals exactly
// one section's form at a time. It costs a click. That trade is made on purpose:
// this console is read by people who did not build it.

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

/** Which section's form is open. Exactly one, or none. */
type Section = "licence" | "agent" | "limits" | "members" | null;

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} />
  </svg>
);

function Badge({
  tone,
  children,
}: {
  tone: "plan" | "on" | "off";
  children: React.ReactNode;
}) {
  const cls =
    tone === "on"
      ? "bg-[#e7f0ec] text-[#1d6e62]"
      : tone === "off"
        ? "bg-[#f1f1f1] text-[#6b6b6b]"
        : "bg-tint2 text-teal-800";
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] ${cls}`}
    >
      {children}
    </span>
  );
}

/** One labelled line: what this concern is, and a way in. */
function SectionRow({
  label,
  summary,
  open,
  onToggle,
  cta = "Change",
  last = false,
  children,
}: {
  label: string;
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  cta?: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={last && !open ? "" : "border-b border-line"}>
      <div className={open ? "bg-tint" : ""}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-start gap-4 px-3.5 py-2.5 text-left transition hover:bg-tint"
        >
          <span
            className={`w-[62px] shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              open ? "text-teal-800" : "text-muted"
            }`}
          >
            {label}
          </span>
          <span className="min-w-0 flex-1 text-[13px] text-ink">{summary}</span>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium text-teal-800">
            {open ? "Close" : cta}
            <Chevron open={open} />
          </span>
        </button>
        {open ? <div className="px-3.5 pb-3.5 pl-[92px]">{children}</div> : null}
      </div>
    </div>
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
  const [agState, agAction, agPending] = useActionState<Res, FormData>(
    setOrgAgentAccess,
    {},
  );
  const [open, setOpen] = useState<Section>(null);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  // Messages are dismissible rather than permanent. Five independent actions
  // used to leave five boxes stacked with no way to clear them, so after a few
  // operations the row was mostly green and none of it was current.
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));
  const drop = (k: string) => setHidden((h) => ({ ...h, [k]: true }));

  const notices: { key: string; cls: string; body: React.ReactNode }[] = [];
  const push = (key: string, state: Res) => {
    if (state.error) notices.push({ key, cls: errCls, body: state.error });
    else if (state.message)
      notices.push({ key, cls: okCls, body: state.message });
  };
  push("apply", applyState);
  push("agent", agState);
  push("limits", limitState);
  if (codeState.error)
    notices.push({ key: "code", cls: errCls, body: codeState.error });

  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-0">
      {/* Identity and the two facts worth having when scanning a long list. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate font-display text-[17px] font-semibold leading-tight text-teal-900">
            {o.name}
          </div>
          <div className="truncate text-xs text-muted">
            {o.ownerEmail ?? "no owner"} · {o.members} member
            {o.members === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="plan">{planLabel(o.plan)}</Badge>
          <Badge tone={o.agenticEnabled ? "on" : "off"}>
            {o.agenticEnabled ? "Agent on" : "Agent off"}
          </Badge>
          {/* Delete lives behind the overflow, away from routine actions. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="More actions"
              aria-expanded={menu}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-muted transition hover:border-coral hover:text-coral"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="19" cy="12" r="1.7" />
              </svg>
            </button>
            {menu ? (
              <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-lg border border-line bg-card shadow-md">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setConfirming(true);
                    setTyped("");
                  }}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete workspace
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <SectionRow
          label="Licence"
          open={open === "licence"}
          onToggle={() => toggle("licence")}
          summary={
            <>
              {planLabel(o.plan)}
              <span className="text-muted">
                {o.planExpiresAt ? ` · until ${fmtDate(o.planExpiresAt)}` : " · no expiry"}
              </span>
            </>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <form action={applyAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="orgId" value={o.id} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-muted">Change plan to</span>
                <select
                  name="plan"
                  defaultValue={o.plan}
                  className={`${input} py-1.5`}
                >
                  <option value="explore">Explore</option>
                  <option value="full">Full</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-muted">For how many days</span>
                <input
                  name="grantDays"
                  defaultValue="365"
                  inputMode="numeric"
                  title="0 or blank = no expiry"
                  className={`${input} w-24 py-1.5`}
                />
              </label>
              <button
                type="submit"
                disabled={applyPending}
                className="shrink-0 rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
              >
                {applyPending ? "…" : "Apply"}
              </button>
            </form>
            {/* Minting a full-access code is a way of granting the LICENCE, so
                it belongs here rather than adrift in a row of mixed actions. */}
            <form action={codeAction}>
              <input type="hidden" name="targetOrgId" value={o.id} />
              <input type="hidden" name="plan" value="full" />
              <input type="hidden" name="grantDays" value="365" />
              <button type="submit" disabled={codePending} className={smallBtn}>
                {codePending ? "…" : "Create code for this org"}
              </button>
            </form>
          </div>
        </SectionRow>

        <SectionRow
          label="Agent"
          open={open === "agent"}
          onToggle={() => toggle("agent")}
          summary={
            <span className="flex flex-col gap-1.5">
              <span>
                {o.agenticEnabled ? "On" : "Off"}
                {o.agenticEnabled ? (
                  <span className="text-muted">
                    {o.agenticExpiresAt ? ` · until ${fmtDate(o.agenticExpiresAt)}` : " · no expiry"}
                    {` · ${o.agentKeys} key${o.agentKeys === 1 ? "" : "s"}`}
                    {o.agentLastUsedAt ? ` · used ${timeAgo(o.agentLastUsedAt)}` : ""}
                  </span>
                ) : null}
              </span>
              {/* Amber, not red. They are paying and have never once connected:
                  a churn signal worth chasing before they cancel, but a
                  business state rather than a fault. */}
              {o.agenticEnabled && !o.agentLastUsedAt ? (
                <span className="flex w-fit items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                  Never connected — paying, never used it
                </span>
              ) : null}
              {o.agentKeysPending ? (
                <span className="w-fit text-xs font-semibold text-[#b4471f]">
                  {o.agentKeysPending} key
                  {o.agentKeysPending === 1 ? "" : "s"} awaiting approval
                </span>
              ) : null}
            </span>
          }
        >
          <form action={agAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="orgId" value={o.id} />
            <input
              type="hidden"
              name="enabled"
              value={o.agenticEnabled ? "false" : "true"}
            />
            {!o.agenticEnabled ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] text-muted">For how many days</span>
                <input
                  name="agenticDays"
                  defaultValue="365"
                  inputMode="numeric"
                  title="0 or blank = no expiry"
                  className={`${input} w-24 py-1.5`}
                />
              </label>
            ) : null}
            <button
              type="submit"
              disabled={agPending}
              className={
                o.agenticEnabled
                  ? "shrink-0 rounded-full border border-line px-4 py-2 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  : "shrink-0 rounded-full bg-coral px-4 py-2 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
              }
            >
              {agPending ? "…" : o.agenticEnabled ? "Turn agent off" : "Turn agent on"}
            </button>
            <span className="text-[11px] text-muted">
              Checked on every request, so switching it off makes existing keys
              inert immediately.
            </span>
          </form>
        </SectionRow>

        <SectionRow
          label="Limits"
          open={open === "limits"}
          onToggle={() => toggle("limits")}
          summary={
            <span className="text-muted">
              {o.agentRateLimit ?? DEFAULT_AGENT_RATE_LIMIT} req/min ·{" "}
              {o.agentWriteLimit ?? DEFAULT_AGENT_WRITE_LIMIT} writes/day
            </span>
          }
        >
          <form action={limitAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="orgId" value={o.id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted">Requests / minute</span>
              <input
                name="agentRateLimit"
                defaultValue={o.agentRateLimit ?? ""}
                placeholder={String(DEFAULT_AGENT_RATE_LIMIT)}
                inputMode="numeric"
                className={`${input} w-24 py-1.5`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted">Writes / day</span>
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
              Blank = default. Only settable here; a workspace can&apos;t raise
              its own ceiling.
            </span>
          </form>
        </SectionRow>

        <SectionRow
          label="Members"
          cta="View"
          last
          open={open === "members"}
          onToggle={() => toggle("members")}
          summary={
            <span className="text-muted">
              {o.members} member{o.members === 1 ? "" : "s"}
            </span>
          }
        >
          {o.memberList.length ? (
            <ul className="flex flex-col gap-1">
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
          )}
        </SectionRow>
      </div>

      {/* One message area, each dismissible. */}
      {notices
        .filter((n) => !hidden[n.key])
        .map((n) => (
          <div
            key={n.key}
            className={`${n.cls} flex items-start justify-between gap-3`}
          >
            <span className="min-w-0">{n.body}</span>
            <button
              type="button"
              onClick={() => drop(n.key)}
              aria-label="Dismiss"
              className="shrink-0 opacity-60 transition hover:opacity-100"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      <CodeResult state={codeState} />

      {confirming ? (
        <form
          action={delAction}
          className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
        >
          <div className="text-xs text-red-700">
            Permanently delete <b>{o.name}</b> and everything in it: members,
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
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={smallBtn}
            >
              Cancel
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
        Open <b>Licence</b> to grant access now, or to mint a code they redeem
        themselves. <b>Agent</b> is the separately-paid add-on.
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
