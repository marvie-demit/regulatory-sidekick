import { getActiveOrg } from "@/lib/auth/org";
import { createClient } from "@/lib/supabase/server";
import { OrgProfileForm, type OrgProfile } from "@/components/org/OrgProfileForm";

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
  const d = (res.data ?? {}) as Record<string, string | null>;
  const profile: OrgProfile = {
    name: d.name ?? org.name,
    website: d.website ?? "",
    linkedin: d.linkedin ?? "",
    industry: d.industry ?? "",
    country: d.country ?? "",
    about: d.about ?? "",
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
    </main>
  );
}
