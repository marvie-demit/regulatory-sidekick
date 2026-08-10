import Link from "next/link";
import type { Brand as BrandData } from "@/lib/partners/theme";
import { brandName } from "@/lib/partners/theme";

// The wordmark, in one place. Previously the string "Regulatory Sidekick" was
// duplicated across the sign-in card, onboarding, both sidebars and the landing
// hero — five places to miss when a partner's name should appear instead.
//
// A plain <img>, not next/image: this repo has never used next/image, and
// adopting it here would mean configuring images.remotePatterns for the Supabase
// storage host to gain nothing at a 28px logo.

export function BrandMark({
  brand,
  href,
  className = "",
  logoHeight = 28,
}: {
  brand?: BrandData | null;
  href?: string;
  className?: string;
  logoHeight?: number;
}) {
  const name = brandName(brand ?? null);
  const inner = brand?.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logoUrl}
      alt={brand.logoAlt || name}
      height={logoHeight}
      style={{ height: logoHeight, width: "auto" }}
      className="block max-w-[180px] object-contain"
    />
  ) : (
    name
  );

  if (!href) return <span className={className}>{inner}</span>;
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
