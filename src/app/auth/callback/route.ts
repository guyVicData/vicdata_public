import { NextResponse, type NextRequest } from "next/server";
import { applySessionCookies, routeSessionClient } from "@/lib/auth-server";

// 0.8 front door part 3 (A1): the auth callback, open signed out. An email link from Supabase Auth (PKCE:
// `?code=…`) is exchanged for the cookie session here and the browser goes on to `next` (a path on this
// site only) or home. A bad or used link goes to sign-in. The code verifier is the browser's own cookie, set
// when it asked for the email, so a link opened in another browser can't be redeemed.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const path = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/member";
  if (!code) return to("/login");
  const { supabase, pending } = routeSessionClient(request);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return to("/login");
  return applySessionCookies(to(path), pending);
}

// A relative Location: behind Render and Cloudflare the request's own origin is the container's address
// (the preview route's lesson), and the browser resolves a path against the address it asked for.
function to(path: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: path } });
}
