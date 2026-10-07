// VicData 0.6.7 B1: Column 3's critical path, before and after, read-only, server-side
// (the routes' own work, no network hop to the browser).
//   npx -y tsx --env-file=.env docs/v0.6/audit_scripts/v067_profiles/timing.ts
// before, cold load:   chooser-set (resolveDefaultNearest) THEN academic-schools (fetchAcademicProfiles,
//                      includeSubjects) for the set -- two requests in a row
// after, cold load:    chooser-set with the lean profiles in the same answer -- one request
// phase switch:        the other phase's chooser-set is prefetched (0.6.4 C2), so before it is
//                      academic-schools alone, after nothing (the profiles came with the prefetch)
// Bytes: the JSON the browser receives for the profiles. Three rounds, the median.
import { fetchAcademicProfiles, serializeAcademicProfile } from "../../../../src/lib/academic-data-view";
import { fetchTeacherComparatorProfiles, profileUrnsFor } from "../../../../src/lib/teacher-comparator-profiles";
import { resolveDefaultNearest } from "../../../../src/lib/chooser-sets";

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function main() {
  console.log("school phase | before: chooser-set + academic-schools = critical path (profiles KB) | after: chooser-set incl. profiles (profiles KB) | phase switch before -> after");
  for (const urn of ["137625", "117037", "118952", "130432", "100053"]) {
    for (const phase of ["ks4", "ks5"] as const) {
      const r = { set: [] as number[], full: [] as number[], lean: [] as number[] };
      let fullKb = 0, leanKb = 0;
      for (let i = 0; i < 3; i++) {
        let t = performance.now();
        const set = await resolveDefaultNearest(urn, phase);
        r.set.push(performance.now() - t);
        const urns = profileUrnsFor(set.rows.map((x) => x.urn), urn);
        t = performance.now();
        const full = await fetchAcademicProfiles(urns, { includeSubjects: true });
        r.full.push(performance.now() - t);
        t = performance.now();
        const lean = await fetchTeacherComparatorProfiles(urns, phase);
        r.lean.push(performance.now() - t);
        fullKb = JSON.stringify({ profiles: full.map(serializeAcademicProfile) }).length / 1024;
        leanKb = JSON.stringify(lean.map(serializeAcademicProfile)).length / 1024;
      }
      const [s, f, l] = [med(r.set), med(r.full), med(r.lean)].map(Math.round);
      console.log(`${urn} ${phase} | ${s} + ${f} = ${s + f} ms (${fullKb.toFixed(0)} KB) | ${s} + ${l} = ${s + l} ms (${leanKb.toFixed(0)} KB) | ${f} -> 0 ms`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
