// Shared constant-time string comparison.
//
// Factored out of src/proxy.ts rather than copied: the old Basic Auth gate (gone since the 0.8
// private-beta gate) and the preview-session route both compared a caller-supplied secret against an env var, and two hand-rolled
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

// SHA-256 as lowercase hex, with crypto.subtle (no node:crypto), so the same helper serves any runtime.
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
