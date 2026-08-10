import type { Brand } from "@/lib/partners/theme";
import { brandStyle } from "@/lib/partners/theme";

/**
 * Applies a partner's palette to everything inside it.
 *
 * CSS custom properties cascade, so setting them on a wrapper re-themes the
 * subtree exactly as setting them on <html> would — without making the root
 * layout async and therefore making every page in the app dynamic. That matters:
 * `/`, `/impressum` and `/privacy` are prerendered today and should stay that
 * way until subdomains genuinely need per-request branding at the root.
 *
 * `background` is repeated here because globals.css sets it on <body>, outside
 * this wrapper — without it a themed page would sit on the house background.
 */
export function BrandScope({
  brand,
  children,
  className = "",
}: {
  brand: Brand | null;
  children: React.ReactNode;
  className?: string;
}) {
  const style = brandStyle(brand);
  if (!style) return <>{children}</>;
  return (
    <div
      style={{ ...style, background: "var(--bg)", minHeight: "100%" }}
      className={className}
    >
      {children}
    </div>
  );
}
