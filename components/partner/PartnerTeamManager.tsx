"use client";

import { useActionState } from "react";
import {
  invitePartnerStaff,
  removePartnerStaff,
  revokePartnerInvite,
  setPartnerStaffRole,
} from "@/lib/partners/actions";
import type { PartnerTeam } from "@/lib/partners/members";
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
} from "@/components/admin/ui";

type Res = { error?: string; message?: string; inviteUrl?: string; email?: string };

function InviteForm({ team, disabled }: { team: PartnerTeam; disabled: boolean }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    invitePartnerStaff,
    {},
  );
  const full = team.seatsUsed >= team.seatLimit;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Email
          <input
            name="email"
            type="email"
            required
            disabled={full || disabled}
            placeholder="colleague@acme.vc"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Role
          <select
            name="role"
            defaultValue="member"
            disabled={full || disabled}
            className={input}
          >
            <option value="member">Member — view only</option>
            <option value="admin">Admin — create &amp; revoke codes</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending || full || disabled}
          className={coral}
        >
          {pending ? "Creating…" : "Create invite"}
        </button>
      </div>

      {full ? (
        <p className="text-xs text-muted">
          All {team.seatLimit} staff seats are in use. Remove someone or revoke a
          pending invite — or ask us to raise the limit.
        </p>
      ) : null}
      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.message ? <p className={okCls}>{state.message}</p> : null}

      {state.inviteUrl ? (
        <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate font-mono text-xs text-teal-800">
            {state.inviteUrl}
          </code>
          <div className="flex gap-2">
            <CopyBtn value={state.inviteUrl} label="Copy link" />
            <a
              href={`mailto:${state.email ?? ""}?subject=${encodeURIComponent(
                "You're invited to Regulatory Sidekick",
              )}&body=${encodeURIComponent(
                `Join our partner account on Regulatory Sidekick:\n\n${state.inviteUrl}\n`,
              )}`}
              className={smallBtn}
            >
              Send via email
            </a>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function PartnerTeamManager({
  team,
  isAdmin,
  suspended,
}: {
  team: PartnerTeam;
  isAdmin: boolean;
  suspended: boolean;
}) {
  const [removeState, removeAction] = useActionState<Res, FormData>(
    removePartnerStaff,
    {},
  );
  const [roleState, roleAction] = useActionState<Res, FormData>(
    setPartnerStaffRole,
    {},
  );
  const [inviteState, inviteAction] = useActionState<Res, FormData>(
    revokePartnerInvite,
    {},
  );

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-teal-900">
            People
          </h2>
          <span className="text-sm text-muted">
            {team.seatsUsed} of {team.seatLimit} seats used
          </span>
        </div>

        <ul className="mt-3 flex flex-col">
          {team.members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-teal-900">
                  {m.name || m.email || "(unknown user)"}
                  {m.isYou ? <span className="text-muted"> · you</span> : null}
                </div>
                {m.name && m.email ? (
                  <div className="truncate text-xs text-muted">{m.email}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && !m.isYou ? (
                  <>
                    <form action={roleAction} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={m.userId} />
                      <input
                        type="hidden"
                        name="role"
                        value={m.role === "admin" ? "member" : "admin"}
                      />
                      <button type="submit" className={smallBtn}>
                        Make {m.role === "admin" ? "member" : "admin"}
                      </button>
                    </form>
                    <form action={removeAction}>
                      <input type="hidden" name="userId" value={m.userId} />
                      <button type="submit" className={subtle}>
                        Remove
                      </button>
                    </form>
                  </>
                ) : (
                  <span className="text-xs text-muted">{m.role}</span>
                )}
              </div>
            </li>
          ))}
        </ul>

        {removeState.error ? (
          <p className={`${errCls} mt-2`}>{removeState.error}</p>
        ) : null}
        {roleState.error ? (
          <p className={`${errCls} mt-2`}>{roleState.error}</p>
        ) : null}
      </section>

      {team.invites.length > 0 ? (
        <section className={card}>
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Pending invites
          </h2>
          <ul className="mt-3 flex flex-col">
            {team.invites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-teal-900">{i.email}</div>
                  <div className="text-xs text-muted">
                    {i.role} · expires {fmtDate(i.expiresAt)}
                  </div>
                </div>
                {isAdmin ? (
                  <form action={inviteAction}>
                    <input type="hidden" name="inviteId" value={i.id} />
                    <button type="submit" className={subtle}>
                      Revoke
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {inviteState.error ? (
            <p className={`${errCls} mt-2`}>{inviteState.error}</p>
          ) : null}
        </section>
      ) : null}

      {isAdmin ? (
        <section className={card}>
          <h2 className="mb-3 font-display text-lg font-semibold text-teal-900">
            Invite a colleague
          </h2>
          <InviteForm team={team} disabled={suspended} />
        </section>
      ) : (
        <p className="text-sm text-muted">
          Only partner admins can invite or remove people.
        </p>
      )}
    </div>
  );
}
