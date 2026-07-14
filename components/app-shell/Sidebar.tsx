"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { hasFullAccess, planLabel } from "@/lib/auth/access";

type NavItem = { label: string; href: string; match?: string; ready: boolean };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Implement",
    items: [
      { label: "Device profile", href: "/profile", match: "/profile", ready: true },
      { label: "Dashboard", href: "/dashboard", ready: true },
      { label: "Roadmap", href: "/roadmap/1", match: "/roadmap", ready: true },
      { label: "Checklist", href: "/checklist", match: "/checklist", ready: true },
    ],
  },
  {
    group: "Reference",
    items: [
      { label: "Standards matrix", href: "/matrix", match: "/matrix", ready: true },
      { label: "Document library", href: "/library", match: "/library", ready: true },
      {
        label: "Process map",
        href: "/process-map",
        match: "/process-map",
        ready: true,
      },
    ],
  },
  {
    group: "Workspace",
    items: [
      {
        label: "Organization",
        href: "/settings/organization",
        match: "/settings/organization",
        ready: true,
      },
      {
        label: "Members",
        href: "/settings/members",
        match: "/settings/members",
        ready: true,
      },
      {
        label: "Activity log",
        href: "/settings/activity",
        match: "/settings/activity",
        ready: true,
      },
      {
        label: "Account",
        href: "/settings/profile",
        match: "/settings/profile",
        ready: true,
      },
    ],
  },
];

const ADMIN_GROUP: { group: string; items: NavItem[] } = {
  group: "Platform",
  items: [{ label: "Admin", href: "/admin", match: "/admin", ready: true }],
};

export function Sidebar({
  orgName,
  role,
  plan,
  isPlatformAdmin = false,
}: {
  orgName?: string;
  role?: string;
  plan?: string;
  isPlatformAdmin?: boolean;
}) {
  const path = usePathname();
  const groups = isPlatformAdmin ? [...NAV, ADMIN_GROUP] : NAV;
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto bg-[var(--side)] px-4 py-6">
      <div className="px-2">
        <Link
          href="/dashboard"
          className="font-display text-lg font-semibold text-white"
        >
          Regulatory Sidekick
        </Link>
        {orgName ? (
          <div className="mt-1.5">
            <div className="truncate text-sm text-white/70">{orgName}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {plan ? (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                  style={
                    hasFullAccess(plan)
                      ? { background: "rgba(93,202,165,.2)", color: "#bcd9cf" }
                      : {
                          background: "rgba(255,255,255,.1)",
                          color: "rgba(255,255,255,.6)",
                        }
                  }
                >
                  {planLabel(plan)}
                </span>
              ) : null}
              {role ? (
                <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/60">
                  {role}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <nav className="flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g.group}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              {g.group}
            </div>
            <div className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const active = it.match
                  ? path.startsWith(it.match)
                  : path === it.href;
                if (!it.ready)
                  return (
                    <span
                      key={it.href}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white/30"
                    >
                      {it.label}
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                        soon
                      </span>
                    </span>
                  );
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={
                      "rounded-lg px-3 py-2 text-sm transition-colors " +
                      (active
                        ? "bg-white/15 font-medium text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white")
                    }
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <Link
          href="/guide"
          className={
            "rounded-lg px-3 py-2 text-sm transition-colors " +
            (path.startsWith("/guide")
              ? "bg-white/15 font-medium text-white"
              : "text-white/75 hover:bg-white/10 hover:text-white")
          }
        >
          Guide
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign out
          </button>
        </form>
        <div className="px-3 text-[10px] text-white/30">ISO 13485 · EU MDR · IVDR</div>
      </div>
    </aside>
  );
}
