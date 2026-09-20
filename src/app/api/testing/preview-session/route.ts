import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { timingSafeEqual, sha256Hex, PREVIEW_GATE_COOKIE } from "@/lib/timing-safe";
import { grantApprovedMembership } from "@/lib/testing-membership";

// Passwordless preview access for automated browser agents
// (docs/vicdata_phase3_agent_preview_access_brief_v1.md).
//
// Why this exists: the deployed site sits behind a Basic Auth gate AND real Supabase
// sign-in, and both require typing a credential into a field -- which Claude will not do,
// whoever authorises it. That is a boundary, not a permissions gap, so the fix removes the
// credential-entry step rather than working around the refusal: navigating to a URL is an
// ordinary action, in the same category as a password-reset link.
//
// HOW THIS ADAPTS TO THE APP'S REAL SIGN-IN, which is not what the brief assumed:
//
// The brief suggests generating a magic link and "redirecting into the app's existing
// callback handler". There isn't one. This app's only sign-in is
// supabase.auth.signInWithPassword in src/app/login/page.tsx, and -- more decisively -- it
// uses plain @supabase/supabase-js, NOT @supabase/ssr, so sessions live in localStorage
// and not in cookies. A server route therefore cannot establish a browser session by
// setting a cookie, however it is shaped; that rules out the obvious implementation
// rather than merely making it awkward.
//
// What it does instead is still the app's own mechanism, not a parallel one:
// supabase-js creates its browser client with detectSessionInUrl defaulting to true, so a
// client that loads on a URL carrying auth tokens in the fragment completes sign-in and
// persists a completely ordinary session itself. So this route asks the Supabase Admin API
// for a REAL magic link and redirects the browser to it; Supabase verifies the one-time
// token and bounces back to our origin with the tokens in the fragment, where the app's
// existing browser client picks them up. Nothing bespoke is minted, stored or maintained
// here, and no new auth path exists for real users.
//
// A consequence worth stating: the fragment never reaches this server, which is why the
// gate cookie has to be set on the redirect BEFORE handing off to Supabase.
//
// Fails closed exactly like the gate it bypasses: if any of the three env vars is missing,
// this route does not exist.
export const dynamic = "force-dynamic";

// The starter school. A real, open school with real KS4 and KS5 data, so the Teacher view
// has genuine figures on first load rather than an empty state that looks like a bug.
const PREVIEW_STARTER_URN = "100053";

// Every failure returns this, byte for byte. A 404 that varies with the reason would tell
// a prober whether the feature is enabled and whether their token was merely wrong, which
// is the one thing an unauthenticated caller must not be able to learn.
function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(request: NextRequest) {
  const enabled = process.env.PREVIEW_ACCESS_ENABLED === "true";
  const expectedToken = process.env.PREVIEW_ACCESS_TOKEN;
  const previewEmail = process.env.PREVIEW_ACCESS_EMAIL;
  if (!enabled || !expectedToken || !previewEmail) return notFound();

  const token = request.nextUrl.searchParams.get("token");
  if (!token || !timingSafeEqual(token, expectedToken)) return notFound();

  // Only ever a path on this origin. An open redirect here would be handed a valid gate
  // cookie on the way out, so the check is not cosmetic: reject anything that could be
  // read as absolute or protocol-relative.
  const requested = request.nextUrl.searchParams.get("redirect");
  const redirectPath = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/teacher";

  const admin = createServiceRoleSupabaseClient();

  // Resolve the preview profile. Created here if absent, deliberately with no password --
  // a password would be a credential that could be typed somewhere, which is the exact
  // thing this whole feature exists to avoid.
  let userId: string | null = null;
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("[preview-session] could not list users:", listError.message);
    return notFound();
  }
  userId = list.users.find((u) => u.email?.toLowerCase() === previewEmail.toLowerCase())?.id ?? null;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: previewEmail,
      email_confirm: true,
    });
    if (createError || !created.user) {
      console.error("[preview-session] could not create preview profile:", createError?.message);
      return notFound();
    }
    userId = created.user.id;
  }

  // A starter school so /teacher has something real to show on arrival. Only granted when
  // this profile has no membership at all -- otherwise every visit would yank the account
  // back to the starter school and break the school-switcher's whole purpose.
  const { data: existing } = await admin
    .from("school_memberships")
    .select("id")
    .eq("profile_id", userId)
    .limit(1);
  if (!existing || existing.length === 0) {
    const granted = await grantApprovedMembership(admin, userId, PREVIEW_STARTER_URN);
    if (!granted.ok) console.error("[preview-session] starter membership failed:", granted.error);
  }

  // A real magic link, verified by Supabase itself. redirectTo must be registered in the
  // project's Auth redirect allow-list or Supabase refuses it.
  const origin = request.nextUrl.origin;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: previewEmail,
    options: { redirectTo: `${origin}${redirectPath}` },
  });
  if (linkError || !link.properties?.action_link) {
    console.error("[preview-session] could not generate sign-in link:", linkError?.message);
    return notFound();
  }

  const response = NextResponse.redirect(link.properties.action_link, { status: 302 });
  response.cookies.set(PREVIEW_GATE_COOKIE, await sha256Hex(expectedToken), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

