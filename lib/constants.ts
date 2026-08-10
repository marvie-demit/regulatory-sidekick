// Active-organization selector cookie. It's only a selector — membership is
// re-validated server-side on every request (RLS is the real boundary).
export const ACTIVE_ORG_COOKIE = "nja_active_org";

// Set when a logged-out user opens an invite link; read by the app layout so a
// freshly signed-up invitee joins the org instead of being sent to onboarding.
export const PENDING_INVITE_COOKIE = "nja_pending_invite";

// Set when a logged-out user opens a redeem link; the app applies the code once
// they have an account + organization (survives sign-up → confirm → onboarding).
export const PENDING_REDEEM_COOKIE = "nja_pending_redeem";

// Active-partner selector, for staff who belong to more than one partner. Same
// contract as ACTIVE_ORG_COOKIE: a selector only — partner membership is
// re-validated server-side on every request, and RLS is the real boundary.
export const ACTIVE_PARTNER_COOKIE = "nja_active_partner";

// Set when a logged-out user opens a partner staff invite link.
export const PENDING_PARTNER_INVITE_COOKIE = "nja_pending_partner_invite";
