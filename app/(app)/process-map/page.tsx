import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/org";
import { phaseMatrix, modelStats } from "@/lib/content/process";
import { ProcessMapView } from "@/components/content/ProcessMapView";

export const metadata = { title: "Process map" };

export default async function ProcessMapPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  const rows = phaseMatrix();
  const stats = modelStats();

  return (
    <main className="px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Process map
      </h1>
      <p className="lead">
        The realization chain — how your core processes trigger and hand off to
        each other as the device matures across the four phases. Rows are
        processes, columns are phases (left&nbsp;→&nbsp;right), and arrows show
        what triggers or feeds what. Open any cell for the full detail:{" "}
        {stats.processes} processes · {stats.steps} steps · {stats.docs}{" "}
        controlled documents, with every document mapped to the step that
        creates it.
      </p>

      <ProcessMapView rows={rows} />

      <p className="mt-4 text-xs text-muted">
        The detail table below scopes to your device with{" "}
        <strong>My device</strong> (the same profile that scopes your roadmap and
        document library); <strong>Full library</strong> shows every process.
      </p>
    </main>
  );
}
