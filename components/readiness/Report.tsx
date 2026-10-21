// The scored output of the readiness self-assessment.
//
// This is the artefact. BUSINESS-MODEL.md §6.3 offers to run the assessment on a
// company an investor is diligencing, and §6.7 makes it a prerequisite for that
// whole motion — so this has to survive being forwarded to someone who has never
// heard of us, with no onboarding and no explanation. Hence: every figure says
// how it was derived, every gap names the activity that closes it and the first
// step that starts it, and the methodology and the disclaimer are on the page
// rather than in a tooltip.
//
// No "use client" and no hooks of its own: it renders from the same
// ReadinessResult whether it arrives from a server action (the questionnaire) or
// out of jsonb (the shared /readiness/r/<token> page).

import Link from "next/link";
import { CopyField } from "@/components/ui/Copy";
import type { CoreStatus, Gap, ReadinessResult } from "@/lib/readiness/assessment";
import { CORE_LEVEL_LABEL } from "@/lib/readiness/assessment";

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d);
}

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

/** The headline figure. An arc rather than a bar: it has to read at a glance. */
function Dial({ value }: { value: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <svg
      viewBox="0 0 128 128"
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label={`Overall readiness ${value} out of 100`}
    >
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke="var(--cream2)"
        strokeWidth="12"
      />
      {/* Skipped at zero: a round line cap on a zero-length dash still paints a
          dot, which reads as "a little bit of progress" on a score of nothing. */}
      {filled > 0 ? (
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--coral)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform="rotate(-90 64 64)"
        />
      ) : null}
      <text
        x="64"
        y="68"
        textAnchor="middle"
        className="font-display"
        fontSize="30"
        fontWeight="700"
        fill="var(--t9)"
      >
        {value}
      </text>
      <text
        x="64"
        y="86"
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="var(--muted)"
      >
        / 100
      </text>
    </svg>
  );
}

function Bar({
  label,
  pct,
  note,
  muted = false,
}: {
  label: string;
  pct: number | null;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-teal-900">{label}</span>
        <span className="shrink-0 text-sm font-semibold text-teal-700">
          {pct === null ? (
            <span className="text-xs font-medium text-muted">
              not applicable
            </span>
          ) : (
            `${pct}%`
          )}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream2">
        {pct === null ? null : (
          <i
            className={`block h-full rounded-full ${muted ? "bg-teal-500" : "bg-ok"}`}
            style={{ width: `${Math.max(pct, 1)}%` }}
          />
        )}
      </div>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-teal-800">
      {children}
    </span>
  );
}

const CORE_DOT: Record<string, string> = {
  inuse: "bg-ok",
  draft: "bg-[#d8a93a]",
  none: "bg-coral",
};

function CoreRow({ item }: { item: CoreStatus }) {
  if (item.level === null)
    return (
      <li className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#cfd7d2]" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-muted">{item.label}</div>
          <div className="text-xs text-muted">
            {item.qse} — no activity in this area applies to the device you
            described, so it is not counted for or against you.
          </div>
        </div>
      </li>
    );

  return (
    <li className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${CORE_DOT[item.level]}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-sm font-semibold text-teal-900">
            {item.label}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {CORE_LEVEL_LABEL[item.level]}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {item.qse}
          {item.activityId ? (
            <>
              {" · "}
              <span className="font-semibold text-teal-700">
                {item.activityId}
              </span>
            </>
          ) : null}
        </div>
        {item.level !== "inuse" && item.leanStart ? (
          <p className="mt-1.5 text-xs leading-relaxed text-ink">
            <b className="text-teal-900">Minimum viable version:</b>{" "}
            {item.leanStart}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function GapCard({ gap }: { gap: Gap }) {
  return (
    <li className="rounded-xl border border-line bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-coral">{gap.id}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Phase {gap.phase} · {gap.qse}
        </span>
        {gap.critical ? (
          <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">
            Critical path
          </span>
        ) : null}
      </div>
      <h4 className="font-display mt-1 text-base font-semibold leading-snug text-teal-900">
        {gap.statement}
      </h4>
      {gap.leanStart ? (
        <p className="mt-2 text-sm leading-relaxed text-ink">
          <b className="text-teal-900">Start here:</b> {gap.leanStart}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {gap.clause ? <span>{gap.clause}</span> : null}
        {gap.docCount ? (
          <span>
            {gap.docCount} controlled document{gap.docCount === 1 ? "" : "s"}
            {gap.docIds.length ? (
              <>
                {" — "}
                <span className="font-mono text-[11px] text-teal-700">
                  {gap.docIds.join(", ")}
                  {gap.docCount > gap.docIds.length ? ", …" : ""}
                </span>
              </>
            ) : null}
          </span>
        ) : null}
        {gap.days ? <span>≈ {gap.days} working days</span> : null}
        {gap.unblocks ? (
          <span>
            unblocks {gap.unblocks} later activit
            {gap.unblocks === 1 ? "y" : "ies"}
          </span>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function Report({
  result,
  shareUrl,
}: {
  result: ReadinessResult;
  /** Absolute URL of the permanent copy, when there is one to share. */
  shareUrl?: string | null;
}) {
  const r = result;
  const title = r.org.name ? `${r.org.name} — readiness` : "Readiness assessment";

  return (
    <article className="flex flex-col gap-7">
      {/* ---- header ---- */}
      <header>
        <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-teal-600">
          EU MDR / IVDR · ISO 13485
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-teal-900 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Self-assessment, {formatDate(r.generatedAt)}
          {r.org.role ? ` · ${r.org.role}` : ""} · scored against{" "}
          {r.scope.activities} of {r.scope.activitiesTotal} implementation
          activities
        </p>
      </header>

      {/* ---- scope ---- */}
      <section className="rounded-xl border border-line bg-cream px-5 py-4">
        <div className="text-xs font-bold uppercase tracking-wide text-teal-800">
          The device this was scored for
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Chip>{r.scope.routeLabel}</Chip>
          <Chip>
            {r.scope.riskClass === "unsure"
              ? "Class not yet determined"
              : `Class ${r.scope.riskClass}`}
          </Chip>
          {r.scope.usMarket ? <Chip>US market (FDA)</Chip> : null}
          {r.scope.characteristics.map((c) => (
            <Chip key={c.code}>{c.label}</Chip>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Only what applies to this device is counted:{" "}
          <b className="text-teal-800">{r.scope.activities}</b> of{" "}
          {r.scope.activitiesTotal} activities and{" "}
          <b className="text-teal-800">{r.scope.documents}</b> of{" "}
          {r.scope.documentsTotal} controlled documents. A software-only device
          is not marked down for having no sterilisation validation; it does not
          have that activity.
        </p>
      </section>

      {/* ---- headline ---- */}
      <section className="rounded-xl border-2 border-coral bg-card p-6 shadow-sm">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Dial value={r.overall} />
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-coral">
              Overall readiness
            </div>
            <h2 className="font-display mt-0.5 text-2xl font-semibold text-teal-900">
              {r.band.label}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {r.band.blurb}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <Bar
            label="QMS foundation"
            pct={r.components.foundation}
            note="The 12 core processes a Stage 1 audit checks"
          />
          <Bar
            label="Roadmap coverage"
            pct={r.components.roadmap}
            note="Weighted across every in-scope activity"
          />
          <Bar
            label="Certification track"
            pct={r.components.certification}
            note={
              r.notifiedBody.required
                ? "How far notified-body engagement has got"
                : "Self-certified route — technical file and DoC"
            }
          />
        </div>
      </section>

      {/* ---- Stage 1 ---- */}
      <section>
        <div className="sect-h">Stage 1 readiness — the 12 core processes</div>
        <div className="rounded-xl border border-line bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl font-semibold text-teal-900">
              {r.stage1.inUse} of {r.stage1.applicable}
            </span>
            <span className="text-sm text-muted">
              approved and in use
              {r.stage1.drafted
                ? `, ${r.stage1.drafted} drafted but not approved`
                : ""}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted">
            These are the quality system essentials a notified body asks for at
            Stage 1 — the documentation review, before anyone looks at the
            device. A drafted but unapproved procedure counts as a finding, so it
            scores below half here.
          </p>
          <ul className="mt-4">
            {r.core.map((c) => (
              <CoreRow key={c.key} item={c} />
            ))}
          </ul>
        </div>
      </section>

      {/* ---- phases ---- */}
      <section>
        <div className="sect-h">By phase</div>
        <div className="grid gap-5 rounded-xl border border-line bg-card p-5 shadow-sm sm:grid-cols-2">
          {r.phases.map((p) => (
            <Bar
              key={p.n}
              label={`${p.n}. ${p.name}`}
              pct={p.pct}
              note={`${p.complete} of ${p.inScope} activities complete`}
            />
          ))}
        </div>
      </section>

      {/* ---- QSEs ---- */}
      <section>
        <div className="sect-h">By quality system essential</div>
        <div className="grid gap-x-8 gap-y-4 rounded-xl border border-line bg-card p-5 shadow-sm sm:grid-cols-2">
          {r.qses.map((q) => (
            <Bar
              key={q.qse}
              label={q.qse}
              pct={q.pct}
              muted
              note={
                q.pct === null
                  ? undefined
                  : `${q.inScope} activit${q.inScope === 1 ? "y" : "ies"} in scope`
              }
            />
          ))}
        </div>
      </section>

      {/* ---- notified body + timeline ---- */}
      <section>
        <div className="sect-h">Notified body and timeline</div>
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold text-teal-900">
              Notified body: {r.notifiedBody.label}
            </div>
            <p className="mt-1 text-sm text-muted">
              {r.notifiedBody.required
                ? "A notified body must assess conformity for this class."
                : "This class may be self-certified, so no notified body is required — the technical file and Declaration of Conformity still are."}
            </p>
            {r.notifiedBody.warning ? (
              <p className="mt-3 rounded-lg border border-coral/40 bg-[#fdece7] px-3.5 py-2.5 text-sm leading-relaxed text-[#8f2f16]">
                {r.notifiedBody.warning}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold text-teal-900">
              Timeline: {r.timeline.pressureLabel}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">
              {r.timeline.verdict}
            </p>
            <p className="mt-2 text-xs text-muted">
              Durations are the corpus&rsquo;s own per-activity estimates,
              discounted by how far each activity already is, and the available
              days assume about 21 working days a month. A critical path is a
              floor on elapsed time, not a forecast — and it says nothing about
              whether you have the people to hold it.
            </p>
          </div>
        </div>
      </section>

      {/* ---- gaps ---- */}
      <section>
        <div className="sect-h">
          What to close first
          {r.gapsTotal > r.gaps.length
            ? ` — top ${r.gaps.length} of ${r.gapsTotal}`
            : ""}
        </div>
        {r.gaps.length === 0 ? (
          <p className="rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-800">
            Nothing in scope reads as open. Either this is genuinely finished, or
            the answers were more generous than the evidence — and the second is
            what a notified body is for.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              In the order the roadmap runs — earliest phase first — and within a
              phase by what each gap is costing the figure above. Each one names
              the implementation activity that closes it and the smallest version
              of it that is still compliant.
            </p>
            <ul className="flex flex-col gap-3">
              {r.gaps.map((g) => (
                <GapCard key={g.id} gap={g} />
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---- share ---- */}
      {shareUrl ? (
        <section className="rounded-xl border border-line bg-cream px-5 py-4">
          <div className="text-sm font-semibold text-teal-900">
            A permanent link to this result
          </div>
          <p className="mt-1 mb-3 text-sm text-muted">
            Anyone with the link can read this page. It holds the score and the
            gaps, never the email address it was sent to — so it is safe to
            forward to a board, an investor or a consultant.
          </p>
          <CopyField value={shareUrl} mono={false} />
        </section>
      ) : null}

      {/* ---- funnel ---- */}
      <section className="rounded-xl border-2 border-teal-200 bg-teal-50 p-6">
        <h3 className="font-display text-xl font-semibold text-teal-900">
          {r.gapsTotal
            ? `Closing ${r.gapsTotal} gap${r.gapsTotal === 1 ? "" : "s"}, in order`
            : "Keeping the system running"}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          This page named the activities. The implementation itself is the
          sequence, the sub-activities and the{" "}
          {r.scope.documents} controlled-document templates that apply to your
          device — the procedures, forms and registers each of those activities
          produces, ready to adopt rather than write.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/pricing"
            className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            See full access and pricing
          </Link>
          <Link
            href="/startup-programme"
            className="rounded-full border border-line bg-card px-6 py-2.5 text-sm font-semibold text-teal-800 transition hover:border-coral"
          >
            Apply to the Startup Programme
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          The Startup Programme is the reduced price for very early companies
          that cannot yet fund CE marking. It is reviewed, and the application
          takes about five minutes.
        </p>
      </section>

      {/* ---- method + disclaimer ---- */}
      <footer className="border-t border-line pt-5 text-xs leading-relaxed text-muted">
        <p>
          <b className="text-teal-800">How the figure is made.</b> Every answer
          is mapped onto the implementation activities that apply to the device
          described above. Each activity gets a completion estimate from the most
          specific answer given — the notified-body ladder, then the core-process
          inventory, then its phase — and counts double when it sits on the
          critical path. The headline is 35% the 12 Stage-1 core processes, 50%
          weighted coverage of the in-scope activity set and 15% the
          certification track. The QMS core is therefore counted twice, which is
          the weighting a Stage 1 audit applies too.
        </p>
        <p className="mt-2">
          <b className="text-teal-800">What this is not.</b> A self-assessment,
          scored from what you told us. It is not a gap audit, not a notified-body
          opinion and not certification advice; it does not inspect a single
          document and it cannot. The manufacturer remains solely responsible for
          conformity. Scorer v{r.scorerVersion}, corpus {r.contentHash}.
        </p>
      </footer>
    </article>
  );
}
