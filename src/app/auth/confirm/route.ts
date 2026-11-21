import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { applySessionCookies, routeSessionClient } from "@/lib/auth-server";
import { confirmDestination } from "@/lib/password-reset";

// 0.8 front door part 3 (A1, R-PASSWORD-RESET): an email link redeemed on the server. The reset email's template can
// link here -- {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password -- and then
// the link works in ANY browser (a PKCE ?code= link works only in the browser that asked, which holds the code
// verifier: a teacher who asks on a laptop and opens the email on a phone). The session goes into this response's
// cookies; the browser goes on to a path on this site. A bad or used link goes to the reset page saying so.
export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["recovery", "email", "magiclink", "signup", "invite", "email_change"];

// A relative Location: behind Render and Cloudflare the request's own origin is the container's address.
const to = (path: string) => new NextResponse(null, { status: 302, headers: { Location: path } });

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  if (!token_hash || !type || !TYPES.includes(type)) return to("/reset-password?error=access_denied&error_code=otp_invalid");
  const { supabase, pending } = routeSessionClient(request);
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return to(`/reset-password?error=access_denied&error_code=${encodeURIComponent(error.code ?? "otp_expired")}`);
  return applySessionCookies(to(confirmDestination(type, sp.get("next"))), pending);
}
