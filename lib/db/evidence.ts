"use server";

import { getActiveOrg } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME,
  type EvidenceItem,
} from "@/lib/db/evidence-types";

// Service-role audit (direct member INSERT to audit_log is revoked; migration 0008).
async function auditEvidence(
  orgId: string,
  uid: string,
  action: string,
  activityId: string,
  detail?: Record<string, unknown>,
) {
  try {
    await createAdminClient().from("audit_log").insert({
      org_id: orgId,
      actor_id: uid,
      action,
      entity_type: "evidence",
      entity_id: activityId,
      detail: detail ?? null,
    });
  } catch {}
}

// Read this activity's evidence for the org (RLS ev_select scopes to members).
// Uploader emails resolved with the service role (deduped, in parallel).
export async function listEvidence(
  orgId: string,
  activityId: string,
): Promise<EvidenceItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evidence")
    .select("id, file_name, mime_type, size_bytes, storage_path, uploaded_by, created_at")
    .eq("org_id", orgId)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const rows = data as Array<{
    id: string;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    storage_path: string;
    uploaded_by: string | null;
    created_at: string;
  }>;
  const ids = [...new Set(rows.map((r) => r.uploaded_by).filter(Boolean))] as string[];
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
    fileName: r.file_name ?? "file",
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    storagePath: r.storage_path,
    uploaderEmail: r.uploaded_by ? (emailById.get(r.uploaded_by) ?? null) : null,
    createdAt: r.created_at,
  }));
}

// Record an uploaded file. The object is uploaded client-side to a private path;
// this validates the plan gate, type/size, and that the path is inside the org's
// own folder, then inserts the row. RLS enforces org membership as a backstop.
export async function addEvidence(input: {
  activityId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  const org = await getActiveOrg();
  if (!org || !uid) return { error: "Not authorized." };
  if (!hasFullAccess(org.plan))
    return { error: "Attaching evidence is part of full access." };

  const { activityId, storagePath, fileName, mimeType, sizeBytes } = input;
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > EVIDENCE_MAX_BYTES)
    return { error: "That file is too large." };
  if (mimeType && !EVIDENCE_MIME.has(mimeType))
    return { error: "Unsupported file type." };
  if (!storagePath.startsWith(`org/${org.id}/${activityId}/`))
    return { error: "Invalid upload path." };

  const { error } = await supabase.from("evidence").insert({
    org_id: org.id,
    activity_id: activityId,
    storage_path: storagePath,
    file_name: fileName.slice(0, 255),
    mime_type: mimeType,
    size_bytes: sizeBytes,
    uploaded_by: uid,
  });
  if (error) return { error: error.message };
  await auditEvidence(org.id, uid, "evidence.add", activityId, { file: fileName });
  return {};
}

export async function deleteEvidence(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  const org = await getActiveOrg();
  if (!org || !uid) return { error: "Not authorized." };

  const { data: row } = await supabase
    .from("evidence")
    .select("storage_path, activity_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { error: "Not found." };
  const r = row as { storage_path: string; activity_id: string };

  // Delete the row first — RLS (ev_delete: can_write & uploader/admin) is the
  // authorization gate. Then best-effort remove the object.
  const { error } = await supabase.from("evidence").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase.storage.from("evidence").remove([r.storage_path]);
  await auditEvidence(org.id, uid, "evidence.delete", r.activity_id);
  return {};
}
