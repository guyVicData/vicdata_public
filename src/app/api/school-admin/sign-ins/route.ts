import { NextRequest, NextResponse } from "next/server";
import { resolveCaller } from "@/lib/view-as-server";
import { readSchoolSignins } from "@/lib/school-admin/signins-server";
import { deviceStore } from "@/lib/devices/http";
import { isSignedIn } from "@/lib/devices/core";
import { signOutDevices } from "@/lib/devices/service";
import { forgetSessions } from "@/lib/devices/gate";

// VicData 0.8 front door, part 3 (F27, E24): the School-Admin's Sign-ins and devices.
//   GET ?urn=                        each of the school's staff with the devices they're signed in on now, last
//                                    active, and a flag when their account was used from more than 4 places in 24
//                                    hours (flagged first); the counts for the account page's row
//   POST { urn, profileId }          signs that person out of every device (reason "admin")
// For the school's School-Admin or account holder (or a platform admin's View as / peek of one: read-only, and the
// POST is refused). The read is the caller's own client (RLS: R-SIGNINS-RLS); the sign-out is the service role,
// after checking the person is approved staff at this very school.
export const dynamic = "force-dynamic";

const REFUSAL = "Sign-ins and devices is for the School-Admin.";

export async function GET(request: NextRequest) {
  const c = await resolveCaller(request, request.nextUrl.searchParams.get("urn"), { allowed: (r) => r.isAdmin || r.isAccountHolder, refusal: REFUSAL });
  if (c instanceof NextResponse) return c;
  if (!c.isAdmin && !c.isAccountHolder) return NextResponse.json({ error: REFUSAL }, { status: 403 });
  try {
    const { data: acc } = await c.reader.from("school_accounts").select("id").eq("school_urn", c.urn).maybeSingle<{ id: string }>();
    if (!acc) return NextResponse.json({ readOnly: c.readOnly, notSetUp: false, people: [], devices: 0, flags: 0 });
    const r = await readSchoolSignins(c.reader, { schoolAccountId: acc.id, now: new Date() });
    return NextResponse.json({ readOnly: c.readOnly, notSetUp: r.notSetUp, ...(r.view ?? { people: [], devices: 0, flags: 0 }) });
  } catch (err) {
    console.error("[school-admin/sign-ins] failed:", err);
    return NextResponse.json({ error: "Could not read your school's sign-ins." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { urn?: unknown; profileId?: unknown };
  const urn = typeof body.urn === "string" ? body.urn : null;
  const c = await resolveCaller(request, urn, { allowed: (r) => r.isAdmin || r.isAccountHolder, refusal: REFUSAL });
  if (c instanceof NextResponse) return c;
  if (!c.isAdmin && !c.isAccountHolder) return NextResponse.json({ error: REFUSAL }, { status: 403 });
  if (c.readOnly) return NextResponse.json({ error: "View as is read-only: nobody is signed out." }, { status: 403 });
  if (typeof body.profileId !== "string") return NextResponse.json({ error: "Who?" }, { status: 400 });
  try {
    const { data: staff } = await c.reader
      .from("school_memberships")
      .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
      .eq("profile_id", body.profileId)
      .eq("status", "approved")
      .eq("school_accounts.school_urn", c.urn)
      .limit(1)
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: "That person isn't on your school's staff." }, { status: 404 });
    const store = deviceStore();
    const devices = (await store.devicesOf(body.profileId)).filter(isSignedIn);
    forgetSessions(await signOutDevices(store, devices, "admin", new Date()));
    return NextResponse.json({ ok: true, signedOut: devices.length });
  } catch (err) {
    console.error("[school-admin/sign-ins] sign-out failed:", err);
    return NextResponse.json({ error: "Could not sign them out. Try again." }, { status: 502 });
  }
}
