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

// ---------------------------------------------------------------------------
// The agent add-on.
//
// Deliberately NOT a Tier. A Tier grants a `plan`, carries payment options, and
// appears on /pricing as a way to buy access to Regulatory Sidekick. The add-on
// grants an ENTITLEMENT to a workspace that already has a licence, renews
// monthly, and is only ever sold from the Agent page. Modelling it as a fourth
// tier would put it in TIERS — and every loop over TIERS (the pricing page, the
// tier picker) would have to remember to skip it. One that forgot would offer
// an unlicensed visitor a subscription that grants them nothing.
// ---------------------------------------------------------------------------

export const AGENT_SUBSCRIPTION = {
  id: "agent" as const,
  label: "Agent access",
  /** Copy only, like the tier headlines above — Stripe is what charges. */
  headline: "€150 / month",
  envVar: "STRIPE_PRICE_AGENT_MONTHLY",
  /**
   * What the customer still needs beyond this, said before checkout rather
   * than after. Discovering it afterwards is the refund conversation.
   */
  requires: [
    "A Regulatory Sidekick licence (full access) — this is an add-on, not a substitute.",
    "Your own Claude subscription, or another MCP-capable assistant. We do not resell model access.",
  ],
} as const;

export function agentPriceId(): string | null {
  return process.env[AGENT_SUBSCRIPTION.envVar]?.trim() || null;
}

/** False until a monthly price exists in Stripe — the Agent page says so. */
export function isAgentBuyable(): boolean {
  return agentPriceId() !== null;
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
