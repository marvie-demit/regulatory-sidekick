"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { BrandMark } from "@/components/brand/Brand";
import type { Brand } from "@/lib/partners/theme";

const NAV = [
  { label: "Overview", href: "/partner", match: "/partner" },
  { label: "Team", href: "/partner/team", match: "/partner/team" },
];

const KIND_LABEL: Record<string, string> = {
  accelerator: "Accelerator",
  incubator: "Incubator",
  investor: "Investor",
  other: "Partner",
};

export function PartnerShell({
  name,
  kind,
  role,
  suspended,
  hasWorkspace,
  brand,
  children,
}: {
  name: string;
  kind: string;
  role: string;
  suspended: boolean;
  hasWorkspace: boolean;
  brand?: Brand | null;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="flex">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto bg-[var(--side)] px-4 py-6">
        <div className="px-2">
          <BrandMark
            brand={brand}
            href="/partner"
            className="font-display text-lg font-semibold text-white"
          />
          <div className="mt-1.5">
            <div className="truncate text-sm text-white/70">{name}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                style={{ background: "rgba(93,202,165,.2)", color: "#bcd9cf" }}
              >
                {KIND_LABEL[kind] ?? "Partner"}
              </span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                style={{
                  background: "rgba(255,255,255,.1)",
                  color: "rgba(255,255,255,.6)",
                }}
              >
                {role}
              </span>
              {suspended ? (
                <span className="shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-red-200">
                  Suspended
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active =
              n.match === "/partner" ? path === "/partner" : path.startsWith(n.match);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {hasWorkspace ? (
            <Link
              href="/dashboard"
              className="mt-2 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              ← My workspace
            </Link>
          ) : null}
        </nav>

        <div className="mt-auto px-2">
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-white/50 transition hover:text-white/80"
            >
              Sign out
            </button>
          </form>
          <p className="mt-3 text-[10px] leading-relaxed text-white/40">
            ISO 13485 · EU MDR · IVDR · multi-tenant QMS
          </p>
        </div>
      </aside>
      <div className="min-h-screen min-w-0 flex-1">{children}</div>
    </div>
  );
}
