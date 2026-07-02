import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Reads the org's audit trail for the Activity-log view. Members may SELECT
// their org's rows (au_select RLS); actor emails are resolved with the service
// role (auth.users isn't member-readable), deduped + in parallel.

export type LogEntry = {
  id: number;
  label: string;
  actorEmail: string | null;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
};

const LABELS: Record<string, string> = {
  "org.create": "Created the workspace",
  "invitation.create": "Invited a teammate",
  "invitation.accept": "Joined the workspace",
  "status.set": "Set activity status",
  "status.bulk": "Bulk-updated statuses",
  "state.reset": "Reset all progress",
  "profile.set": "Updated device profile",
  "document.download": "Downloaded a document",
  "evidence.add": "Attached evidence",
  "evidence.delete": "Removed evidence",
  "plan.redeem": "Redeemed an access code",
  "plan.set_by_platform_admin": "Plan updated by platform admin",
};

function label(action: string): string {
  return (
    LABELS[action] ??
    action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Uuids/long refs aren't useful to show; activity ids ("P1.1"), doc ids and
// emails are.
function shortEntity(id: string | null): string | null {
  if (!id) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) return null;
  return id.length <= 40 ? id : null;
}

function detailOf(
  action: string,
  d: Record<string, unknown> | null,
): string | null {
  if (!d) return null;
  if (action === "status.set" || action === "status.bulk") {
    const s = d.status;
    return typeof s === "string" ? s.replace(/_/g, " ") : null;
  }
  if (action.startsWith("plan.")) {
    const p = d.plan;
    return typeof p === "string" ? p : null;
  }
  return null;
}

export async function getActivityLog(
  orgId: string,
  limit = 100,
): Promise<LogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, actor_id, action, entity_id, detail, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const rows = data as Array<{
    id: number;
    actor_id: string | null;
    action: string;
    entity_id: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
  }>;

  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const admin = createAdminClient();
  const emailById = new Map<string, string | null>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data: u } = await admin.auth.admin.getUserById(id);
        emailById.set(id, u.user?.email ?? null);
      } catch {
        emailById.set(id, null);
      }
    }),
  );

  return rows.map((r) => ({
    id: r.id,
    label: label(r.action),
    actorEmail: r.actor_id ? (emailById.get(r.actor_id) ?? null) : null,
    entityId: shortEntity(r.entity_id),
    detail: detailOf(r.action, r.detail),
    createdAt: r.created_at,
  }));
}
