import { content } from "@/lib/content/content";
import { ProfileSelector } from "@/components/content/ProfileSelector";

export const metadata = { title: "Device profile" };

export default function ProfilePage() {
  const acts = content.activities.map((a) => ({ mods: a.mods || [] }));
  const docModules = content.documents.map((d) => d.module);

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-teal-900">
        Device profile
      </h1>
      <p className="lead mt-3">
        Tell us what kind of device you are building - we tailor the roadmap,
        checklist, matrix and library to the modules that apply.{" "}
        <b>ISO 13485 (Core) always applies.</b> Change it anytime; your saved
        status is kept.
      </p>
      <ProfileSelector
        modules={content.modules}
        modCounts={content.modCounts}
        acts={acts}
        docModules={docModules}
        totalDocs={content.stats.docs}
        totalActs={content.activities.length}
      />
    </main>
  );
}
