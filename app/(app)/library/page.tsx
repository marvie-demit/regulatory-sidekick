import { LibraryView } from "@/components/content/LibraryView";
import { getActiveOrg } from "@/lib/auth/org";
import { content } from "@/lib/content/content";

export const metadata = { title: "Document library" };

type Proc = { name: string; module?: string };

export default async function LibraryPage() {
  const org = await getActiveOrg();
  return (
    <LibraryView
      documents={content.documents}
      procs={(content.procs ?? {}) as Record<string, Proc>}
      procOrder={content.procOrder ?? []}
      totalDocs={content.stats.docs}
      plan={org?.plan}
    />
  );
}
