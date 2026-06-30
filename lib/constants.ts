// Active-organization selector cookie. It's only a selector — membership is
// re-validated server-side on every request (RLS is the real boundary).
export const ACTIVE_ORG_COOKIE = "nja_active_org";

// Set when a logged-out user opens an invite link; read by the app layout so a
// freshly signed-up invitee joins the org instead of being sent to onboarding.
export const PENDING_INVITE_COOKIE = "nja_pending_invite";
