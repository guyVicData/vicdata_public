import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller, savedLists } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { cachedCensus, fetchSchoolInfo } from "@/lib/admissions/data";
import { defaultRivals, defaultRungSets, nearbyCandidates } from "@/lib/admissions/rungs";
import { rivalsFromLists, rungSetsFromLists } from "@/lib/admissions/lists";
import { localShape, shapeOf, sizeByBand } from "@/lib/admissions/shape";
import { lookupAgeBandDistributions } from "@/lib/age-band-distributions";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";

// VicData 0.7 admissions r1 (A5): shape and size -- the school's shape each year since 2019/20 (its
// stability), its roll by phase with the XS-XL badges, the feeder area's local shape, and the
// rivals' shapes (described, never ranked: R-ADM-SHAPE-NOT-RANKED). GET ?urn&entry.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  try {
    const lists = await savedLists(caller.supabase, caller.urn, ep.id);
    const candidates = await nearbyCandidates(caller.urn);
    const sets = rungSetsFromLists(ep, lists, defaultRungSets(caller.urn, ep, candidates));
    const feeders = Array.from(new Set(sets.get(Math.min(...sets.keys())) ?? []));
    const rivals = rivalsFromLists(lists) ?? defaultRivals(ep, candidates);
    const all = Array.from(new Set([caller.urn, ...feeders, ...rivals]));
    const [census, info] = await Promise.all([cachedCensus(all), fetchSchoolInfo(all)]);
    const own = census.get(caller.urn);
    const dist = await lookupAgeBandDistributions(info.get(caller.urn)?.laName ?? null, own?.latestPeriod ?? 2025);
    const byYear = own ? Array.from(own.ageGenderByPeriod, ([year, counts]) => ({ year, shape: shapeOf(counts) })).sort((a, b) => a.year - b.year) : [];
    return NextResponse.json({
      urn: caller.urn,
      entry: ep,
      shapeByYear: byYear,
      size: own ? sizeByBand(own.ageGender, dist) : [],
      localShape: { schools: feeders.length, shape: localShape(feeders.map((u) => census.get(u)?.ageGender).filter((c): c is NonNullable<typeof c> => !!c)) },
      rivals: rivals.map((u) => ({ urn: u, name: info.get(u)?.name ?? u, shape: census.get(u) ? shapeOf(census.get(u)!.ageGender) : null })),
      note: ADMISSIONS_NOTES.shape,
    });
  } catch (err) {
    console.error("[admissions/shape] failed:", err);
    return NextResponse.json({ error: "Could not build shape and size." }, { status: 502 });
  }
}
