import { NextRequest, NextResponse } from "next/server";
import { userFrom } from "@/lib/groups/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase";
import { isPlatformAdmin } from "@/lib/view-as";
import { PLACES_ALERT } from "@/lib/devices/config";
import { flaggedAccounts, isSignedIn } from "@/lib/devices/core";
import { deviceStore } from "@/lib/devices/http";
import { signOutDevices } from "@/lib/devices/service";
import { forgetSessions } from "@/lib/devices/gate";

// VicData 0.8 front door, part 3 (E24): the quiet alert. Accounts used from more than 4 places in 24 hours, for the
// Platform page (no email is sent). Platform admins only (anyone else: "not found", as the page itself).
//   GET                         the flagged accounts: who, their schools, the places, devices signed in now
//   POST { profileId }          signs that account out of every device (reason "platform")
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
const missing = (m?: string) => /does not exist|schema cache|account_sign_ins|account_devices/i.test(m ?? "");

export async function GET(request: NextRequest) {
  try {
    const u = await userFrom(request);
    if (u instanceof NextResponse || !(await isPlatformAdmin(u.supabase))) return notFound();
    const sb = createServiceRoleSupabaseClient();
    const now = new Date();
    const since = new Date(now.getTime() - PLACES_ALERT.hours * 3_600_000).toISOString();
    const { data: events, error } = await sb.from("account_sign_ins").select("profile_id, place, at").gte("at", since).limit(20000);
    if (error) return missing(error.message) ? NextResponse.json({ notSetUp: true, flags: [] }) : NextResponse.json({ error: "Could not read sign-ins." }, { status: 502 });
    const flags = flaggedAccounts((events ?? []) as { profile_id: string; place: string | null; at: string }[], now);
    if (!flags.length) return NextResponse.json({ notSetUp: false, flags: [], rule: PLACES_ALERT });
    const ids = flags.map((f) => f.profileId);
    const [{ data: profiles }, { data: members }, { data: devices }] = await Promise.all([
      sb.from("profiles").select("id, email, full_name").in("id", ids),
      sb.from("school_memberships").select("profile_id, school_accounts!school_memberships_school_account_id_fkey(school_urn, schools(current_name))").in("profile_id", ids).eq("status", "approved"),
      sb.from("account_devices").select("profile_id").in("profile_id", ids).not("signed_in_at", "is", null).is("signed_out_at", null),
    ]);
    type M = { profile_id: string; school_accounts: { school_urn: string; schools: { current_name: string } | null } | null };
    return NextResponse.json({
      notSetUp: false,
      rule: PLACES_ALERT,
      flags: flags.map((f) => {
        const p = ((profiles ?? []) as { id: string; email: string | null; full_name: string | null }[]).find((x) => x.id === f.profileId);
        return {
          profileId: f.profileId,
          name: p?.full_name || p?.email || f.profileId,
          email: p?.email ?? null,
          schools: ((members ?? []) as unknown as M[]).filter((m) => m.profile_id === f.profileId).map((m) => m.school_accounts?.schools?.current_name ?? m.school_accounts?.school_urn ?? "—"),
          places: f.places,
          devices: ((devices ?? []) as { profile_id: string }[]).filter((d) => d.profile_id === f.profileId).length,
        };
      }),
    });
  } catch (err) {
    console.error("[platform/sign-in-flags] failed:", err);
    return NextResponse.json({ error: "Could not read sign-ins." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const u = await userFrom(request);
    if (u instanceof NextResponse || !(await isPlatformAdmin(u.supabase))) return notFound();
    const body = (await request.json().catch(() => ({}))) as { profileId?: unknown };
    if (typeof body.profileId !== "string") return NextResponse.json({ error: "Who?" }, { status: 400 });
    const store = deviceStore();
    const devices = (await store.devicesOf(body.profileId)).filter(isSignedIn);
    forgetSessions(await signOutDevices(store, devices, "platform", new Date()));
    return NextResponse.json({ ok: true, signedOut: devices.length });
  } catch (err) {
    console.error("[platform/sign-in-flags] sign-out failed:", err);
    return NextResponse.json({ error: "Could not sign them out." }, { status: 502 });
  }
}
