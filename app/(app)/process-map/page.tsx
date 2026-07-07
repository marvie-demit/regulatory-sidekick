import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/org";
import { modelStats } from "@/lib/content/process";
import { RealizationChain } from "@/components/content/RealizationChain";

export const metadata = { title: "Process map" };

export default async function ProcessMapPage() {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

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
        what triggers or feeds what — the interaction view ISO 13485 §4.1.2 asks
        for, spanning {stats.processes} processes, {stats.steps} steps and{" "}
        {stats.docs} controlled documents.
      </p>

      <RealizationChain />
    </main>
  );
}
