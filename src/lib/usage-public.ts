// VicData 0.8 shell + SMT r1, B7 step 2: the public school page's daily count. Server-only (the proxy).
// The public school page: /schools/<urn>, counted in the proxy (src/proxy.ts) so the page itself
// is untouched. A plain RPC call, not supabase-js, to keep the proxy light. Not counted: prefetches
// and anything that says it's a bot. Nothing about the visitor is sent or kept.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python-requests/i;

export function publicPageUrn(pathname: string): string | null {
  const m = /^\/schools\/(\d{5,7})\/?$/.exec(pathname);
  return m ? m[1] : null;
}

export function countablePublicView(method: string, headers: Headers): boolean {
  if (method !== "GET") return false;
  if (headers.get("next-router-prefetch") || headers.get("purpose") === "prefetch" || headers.get("sec-purpose")?.includes("prefetch")) return false;
  return !BOT.test(headers.get("user-agent") ?? "");
}

export async function countPublicPageView(urn: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/rpc/count_public_page_view`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_urn: urn }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // As above.
  }
}
