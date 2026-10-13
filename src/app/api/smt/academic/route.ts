import { NextRequest, NextResponse } from "next/server";
import { setFrom, smtCaller } from "@/lib/smt/auth";
import { smtSchool } from "@/lib/smt/school";
import { buildAcademic } from "@/lib/smt/academic";
import { parseLevel } from "@/lib/smt/levels";

// VicData 0.8 SMT r1: Academic for the level in focus -- headlines, subject areas against the set,
// the area's subjects (Teacher's ranking), value added, grade profile, trends. POST { urn, level,
// area, set }. A level the school can't show falls back (parseLevel), never errors.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { urn?: string; level?: string; area?: string } | null;
  const caller = await smtCaller(request, body?.urn ?? null);
  if (caller instanceof NextResponse) return caller;
  const set = setFrom(body);
  if (!set) return NextResponse.json({ error: "set is required" }, { status: 400 });
  try {
    const school = await smtSchool(caller.urn);
    if (!school) return NextResponse.json({ error: "No such school." }, { status: 404 });
    const q = new URLSearchParams();
    if (body?.level) q.set("level", body.level);
    if (body?.area) q.set("area", body.area);
    const level = parseLevel(q, school.phases, { gcse: school.areas.gcse.map((a) => a.id), post16: school.areas.post16.map((a) => a.id) });
    return NextResponse.json(await buildAcademic(school, level, set));
  } catch (err) {
    console.error("[smt/academic] failed:", err);
    return NextResponse.json({ error: "Could not build the academic view." }, { status: 502 });
  }
}
