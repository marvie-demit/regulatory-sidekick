"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createInvite, removeMember, revokeInvite } from "@/lib/auth/team";
import type { Member, PendingInvite, Team } from "@/lib/auth/members";

type Res = {
  error?: string;
  message?: string;
  inviteUrl?: string;
  email?: string;
};

const card = "rounded-2xl border border-line bg-card p-6 shadow-sm";
const input =
  "rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const coral =
  "rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const subtle =
  "shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60";
const chip =
  "shrink-0 rounded-full bg-[#eef1ef] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#5c6b66]";
const errCls =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700";

const roleLabel = (r: string) =>
  r === "admin" ? "Admin" : r === "viewer" ? "Viewer" : "Member";

function InviteForm({ remaining }: { remaining: number }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    createInvite,
    {},
  );
  const [copied, setCopied] = useState(false);
  const full = remaining <= 0;

  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Invite a teammate
        </h2>
        <p className="mt-1 text-sm text-muted">
          {full
            ? "All seats are in use — remove a member or revoke an invite to add someone."
            : `${remaining} seat${remaining === 1 ? "" : "s"} available. You'll get a link to send them.`}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@company.com"
          disabled={full}
          className={`${input} flex-1`}
        />
        <select name="role" defaultValue="member" disabled={full} className={input}>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={pending || full} className={coral}>
          {pending ? "Creating…" : "Create invite"}
        </button>
      </div>

      {state.error ? <p className={errCls}>{state.error}</p> : null}

      {state.inviteUrl ? (
        <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3">
          <p className="text-sm text-teal-800">
            {state.message} Copy this link and send it — it&apos;s shown only
            once.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={state.inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className={`${input} flex-1 font-mono text-xs`}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(state.inviteUrl!);
                setCopied(true);
              }}
              className="shrink-0 rounded-full bg-teal-800 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={`mailto:${encodeURIComponent(
                state.email ?? "",
              )}?subject=${encodeURIComponent(
                "You're invited to Regulatory Sidekick",
              )}&body=${encodeURIComponent(
                `Join our workspace on Regulatory Sidekick:\n\n${state.inviteUrl}\n\nThe link expires in 14 days.`,
              )}`}
              className="shrink-0 rounded-full border border-line px-4 py-2 text-center text-xs font-semibold text-teal-800 transition hover:bg-white"
            >
              Send via email
            </a>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function MemberRow({ m, canManage }: { m: Member; canManage: boolean }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    removeMember,
    {},
  );
  return (
    <li className="flex flex-col gap-1 border-b border-line py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-teal-900">
            {m.name || m.email || "Pending member"}
            {m.isYou ? (
              <span className="ml-1.5 text-xs font-normal text-muted">
                (you)
              </span>
            ) : null}
          </div>
          {m.email && m.name ? (
            <div className="truncate text-xs text-muted">{m.email}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={chip}>{roleLabel(m.role)}</span>
          {canManage && !m.isYou ? (
            <form action={action}>
              <input type="hidden" name="userId" value={m.userId} />
              <button type="submit" disabled={pending} className={subtle}>
                {pending ? "…" : "Remove"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
    </li>
  );
}

function InviteRow({ inv, canManage }: { inv: PendingInvite; canManage: boolean }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    revokeInvite,
    {},
  );
  return (
    <li className="flex flex-col gap-1 border-b border-line py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-teal-900">
            {inv.email}
          </div>
          <div className="text-xs text-muted">Pending · {roleLabel(inv.role)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${chip} bg-[#faf2e8] text-[#9a6b3f]`}>Invited</span>
          {canManage ? (
            <form action={action}>
              <input type="hidden" name="inviteId" value={inv.id} />
              <button type="submit" disabled={pending} className={subtle}>
                {pending ? "…" : "Revoke"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {state.error ? <p className={errCls}>{state.error}</p> : null}
    </li>
  );
}

export function MembersManager({
  team,
  isAdmin,
  isFull,
}: {
  team: Team;
  isAdmin: boolean;
  isFull: boolean;
}) {
  const remaining = team.seatLimit - team.seatsUsed;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-xl border border-line bg-[#f4f7f5] px-4 py-3 text-sm">
        <span className="font-medium text-teal-900">Seats</span>
        <span className="text-muted">
          {team.seatsUsed} of {team.seatLimit} used
        </span>
      </div>

      {isAdmin && isFull ? <InviteForm remaining={remaining} /> : null}

      {isAdmin && !isFull ? (
        <div className={`${card} flex flex-col gap-2`}>
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Invite your team
          </h2>
          <p className="text-sm text-muted">
            Adding teammates is part of full access (up to {team.seatLimit}{" "}
            users per workspace).
          </p>
          <Link
            href="/pricing"
            className="mt-1 self-start rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Purchase for full access
          </Link>
        </div>
      ) : null}

      {!isAdmin ? (
        <p className="text-sm text-muted">
          Only workspace admins can invite or remove people.
        </p>
      ) : null}

      <section className={card}>
        <h2 className="mb-1 font-display text-lg font-semibold text-teal-900">
          Members
        </h2>
        <ul className="flex flex-col">
          {team.members.map((m) => (
            <MemberRow key={m.userId} m={m} canManage={isAdmin} />
          ))}
        </ul>
      </section>

      {isAdmin && team.invites.length > 0 ? (
        <section className={card}>
          <h2 className="mb-1 font-display text-lg font-semibold text-teal-900">
            Pending invites
          </h2>
          <ul className="flex flex-col">
            {team.invites.map((inv) => (
              <InviteRow key={inv.id} inv={inv} canManage={isAdmin} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
