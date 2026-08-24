// The Startup Programme application — shape, limits, and the parsing rules the
// server enforces.
//
// PURE ON PURPOSE: no imports that reach a database. The client form imports
// LIMITS and the display helpers from here, so a server-only import in this
// file drags the Supabase server client into the browser bundle and the build
// fails. The reads live in ./queries.ts for exactly that reason.
//
// The programme exists for one kind of company: a very small, early startup that
// genuinely cannot fund CE marking. The form only has to answer four questions —
// are they real, are they small, are they under-funded, and are they actually
// building a device. That is why this file is short. Every extra question is a
// reason to abandon the form, and none of the obvious candidates (GTM,
// competitors, founder bios, notified body) changes whether a company qualifies
// for a discount.
//
// Limits live here, are rendered as maxLength by the form, AND are re-checked in
// the server action. The attribute is a courtesy to someone typing; the check is
// what actually holds, because a form field is not a validator.

export const LIMITS = {
  legalName: 120,
  website: 200,
  country: 60,
  riskClass: 20,
  deviceSummary: 200,
  whyBlocked: 400,
} as const;

export const REGULATIONS = ["MDR", "IVDR", "unsure"] as const;
export type Regulation = (typeof REGULATIONS)[number];

/** Free text, because MDR and IVDR classify on different scales. */
export const RISK_CLASS_SUGGESTIONS = [
  "I",
  "IIa",
  "IIb",
  "III",
  "A",
  "B",
  "C",
  "D",
] as const;

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "declined"
  | "withdrawn";

export type StartupApplication = {
  id: string;
  org_id: string;
  partner_id: string | null;
  status: ApplicationStatus;
  legal_name: string | null;
  website: string | null;
  country: string | null;
  founded_on: string | null;
  employees: number | null;
  device_summary: string | null;
  regulation: Regulation | null;
  risk_class: string | null;
  /** Minor units, like purchases.amount_total. */
  funding_dilutive_eur: bigint | number | null;
  funding_non_dilutive_eur: bigint | number | null;
  revenue_12m_eur: bigint | number | null;
  why_blocked: string | null;
  declared: boolean;
  declaration_text: string | null;
  decision_note: string | null;
  reviewed_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

export const APPLICATION_COLS =
  "id, org_id, partner_id, status, legal_name, website, country, founded_on, " +
  "employees, device_summary, regulation, risk_class, funding_dilutive_eur, " +
  "funding_non_dilutive_eur, revenue_12m_eur, why_blocked, declared, " +
  "declaration_text, decision_note, reviewed_at, submitted_at, created_at";

// ---------------------------------------------------------------------------
// Parsing. Every one of these returns null rather than throwing on nonsense —
// a draft is allowed to be incomplete, and submit() is where completeness is
// enforced.
// ---------------------------------------------------------------------------

export function text(v: FormDataEntryValue | null, max: number): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.slice(0, max);
}

/** True when the raw input exceeded the limit — the server-side rejection. */
export function tooLong(v: FormDataEntryValue | null, max: number): boolean {
  return typeof v === "string" && v.trim().length > max;
}

export function int(
  v: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v.replace(/[\s,._]/g, ""));
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i < min || i > max ? null : i;
}

/**
 * Euros in, MINOR UNITS out.
 *
 * Stored in cents to match purchases.amount_total. Mixing the two units across
 * tables is how a 100x error ends up in a board deck, so the conversion happens
 * once, here.
 *
 * Accepts what founders actually type: "1.5m", "250k", "1,200,000", "€400 000".
 */
export function money(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const raw = v.trim().toLowerCase().replace(/[€\s]/g, "");
  if (!raw) return null;

  const suffix = raw.endsWith("m") ? 1e6 : raw.endsWith("k") ? 1e3 : 1;
  let body = suffix === 1 ? raw : raw.slice(0, -1);

  // Thousands separators vs decimal point. If both appear, the LAST one is the
  // decimal separator; otherwise a lone comma is treated as thousands, which is
  // the reading that makes "1,200" mean 1200 rather than 1.2.
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    body = body.replace(new RegExp(`\\${decimal === "," ? "." : ","}`, "g"), "");
    body = body.replace(decimal, ".");
  } else if (lastComma !== -1) {
    body = body.replace(/,/g, "");
  }

  const n = Number(body) * suffix;
  if (!Number.isFinite(n) || n < 0) return null;
  // Cap well above any plausible figure so a typo cannot overflow bigint.
  if (n > 1e12) return null;
  return Math.round(n * 100);
}

/** `<input type="month">` gives "2024-03"; the column is a date. */
export function monthToDate(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}$/.test(v.trim())) return null;
  return `${v.trim()}-01`;
}

export function dateToMonth(v: string | null): string {
  return v && /^\d{4}-\d{2}/.test(v) ? v.slice(0, 7) : "";
}

/** Minor units back to a plain euro figure for re-populating the form. */
export function euros(v: bigint | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(Number(v) / 100);
}

/**
 * What a submitted application must contain.
 *
 * Deliberately short. Risk class is optional — a pre-seed startup that has not
 * classified its device yet is precisely the applicant this programme is for,
 * and demanding a class would filter out the target audience. Money fields
 * accept zero, which is a meaningful answer here rather than a missing one.
 */
export function missingFields(a: StartupApplication): string[] {
  const missing: string[] = [];
  if (!a.legal_name) missing.push("legal name");
  if (!a.country) missing.push("country");
  if (!a.founded_on) missing.push("founded");
  if (a.employees === null) missing.push("employees");
  if (!a.device_summary) missing.push("what you're building");
  if (!a.regulation) missing.push("MDR or IVDR");
  if (a.funding_dilutive_eur === null) missing.push("dilutive funding");
  if (a.funding_non_dilutive_eur === null) missing.push("non-dilutive funding");
  if (a.revenue_12m_eur === null) missing.push("revenue");
  if (!a.why_blocked) missing.push("why CE marking is out of reach");
  if (!a.declared) missing.push("the declaration");
  return missing;
}
