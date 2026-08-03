// The sellable catalogue — the single source of truth for what can be bought,
// what it grants, and which Stripe Price backs it.
//
// Prices live in Stripe (amounts, currency, tax behaviour) and are referenced
// here only by env var. The euro figures below are for COPY ONLY: they render
// the card, they never drive a charge. If Stripe and this file disagree the
// customer is charged what Stripe says — so keep them in sync, but know that a
// stale number here is a copy bug, not a billing bug.

import type { OrgPlan } from "@/lib/auth/access";

export type TierId = "practitioner" | "standard";
export type PaymentOptionId = "once" | "x3" | "x6";

export type PaymentOption = {
  id: PaymentOptionId;
  label: string;
  // Env var holding the Stripe Price id. Absent/blank -> the option is simply
  // not offered, so instalments can be switched on later by adding a price
  // in Stripe and setting one variable. No code change, no redeploy of logic.
  envVar: string;
  // null = single payment. A number = collect exactly that many monthly
  // charges, then cancel the subscription (see the webhook — Stripe Checkout
  // has no native "stop after N", so we count invoices and end it ourselves).
  installments: number | null;
};

export type Tier = {
  id: TierId;
  label: string;
  plan: Extract<OrgPlan, "full">;
  // Copy only — see the note above.
  headline: string;
  options: PaymentOption[];
  // Practitioner is the discounted price, so it carries the §6 self-declaration.
  requiresEligibility: boolean;
};

// The structural gate that replaces "by application" (BUSINESS-MODEL.md §6).
// Self-declared, auditable, and enforceable through the licence terms — which
// is what lets Practitioner self-serve instead of being adjudicated deal by
// deal. Stored verbatim on the purchase row.
export const ELIGIBILITY_STATEMENT =
  "I confirm this organisation has under €1M annual revenue and 10 or fewer " +
  "employees, and that Practitioner access will be used for our own single " +
  "device family by at most 3 users. I understand a false declaration is a " +
  "breach of the licence, payable at the difference to the Standard price.";

export const TIERS: Tier[] = [
  {
    id: "practitioner",
    label: "Practitioner",
    plan: "full",
    headline: "€1,800",
    requiresEligibility: true,
    options: [
      { id: "once", label: "€1,800 once", envVar: "STRIPE_PRICE_PRACTITIONER", installments: null },
      { id: "x3", label: "€600 × 3 months", envVar: "STRIPE_PRICE_PRACTITIONER_3X", installments: 3 },
      { id: "x6", label: "€300 × 6 months", envVar: "STRIPE_PRICE_PRACTITIONER_6X", installments: 6 },
    ],
  },
  {
    id: "standard",
    label: "Standard",
    plan: "full",
    headline: "€6,000",
    requiresEligibility: false,
    options: [
      { id: "once", label: "€6,000 once", envVar: "STRIPE_PRICE_STANDARD", installments: null },
      { id: "x3", label: "€2,000 × 3 months", envVar: "STRIPE_PRICE_STANDARD_3X", installments: 3 },
      { id: "x6", label: "€1,000 × 6 months", envVar: "STRIPE_PRICE_STANDARD_6X", installments: 6 },
    ],
  },
];

export function getTier(id: string): Tier | null {
  return TIERS.find((t) => t.id === id) ?? null;
}

export function priceIdFor(option: PaymentOption): string | null {
  return process.env[option.envVar]?.trim() || null;
}

// Only the options that actually have a Stripe Price configured. An instalment
// plan advertised in the UI but missing in Stripe would be a dead button, so
// the UI is driven by what is genuinely purchasable right now.
export function offeredOptions(tier: Tier): PaymentOption[] {
  return tier.options.filter((o) => priceIdFor(o) !== null);
}

// A tier is buyable when at least one of its options has a price.
export function isBuyable(tier: Tier): boolean {
  return offeredOptions(tier).length > 0;
}
