import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity } from "@/lib/content/content";
import { canViewActivity } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { DocWorkflow } from "@/components/content/DocWorkflow";
import { LockedNotice } from "@/components/content/LockedNotice";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; index: string }>;
}) {
  const { id, index } = await params;
  const s = getActivity(id)?.subs?.[parseInt(index, 10)];
  return { title: s ? s.t : "Sub-activity" };
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-5">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-teal-800">
        {label}
      </h2>
      <div className="text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default async function SubActivityPage({
  params,
}: {
  params: Promise<{ id: string; index: string }>;
}) {
  const { id, index } = await params;
  const a = getActivity(id);
  const i = parseInt(index, 10);
  if (!a || !a.subs || !a.subs[i]) notFound();
  const s = a.subs[i];
  const n = a.subs.length;

  // Same gate as the activity page — the deep "how & who" steps are core IP.
  const org = await getActiveOrg();
  const allowed = canViewActivity(org?.plan, id);

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href={`/activity/${a.id}`}
        className="text-sm font-medium text-teal-600 hover:underline"
      >
        ← {a.id} · {a.statement}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-cream2 px-2.5 py-0.5 text-[11px] font-medium text-teal-800">
          {a.phase}
        </span>
        <span className="rounded-full bg-cream2 px-2.5 py-0.5 text-[11px] font-medium text-teal-800">
          {a.qse}
        </span>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">
          Sub-activity {i + 1} of {n}
        </span>
      </div>

      <div className="mt-3 text-xs font-bold text-coral">
        {a.id}.{i + 1}
      </div>
      <h1 className="font-display mt-0.5 text-3xl font-semibold tracking-tight text-teal-900">
        {s.t}
      </h1>

      {!allowed ? (
        <div className="mt-6">
          <LockedNotice title={`${a.id} · ${a.statement}`} />
        </div>
      ) : (
        <>
          {s.why && <Section label="Why">{s.why}</Section>}
          {s.what && <Section label="What">{s.what}</Section>}

          <Section label="How & who">
            <div className="mb-2 text-xs font-semibold text-teal-600">
              {s.who}
            </div>
            <ol className="space-y-2">
              {s.how.map((st, si) => (
                <li key={si} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream2 text-[11px] font-bold text-teal-800">
                    {si + 1}
                  </span>
                  <span className="text-sm leading-relaxed">
                    <b className="font-semibold text-teal-900">{st.t}</b>
                    {st.d ? <> — {st.d}</> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          {s.docs && (
            <Section label="Templates to use">
              <DocWorkflow documents={s.docs} />
            </Section>
          )}

          {s.refs && s.refs.length > 0 && (
            <Section label="Reference">
              <ul className="list-inside list-disc space-y-1 text-sm text-muted">
                {s.refs.map((r, ri) => (
                  <li key={ri}>{r}</li>
                ))}
              </ul>
            </Section>
          )}

          {s.clauses && s.clauses.length > 0 && (
            <Section label="Clause coverage">
              <div className="space-y-2">
                {s.clauses.map((c, ci) => (
                  <div key={ci} className="flex flex-wrap items-baseline gap-2">
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

          <Section label="Part of">
            <Link
              href={`/activity/${a.id}`}
              className="font-medium text-teal-600 hover:underline"
            >
              {a.id} — {a.statement}
            </Link>
          </Section>

          <nav className="flex items-center justify-between gap-2 border-t border-line pt-5">
            {i > 0 ? (
              <Link
                href={`/activity/${a.id}/sub/${i - 1}`}
                className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-teal-800 hover:border-teal-600"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <Link
              href={`/activity/${a.id}`}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-teal-800 hover:border-teal-600"
            >
              All sub-activities
            </Link>
            {i < n - 1 ? (
              <Link
                href={`/activity/${a.id}/sub/${i + 1}`}
                className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-teal-800 hover:border-teal-600"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </main>
  );
}
