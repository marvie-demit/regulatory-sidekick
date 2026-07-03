// Client-safe device-profile scoping — the SINGLE source of truth for "does
// this activity/document apply to this org's device?". Two independent axes:
//
//   • regulation (reg): "MDR" | "IVDR" — the EU route, MUTUALLY EXCLUSIVE.
//     [] = common to all routes. This is what makes Clinical Evaluation (MDR)
//     and Performance Evaluation (IVDR) show for one route, never both.
//   • device characteristics (mods): SW/AI/IVD/HW/SEC/PRIV + the FDA market.
//     "Core" (or no mods) = applies to everyone.
//
// An item is in scope when BOTH axes match. Regulation is derived from the
// profile's chosen route (an IVD device ⇒ IVDR).

export type ScopeProfile = Record<string, number> | null | undefined;

// The EU regulatory route the profile has chosen (IVD ⇒ IVDR).
export function euRoute(prof: ScopeProfile): "MDR" | "IVDR" | null {
  if (!prof) return null;
  if (prof.MDR) return "MDR";
  if (prof.IVDR || prof.IVD) return "IVDR";
  return null;
}

function regInScope(reg: string[] | undefined, prof: ScopeProfile): boolean {
  if (!prof) return true;
  if (!reg || reg.length === 0) return true; // common to every route
  const route = euRoute(prof);
  if (route) return reg.includes(route); // an EU route is chosen → only its regulation
  if (prof.FDA) return false; // US-only profile → hide EU (MDR/IVDR)-specific content
  return true; // no route/market chosen → unfiltered (back-compat)
}

function modsInScope(mods: string[] | undefined, prof: ScopeProfile): boolean {
  if (!prof) return true;
  if (!mods || mods.length === 0 || mods.indexOf("Core") >= 0) return true;
  return mods.some((mod) => !!prof[mod]);
}

export function actInScope(
  a: { mods?: string[]; reg?: string[] },
  prof: ScopeProfile,
): boolean {
  return regInScope(a.reg, prof) && modsInScope(a.mods, prof);
}

export function docInScope(
  d: { module?: string; reg?: string[] },
  prof: ScopeProfile,
): boolean {
  const modOk = !prof || d.module === "Core" || !!prof[d.module ?? ""];
  return regInScope(d.reg, prof) && modOk;
}
