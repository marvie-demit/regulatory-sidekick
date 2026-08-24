"use client";

import { useActionState } from "react";
import { decideApplication } from "@/lib/startup/actions";

type State = { error?: string; message?: string };

/**
 * One shape for both reviewers.
 *
 * The platform admin reads these from the table via the service role; a partner
 * admin reads the same applications through partner_startup_applications(). Two
 * very different paths, deliberately — but the reviewer sees and does the same
 * thing, so the component is shared and the difference stays in the data layer
 * where it belongs.
 */
export type ReviewItem = {
  id: string;
  /** Workspace name — what the reviewer recognises the applicant by. */
  subject: string;
  /** Platform admin only: which partner it came through, if any. */
  partnerName?: string | null;
  status: string;
  legalName: string | null;
  website: string | null;
  country: string | null;
  foundedOn: string | null;
  employees: number | null;
  deviceSummary: string | null;
  regulation: string | null;
  riskClass: string | null;
  fundingDilutive: number | null;
  fundingNonDilutive: number | null;
  revenue12m: number | null;
  whyBlocked: string | null;
  declared: boolean;
  decisionNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

/** Minor units in, a figure a human reads out. */
function eur(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const n = v / 100;
  if (n === 0) return "€0";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}m`;
  if (n >= 1_000) return `€${Math.round(n / 1000)}k`;
  return `€${n.toLocaleString("en-GB")}`;
}

function day(v: string | null): string {
  return v ? new Date(v).toLocaleDateString("en-GB") : "—";
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  submitted: "bg-cream2 text-teal-800",
  approved: "bg-ok text-white",
  declined: "bg-red-100 text-red-700",
  withdrawn: "bg-tint text-muted",
};

function Card({ item }: { item: ReviewItem }) {
  const [state, action, pending] = useActionState<State, FormData>(
    decideApplication,
    {},
  );
  const open = item.status === "submitted";

  return (
    <li className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-teal-900">{item.subject}</span>
          {item.legalName && item.legalName !== item.subject ? (
            <span className="ml-2 text-sm text-muted">({item.legalName})</span>
          ) : null}
          {item.partnerName ? (
            <span className="ml-2 rounded-full bg-tint px-2 py-0.5 text-[11px] font-semibold text-teal-800">
              via {item.partnerName}
            </span>
          ) : null}
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
            BADGE[item.status] ?? "bg-tint text-muted"
          }`}
        >
          {item.status}
        </span>
      </div>

      <p className="mt-3 text-sm text-ink">{item.deviceSummary ?? "—"}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Fact label="Employees" value={item.employees ?? "—"} />
        <Fact label="Founded" value={day(item.foundedOn)} />
        <Fact
          label="Regulation"
          value={`${item.regulation ?? "—"}${item.riskClass ? ` · ${item.riskClass}` : ""}`}
        />
        <Fact label="Country" value={item.country ?? "—"} />
        <Fact label="Dilutive" value={eur(item.fundingDilutive)} />
        <Fact label="Non-dilutive" value={eur(item.fundingNonDilutive)} />
        <Fact label="Revenue 12m" value={eur(item.revenue12m)} />
        <Fact
          label="Website"
          value={
            item.website ? (
              <a
                className="lnk"
                href={
                  item.website.startsWith("http")
                    ? item.website
                    : `https://${item.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.website}
              </a>
            ) : (
              "—"
            )
          }
        />
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Why CE marking is out of reach
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
          {item.whyBlocked ?? "—"}
        </p>
      </div>

      <div className="mt-3 text-xs text-muted">
        Declaration {item.declared ? "signed" : "NOT signed"} · submitted{" "}
        {day(item.submittedAt)}
        {item.reviewedAt ? ` · decided ${day(item.reviewedAt)}` : ""}
      </div>

      {item.decisionNote ? (
        <p className="mt-2 rounded-lg border border-line bg-tint px-3 py-2 text-sm text-muted">
          {item.decisionNote}
        </p>
      ) : null}

      {open ? (
        <form action={action} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={item.id} />
          <input
            name="note"
            maxLength={500}
            placeholder="Note to the applicant (optional)"
            className="h-[38px] min-w-[220px] flex-1 rounded-lg border border-line bg-white px-3 text-sm text-teal-900 outline-none focus:border-teal-500"
            autoComplete="off"
          />
          <button
            type="submit"
            name="decision"
            value="approved"
            disabled={pending}
            className="rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="submit"
            name="decision"
            value="declined"
            disabled={pending}
            className="rounded-full border border-line bg-card px-5 py-2 text-sm font-semibold text-teal-800 transition hover:border-coral disabled:opacity-60"
          >
            Decline
          </button>
        </form>
      ) : null}

      {state.error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="mt-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}

export function ApplicationReview({
  items,
  /**
   * Spacing above the heading. The partner console stacks this below other
   * sections and needs the gap; in the admin console it is a tab panel and the
   * gap reads as a misalignment.
   */
  spaced = true,
}: {
  items: ReviewItem[];
  spaced?: boolean;
}) {
  // Undecided first — a queue sorted by date buries the only rows that need
  // action once a few decisions have been made.
  const pending = items.filter((i) => i.status === "submitted");
  const decided = items.filter((i) => i.status !== "submitted");

  return (
    <section className={spaced ? "mt-10" : ""}>
      <h2 className="font-display text-lg font-semibold text-teal-900">
        Startup Programme applications
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        {pending.length
          ? `${pending.length} waiting for a decision.`
          : "Nothing waiting for a decision."}{" "}
        Approving opens the €1,800 checkout for that workspace; it does not grant
        access on its own.
      </p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-line bg-tint px-4 py-3 text-sm text-muted">
          No applications yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {[...pending, ...decided].map((i) => (
            <Card key={i.id} item={i} />
          ))}
        </ul>
      )}
    </section>
  );
}
