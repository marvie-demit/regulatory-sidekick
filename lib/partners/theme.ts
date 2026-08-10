import type { CSSProperties } from "react";

// Turns a partner's four brand colours into the CSS custom properties the whole
// app is already built on.
//
// Why this is cheap: app/globals.css declares its palette in an `@theme inline`
// block, so Tailwind emits `color: var(--t9)` rather than baking the hex into
// the utility class. Overriding --t9 on <html> therefore re-themes every
// `text-teal-900` in the app, plus the ~1300 lines of hand-written component CSS
// that already reference the same variables.
//
// SECURITY: every value here ends up inside a style attribute. The DB enforces
// '^#[0-9a-fA-F]{6}$' (0015) and this module enforces it AGAIN before render.
// Both layers matter — a bad value must never be able to close the attribute and
// inject CSS on a page that carries our product.

const HEX = /^#[0-9a-fA-F]{6}$/;

export type Brand = {
  slug: string;
  name: string;
  wordmark: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
  primary: string | null;
  mid: string | null;
  accent: string | null;
  surface: string | null;
};

function safe(hex: string | null | undefined): string | null {
  return hex && HEX.test(hex) ? hex : null;
}

function channels(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (rgb: number[]) =>
  "#" + rgb.map((c) => clamp(c).toString(16).padStart(2, "0")).join("");

/** Blend towards white (amount > 0) or black (amount < 0). -1..1. */
function shade(hex: string, amount: number): string {
  const [r, g, b] = channels(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex([
    r + (target - r) * t,
    g + (target - g) * t,
    b + (target - b) * t,
  ]);
}

/** A very pale wash of a colour — for --tint / --cream style surfaces. */
function wash(hex: string, amount: number): string {
  return shade(hex, 1 - amount);
}

/**
 * The full token override for a partner. Returns undefined when there is nothing
 * valid to apply, so the caller renders the default palette untouched.
 *
 * Each of the four inputs is independent: a partner who sets only a primary
 * colour gets a coherent theme derived from it, and everything they left blank
 * falls through to the house tokens in globals.css.
 */
export function brandStyle(brand: Brand | null): CSSProperties | undefined {
  if (!brand) return undefined;

  const primary = safe(brand.primary);
  const mid = safe(brand.mid);
  const accent = safe(brand.accent);
  const surface = safe(brand.surface);
  if (!primary && !mid && !accent && !surface) return undefined;

  const vars: Record<string, string> = {};

  if (primary) {
    vars["--t95"] = shade(primary, -0.3); // darkest
    vars["--t9"] = primary; // deepest — titles
    vars["--t8"] = shade(primary, 0.12); // headings / bands
    vars["--side"] = primary; // sidebar
    vars["--ink"] = shade(primary, 0.1); // body text keeps the family
  }
  // The MID of the ramp drives links and secondary emphasis; the PALE end drives
  // the success-notice fill and chip backgrounds. Both have to move, or a themed
  // page keeps stray teal in exactly the places people notice — links and
  // confirmation banners.
  const ramp = mid ?? (primary ? shade(primary, 0.28) : null);
  if (mid) {
    vars["--t6"] = mid;
    vars["--t5"] = shade(mid, 0.14);
    vars["--ok"] = mid;
  } else if (primary) {
    // No mid supplied — derive a usable pair so links and chips aren't the same
    // ink as the headings.
    vars["--t6"] = shade(primary, 0.28);
    vars["--t5"] = shade(primary, 0.42);
  }
  if (ramp) {
    vars["--t7"] = shade(ramp, -0.12);
    vars["--t2"] = wash(ramp, 0.26);
    vars["--t1"] = wash(ramp, 0.13);
    vars["--t0"] = wash(ramp, 0.05);
  }
  if (accent) {
    vars["--coral"] = accent; // primary CTA + focus rings
  }
  if (surface) {
    vars["--bg"] = surface;
    vars["--tint"] = wash(surface, 0.35);
    vars["--tint2"] = shade(surface, -0.04);
  } else if (primary) {
    vars["--bg"] = wash(primary, 0.045);
    vars["--tint"] = wash(primary, 0.03);
    vars["--tint2"] = wash(primary, 0.075);
  }
  if (primary) {
    vars["--cream"] = wash(primary, 0.035);
    vars["--cream2"] = wash(primary, 0.11);
    vars["--line"] = wash(primary, 0.12);
    vars["--muted"] = shade(primary, 0.42);
  }

  // Note what is deliberately NOT overridden:
  //   --card stays white, --chip stays neutral grey, and the whole --doc-*
  //   palette stays as-is. Rendered SOPs and registers are the CUSTOMER's
  //   controlled documents (globals.css says so) — they must not carry an
  //   investor's brand. Semantic colours (amber in-progress, green done, red
  //   error) stay fixed too: "done" being green is meaning, not styling.
  return vars as CSSProperties;
}

/** The name to show in chrome and <title>. */
export function brandName(brand: Brand | null): string {
  return brand?.wordmark?.trim() || brand?.name || "Regulatory Sidekick";
}
