import { NextRequest, NextResponse } from "next/server";
import { admissionsCaller } from "@/lib/admissions/auth";
import { entryPoint } from "@/lib/admissions/entry-points";
import { nearbyCandidates } from "@/lib/admissions/rungs";
import { cachedCensus } from "@/lib/admissions/data";
import { feederFlags } from "@/lib/admissions/feeders";
import { loadThresholds, phaseForEntryAge } from "@/lib/admissions/thresholds";
import { englandSchools, sizePlaces } from "@/lib/admissions/ranks";
import { fetchSchoolTraits, schoolsInLas, type SchoolTraits } from "@/lib/admissions/traits";
import { distanceKm } from "@/lib/admissions/screens";
import { pctChange } from "@/lib/admissions/flags";
import { CURRENT_CENSUS_PERIOD, type AgeBandKey } from "@/lib/roll-data";

// VicData 0.7 admissions r2 (D5): the schools setup offers to tick, with the figures beside each
// (pupils at the age that matters, their two-year trend and flag against the schools shown, km,
// sector, gender, boarding, XS-XL). Read-only public data; the caller must be allowed into
// Admissions (admissionsCaller). Saving goes through /api/admissions/lists.
//   GET ?urn&entry&kind=day|boarding|rivals
//       &mode=nearest[&n=15] | radius&km=5 | la&las=885,884 | region | urns&urns=1,2,3
//       [&sector=state|independent][&gender=same][&boarding=1][&ages=11,13] (boarding preps' top age)
//       [&sizes=S,M,L]
const P = CURRENT_CENSUS_PERIOD;
const CAP = 150;
const holds = (t: { low: number | null; high: number | null }, age: number) => (t.low ?? 99) <= age && (t.high ?? -1) >= age;
const bandOf = (age: number): AgeBandKey => (age <= 4 ? "early_years" : age <= 10 ? "primary" : age <= 15 ? "secondary" : "sixth_form");

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const caller = await admissionsCaller(request, sp.get("urn"));
  if (caller instanceof NextResponse) return caller;
  const ep = entryPoint(sp.get("entry") ?? "");
  if (!ep) return NextResponse.json({ error: "entry must be 4+, 11+, 16+ or age:2-17" }, { status: 400 });
  const kind = sp.get("kind") === "rivals" ? "rivals" : sp.get("kind") === "boarding" ? "boarding" : "day";
  const mode = sp.get("mode") ?? "nearest";
  // The age that matters: a feeder's pupils a year before entry (Reception's at 4+); a rival's at entry.
  const age = kind === "rivals" ? ep.age : Math.max(4, ep.age - 1);
  try {
    const me = (await fetchSchoolTraits([caller.urn])).get(caller.urn);
    let pool: SchoolTraits[] = [];
    if (mode === "urns") {
      const urns = (sp.get("urns") ?? "").split(",").filter((u) => /^\d{5,7}$/.test(u)).slice(0, 500);
      pool = Array.from((await fetchSchoolTraits(urns)).values());
    } else if (mode === "la" || (kind === "boarding" && sp.get("las"))) {
      const las = (sp.get("las") ?? "").split(",").filter((x) => /^\d{3}$/.test(x)).slice(0, 12);
      pool = las.length ? await schoolsInLas(las) : [];
    } else if (mode === "region") {
      const england = await englandSchools();
      const region = england.get(caller.urn)?.regionCode;
      const urns = region ? Array.from(england, ([u, s]) => ({ u, s })).filter(({ s }) => s.regionCode === region && (s.low ?? 99) <= age && (s.high ?? -1) >= age).map(({ u }) => u) : [];
      pool = Array.from((await fetchSchoolTraits(urns)).values());
    } else {
      const near = await nearbyCandidates(caller.urn);
      pool = Array.from((await fetchSchoolTraits(near.map((c) => c.urn))).values());
    }
    const sector = sp.get("sector");
    const tops = (sp.get("ages") ?? "").split(",").map(Number).filter((n) => n >= 5 && n <= 19);
    let list = pool
      .filter((t) => t.urn !== caller.urn)
      .filter((t) => holds(t, age) && (kind !== "rivals" || holds(t, age + 1)))
      .filter((t) => (sector === "state" || sector === "independent" ? t.sector === sector : true))
      .filter((t) => (kind === "boarding" ? t.sector === "independent" && t.boarding : true))
      .filter((t) => (sp.get("boarding") === "1" ? t.boarding : true))
      .filter((t) => (sp.get("gender") === "same" && me ? t.gender === me.gender : true))
      .filter((t) => (tops.length ? tops.includes(t.high ?? -1) : true))
      .map((t) => ({ t, km: distanceKm(me, t) }))
      .sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    if (mode === "radius") list = list.filter((x) => x.km !== null && x.km <= Math.min(80, Number(sp.get("km") ?? 5)));
    if (mode === "nearest") list = list.slice(0, Math.min(60, Math.max(1, Number(sp.get("n") ?? (kind === "rivals" ? 10 : 15)))));
    list = list.slice(0, CAP);

    const urns = list.map((x) => x.t.urn);
    const thresholds = await loadThresholds();
    const [census, sizes] = await Promise.all([cachedCensus(urns), sizePlaces(bandOf(age), urns, me?.laName ?? null)]);
    const sizeFilter = (sp.get("sizes") ?? "").split(",").filter(Boolean);
    const flags = feederFlags(new Map(urns.map((u) => [u, census.get(u)?.table ?? new Map()])), [age], P, thresholds?.get(phaseForEntryAge(ep.age), "entry_cohort")?.minCohort ?? 10);
    const rows = list
      .map(({ t, km }) => {
        const f = flags.find((x) => x.urn === t.urn)!;
        return {
          urn: t.urn, name: t.name, sector: t.sector, gender: t.gender, boarding: t.boarding, laCode: t.laCode, laName: t.laName, town: t.town,
          high: t.high, distanceKm: km, pupils: f.to, before: f.from, changePct: pctChange(f.from, f.to), flag: kind === "rivals" ? null : f.flag,
          size: sizes.get(t.urn)?.badge ?? null, easting: t.easting, northing: t.northing,
        };
      })
      .filter((r) => (sizeFilter.length ? !!r.size && sizeFilter.includes(r.size) : true));
    return NextResponse.json({ kind, mode, age, period: P, school: me ? { urn: me.urn, name: me.name, easting: me.easting, northing: me.northing, laCode: me.laCode, laName: me.laName, gender: me.gender } : null, rows });
  } catch (err) {
    console.error("[admissions/candidates] failed:", err);
    return NextResponse.json({ error: "Could not list the schools." }, { status: 502 });
  }
}
