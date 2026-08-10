import { randomBytes } from "crypto";

// The ONE place raw access codes are generated. Both the platform-admin mint
// (lib/admin/actions.ts) and the partner mint (0015 partner_mint_codes) use it,
// so the format can never drift between the two paths.
//
// 15 random bytes -> 20 base64url chars, ~120 bits. The "RS-" prefix is purely
// so a code is recognisable when someone pastes one into a support thread.
//
// The HASH is what identifies a code (access_codes.code_hash); the raw value is
// also stored (migration 0005) so a batch stays re-exportable. That is
// deliberate — a code is a revocable grant token behind an RLS wall, not a
// secret like a password.
export function generateCode(): string {
  return "RS-" + randomBytes(15).toString("base64url");
}

export function generateCodes(n: number): string[] {
  return Array.from({ length: n }, generateCode);
}
