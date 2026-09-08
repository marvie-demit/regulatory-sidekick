"use client";

import { useActionState, useState } from "react";
import {
  createAccessCode,
  deleteOrg,
  setOrgAgentAccess,
  setOrgAgentLimits,
  setOrgPlan,
} from "@/lib/admin/actions";
import type { AccessCode, AdminOrg } from "@/lib/admin/data";
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

/**
 * A code issued to this workspace that nobody has redeemed yet.
 *
 * The same revoked / lapsed / spent vocabulary the Codes tab uses, so the two
 * places cannot disagree about what "outstanding" means. Worth surfacing on the
 * row because that is where you mint one: without it, checking whether a code
 * you sent was ever used means switching tab and searching for it.
 */
function redemptionOf(c: AccessCode): "outstanding" | "redeemed" | "dead" {
  if (c.revokedAt) return "dead";
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return "dead";
  if (c.usedCount >= c.maxUses) return "redeemed";
  return c.usedCount > 0 ? "redeemed" : "outstanding";
}

/** What a code grants, in the Codes tab's words. */
function grantsOf(c: AccessCode): string {
  const parts: string[] = [];
  if (c.plan) parts.push(planLabel(c.plan));
  if (c.agentic) parts.push(`Agent ${c.agenticDays ? `${c.agenticDays}d` : "∞"}`);
  return parts.join(" + ") || "—";
}

/** Which section's form is open. Exactly one, or none. */
type Section = "licence" | "agent" | "limits" | "code" | "members" | null;

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

function OrgRow({ o, codes }: { o: AdminOrg; codes: AccessCode[] }) {
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
  // The ROW collapses too, not just its sections. Seven orgs times five
  // section rows is a wall you have to scroll past to reach anyone, so the
  // list defaults to headers and you open the one you came for.
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Section>(null);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  // Messages are dismissible rather than permanent. Five independent actions
  // used to leave five boxes stacked with no way to clear them, so after a few
  // operations the row was mostly green and none of it was current.
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  // Codes locked to THIS workspace. Filtered from the list the console already
  // loaded, so this costs no extra query.
  const mine = codes.filter((c) => c.targetOrgId === o.id);
  const outstanding = mine.filter((c) => redemptionOf(c) === "outstanding");

  // What a reader must be able to see WITHOUT opening the row.
  const attention: string[] = [];
  if (o.agenticEnabled && !o.agentLastUsedAt) attention.push("Never connected");
  if (outstanding.length)
    attention.push(
      `${outstanding.length} code${outstanding.length === 1 ? "" : "s"} not redeemed`,
    );
  if (o.agentKeysPending)
    attention.push(
      `${o.agentKeysPending} key${o.agentKeysPending === 1 ? "" : "s"} awaiting approval`,
    );

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
      {/* Identity, plus anything that needs attention. Both stay on the
          COLLAPSED line on purpose: a churn signal you have to expand a row to
          find is a signal nobody sees. */}
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span className="pt-1 text-muted transition">
            <Chevron open={expanded} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[17px] font-semibold leading-tight text-teal-900">
              {o.name}
            </span>
            <span className="block truncate text-xs text-muted">
              {o.ownerEmail ?? "no owner"} · {o.members} member
              {o.members === 1 ? "" : "s"}
            </span>
            {attention.length ? (
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {attention.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-cream2 px-2 py-0.5 text-[11px] font-semibold text-[#b4471f]"
                  >
                    {a}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </button>
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

      {expanded ? (
        <>
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

        {/* Its own row rather than a corner of Licence: since 0023 a code can
            carry the licence, the agent add-on, or both, so it is no longer a
            licence concern — and a second plan <select> inside the Licence
            form would be read as part of Apply. */}
        <SectionRow
          label="Code"
          cta="Mint"
          open={open === "code"}
          onToggle={() => toggle("code")}
          summary={
            outstanding.length ? (
              <span>
                {outstanding.length} code{outstanding.length === 1 ? "" : "s"}{" "}
                <span className="font-medium text-[#b4471f]">
                  waiting to be redeemed
                </span>
              </span>
            ) : (
              <span className="text-muted">
                Mint a code locked to this workspace
              </span>
            )
          }
        >
          <form action={codeAction} className="flex flex-wrap items-end gap-3">
            {/* Locked to this org, which is the whole point of minting from the
                customer's own row: an unlocked agent code works for whoever
                receives it, and the add-on is €150/month. */}
            <input type="hidden" name="targetOrgId" value={o.id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted">Grants plan</span>
              <select name="plan" defaultValue="full" className={`${input} py-1.5`}>
                <option value="full">Full</option>
                <option value="enterprise">Enterprise</option>
                <option value="none">None (agent only)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] text-muted">Plan days</span>
              <input
                name="grantDays"
                defaultValue="365"
                inputMode="numeric"
                title="0 or blank = no expiry"
                className={`${input} w-20 py-1.5`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                Agent access
                <input type="checkbox" name="agentic" className="accent-coral" />
              </span>
              <input
                name="agenticDays"
                placeholder="days · blank = ∞"
                inputMode="numeric"
                className={`${input} w-32 min-w-0 py-1.5`}
              />
            </label>
            <button type="submit" disabled={codePending} className={smallBtn}>
              {codePending ? "…" : "Create code"}
            </button>
            <span className="text-[11px] text-muted">
              Redeemable for 14 days. Works even if they already have access —
              that is how you add the agent later.
            </span>
          </form>

          {mine.length ? (
            <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
              {mine.map((c) => {
                const st = redemptionOf(c);
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate font-mono text-[11px] text-teal-800">
                      {c.code ?? "(code not stored)"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-muted">{grantsOf(c)}</span>
                      {st === "outstanding" ? (
                        <span className="rounded-full bg-cream2 px-2 py-0.5 font-semibold text-[#b4471f]">
                          not redeemed
                        </span>
                      ) : st === "redeemed" ? (
                        <span className="rounded-full bg-[#e7f0ec] px-2 py-0.5 font-semibold text-[#1d6e62]">
                          redeemed
                        </span>
                      ) : (
                        <span className="rounded-full bg-chip px-2 py-0.5 text-muted">
                          {c.revokedAt ? "revoked" : "expired"}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
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
        </>
      ) : null}

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
  codes,
  idleOnly,
  onIdleOnlyChange,
}: {
  orgs: AdminOrg[];
  /** Already loaded for the Codes tab; reused so the row can show redemption
   *  state without a second query. */
  codes: AccessCode[];
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
          <OrgRow key={o.id} o={o} codes={codes} />
        ))}
      </ul>
      {filtered.length === 0 ? (
        <p className="py-3 text-sm text-muted">No organizations match.</p>
      ) : null}
    </section>
  );
}
