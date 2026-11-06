import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/build-info";

// VicData 0.8 feedback deploy gate: which commit is live, outside the access gate like /api/health (see
// src/proxy.ts), so the republish script and Guy's commands can read it. The repo is public, so the commit
// isn't a secret. `commits` is how many commits the build lists (null: it has no list), so a Render build's
// history can be checked from outside; the list itself stays on the server.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const b = buildInfo();
  return NextResponse.json({ commit: b.commit, built_at: b.built_at, commits: b.commits ? b.commits.length : null }, { headers: { "Cache-Control": "no-store" } });
}
