import { NextResponse, type NextRequest } from "next/server";
import { deviceCodesOn } from "@/lib/devices/config";
import { placeFrom } from "@/lib/devices/place";
import { registerSignIn } from "@/lib/devices/service";
import { envMailer } from "@/lib/devices/mailer";
import { callerOf, deviceStore, deviceTokenOf, setDeviceCookie, setNotice } from "@/lib/devices/http";
import { forgetSessions } from "@/lib/devices/gate";

// 0.8 front door part 3 (E24): a sign-in meets this browser. Called by /login after the password, by /join after the
// account is made, and by /login?step=device when the gate sends a session here to finish. Answers
//   { next: "home" }                     signed in on this device (the cap may have signed another out: notice)
//   { next: "code", sentTo, message }    a device VicData hasn't seen: a code was emailed (DEVICE_CODES=on)
//   401                                  no verified session
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const caller = await callerOf(request);
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const r = await registerSignIn(deviceStore(), envMailer(), {
      ...caller,
      token: deviceTokenOf(request),
      userAgent: request.headers.get("user-agent"),
      place: placeFrom(request.headers),
      codesOn: deviceCodesOn(),
      now: new Date(),
    });
    forgetSessions([caller.sessionId]);
    if (r.next === "error") return NextResponse.json({ next: "error", error: r.message }, { status: 401 });
    const body = r.next === "home" ? { next: "home" } : { next: "code", sentTo: r.sentTo, sent: r.sent, message: r.message };
    const res = setDeviceCookie(NextResponse.json(body), r.token);
    return r.next === "home" ? setNotice(res, r.notice) : res;
  } catch (e) {
    console.error("[auth/device] failed:", (e as Error).message);
    return NextResponse.json({ next: "error", error: "VicData couldn't finish signing you in. Try again in a minute." }, { status: 502 });
  }
}
