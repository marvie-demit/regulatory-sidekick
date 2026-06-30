import { canViewActivity } from "@/lib/auth/access";
import { getActiveOrg } from "@/lib/auth/org";
import { content, pnum, expandRefs } from "@/lib/content/content";
import {
  ChecklistView,
  type CKActivity,
} from "@/components/content/ChecklistView";

export const metadata = { title: "Checklist" };

export default async function ChecklistPage() {
  const org = await getActiveOrg();
  const activities: CKActivity[] = content.activities.map((a) => {
    // Redact the deep fields for locked activities so the granular checklist
    // items never reach a free org's browser — they're core IP.
    const allowed = canViewActivity(org?.plan, a.id);
    return {
      id: a.id,
      statement: a.statement,
      phaseN: pnum(a.phase),
      qse: a.qse,
      dur: a.dur ?? 0,
      clause: a.clause,
      mods: a.mods || [],
      docIds: allowed ? expandRefs(a.documents) : [],
      tasks: allowed ? (a.how2 || []).flatMap((g) => g.steps) : [],
    };
  });

  return (
    <ChecklistView
      activities={activities}
      qses={content.qses}
      plan={org?.plan}
    />
  );
}
