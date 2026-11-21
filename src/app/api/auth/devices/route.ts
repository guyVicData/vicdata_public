import { NextResponse, type NextRequest } from "next/server";
import { isSignedIn, lastActiveWords } from "@/lib/devices/core";
import { signOutDevices } from "@/lib/devices/service";
import { callerOf, deviceStore } from "@/lib/devices/http";
import { forgetSessions } from "@/lib/devices/gate";

// 0.8 front door part 3 (E24): "Where you're signed in", the person's own.
//   GET                                   the devices signed in now: label, browser, OS, rough place, last active,
//                                         and which one is this browser
//   POST { action: "sign_out", id }       signs one of them out (this one too, if asked)
//   POST { action: "sign_out_all" }       signs every one out, this browser included
// Only ever the caller's own devices: the row's owner is checked before anything is read or written.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const caller = await callerOf(request);
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const now = new Date();
  const rows = (await deviceStore().devicesOf(caller.userId)).filter(isSignedIn).sort((a, b) => (a.session_id === caller.sessionId ? -1 : b.session_id === caller.sessionId ? 1 : b.last_active_at.localeCompare(a.last_active_at)));
  return NextResponse.json({
    devices: rows.map((d) => ({ id: d.id, label: d.label, browser: d.browser, os: d.os, form: d.form, place: d.place, lastActive: d.session_id === caller.sessionId ? "This device" : lastActiveWords(d.last_active_at, now), signedInAt: d.signed_in_at, current: d.session_id === caller.sessionId })),
  });
}

export async function POST(request: NextRequest) {
  const caller = await callerOf(request);
  if (!caller) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; id?: unknown };
  const store = deviceStore();
  const mine = (await store.devicesOf(caller.userId)).filter(isSignedIn);
  let targets = mine;
  if (body.action === "sign_out") {
    targets = mine.filter((d) => d.id === body.id);
    if (!targets.length) return NextResponse.json({ error: "That device isn't signed in." }, { status: 404 });
  } else if (body.action !== "sign_out_all") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const ended = await signOutDevices(store, targets, body.action === "sign_out_all" ? "all" : targets[0].session_id === caller.sessionId ? "here" : "elsewhere", new Date());
  forgetSessions(ended);
  return NextResponse.json({ ok: true, signedOutHere: ended.includes(caller.sessionId) });
}
