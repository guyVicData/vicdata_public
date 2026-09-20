// Shared constant-time string comparison.
//
// Factored out of src/proxy.ts rather than copied: the access gate and the preview-session
// route now both compare a caller-supplied secret against an env var, and two hand-rolled
// copies of a security primitive is exactly the kind of duplication that drifts -- one
// gets an early return added "for clarity" and quietly becomes variable-time.
//
// Node's own crypto.timingSafeEqual is deliberately not used: proxy.ts runs in the edge
// runtime, where the node:crypto import is not available. This is the same character-wise
// XOR accumulation that was already in proxy.ts, unchanged in behaviour.
//
// The length check short-circuits, so this leaks the LENGTH of the expected value but not
// its contents -- the standard, accepted trade-off for this construction, and unchanged
// from the original.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// The gate-bypass cookie carries a SHA-256 of the preview token, never the token itself.
//
// Why not just store the token: the cookie only needs to satisfy the Basic Auth gate,
// whereas the token also mints real sessions. Storing a derived value means a stolen
// cookie can get past the gate but cannot call preview-session to sign in as anyone --
// strictly less to lose, for one cheap hash.
//
// Async because this runs in the edge runtime, where crypto.subtle is the only hashing
// primitive available.
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Named here rather than in proxy.ts so the route that SETS the cookie and the gate that
// READS it cannot disagree about the name.
export const PREVIEW_GATE_COOKIE = "vicdata_preview_gate";
