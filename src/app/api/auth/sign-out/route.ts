import { NextResponse, type NextRequest } from "next/server";
import { signOutDevices } from "@/lib/devices/service";
import { callerOf, deviceStore } from "@/lib/devices/http";
import { forgetSessions } from "@/lib/devices/gate";

// 0.8 front door part 3: the server's half of signing out of this browser (src/lib/sign-out.ts): this device's row
// is marked signed out by its owner and the session ended. The browser clears its own cookie after.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const caller = await callerOf(request);
  if (!caller) return new NextResponse(null, { status: 204 });
  try {
    const store = deviceStore();
    const d = await store.deviceBySession(caller.sessionId);
    if (d && d.profile_id === caller.userId) forgetSessions(await signOutDevices(store, [d], "here", new Date()));
  } catch (e) {
    console.error("[auth/sign-out] failed:", (e as Error).message);
  }
  return new NextResponse(null, { status: 204 });
}
