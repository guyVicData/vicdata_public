import { NextResponse, type NextRequest } from "next/server";
import { resendDeviceCode } from "@/lib/devices/service";
import { envMailer } from "@/lib/devices/mailer";
import { callerOf, deviceStore, deviceTokenOf } from "@/lib/devices/http";

// 0.8 front door part 3 (E24): "Send a new code" -- not within a minute of the last, nor more than five an hour.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const caller = await callerOf(request);
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const r = await resendDeviceCode(deviceStore(), envMailer(), { ...caller, token: deviceTokenOf(request), now: new Date() });
    return NextResponse.json(r, { status: r.ok ? 200 : 429 });
  } catch (e) {
    console.error("[auth/device/resend] failed:", (e as Error).message);
    return NextResponse.json({ ok: false, message: "We couldn't send a code just now. Try again in a minute." }, { status: 502 });
  }
}
