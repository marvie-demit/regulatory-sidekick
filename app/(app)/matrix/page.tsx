import { getActiveOrg } from "@/lib/auth/org";
import { content } from "@/lib/content/content";
import { MatrixView } from "@/components/content/MatrixView";

export const metadata = { title: "Standards matrix" };

export default async function MatrixPage() {
  const org = await getActiveOrg();
  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Standards traceability matrix
      </h1>
      <p className="mt-3 max-w-2xl text-muted">
        Where each standard &amp; clause is addressed across the four phases.
        Expand a standard to see its clauses and the activities that cover them.
      </p>
      <MatrixView standards={content.standards} plan={org?.plan} />
    </main>
  );
}
