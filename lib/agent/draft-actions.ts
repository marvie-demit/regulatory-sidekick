"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrg } from "@/lib/auth/org";
import { hasFullAccess } from "@/lib/auth/access";

type Res = { error?: string; message?: string };

/**
 * Mark a drafted document as reviewed by a human.
 *
 * The write goes through the USER's client, not the service role, on purpose:
 * migration 0019 grants `authenticated` an UPDATE on exactly two columns
 * (reviewed_at, reviewed_by), so the database — not this function — is what
 * guarantees a reviewer cannot also rewrite the path, the size or the counts.
 * Routing it through the admin client would hand back the ability to edit
 * everything and put the whole control in the hands of this code being correct.
 *
 * Reviewing is a claim about a document a person has read. It deliberately does
 * NOT close the activity: that is a separate, human decision the agent is also
 * barred from (app/api/v1/activities/[id]/route.ts).
 */
export async function markDraftReviewed(
  docId: string,
  reviewed: boolean,
): Promise<Res> {
  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (!hasFullAccess(org.plan))
    return { error: "Agent drafts are part of full access." };

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await db
    .from("document_drafts")
    .update(
      reviewed
        ? { reviewed_at: new Date().toISOString(), reviewed_by: user.id }
        : { reviewed_at: null, reviewed_by: null },
    )
    .eq("org_id", org.id)
    .eq("doc_id", docId);

  if (error) return { error: error.message };

  try {
    await createAdminClient().from("audit_log").insert({
      org_id: org.id,
      actor_id: user.id,
      action: reviewed ? "draft.reviewed" : "draft.unreviewed",
      target_type: "document",
      target_id: docId,
    });
  } catch {
    // The review stands even if the audit insert fails; do not fail the action.
  }

  revalidatePath("/library");
  revalidatePath("/agent");
  return { message: reviewed ? "Marked reviewed." : "Review cleared." };
}
