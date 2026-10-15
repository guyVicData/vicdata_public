// VicData 0.8 SMT round 3 (R-SMT-YEARS): run under a synthetic extra LSOA year (install-lsoa-next.ts)
// and print, as JSON on the last line, the years Context reads -- they should all move on by one with
// no code change. Read-only. Used by scripts/catalogue-rule-tests.ts.
import { smtSchool } from "../../src/lib/smt/school";
import { buildContext } from "../../src/lib/smt/context";

// 0.8 SMT r4: the board at exactly the ingest's 5 miles (school_context_lookup's radius), as the rules
// check it, through area_context: the two must agree.
const FIVE_MILES_KM = 5 * 1.609344;
const catchment = { km: FIVE_MILES_KM, savedKm: null, defaultKm: FIVE_MILES_KM, capKm: 30, from: "view" as const, capped: false };
const school = (await smtSchool("137625"))!;
const c = await buildContext(school, "around", "gcse", catchment);
console.log(JSON.stringify({ children: c.now.children.year, byAge: c.byAge.period, sources: c.sources.lsoaYear, nearbyLast: c.nearby.school.at(-1)?.year ?? null, value: c.now.children.value }));
