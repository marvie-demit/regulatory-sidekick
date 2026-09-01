"use client";

import { useActionState, useState } from "react";
import { saveApplication } from "@/lib/startup/actions";
import {
  LIMITS,
  REGULATIONS,
  RISK_CLASS_SUGGESTIONS,
  dateToMonth,
  euros,
  type StartupApplication,
} from "@/lib/startup/application";

type State = { error?: string; message?: string };

// Styling mirrors components/org/OrgProfileForm.tsx so the two forms feel like
// one product rather than two.
const fieldBase =
  "rounded-lg border border-line bg-white px-3.5 text-sm text-teal-900 outline-none transition focus:border-teal-500 disabled:bg-tint disabled:text-muted";
const inputCls = `${fieldBase} h-[42px]`;
const areaCls = `${fieldBase} py-2.5 resize-y`;
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";
const hintCls = "text-xs text-muted";
const noExt = { autoComplete: "off", "data-gramm": "false" } as const;

function Section({
  n,
  title,
  blurb,
  children,
}: {
  n: number;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-teal-900">
        {n}. {title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">{blurb}</p>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

/** Counts down rather than up — what matters is how much room is left. */
function Counter({ used, max }: { used: number; max: number }) {
  const left = max - used;
  return (
    <span className={left < 0 ? "text-xs text-red-600" : hintCls}>
      {left < 0 ? `${-left} over` : `${left} left`}
    </span>
  );
}

export function ApplicationForm({
  application,
  partnerName,
  declaration,
}: {
  application: StartupApplication | null;
  /** Set when applying through a partner subdomain — they will read this. */
  partnerName: string | null;
  declaration: string;
}) {
  const [state, action, pending] = useActionState<State, FormData>(
    saveApplication,
    {},
  );
  const a = application;
  const locked = a?.status === "submitted" || a?.status === "approved";

  const [summary, setSummary] = useState(a?.device_summary ?? "");
  const [why, setWhy] = useState(a?.why_blocked ?? "");

  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      {partnerName ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          You&rsquo;re applying through <b>{partnerName}</b>. Your application,
          including your funding position and revenue, will be read by{" "}
          {partnerName} as well as by us. If you&rsquo;d rather it went only to
          us, apply from our main site instead.
        </p>
      ) : null}

      {locked ? (
        <p className="rounded-lg border border-line bg-tint px-4 py-3 text-sm text-muted">
          {a?.status === "approved"
            ? "Approved. You can now buy the Startup Programme from the pricing page."
            : "Submitted and under review. You'll hear from us shortly."}
        </p>
      ) : null}

      <Section
        n={1}
        title="Your company"
        blurb="Just enough to know who we're talking to."
      >
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Legal name</span>
          <input
            name="legal_name"
            maxLength={LIMITS.legalName}
            defaultValue={a?.legal_name ?? ""}
            placeholder="Acme Medical GmbH"
            disabled={locked}
            className={inputCls}
            {...noExt}
          />
        </label>

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Website</span>
            <input
              name="website"
              inputMode="url"
              maxLength={LIMITS.website}
              defaultValue={a?.website ?? ""}
              placeholder="acme.com"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Country</span>
            <input
              name="country"
              maxLength={LIMITS.country}
              defaultValue={a?.country ?? ""}
              placeholder="Austria"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Founded</span>
            <input
              name="founded_on"
              type="month"
              defaultValue={dateToMonth(a?.founded_on ?? null)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Employees (FTE)</span>
            <input
              name="employees"
              inputMode="numeric"
              defaultValue={a?.employees ?? ""}
              placeholder="4"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
          </label>
        </div>
      </Section>

      <Section
        n={2}
        title="What you're building"
        blurb="One sentence is genuinely enough; we're checking it's a device, not assessing it."
      >
        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between">
            <span className={labelCls}>The device, in one sentence</span>
            <Counter used={summary.length} max={LIMITS.deviceSummary} />
          </span>
          <textarea
            name="device_summary"
            rows={2}
            maxLength={LIMITS.deviceSummary}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A wearable sensor that flags atrial fibrillation from a single-lead ECG."
            disabled={locked}
            className={areaCls}
          />
        </label>

        <div className="grid items-start gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Which regulation?</span>
            <select
              name="regulation"
              defaultValue={a?.regulation ?? ""}
              disabled={locked}
              className={inputCls}
            >
              <option value="">Select…</option>
              {REGULATIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "unsure" ? "Not sure yet" : r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Risk class (if you know it)</span>
            <input
              name="risk_class"
              list="risk-classes"
              maxLength={LIMITS.riskClass}
              defaultValue={a?.risk_class ?? ""}
              placeholder="IIa"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
            <datalist id="risk-classes">
              {RISK_CLASS_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <span className={hintCls}>
              Leave blank if you haven&rsquo;t classified it yet; that&rsquo;s
              normal at this stage.
            </span>
          </label>
        </div>
      </Section>

      <Section
        n={3}
        title="Why you qualify"
        blurb="The programme is for companies that genuinely can't fund CE marking yet. Figures in euros (250k and 1.5m both work)."
      >
        <div className="grid items-start gap-5 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Dilutive funding raised</span>
            <input
              name="funding_dilutive_eur"
              inputMode="decimal"
              defaultValue={euros(a?.funding_dilutive_eur)}
              placeholder="0"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
            <span className={hintCls}>Equity, to date</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Non-dilutive raised</span>
            <input
              name="funding_non_dilutive_eur"
              inputMode="decimal"
              defaultValue={euros(a?.funding_non_dilutive_eur)}
              placeholder="0"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
            <span className={hintCls}>Grants, FFG, EIC</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Revenue, last 12 months</span>
            <input
              name="revenue_12m_eur"
              inputMode="decimal"
              defaultValue={euros(a?.revenue_12m_eur)}
              placeholder="0"
              disabled={locked}
              className={inputCls}
              {...noExt}
            />
            <span className={hintCls}>Zero is a fine answer</span>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between">
            <span className={labelCls}>
              Why is CE marking out of reach right now?
            </span>
            <Counter used={why.length} max={LIMITS.whyBlocked} />
          </span>
          <textarea
            name="why_blocked"
            rows={5}
            maxLength={LIMITS.whyBlocked}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="What's actually blocking you: consultant quotes, notified body costs, runway, no QA/RA hire yet. Be concrete; this is the part we read most carefully."
            disabled={locked}
            className={areaCls}
          />
        </label>
      </Section>

      <Section
        n={4}
        title="Declaration"
        blurb="The Startup Programme is roughly 70% off the Standard price, so we ask you to confirm this in writing."
      >
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="declared"
            defaultChecked={a?.declared ?? false}
            disabled={locked}
            className="mt-1 accent-coral"
          />
          <span>{declaration}</span>
        </label>
      </Section>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {state.message}
        </p>
      ) : null}

      {!locked ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="submit"
            disabled={pending}
            className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Working…" : "Submit application"}
          </button>
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="rounded-full border border-line bg-card px-6 py-2.5 text-sm font-semibold text-teal-800 transition hover:border-coral disabled:opacity-60"
          >
            Save draft
          </button>
          <span className={hintCls}>
            You can save and come back; nothing is sent until you submit.
          </span>
        </div>
      ) : null}
    </form>
  );
}
