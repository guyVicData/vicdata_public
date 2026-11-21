import { NextResponse } from "next/server";

// 0.8 front door part 3: the server's half of signing out of this browser (src/lib/sign-out.ts). Milestone 2:
// nothing to do yet (the browser clears its own session cookie); milestone 3 marks this device signed out.
export const dynamic = "force-dynamic";

export async function POST() {
  return new NextResponse(null, { status: 204 });
}
