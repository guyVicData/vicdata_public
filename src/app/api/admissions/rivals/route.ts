import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { buildRivals, stageForEntry, subjectPlaces } from "@/lib/admissions/rivals";
import { rivalsFromLists } from "@/lib/admissions/lists";
import type { RankMeasure } from "@/lib/subject-ranking";

// VicData 0.7 admissions r1 (A5): the rivals -- ranks (headline, subject area; subject when one is
// asked for), size, shape, momentum flags, and the school's strengths and weaknesses by area.
// GET ?urn&entry[&subject&family&qual&measure=points|entries|threshold] (subject: GCSE / Post-16).
const MEASURES = new Set(["points", "entries", "threshold"]);
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  try {
    const lists = await savedLists(caller.supabase, caller.urn, ep.id);
    const r = await buildRivals(caller.urn, ep, { rivals: rivalsFromLists(lists) });
    const stage = stageForEntry(ep.age);
    const subject = sp.get("subject");
    let subjects = null;
    if (subject && subject.length <= 200 && (stage === "ks4" || stage === "ks5")) {
      const measure = (MEASURES.has(sp.get("measure") ?? "") ? { kind: sp.get("measure") } : { kind: "points" }) as RankMeasure;
      const places = await subjectPlaces(r.rows.map((x) => x.urn), stage, { subject, familyId: sp.get("family"), qualificationType: sp.get("qual"), measure });
      subjects = Object.fromEntries(places);
    }
    return NextResponse.json({ ...r, subjects });
  } catch (err) {
    console.error("[admissions/rivals] failed:", err);
    return NextResponse.json({ error: "Could not build the rivals." }, { status: 502 });
  }
}
