import { NextRequest, NextResponse } from "next/server";
import { groupCaller } from "@/lib/groups/server";

// VicData 0.8 groups r1: the caller's head-office accounts (their own memberships, RLS; a suspended
// account's are hidden). A platform admin in View as gets the one account they are viewing, read-only.
// GET. Invitations are accepted only by an explicit act with the link (/teacher/group/join), never here.
export async function GET(request: NextRequest) {
  const pre = request.headers.get("authorization");
  if (!pre) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    const caller = await groupCaller(request);
    if (caller instanceof NextResponse) return caller;
    return NextResponse.json({ offices: caller.offices, viewAs: caller.viewAs });
  } catch (err) {
    console.error("[group/me] failed:", err);
    return NextResponse.json({ error: "Could not read your group accounts." }, { status: 502 });
  }
}
