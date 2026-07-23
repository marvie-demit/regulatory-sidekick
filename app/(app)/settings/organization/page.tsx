import { headers } from "next/headers";
import { getActiveOrg } from "@/lib/auth/org";
import { hasAgenticAccess, hasFullAccess } from "@/lib/auth/access";
import { getAgentTokens } from "@/lib/auth/agent-tokens-read";
import {
  DEFAULT_AGENT_RATE_LIMIT,
  DEFAULT_AGENT_WRITE_LIMIT,
} from "@/lib/auth/agent-tokens";
import { createClient } from "@/lib/supabase/server";
import { OrgProfileForm, type OrgProfile } from "@/components/org/OrgProfileForm";
import { WorkspaceId } from "@/components/org/WorkspaceId";
import { AgentAccess } from "@/components/org/AgentAccess";

export const metadata = { title: "Organization" };

export default async function OrgSettingsPage() {
  const org = await getActiveOrg();
  // The (app) layout redirects a user with no org to onboarding; guard anyway.
  if (!org) return null;

  const supabase = await createClient();
  // Resilient to migration 0010 not being applied yet — fall back to name only.
  let res = await supabase
    .from("organizations")
    .select(
      "name, website, linkedin, industry, country, about, agent_rate_limit, agent_write_limit, agentic_enabled, agentic_expires_at",
    )
    .eq("id", org.id)
    .single();
  if (res.error) {
    res = await supabase
      .from("organizations")
      .select("name, website, linkedin, industry, country, about")
      .eq("id", org.id)
      .single();
  }
  if (res.error) {
    res = await supabase
      .from("organizations")
      .select("name")
      .eq("id", org.id)
      .single();
  }
  const d = (res.data ?? {}) as Record<string, string | number | boolean | null>;
  const str = (v: string | number | boolean | null | undefined) =>
    typeof v === "string" ? v : "";
  const profile: OrgProfile = {
    name: str(d.name) || org.name,
    website: str(d.website),
    linkedin: str(d.linkedin),
    industry: str(d.industry),
    country: str(d.country),
    about: str(d.about),
  };

  // Agent access is additive — if migration 0011 isn't applied yet the read
  // simply returns [] and the card still renders (create will surface the error).
  const tokens = await getAgentTokens(org.id);
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3100";
  const baseUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-teal-900">
        Organization
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your company / workspace profile. This is where your team&apos;s QMS
        implementation lives.
      </p>
      <OrgProfileForm profile={profile} canEdit={org.role === "admin"} />
      <WorkspaceId id={org.id} />
      <AgentAccess
        tokens={tokens}
        isAdmin={org.role === "admin"}
        isFull={hasFullAccess(org.plan)}
        baseUrl={baseUrl}
        rateLimit={
          (d.agent_rate_limit as number | null) ?? DEFAULT_AGENT_RATE_LIMIT
        }
        writeLimit={
          (d.agent_write_limit as number | null) ?? DEFAULT_AGENT_WRITE_LIMIT
        }
        isEnabled={hasAgenticAccess({
          plan: org.plan,
          agenticEnabled: d.agentic_enabled as boolean | null,
          agenticExpiresAt: d.agentic_expires_at as string | null,
        })}
      />
    </main>
  );
}
