"use client";

import { useActionState, useMemo, useState } from "react";
import { mintPartnerCodes, revokePartnerCode } from "@/lib/partners/actions";
import type {
  PartnerCode,
  PartnerOverview,
  PortfolioRow,
} from "@/lib/partners/console";
import {
  card,
  coral,
  CopyBtn,
  csvRow,
  DownloadBtn,
  errCls,
  fmtDate,
  input,
  okCls,
  smallBtn,
  subtle,
  warnCls,
} from "@/components/admin/ui";

type Res = { error?: string; message?: string; codes?: string[] };

/** Mirrors app.partner_seats_consumed — a live code holds its whole reservation. */
function seatsHeld(c: PartnerCode): number {
  if (c.revokedAt) return c.usedCount;
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return c.usedCount;
  return c.maxUses;
}

function AllowanceCard({ o }: { o: PartnerOverview }) {
  const over = o.consumed > o.allowance;
  const pct = o.allowance ? Math.min((o.consumed / o.allowance) * 100, 100) : 0;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Licences
        </h2>
        <span className="text-sm text-muted">
          {o.redemptions} redeemed by portfolio companies
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-teal-900">
        {o.consumed}{" "}
        <span className="text-base font-normal text-muted">
          of {o.allowance} issued
        </span>
      </p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${over ? "bg-coral" : "bg-teal-500"}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
      {over ? (
        <p className={`${warnCls} mt-3`}>
          You&apos;re {o.consumed - o.allowance} over your allowance. Codes
          already out stay valid — revoke unredeemed ones to free licences, or
          ask us to raise the limit.
        </p>
      ) : (
        <p className="mt-2 text-sm text-teal-700">
          {o.remaining} licence{o.remaining === 1 ? "" : "s"} remaining
        </p>
      )}
    </section>
  );
}

function MintForm({
  remaining,
  disabled,
  defaultGrantDays,
  maxGrantDays,
  defaultRedeemDays,
}: {
  remaining: number;
  disabled: boolean;
  defaultGrantDays: number | null;
  maxGrantDays: number | null;
  defaultRedeemDays: number | null;
}) {
  const [state, action, pending] = useActionState<Res, FormData>(
    mintPartnerCodes,
    {},
  );
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const needed = Math.max(count, 0) * Math.max(maxUses, 0);
  const tooMany = needed > remaining;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = (state.codes ?? []).map((c) => `${origin}/redeem/${c}`);
  const csv = useMemo(
    () =>
      [
        csvRow(["code", "redeem_url"]),
        ...(state.codes ?? []).map((c, i) => csvRow([c, links[i]])),
      ].join("\n"),
    [state.codes, links],
  );

  return (
    <form action={action} className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Create access codes
        </h2>
        <p className="mt-1 text-sm text-muted">
          Each code gives one company full access. Send the link — they redeem it
          for their own workspace. One licence per use, so 10 codes × 2 uses
          costs 20.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-muted">
          How many
          <input
            name="count"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
            inputMode="numeric"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Uses per code
          <input
            name="maxUses"
            value={maxUses}
            onChange={(e) => setMaxUses(parseInt(e.target.value, 10) || 0)}
            inputMode="numeric"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Access days
          <input
            name="grantDays"
            defaultValue={defaultGrantDays ? String(defaultGrantDays) : ""}
            placeholder="blank = ∞"
            title={
              maxGrantDays
                ? `Capped at ${maxGrantDays} days for your account`
                : undefined
            }
            inputMode="numeric"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Redeem within
          <input
            name="redeemDays"
            defaultValue={defaultRedeemDays ? String(defaultRedeemDays) : ""}
            placeholder="blank = none"
            inputMode="numeric"
            className={input}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted sm:col-span-1">
          Note
          <input name="note" placeholder="Cohort / company" className={input} />
        </label>
      </div>

      <p className={`text-xs ${tooMany ? "font-medium text-coral" : "text-muted"}`}>
        Uses <b>{needed}</b> of your {remaining} remaining licence
        {remaining === 1 ? "" : "s"}
        {tooMany ? " — not enough." : "."}
      </p>

      <button
        type="submit"
        disabled={pending || disabled || tooMany || needed < 1}
        className={`${coral} self-start`}
      >
        {pending ? "Creating…" : "Create codes"}
      </button>

      {state.error ? <p className={errCls}>{state.error}</p> : null}
      {state.message ? <p className={okCls}>{state.message}</p> : null}

      {state.codes?.length ? (
        <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-teal-800">
              {state.codes.length} code{state.codes.length === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <CopyBtn value={links.join("\n")} label="Copy all links" />
              <DownloadBtn
                filename="access-codes.csv"
                content={csv}
                label="Download CSV"
              />
            </div>
          </div>
          <textarea
            readOnly
            rows={Math.min(state.codes.length, 8)}
            value={links.join("\n")}
            className="w-full resize-y rounded-lg border border-teal-200 bg-white p-2 font-mono text-[11px] text-teal-800"
          />
          <p className="text-xs text-muted">
            These stay listed below — you can copy or re-export them any time.
          </p>
        </div>
      ) : null}
    </form>
  );
}

function CodeRow({ c, isAdmin }: { c: PartnerCode; isAdmin: boolean }) {
  const [state, action, pending] = useActionState<Res, FormData>(
    revokePartnerCode,
    {},
  );
  const lapsed = !!c.expiresAt && new Date(c.expiresAt) < new Date();
  const spent = c.usedCount >= c.maxUses;
  const dead = !!c.revokedAt || lapsed;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <li className={`border-b border-line py-3 last:border-0 ${dead ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-teal-900">
            {c.note || "(no note)"}
            {c.grantDays ? ` · ${c.grantDays}d access` : " · unlimited access"}
          </div>
          <div className="text-xs text-muted">
            {c.usedCount}/{c.maxUses} used · {seatsHeld(c)} licence
            {seatsHeld(c) === 1 ? "" : "s"} held · {fmtDate(c.createdAt)} ·{" "}
            {c.revokedAt ? (
              <span className="font-medium text-red-600">
                revoked {fmtDate(c.revokedAt)}
              </span>
            ) : lapsed ? (
              <span className="text-muted">redeem window closed</span>
            ) : spent ? (
              <span className="text-muted">fully used</span>
            ) : c.expiresAt ? (
              <span className="text-teal-700">redeem by {fmtDate(c.expiresAt)}</span>
            ) : (
              <span className="text-muted">no redeem deadline</span>
            )}
          </div>
        </div>
        {isAdmin && !c.revokedAt ? (
          <form action={action}>
            <input type="hidden" name="codeId" value={c.id} />
            <button type="submit" disabled={pending} className={subtle}>
              {pending ? "…" : "Revoke"}
            </button>
          </form>
        ) : null}
      </div>
      {c.code && !dead ? (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-line bg-cream p-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate font-mono text-xs text-teal-800">
            {c.code}
          </code>
          <div className="flex gap-2">
            <CopyBtn value={c.code} label="Copy code" />
            <CopyBtn value={`${origin}/redeem/${c.code}`} label="Copy link" />
          </div>
        </div>
      ) : null}
      {state.error ? <p className={`${errCls} mt-2`}>{state.error}</p> : null}
      {state.message ? <p className={`${okCls} mt-2`}>{state.message}</p> : null}
    </li>
  );
}

export function PartnerConsole({
  partnerName,
  isAdmin,
  suspended,
  defaultGrantDays,
  maxGrantDays,
  defaultRedeemDays,
  overview,
  codes,
  portfolio,
}: {
  partnerName: string;
  isAdmin: boolean;
  suspended: boolean;
  defaultGrantDays: number | null;
  maxGrantDays: number | null;
  defaultRedeemDays: number | null;
  overview: PartnerOverview;
  codes: PartnerCode[];
  portfolio: PortfolioRow[];
}) {
  const [showRevoked, setShowRevoked] = useState(false);
  const visible = showRevoked ? codes : codes.filter((c) => !c.revokedAt);
  const allCsv = [
    csvRow(["code", "note", "uses", "used", "redeem_by", "created"]),
    ...codes
      .filter((c) => c.code && !c.revokedAt)
      .map((c) =>
        csvRow([
          c.code,
          c.note,
          c.maxUses,
          c.usedCount,
          c.expiresAt ? c.expiresAt.slice(0, 10) : "",
          c.createdAt.slice(0, 10),
        ]),
      ),
  ].join("\n");

  return (
    <div className="flex flex-col gap-6">
      {suspended ? (
        <p className={warnCls}>
          {partnerName} is suspended — existing codes can&apos;t be redeemed and
          no new ones can be created. Get in touch and we&apos;ll sort it out.
        </p>
      ) : null}

      <AllowanceCard o={overview} />

      {isAdmin ? (
        <MintForm
          remaining={overview.remaining}
          disabled={suspended}
          defaultGrantDays={defaultGrantDays}
          maxGrantDays={maxGrantDays}
          defaultRedeemDays={defaultRedeemDays}
        />
      ) : (
        <p className="text-sm text-muted">
          Only partner admins can create or revoke codes.
        </p>
      )}

      <section className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-teal-900">
            Your codes
          </h2>
          <div className="flex items-center gap-2">
            {codes.some((c) => c.revokedAt) ? (
              <button
                type="button"
                onClick={() => setShowRevoked((v) => !v)}
                className={smallBtn}
              >
                {showRevoked ? "Hide revoked" : "Show revoked"}
              </button>
            ) : null}
            {codes.length > 0 ? (
              <DownloadBtn
                filename="all-access-codes.csv"
                content={allCsv}
                label="Export all"
              />
            ) : null}
          </div>
        </div>
        {visible.length > 0 ? (
          <ul className="flex flex-col">
            {visible.map((c) => (
              <CodeRow key={c.id} c={c} isAdmin={isAdmin} />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted">
            No codes yet{isAdmin ? " — create some above." : "."}
          </p>
        )}
      </section>

      <section className={card}>
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Portfolio
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">
          Companies that activated one of your licences. You can see that they
          activated — you can&apos;t see anything inside their workspace. Their
          QMS is theirs.
        </p>
        {portfolio.length > 0 ? (
          <ul className="flex flex-col">
            {portfolio.map((r, i) => (
              <li
                key={`${r.workspaceName}-${r.redeemedAt}-${i}`}
                className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0"
              >
                <span className="truncate text-teal-900">{r.workspaceName}</span>
                <span className="shrink-0 text-xs text-muted">
                  {r.codeNote ? `${r.codeNote} · ` : ""}
                  {fmtDate(r.redeemedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted">
            Nobody has redeemed a code yet.
          </p>
        )}
      </section>
    </div>
  );
}
