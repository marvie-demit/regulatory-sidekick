"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { actInScope } from "@/lib/content/scope";
import { submitAssessment, type ReadinessRes } from "@/lib/readiness/actions";
import {
  CHANGELOG_CONSENT,
  CORE_LEVELS,
  CORE_LEVEL_LABEL,
  CORE_PROCESSES,
  DEFAULT_ANSWERS,
  IVDR_ONLY_CHARACTERISTICS,
  IVDR_CLASSES,
  MDR_CLASSES,
  NB_OPTIONS,
  ORG_NAME_MAX,
  PHASE_LEVELS,
  PHASE_LEVEL_LABEL,
  PRESSURE_OPTIONS,
  ROLE_OPTIONS,
  phaseDetail,
  ROUTE_OPTIONS,
  profileFrom,
  type Answers,
  type CharacteristicCode,
  type CoreLevel,
  type NbState,
  type PhaseLevel,
  type Pressure,
  type RiskClass,
  type Route,
} from "@/lib/readiness/assessment";
import { Report } from "./Report";

// The questionnaire. Seven short steps, then the email gate.
//
// The whole thing is answered WITHOUT a round trip: state lives here and posts
// once, at the gate. That is deliberate — an assessment that saves after every
// question is an assessment that captures half-answers from people who changed
// their mind, and the point of rung 1 is a qualified lead with a finished score
// behind it.
//
// Scoring is NOT here. The client holds answers; the server action scores them
// (see lib/readiness/actions.ts for why that boundary matters).

type ActScope = { id: string; phase: number; mods?: string[]; reg?: string[] };

export type CoreAnchorChoice = {
  key: string;
  candidates: { id: string; statement: string; mods?: string[]; reg?: string[] }[];
};

export type PhaseInfo = { n: number; name: string; focus: string };

const fieldBase =
  "rounded-lg border border-line bg-white px-3.5 text-sm text-teal-900 outline-none transition focus:border-teal-500";
const inputCls = `${fieldBase} h-[42px]`;
const labelCls = "text-xs font-medium uppercase tracking-wide text-teal-800";

const STEP_TITLES = [
  "Your device",
  "What it is made of",
  "Where you are",
  "The QMS core",
  "Notified body and timeline",
  "Who is asking",
  "Your result",
];

// ---------------------------------------------------------------------------
// Leaves
// ---------------------------------------------------------------------------

function Card({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-teal-900">
        {title}
      </h2>
      {blurb ? <p className="mt-1 text-sm text-muted">{blurb}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A radio row that is a whole clickable card — these get answered on phones. */
function Choice({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
        checked
          ? "border-coral bg-[#fdece7]"
          : "border-line bg-white hover:border-teal-500"
      }`}
    >
      <span
        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
          checked ? "border-coral bg-coral" : "border-line bg-white"
        }`}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-teal-900">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {hint}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** The three-state answer used for every phase and every core process. */
function Scale<T extends string>({
  options,
  value,
  onSelect,
  labels,
}: {
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onSelect(o)}
          aria-pressed={value === o}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            value === o
              ? "border-coral bg-coral text-white"
              : "border-line bg-white text-teal-800 hover:border-coral"
          }`}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

/**
 * The page headline. It lives in the client component, not the route, because
 * it must DISAPPEAR once the result is on screen — an invitation to take the
 * assessment sitting above a finished score reads like the page did not notice.
 * (It was briefly passed down from the route as a JSX prop, which React then
 * warns about as an unkeyed list child across the server boundary.)
 */
function Intro({ activityCount }: { activityCount: number }) {
  return (
    <header className="mb-10">
      <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-teal-600">
        Free · no account
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-teal-900">
        How ready are you, really?
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Seven short steps about your device and your quality system, scored
        against the {activityCount}-activity MDR/IVDR and ISO&nbsp;13485
        implementation this platform is built on. You get a readiness figure, a
        breakdown by phase and by quality system essential, and for every gap the
        specific activity that closes it — with the smallest version of it that
        is still compliant.
      </p>
      <p className="mt-3 text-sm text-muted">
        Only what applies to your device is counted, so the score is not a
        generic checklist. About five minutes. We ask for an email at the end, to
        show you the result and to keep the link working.
      </p>
    </header>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-teal-800">
          Step {step + 1} of {STEP_TITLES.length} · {STEP_TITLES[step]}
        </span>
        <span className="text-xs text-muted">
          about {Math.max(1, 4 - Math.floor(step / 2))} min left
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream2">
        <i
          className="block h-full rounded-full bg-coral transition-all"
          style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The questionnaire
// ---------------------------------------------------------------------------

export function Assessment({
  modules,
  phases,
  acts,
  coreAnchors,
  activityCount,
}: {
  /** content.modules — the question text each characteristic carries. */
  modules: { code: string; label: string; q?: string; std?: string }[];
  /** content.phases, with the display names from PHASE_NAMES. */
  phases: PhaseInfo[];
  /** Minimal activity scope data, so the live in-scope counts are real. */
  acts: ActScope[];
  /** Candidate anchor activities per core process, resolved client-side. */
  coreAnchors: CoreAnchorChoice[];
  /** Corpus activity count, for the headline claim. */
  activityCount: number;
}) {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState<ReadinessRes, FormData>(
    submitAssessment,
    {},
  );

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  // The same two scoping axes the server will use, evaluated here only so the
  // questionnaire can show honest counts and hide inapplicable questions.
  const profile = useMemo(() => profileFrom(answers), [answers]);
  const hasProfile = Object.keys(profile).length > 0;
  const prof = hasProfile ? profile : null;

  const inScopeCount = useMemo(
    () => acts.filter((a) => actInScope(a, prof)).length,
    [acts, prof],
  );
  const perPhase = useMemo(() => {
    const m: Record<number, number> = {};
    acts
      .filter((a) => actInScope(a, prof))
      .forEach((a) => {
        m[a.phase] = (m[a.phase] ?? 0) + 1;
      });
    return m;
  }, [acts, prof]);

  // Which core processes apply, and which activity stands for each. Mirrors
  // resolveAnchor() in lib/readiness/score.ts; both run actInScope, so the
  // question asked and the question scored cannot drift apart.
  const applicableCore = useMemo(
    () =>
      coreAnchors
        .map((c) => ({
          def: CORE_PROCESSES.find((p) => p.key === c.key)!,
          anchor: c.candidates.find((cand) => actInScope(cand, prof)) ?? null,
        }))
        .filter((c) => c.def && c.anchor),
    [coreAnchors, prof],
  );

  const charModules = modules.filter(
    (m) =>
      m.code !== "IVD" &&
      m.code !== "FDA" &&
      (!IVDR_ONLY_CHARACTERISTICS.includes(m.code) || answers.route === "IVDR"),
  );

  const classes: RiskClass[] =
    answers.route === "IVDR" ? IVDR_CLASSES : MDR_CLASSES;

  function setRoute(route: Route) {
    setAnswers((a) => ({
      ...a,
      route,
      // The class scales differ per regulation, and the IVD sub-types are IVDR
      // concepts — so changing the route has to clear what no longer exists,
      // exactly as ProfileSelector.setRoute does.
      riskClass: "unsure",
      characteristics:
        route === "IVDR"
          ? a.characteristics
          : a.characteristics.filter(
              (c) => !IVDR_ONLY_CHARACTERISTICS.includes(c),
            ),
    }));
  }

  function toggleChar(code: CharacteristicCode) {
    setAnswers((a) => {
      const has = a.characteristics.includes(code);
      let next = has
        ? a.characteristics.filter((c) => c !== code)
        : [...a.characteristics, code];
      // Dependent characteristics, same rules as the app's profile selector:
      // AI needs software; active and sterile need physical hardware.
      if (has) {
        if (code === "SW") next = next.filter((c) => c !== "AI");
        if (code === "HW") next = next.filter((c) => c !== "ACT" && c !== "STE");
      } else {
        if (code === "AI" && !next.includes("SW")) next.push("SW");
        if ((code === "ACT" || code === "STE") && !next.includes("HW"))
          next.push("HW");
      }
      return { ...a, characteristics: next };
    });
  }

  // ---- the result ---------------------------------------------------------
  if (state.result) {
    // No share panel when the lead could not be stored: the link would 404, and
    // offering someone a permanent URL that is not there is worse than offering
    // none. The notice below says so plainly instead.
    const shareUrl =
      state.stored !== false && state.token && typeof window !== "undefined"
        ? `${window.location.origin}/readiness/r/${state.token}`
        : null;
    return (
      <>
        <Report result={state.result} shareUrl={shareUrl} />
        {state.stored === false ? (
          <p className="mt-6 rounded-lg border border-line bg-cream px-4 py-3 text-xs text-muted">
            Your score is above, but we could not save it on our side, so there
            is no permanent link for it this time. Nothing you did caused that —
            copy or print this page if you need to keep it.
          </p>
        ) : null}
      </>
    );
  }

  const last = step === STEP_TITLES.length - 1;

  return (
    <div>
      <Intro activityCount={activityCount} />
      <Progress step={step} />

      {step === 0 ? (
        <Card
          title="Which route are you on?"
          blurb="This is the first gate in the roadmap, and it decides which half of the corpus applies to you — clinical evaluation under MDR, performance evaluation under IVDR."
        >
          <div className="flex flex-col gap-2">
            {ROUTE_OPTIONS.map((o) => (
              <Choice
                key={o.value}
                checked={answers.route === o.value}
                onSelect={() => setRoute(o.value)}
                label={o.label}
                hint={o.hint}
              />
            ))}
          </div>

          {answers.route === "MDR" || answers.route === "IVDR" ? (
            <label className="flex items-start gap-3 rounded-lg border border-line bg-white px-3.5 py-3">
              <input
                type="checkbox"
                checked={answers.usMarket}
                onChange={(e) => set("usMarket", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ accentColor: "var(--coral)" }}
              />
              <span className="text-sm text-ink">
                We will also market in the US (FDA QMSR / 21 CFR 820)
              </span>
            </label>
          ) : null}

          <div>
            <span className={labelCls}>Risk class</span>
            <p className="mt-1 mb-2 text-xs text-muted">
              It decides one thing here: whether a notified body has to assess
              you at all. MDR class I and IVDR class A can self-certify.
            </p>
            <Scale
              options={[...classes, "unsure"] as RiskClass[]}
              value={answers.riskClass}
              onSelect={(v) => set("riskClass", v)}
              labels={
                Object.fromEntries(
                  [...classes, "unsure"].map((c) => [
                    c,
                    c === "unsure" ? "Not sure yet" : `Class ${c}`,
                  ]),
                ) as Record<RiskClass, string>
              }
            />
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card
          title="What is the device made of?"
          blurb="Each answer switches a block of the implementation on or off. Nothing you leave unticked is ever counted against you."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {charModules.map((m) => {
              const on = answers.characteristics.includes(m.code);
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => toggleChar(m.code as CharacteristicCode)}
                  aria-pressed={on}
                  className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition ${
                    on
                      ? "border-coral bg-[#fdece7]"
                      : "border-line bg-white hover:border-teal-500"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold text-white ${
                      on ? "border-coral bg-coral" : "border-line bg-white"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-teal-900">
                      {m.q ?? m.label}
                    </span>
                    {m.std ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {m.std}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-sm text-teal-800">
            <b>{inScopeCount}</b> implementation activities apply to the device
            you have described so far. That is the set you are about to be scored
            against.
          </p>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card
          title="Where are you on the four phases?"
          blurb="Answer for what is finished and approved, not for what is in someone's head. The last third of a phase is the records and the approvals, which is the part an auditor actually reads."
        >
          {phases.map((p) => (
            <div key={p.n} className="border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-teal-900">
                  {p.n}. {p.name}
                </span>
                <span className="text-xs text-muted">
                  {perPhase[p.n] ?? 0} activities in scope
                </span>
              </div>
              <p className="mt-1 mb-2.5 text-xs leading-relaxed text-muted">
                {phaseDetail(p.focus)}
              </p>
              <Scale
                options={PHASE_LEVELS}
                value={answers.phases[String(p.n)] ?? "none"}
                onSelect={(v: PhaseLevel) =>
                  set("phases", { ...answers.phases, [String(p.n)]: v })
                }
                labels={PHASE_LEVEL_LABEL}
              />
            </div>
          ))}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card
          title="Which of the core processes exist?"
          blurb="One per quality system essential — the set a notified body works through at Stage 1, before anyone looks at the device. Only the ones that apply to your device are listed."
        >
          {applicableCore.map(({ def, anchor }) => (
            <div key={def.key} className="border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-teal-900">
                  {def.label}
                </span>
                <span className="text-xs text-muted">{def.qse}</span>
              </div>
              <p className="mt-1 mb-2.5 text-xs leading-relaxed text-muted">
                {anchor!.statement}{" "}
                <span className="font-semibold text-teal-700">
                  ({anchor!.id})
                </span>
              </p>
              <Scale
                options={CORE_LEVELS}
                value={answers.core[def.key] ?? "none"}
                onSelect={(v: CoreLevel) =>
                  set("core", { ...answers.core, [def.key]: v })
                }
                labels={CORE_LEVEL_LABEL}
              />
            </div>
          ))}
          {applicableCore.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing to ask here for the device you described.
            </p>
          ) : null}
        </Card>
      ) : null}

      {step === 4 ? (
        <Card
          title="The two things that move a launch date"
          blurb="Notified-body capacity is the usual hidden bottleneck, and the date you are working to decides whether the remaining work fits."
        >
          <div>
            <span className={labelCls}>Notified body</span>
            <div className="mt-2 flex flex-col gap-2">
              {NB_OPTIONS.map((o) => (
                <Choice
                  key={o.value}
                  checked={answers.nb === o.value}
                  onSelect={() => set("nb", o.value as NbState)}
                  label={o.label}
                />
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>When do you need to be on the market?</span>
            <div className="mt-2 flex flex-col gap-2">
              {PRESSURE_OPTIONS.map((o) => (
                <Choice
                  key={o.value}
                  checked={answers.pressure === o.value}
                  onSelect={() => set("pressure", o.value as Pressure)}
                  label={o.label}
                />
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {step === 5 ? (
        <Card
          title="Who is this for?"
          blurb="Both optional. The company name is what goes on the result, which matters if you are going to forward it."
        >
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Company (optional)</span>
            <input
              value={answers.orgName ?? ""}
              onChange={(e) => set("orgName", e.target.value || null)}
              maxLength={ORG_NAME_MAX}
              placeholder="Acme Medical GmbH"
              autoComplete="organization"
              className={inputCls}
            />
          </label>
          <div>
            <span className={labelCls}>Your role (optional)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => set("role", answers.role === role ? null : role)}
                  aria-pressed={answers.role === role}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    answers.role === role
                      ? "border-coral bg-coral text-white"
                      : "border-line bg-white text-teal-800 hover:border-coral"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {/* ---- the gate ---- */}
      {last ? (
        <form action={action} className="flex flex-col gap-4">
          <input
            type="hidden"
            name="answers"
            value={JSON.stringify(answers)}
            readOnly
          />
          <section className="rounded-xl border-2 border-coral bg-card p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-teal-900">
              Where should your result live?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Your score, a breakdown by phase and by quality system essential,
              and the specific activities that close each gap — shown on the next
              screen, and kept at a permanent link you can forward.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={`${inputCls} flex-1`}
              />
              <button
                type="submit"
                disabled={pending}
                className="shrink-0 rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
              >
                {pending ? "Scoring…" : "Show my result"}
              </button>
            </div>
            {state.error ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            ) : null}

            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                name="changelog"
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{ accentColor: "var(--coral)" }}
              />
              <span className="text-xs leading-relaxed text-ink">
                {CHANGELOG_CONSENT}
              </span>
            </label>

            <p className="mt-3 text-xs leading-relaxed text-muted">
              We store your address, your answers and the resulting score so we
              can show you the result and keep the link working. We do not pass
              it to anyone, and leaving the box above unticked means we will not
              email you about anything else.{" "}
              <Link href="/privacy" className="font-semibold text-teal-700 hover:underline">
                Privacy
              </Link>
            </p>
          </section>
        </form>
      ) : null}

      {/* ---- navigation ---- */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-semibold text-teal-800 transition hover:border-coral disabled:opacity-40"
        >
          Back
        </button>
        {last ? (
          <span className="text-xs text-muted">
            {inScopeCount} activities in scope
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-full bg-teal-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
