import { content, counts, pnum } from "@/lib/content/content";
import { DashboardClient } from "@/components/content/DashboardClient";
import { getActiveOrg } from "@/lib/auth/org";
import { hasAgenticAccess } from "@/lib/auth/access";
import { getAgentTokens } from "@/lib/auth/agent-tokens-read";
import { agentConnection } from "@/lib/agent/connection";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

// "Agent access is switched on but nothing has ever connected" — the setup was
// started and abandoned. Worth a nudge, and only worth a query when the add-on
// is actually on, so the common case costs nothing.
async function agentIdle(): Promise<boolean> {
  const org = await getActiveOrg();
  if (!org) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("agentic_enabled, agentic_expires_at")
    .eq("id", org.id)
    .single();
  if (error || !data) return false; // migration 0013 not applied — say nothing
  const enabled = hasAgenticAccess({
    plan: org.plan,
    agenticEnabled: (data as { agentic_enabled: boolean | null }).agentic_enabled,
    agenticExpiresAt: (data as { agentic_expires_at: string | null })
      .agentic_expires_at,
  });
  if (!enabled) return false;
  return !agentConnection(await getAgentTokens(org.id)).everConnected;
}

export default async function DashboardPage() {
  const acts = content.activities.map((a) => ({
    id: a.id,
    statement: a.statement,
    phaseN: pnum(a.phase),
    // per-phase start order — drives the "Next up" recommendation
    wave: parseInt(String(a.wave || "W1").slice(1), 10) || 1,
    depends: a.depends || "-",
    workstream: (a as { workstream?: string }).workstream || "tf",
    qse: a.qse,
    dur: a.dur || 0,
    es: a.es || 0,
    ef: a.ef || 0,
    mods: a.mods || [],
    reg: a.reg || [],
    ord: (a as { ord?: number }).ord || 0,
  }));
  const docScopes = content.documents.map((d) => ({
    module: d.module,
    reg: d.reg,
  }));

  return (
    <DashboardClient
      phases={content.phases}
      acts={acts}
      modules={content.modules}
      docScopes={docScopes}
      totalDocs={counts().documents}
      agentIdle={await agentIdle()}
    />
  );
}
