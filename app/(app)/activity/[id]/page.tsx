import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity, pnum } from "@/lib/content/content";
import { canViewActivity, hasFullAccess } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { listEvidence } from "@/lib/db/evidence";
import { ActivityTasks } from "@/components/content/ActivityTasks";
import { DocWorkflow } from "@/components/content/DocWorkflow";
import { EvidenceSection } from "@/components/content/EvidenceSection";
import { LockedNotice } from "@/components/content/LockedNotice";
import { StatusDropdown } from "@/components/content/StatusDropdown";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = getActivity(id);
  return { title: a ? `${a.id} · ${a.statement}` : "Activity" };
}

function Section({
  label,
  accent,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-5">
      <h2
        className={
          "mb-2 text-[11px] font-bold uppercase tracking-[0.15em] " +
          (accent ? "text-coral" : "text-teal-800")
        }
      >
        {label}
      </h2>
      <div className="text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function ActLinks({ ids }: { ids?: string }) {
  const parts = (ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "-");
  if (!parts.length) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {parts.map((pid) => {
        const dep = getActivity(pid);
        return (
          <Link
            key={pid}
            href={`/activity/${pid}`}
            title={dep?.statement}
            className="rounded-md border border-line bg-card px-2 py-0.5 text-xs font-semibold text-teal-700 hover:border-coral"
          >
            {pid}
          </Link>
        );
      })}
    </span>
  );
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = getActivity(id);
  if (!a) notFound();
  const hasSubs = !!(a.subs && a.subs.length);

  // Server-side gate: a free org may only open the sample activity in full. When
  // not allowed we render only the header + a lock notice — the deep content
  // (sub-activities, tasks, clause coverage) never leaves the server.
  const org = await getActiveOrg();
  const allowed = canViewActivity(org?.plan, id);
  const evidence = allowed && org ? await listEvidence(org.id, id) : [];

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href={`/roadmap/${pnum(a.phase)}`}
        className="text-sm font-medium text-teal-600 hover:underline"
      >
        ← Roadmap · Phase {pnum(a.phase)}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {[a.phase, a.wave, a.qse].map((t) => (
          <span
            key={t}
            className="rounded-full bg-cream2 px-2.5 py-0.5 text-[11px] font-medium text-teal-800"
          >
            {t}
          </span>
        ))}
        {a.dur != null && (
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">
            {a.dur} working days
          </span>
        )}
      </div>

      <div className="mt-3 text-xs font-bold text-coral">{a.id}</div>
      <h1 className="font-display mt-0.5 text-3xl font-semibold tracking-tight text-teal-900">
        {a.statement}
      </h1>

      {allowed && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-teal-800/25 bg-cream2/60 px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">
            Status
          </span>
          <StatusDropdown id={a.id} />
        </div>
      )}

      {!allowed ? (
        <div className="mt-6">
          <LockedNotice title={`${a.id} · ${a.statement}`} />
        </div>
      ) : (
        <>
          {a.why && <Section label="Why">{a.why}</Section>}
          {a.what && <Section label="What">{a.what}</Section>}

          {a.lean && (
            <Section label="Start lean">
              <div className="space-y-2">
                <p>
                  <span className="mr-2 rounded bg-[#e7f0ec] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-600">
                    Minimum to start
                  </span>
                  {a.lean.start}
                </p>
                <p>
                  <span className="mr-2 rounded bg-cream2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a5a2b]">
                    Evolve as you grow
                  </span>
                  {a.lean.evolve}
                </p>
              </div>
            </Section>
          )}

          {hasSubs && (
            <Section label="Sub-activities">
              <p className="mb-3 text-sm text-muted">
                Each sub-activity is its own short guide — take them one at a
                time.
              </p>
              <div className="flex flex-col gap-2">
                {a.subs!.map((s, i) => (
                  <Link
                    key={i}
                    href={`/activity/${a.id}/sub/${i}`}
                    className="flex items-center gap-3 rounded-xl border border-line border-l-[3px] border-l-teal-500 bg-card p-3.5 transition hover:border-coral hover:border-l-coral hover:shadow-sm"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold text-teal-900">
                        {s.t}
                      </span>
                      <span className="text-[11px] text-muted">
                        {s.who} · {s.how?.length ?? 0} steps
                      </span>
                    </span>
                    <span className="text-base font-bold text-coral">→</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {a.how2 && a.how2.length > 0 && (
            <Section label={hasSubs ? "Verify & checklist" : "Tasks"}>
              <ActivityTasks id={a.id} groups={a.how2} />
            </Section>
          )}

          {a.tips && a.tips.length > 0 && (
            <Section label="Watch-outs" accent>
              <ul className="space-y-1.5">
                {a.tips.map((t, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                    <span className="text-sm leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section label="Document workflow">
            <DocWorkflow documents={a.documents} />
          </Section>

          {a.records && a.records.length > 0 && (
            <Section label="Records &amp; outputs">
              <ul className="list-inside list-disc space-y-1 text-sm">
                {a.records.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Section>
          )}

          {a.clausemap && a.clausemap.length > 0 && (
            <Section label="Clause coverage">
              <div className="space-y-2">
                {a.clausemap.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-bold text-teal-800">
                      {c.std}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {c.refs.map((r, ri) => (
                        <span
                          key={ri}
                          className="rounded-md border border-line bg-cream px-2 py-0.5 text-[11.5px] font-medium text-teal-600"
                        >
                          {r}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="grid gap-5 border-t border-line py-5 sm:grid-cols-2">
            <div>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">
                Depends on
              </h2>
              <ActLinks ids={a.depends} />
            </div>
            <div>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">
                Leads to
              </h2>
              <ActLinks ids={a.leads} />
            </div>
          </div>

          {org && (
            <Section label="Evidence">
              <EvidenceSection
                activityId={a.id}
                orgId={org.id}
                canUpload={hasFullAccess(org.plan)}
                items={evidence}
              />
            </Section>
          )}
        </>
      )}
    </main>
  );
}
