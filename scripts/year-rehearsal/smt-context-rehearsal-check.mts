// VicData 0.8 SMT round 3 (R-SMT-YEARS): run under a synthetic extra LSOA year (install-lsoa-next.ts)
// and print, as JSON on the last line, the years Context reads -- they should all move on by one with
// no code change. Read-only. Used by scripts/catalogue-rule-tests.ts.
import { smtSchool } from "../../src/lib/smt/school";
import { buildContext } from "../../src/lib/smt/context";

const school = (await smtSchool("137625"))!;
const c = await buildContext(school, "around", "gcse");
console.log(JSON.stringify({ children: c.now.children.year, byAge: c.byAge.period, sources: c.sources.lsoaYear, nearbyLast: c.nearby.school.at(-1)?.year ?? null, value: c.now.children.value }));
