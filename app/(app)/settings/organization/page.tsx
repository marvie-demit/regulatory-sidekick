import Link from "next/link";
import { getActiveOrg } from "@/lib/auth/org";
import { createClient } from "@/lib/supabase/server";
import { OrgProfileForm, type OrgProfile } from "@/components/org/OrgProfileForm";
import { WorkspaceId } from "@/components/org/WorkspaceId";

export const metadata = { title: "Organization" };

export default async function OrgSettingsPage() {
  const org = await getActiveOrg();
  // The (app) layout redirects a user with no org to onboarding; guard anyway.
  if (!org) return null;

  const supabase = await createClient();
  // Resilient to migration 0010 not being applied yet — fall back to name only.
  let res = await supabase
    .from("organizations")
    .select("name, website, linkedin, industry, country, about")
    .eq("id", org.id)
    .single();
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

      {/* Agent access moved to its own page. Keep this pointer for a release —
          AGENT_API.md and skills.md sent people here for months. */}
      <section className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-teal-900">
          Agent access
        </h2>
        <p className="mt-1 text-sm text-muted">
          Keys, setup and connection status now live on their own page.
        </p>
        <Link
          href="/agent"
          className="mt-3 inline-flex rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-teal-800 transition hover:border-coral"
        >
          Open Agent →
        </Link>
      </section>
    </main>
  );
}
