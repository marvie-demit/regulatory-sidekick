import { BrandMark } from "@/components/brand/Brand";
import { BrandScope } from "@/components/brand/BrandScope";
import { getRequestBrand } from "@/lib/partners/brand";

// Sign-in / sign-up / password reset. On a partner subdomain these are the very
// first pages a portfolio company sees, so they carry the partner's brand.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = await getRequestBrand();
  return (
    <BrandScope brand={brand}>
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <BrandMark
          brand={brand}
          href="/"
          className="font-display text-lg font-semibold text-teal-900"
          logoHeight={32}
        />
        <div className="mt-6 w-full max-w-sm rounded-2xl border border-line bg-card p-7 shadow-sm">
          {children}
        </div>
        <p className="mt-6 text-xs text-muted">
          ISO 13485 · EU MDR · IVDR · multi-tenant QMS
        </p>
      </main>
    </BrandScope>
  );
}
