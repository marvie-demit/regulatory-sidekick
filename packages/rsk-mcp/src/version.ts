/**
 * Compare dotted numeric versions. -1 if a < b, 0 if equal, 1 if a > b.
 *
 * Its own module, with no imports, for a practical reason: the tests run under
 * Node's type-stripping, which does not support TypeScript parameter properties
 * — and client.ts uses them in RskError's constructor. Anything that reaches
 * client.ts transitively cannot be unit-tested here, and the function deciding
 * whether a client may run at all should be the easiest thing in the package to
 * test.
 *
 * Deliberately not semver-aware: these are our own release numbers, and a
 * dependency for "is 0.1.0 older than 0.2.0" is not worth the supply chain on a
 * machine inside a manufacturer's network. A non-numeric segment sorts as 0, so
 * a pre-release tag reads as its base version rather than throwing — being
 * wrong by a hair beats refusing to run.
 */
export function cmpVersion(a: string, b: string): number {
  // Cut any pre-release or build suffix BEFORE splitting on dots. Splitting
  // first turns "0.2.0-beta.1" into ["0","2","0-beta","1"], which gains a
  // fourth segment and sorts the beta as NEWER than the 0.2.0 it precedes —
  // so a pre-release would never warn, and would pass a `minimum` check it
  // should fail. That is the wrong direction for a kill switch.
  const parts = (v: string) =>
    v.split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
