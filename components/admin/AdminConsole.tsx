"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AccessCode, AdminApplication, AdminOrg } from "@/lib/admin/data";
import type { AdminPartner } from "@/lib/partners/data";
import { ApplicationsTab } from "./ApplicationsTab";
import { CodesTab } from "./CodesTab";
import { OrganizationsTab } from "./OrganizationsTab";
import { PartnersSection } from "./PartnersSection";
import { ToolsTab } from "./ToolsTab";
import { parseTab, TabStrip, TriageBar, type TabKey } from "./ui";

// The platform-admin console shell: what needs attention, then five tabs.
//
// This file used to be 757 lines holding every form and row as well as the
// layout. Splitting it followed the precedent already set by PartnersSection —
// each tab is its own file now, and this is only assembly.
//
// All data still loads in one pass on the server (see app/(app)/admin/page.tsx).
// Tabs here are visibility, not fetching: listOrgs() is four batched queries
// capped at 100 rows, so the whole page is under a dozen queries and splitting
// it into routes would buy nothing but a page load per switch.

export function AdminConsole({
  codes,
  orgs,
  partners,
  applications,
}: {
  codes: AccessCode[];
  orgs: AdminOrg[];
  partners: AdminPartner[];
  applications: AdminApplication[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = parseTab(params.get("tab"));

  // Lifted out of OrganizationsTab so the triage bar can switch tab AND apply
  // the filter in one click.
  const [idleOnly, setIdleOnly] = useState(false);

  const go = (key: TabKey) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    // replace, not push: flicking between tabs should not fill the back button
    // with steps nobody wants to retrace. scroll:false keeps your place.
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const waiting = applications.filter((a) => a.status === "submitted").length;
  const idle = orgs.filter((o) => o.agenticEnabled && !o.agentLastUsedAt).length;

  const triage: { label: string; onClick: () => void }[] = [];
  if (waiting)
    triage.push({
      label: `${waiting} application${waiting === 1 ? "" : "s"} waiting`,
      onClick: () => go("applications"),
    });
  if (idle)
    triage.push({
      label: `${idle} paying · never connected`,
      onClick: () => {
        setIdleOnly(true);
        go("organizations");
      },
    });

  return (
    <div className="flex flex-col gap-6">
      <TriageBar items={triage} />
      <TabStrip
        active={active}
        counts={{ applications: waiting }}
        onSelect={go}
      />

      {active === "applications" ? (
        <ApplicationsTab items={applications} />
      ) : null}
      {active === "organizations" ? (
        <OrganizationsTab
          orgs={orgs}
          idleOnly={idleOnly}
          onIdleOnlyChange={setIdleOnly}
        />
      ) : null}
      {active === "codes" ? (
        <CodesTab codes={codes} orgs={orgs} partners={partners} />
      ) : null}
      {active === "partners" ? <PartnersSection partners={partners} /> : null}
      {active === "tools" ? <ToolsTab /> : null}
    </div>
  );
}
