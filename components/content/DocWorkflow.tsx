import Link from "next/link";
import { docWorkflow, type DocGroups } from "@/lib/content/content";
import type { DocItem } from "@/lib/content/types";

const ROWS: { key: keyof DocGroups; label: string }[] = [
  { key: "adopt", label: "Adopt & adapt" },
  { key: "templates", label: "Templates" },
  { key: "record", label: "Record on" },
  { key: "registers", label: "Registers" },
  { key: "other", label: "Reference" },
];

function Chip({ d }: { d: DocItem }) {
  return (
    <Link
      href={`/library/${d.id}`}
      title={d.title || undefined}
      className="rounded-md border border-line bg-card px-2 py-0.5 text-[11.5px] font-semibold text-teal-800 hover:border-coral"
    >
      {d.id}
    </Link>
  );
}

export function DocWorkflow({ documents }: { documents?: string }) {
  const g = docWorkflow(documents);
  const total =
    g.adopt.length +
    g.templates.length +
    g.record.length +
    g.registers.length +
    g.other.length;
  if (!total) return <p className="text-sm text-muted">—</p>;

  return (
    <div className="text-sm">
      <p className="mb-3 leading-relaxed text-muted">
        Set up the procedure, then run it:{" "}
        <b className="text-teal-800">adopt &amp; adapt</b> the SOP to your scope →{" "}
        <b className="text-teal-800">use</b> the templates →{" "}
        <b className="text-teal-800">record</b> on the forms →{" "}
        <b className="text-teal-800">keep</b> the registers current.
      </p>
      {ROWS.map((r) => {
        const items = g[r.key];
        if (!items.length) return null;
        return (
          <div key={r.key} className="mb-2 flex flex-wrap items-baseline gap-2">
            <span className="w-28 shrink-0 text-[11px] font-bold uppercase tracking-wide text-teal-800">
              {r.label}
            </span>
            <span className="flex flex-wrap gap-1.5">
              {items.map((d) => (
                <Chip key={d.id} d={d} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
