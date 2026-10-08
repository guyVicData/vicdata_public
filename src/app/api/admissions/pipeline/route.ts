import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { buildPipeline } from "@/lib/admissions/pipeline";
import { defaultRungSets, nearbyCandidates } from "@/lib/admissions/rungs";
import { blendFromLists, rungSetsFromLists } from "@/lib/admissions/lists";
import { cachedCensus } from "@/lib/admissions/data";
import { feederFlags } from "@/lib/admissions/feeders";
import { loadThresholds, phaseForEntryAge } from "@/lib/admissions/thresholds";
import { CURRENT_CENSUS_PERIOD } from "@/lib/roll-data";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";

// VicData 0.7 admissions r1 (A5): Pipelines for one entry point -- the pool by entry year (past
// and forward, by source, with ranges), the share needed to hold numbers steady, the sets used,
// the LA blend, and the feeder flags. GET ?urn&entry=11+|4+|16+|age:N[&sex=male|female][&projection=1].
// The school's saved lists when it has them (RLS: the caller's own token), else nearby schools.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  const sex = sp.get("sex") === "male" || sp.get("sex") === "female" ? (sp.get("sex") as "male" | "female") : "all";
  try {
    const lists = await savedLists(caller.supabase, caller.urn, ep.id);
    const defaults = defaultRungSets(caller.urn, ep, await nearbyCandidates(caller.urn));
    const sets = rungSetsFromLists(ep, lists, defaults);
    const p = await buildPipeline(caller.urn, ep, { sets, laBlend: blendFromLists(lists), sex, includeProjection: sp.get("projection") === "1" });
    // Feeder flags on the youngest counted rung's set, across the ages it holds.
    const thresholds = await loadThresholds();
    const feederAge = p.sets.find((s) => s.age < 11)?.age ?? p.sets[0]?.age;
    const feederSet = p.sets.find((s) => s.age === feederAge)?.urns ?? [];
    const ages = p.sets.filter((s) => s.urns === feederSet || s.urns.join() === feederSet.join()).map((s) => s.age);
    const census = await cachedCensus(feederSet);
    const flags = feederFlags(new Map(feederSet.map((u) => [u, census.get(u)?.table ?? new Map()])), ages, CURRENT_CENSUS_PERIOD, thresholds?.get(phaseForEntryAge(ep.age), "entry_cohort")?.minCohort ?? 10);
    return NextResponse.json({ ...p, feeders: flags, listsUsed: lists.filter((l) => (l.members?.length ?? 0) > 0).map((l) => l.kind), notes: ADMISSIONS_NOTES });
  } catch (err) {
    console.error("[admissions/pipeline] failed:", err);
    return NextResponse.json({ error: "Could not build the pipeline." }, { status: 502 });
  }
}
