import { NextResponse, type NextRequest } from "next/server";
import { placeFrom } from "@/lib/devices/place";
import { verifyDeviceCode } from "@/lib/devices/service";
import { callerOf, deviceStore, deviceTokenOf, setNotice } from "@/lib/devices/http";
import { forgetSessions } from "@/lib/devices/gate";

// 0.8 front door part 3 (E24, R-DEVICE-CODES): the 6-digit code for a device VicData hasn't seen. Right: the device
// is trusted for 60 days and signed in (the cap may sign out the oldest). Wrong: a try is used (5 in all).
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const caller = await callerOf(request);
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  try {
    const r = await verifyDeviceCode(deviceStore(), { ...caller, token: deviceTokenOf(request), code, place: placeFrom(request.headers), now: new Date() });
    forgetSessions([caller.sessionId]);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.message, attemptsLeft: r.attemptsLeft }, { status: 400 });
    return setNotice(NextResponse.json({ ok: true }), r.notice);
  } catch (e) {
    console.error("[auth/device/code] failed:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "VicData couldn't check the code. Try again in a minute." }, { status: 502 });
  }
}
