import Link from "next/link";

export const metadata = { title: "Guide" };

// Static in-app manual: the recommended workflow + what every section does.
// Kept plan-agnostic (help is visible to every plan).

type Step = { n: number; title: string; body: string; href: string; cta: string };

const WORKFLOW: Step[] = [
  {
    n: 1,
    title: "Set your device profile",
    body: "Tell us your device characteristics, the regulations you're targeting and your markets. This scopes the whole plan — activities, documents and modules — to what actually applies to you, so you're never staring at controls you don't need. Revisit it whenever your device or markets change.",
    href: "/profile",
    cta: "Set device profile",
  },
  {
    n: 2,
    title: "Work the roadmap, phase by phase",
    body: "The roadmap is your execution plan. Rows are processes, columns are the recommended start order within a phase. Open any activity to see why it matters, what to produce, the lean way to start today, its sub-activities and the documents it creates.",
    href: "/roadmap/1",
    cta: "Open the roadmap",
  },
  {
    n: 3,
    title: "Track status as you go",
    body: "On each activity, set a status — Not started, In progress, Done or N-A. Expand it in the checklist to tick off granular items. Your whole team shares one implementation, so progress stays in sync for everyone.",
    href: "/checklist",
    cta: "Open the checklist",
  },
  {
    n: 4,
    title: "Attach evidence and lean on the reference",
    body: "Upload proof of what you've done on each activity — that's your audit trail. Pull ready-to-adapt templates from the document library, and use the standards matrix to see exactly where each clause is covered.",
    href: "/library",
    cta: "Open the library",
  },
];

type Item = { label: string; href: string; body: string };
const SECTIONS: { group: string; items: Item[] }[] = [
  {
    group: "Implement",
    items: [
      {
        label: "Device profile",
        href: "/profile",
        body: "Start here. Set your device's characteristics, applicable regulations and target markets — this is what scopes the entire plan. Once set it's fixed for the project; changing it re-scopes everything.",
      },
      {
        label: "Dashboard",
        href: "/dashboard",
        body: "Your at-a-glance status — overall completion, per-phase progress and how much of the plan is in your device's scope.",
      },
      {
        label: "Roadmap",
        href: "/roadmap/1",
        body: "The execution plan, one phase at a time: processes down the side, recommended start order across the top. Open an activity for the full how-to, to set its status and to attach evidence.",
      },
      {
        label: "Checklist",
        href: "/checklist",
        body: "Every activity in one list with a status control. Expand a row for its granular, individually-checkable items; filter by phase and print or export a self-assessment record.",
      },
    ],
  },
  {
    group: "Reference",
    items: [
      {
        label: "Standards matrix",
        href: "/matrix",
        body: "Traceability — where each standard and clause (ISO 13485, EU MDR/IVDR and more) is addressed across the four phases. Expand a standard to see its clauses and the activities that cover them.",
      },
      {
        label: "Document library",
        href: "/library",
        body: "All 275 controlled-document templates, grouped by process. Open one to read it and see how to use it; download from your workspace when you're on full access.",
      },
      {
        label: "Process map",
        href: "/process-map",
        body: "The full ISO 13485 §4.1.2 process landscape — every process across the four phases, each maturing from lean to certified, with every document mapped to the step that creates it.",
      },
    ],
  },
  {
    group: "Workspace",
    items: [
      {
        label: "Members",
        href: "/settings/members",
        body: "Invite teammates and set their role. Everyone shares one implementation, so status, checkboxes and evidence stay in sync across the team.",
      },
      {
        label: "Activity log",
        href: "/settings/activity",
        body: "An audit trail of who changed what and when — useful evidence of control when you're audited.",
      },
      {
        label: "Account",
        href: "/settings/profile",
        body: "Your personal details — display name and password.",
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <main className="px-7 py-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Guide
      </h1>
      <p className="lead">
        Regulatory Sidekick turns ISO 13485 and EU MDR/IVDR into a guided, lean
        implementation you work step by step. Here's how to find your way around
        and the order we recommend tackling things.
      </p>

      <div className="sect-h">The workflow</div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {WORKFLOW.map((s) => (
          <li
            key={s.n}
            className="flex flex-col rounded-2xl border border-line bg-card p-5"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-800 text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="font-display text-lg font-semibold text-teal-900">
                {s.title}
              </h3>
            </div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              {s.body}
            </p>
            <Link
              href={s.href}
              className="mt-3 inline-block text-sm font-semibold text-coral hover:underline"
            >
              {s.cta} →
            </Link>
          </li>
        ))}
      </ol>

      <div className="sect-h">Every section, explained</div>
      <div className="flex flex-col gap-6">
        {SECTIONS.map((sec) => (
          <div key={sec.group}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-teal-800">
              {sec.group}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sec.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="group block rounded-xl border border-line bg-card p-4 transition hover:border-coral"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-teal-900">
                      {it.label}
                    </span>
                    <span className="text-coral opacity-0 transition group-hover:opacity-100">
                      →
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
                    {it.body}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sect-h">Access &amp; plans</div>
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm leading-relaxed text-ink">
          <b className="text-teal-900">Explore (free)</b> lets you browse the whole
          roadmap, standards matrix, library index and process map, and open one
          sample activity and document group in full — so you can see the depth
          before you commit.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink">
          <b className="text-teal-900">Full access</b> unlocks all 92 activities,
          346 sub-activities and 275 templates, evidence uploads and team
          collaboration. Have an access code? Enter it on the plans page to
          unlock everything.
        </p>
        <div className="mt-4">
          <Link
            href="/pricing"
            className="inline-block rounded-lg bg-teal-800 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-900"
          >
            See plans &amp; redeem a code
          </Link>
        </div>
        <p className="mt-4 text-[12.5px] text-muted">
          Platform admins also see an <b>Admin</b> area for minting access codes
          and managing organizations.
        </p>
      </div>
    </main>
  );
}
