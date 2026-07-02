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
        How the {stats.processes}{" "}
        processes interact across the four phases (the
        ISO&nbsp;13485 §4.1.2 process-interaction map). Each cell is the step a
        process runs in that phase — starting lean and maturing toward
        certification. Every step produces controlled documents: {stats.steps}{" "}
        steps · {stats.docs} documents, with none unaccounted for.
      </p>

      <ProcessMapView rows={rows} />

      <p className="mt-4 text-xs text-muted">
        Switch to <strong>My device</strong> to see only the processes and steps
        your device profile requires — the same profile that scopes your roadmap
        and document library. <strong>Full library</strong> shows every process.
      </p>
    </main>
  );
}
