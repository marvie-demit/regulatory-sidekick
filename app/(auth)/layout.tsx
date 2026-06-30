import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link
        href="/"
        className="font-display text-lg font-semibold text-teal-900"
      >
        NotJustAnyQMS
      </Link>
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-sm">
        {children}
      </div>
      <p className="mt-6 text-xs text-muted">
        ISO 13485 / EU MDR · multi-tenant QMS
      </p>
    </main>
  );
}
