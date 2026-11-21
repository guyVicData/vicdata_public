import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { timingSafeEqual, sha256Hex, PREVIEW_GATE_COOKIE } from "@/lib/timing-safe";
import { isPreviewGroup, previewGroupEmail, seedPreviewGroup } from "@/lib/testing-group";
import { applySessionCookies, routeSessionClient } from "@/lib/auth-server";

// Passwordless preview access for automated browser agents
// (docs/vicdata_phase3_agent_preview_access_brief_v1.md).
//
// Why this exists: the deployed site sits behind a Basic Auth gate AND real Supabase
// sign-in, and both require typing a credential into a field -- which Claude will not do,
// whoever authorises it. That is a boundary, not a permissions gap, so the fix removes the
// credential-entry step rather than working around the refusal: navigating to a URL is an
// ordinary action, in the same category as a password-reset link.
//
// HOW IT SIGNS IN (since 0.8 front door part 3, milestone 1: cookie sessions): it asks the Supabase Admin
// API for a REAL magic link for the fixed preview account and redeems it on the server with Supabase's own
// verifyOtp, over a server client that writes the session to this response's cookies -- the app's ordinary
// session cookie, the one a password sign-in makes. Nothing bespoke is minted, stored or maintained here,
// and no new auth path exists for real users. (Before cookie sessions the session lived in localStorage, so
// the route had to bounce the browser through the link and let the browser client read the tokens from the
// URL fragment; see git history.)
//
// Fails closed exactly like the gate it bypasses: if any of the four env vars is missing,
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

// 0.8 View as: the starter school's membership, granted only to a preview profile with none (below).
// It replaces the retired testing switcher's grant (src/lib/testing-membership.ts, gone), which DELETED
// the caller's memberships and personal saved sets to "switch" school; this only ever adds: View as is
// the way to see another school. Service role: a plain member can't self-approve.
async function grantStarterMembership(admin: SupabaseClient, profileId: string, urn: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let { data: account } = await admin.from("school_accounts").select("id, account_holder_membership_id").eq("school_urn", urn).maybeSingle<{ id: string; account_holder_membership_id: string | null }>();
  if (!account) {
    const { data, error } = await admin.from("school_accounts").insert({ school_urn: urn, tier: "individual" }).select("id, account_holder_membership_id").single<{ id: string; account_holder_membership_id: string | null }>();
    if (error || !data) return { ok: false, error: "Could not create a school account for this school" };
    account = data;
  }
  const { data: membership, error } = await admin
    .from("school_memberships")
    .insert({ school_account_id: account.id, profile_id: profileId, status: "approved", is_admin: true, approved_at: new Date().toISOString() })
    .select("id")
    .single<{ id: string }>();
  if (error || !membership) return { ok: false, error: "Could not create a membership for this school" };
  if (!account.account_holder_membership_id) await admin.from("school_accounts").update({ account_holder_membership_id: membership.id }).eq("id", account.id);
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const enabled = process.env.PREVIEW_ACCESS_ENABLED === "true";
  const expectedToken = process.env.PREVIEW_ACCESS_TOKEN;
  const previewEmail = process.env.PREVIEW_ACCESS_EMAIL;
  const siteUrl = process.env.PREVIEW_ACCESS_SITE_URL;
  if (!enabled || !expectedToken || !previewEmail || !siteUrl) return notFound();

  const token = request.nextUrl.searchParams.get("token");
  if (!token || !timingSafeEqual(token, expectedToken)) return notFound();

  // Only ever a path on this origin. An open redirect here would be handed a valid gate
  // cookie on the way out, so the check is not cosmetic: reject anything that could be
  // read as absolute or protocol-relative.
  // 0.8 groups r1 (G6): ?group=harris|dukes signs in that group's own preview head-office user instead
  // (no school membership: its home is the group's), with the test group account seeded.
  const groupParam = request.nextUrl.searchParams.get("group");
  if (groupParam !== null && !isPreviewGroup(groupParam)) return notFound();
  const group = isPreviewGroup(groupParam) ? groupParam : null;
  const signInEmail = group ? previewGroupEmail(previewEmail, group) : previewEmail;

  const requested = request.nextUrl.searchParams.get("redirect");
  const redirectPath = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : group ? "/teacher/group" : "/teacher";

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
  userId = list.users.find((u) => u.email?.toLowerCase() === signInEmail.toLowerCase())?.id ?? null;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: signInEmail,
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
  // back to the starter school. Another school is reached through View as (0.8).
  if (group) {
    const seeded = await seedPreviewGroup(admin, userId, group);
    if (!seeded.ok) {
      console.error("[preview-session] group seed failed:", seeded.error);
      return notFound();
    }
  }
  if (!group) {
    const { data: existing } = await admin
      .from("school_memberships")
      .select("id")
      .eq("profile_id", userId)
      .limit(1);
    // 0.8 View as fixes: never to a platform admin, who needs no membership (View as reaches any school).
    const { data: admin0 } = await admin.from("platform_admins").select("profile_id").eq("profile_id", userId).maybeSingle();
    if ((!existing || existing.length === 0) && !admin0) {
      const granted = await grantStarterMembership(admin, userId, PREVIEW_STARTER_URN);
      if (!granted.ok) console.error("[preview-session] starter membership failed:", granted.error);
    }
  }

  // A real magic link, verified HERE (0.8 front door part 3, milestone 1: cookie sessions). The Admin API
  // makes the one-time token; this route redeems it with Supabase's own verifyOtp on a server client over
  // this response's cookies, so the browser is handed an ordinary signed-in session cookie on the
  // redirect -- the same session a password sign-in makes, through the app's own session code
  // (src/lib/auth-server.ts). Before cookie sessions the browser had to redeem the link itself (the
  // session lived in localStorage); that hop through Supabase is gone, and with it the need for the
  // redirect target to be on the project's Auth redirect allow-list (the bug described below). The
  // redirect goes to PREVIEW_ACCESS_SITE_URL's origin, never the request's (also below).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: signInEmail });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("[preview-session] could not generate sign-in link:", linkError?.message);
    return notFound();
  }
  const { supabase: sessionClient, pending } = routeSessionClient(request);
  const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (verifyError || !verified.session) {
    console.error("[preview-session] could not redeem the sign-in link:", verifyError?.message);
    return notFound();
  }

  // Why the origin is PREVIEW_ACCESS_SITE_URL, NOT the incoming request's -- a real production bug, and
  // one local testing structurally could not catch: on localhost, request.nextUrl.origin is correct, so
  // dev never disagreed with it. On the real deployment (Render behind Cloudflare) it resolved to
  // http://localhost:3000 -- the container's own internal address. Deliberately NOT read from
  // x-forwarded-host/x-forwarded-proto either: this feature trusts nothing the caller or the platform
  // hands it that it does not have to. (Until milestone 1 the same value was the magic link's redirect_to,
  // which Supabase silently swapped for the project's Site URL when it wasn't on the allow-list; the
  // route refused such a link. With the link redeemed here, that check has nothing left to guard.)
  const origin = siteUrl.replace(/\/+$/, "");
  const response = applySessionCookies(NextResponse.redirect(`${origin}${redirectPath}`, { status: 302 }), pending);
  response.cookies.set(PREVIEW_GATE_COOKIE, await sha256Hex(expectedToken), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

