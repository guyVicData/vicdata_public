// VicData 0.6.7 B1: the fields the Teacher page reads from its comparator schools' details,
// old (academic-schools: fetchAcademicProfiles with includeSubjects) against new (lean:
// fetchTeacherComparatorProfiles), for the same schools, the page's way (profileUrnsFor).
// Read-only. Server key used here only to list saved and VC sets' members (never in client code).
//
//   npx -y tsx --env-file=.env docs/v0.6/audit_scripts/v067_profiles/fields_diff.ts
//
// Sets: the nearest set and the national ranking sample at GCSE and Post-16 for 9 schools,
// and every saved set and VC set in the app database (anchored at its school), both phases.
// The fields (traced over every Teacher view, both drawing paths; v067_report_v1.md §1):
//   urn, name, easting, northing, establishmentTypeGroup, the profiles' order, and the phase's
//   subject rows' subject / period / entriesTotal / avgPointScore (ks4Subjects at GCSE,
//   ks5SubjectsByBucket at Post-16).
import { fetchAcademicProfiles, type AcademicSchoolProfile } from "../../../../src/lib/academic-data-view";
import { fetchTeacherComparatorProfiles, profileUrnsFor } from "../../../../src/lib/teacher-comparator-profiles";
import { resolveDefaultNearest, resolveRankingSet, cachedRankingPopulation } from "../../../../src/lib/chooser-sets";
import { defaultRankingFilters, NATIONAL } from "../../../../src/lib/comparator-chooser";
import { createServiceRoleSupabaseClient } from "../../../../src/lib/supabase";

type Phase = "ks4" | "ks5";
const row = (r: { subject: string; period: number; entriesTotal: number; avgPointScore: number | null }) => [r.subject, r.period, r.entriesTotal, r.avgPointScore];
function project(ps: AcademicSchoolProfile[], phase: Phase) {
  return ps.map((p) => ({
    urn: p.urn,
    name: p.name,
    easting: p.easting,
    northing: p.northing,
    establishmentTypeGroup: p.establishmentTypeGroup,
    subjects:
      phase === "ks4"
        ? p.ks4Subjects.map(row)
        : Object.fromEntries(Object.keys(p.ks5SubjectsByBucket).sort().map((b) => [b, p.ks5SubjectsByBucket[b].map(row)])),
  }));
}

async function main() {
  const sets: { label: string; anchor: string; phase: Phase; urns: string[] }[] = [];
  const named = ["137625", "100053", "117037", "118952", "130432", "130416"];
  const ks5Pop = (await cachedRankingPopulation(null, "ks5", null)).map((r) => r[0]).sort();
  const schools = [...named, ...[0.25, 0.5, 0.75].map((f) => ks5Pop[Math.floor(ks5Pop.length * f)])];
  for (const urn of schools) {
    for (const phase of ["ks4", "ks5"] as Phase[]) {
      const nearest = await resolveDefaultNearest(urn, phase);
      sets.push({ label: `${urn} ${phase} nearest`, anchor: urn, phase, urns: nearest.rows.map((r) => r.urn) });
      const ranking = await resolveRankingSet(urn, urn, phase, defaultRankingFilters(NATIONAL), null);
      sets.push({ label: `${urn} ${phase} national ranking sample`, anchor: urn, phase, urns: ranking.rows.map((r) => r.urn) });
    }
  }
  const sb = createServiceRoleSupabaseClient();
  const { data: saved } = await sb.from("saved_sets").select("id, name, school_accounts(school_urn), saved_set_members(school_urn)");
  for (const s of (saved ?? []) as unknown as { id: string; school_accounts: { school_urn: string }; saved_set_members: { school_urn: string }[] }[]) {
    for (const phase of ["ks4", "ks5"] as Phase[]) sets.push({ label: `saved set ${s.id} ${phase}`, anchor: s.school_accounts.school_urn, phase, urns: s.saved_set_members.map((m) => m.school_urn) });
  }
  const { data: vc } = await sb.from("vc_comparator_sets").select("id, vc_comparator_set_members(school_urn), vc_set_school_visibility(school_accounts(school_urn))");
  for (const s of (vc ?? []) as unknown as { id: string; vc_comparator_set_members: { school_urn: string }[]; vc_set_school_visibility: { school_accounts: { school_urn: string } }[] }[]) {
    const anchors = s.vc_set_school_visibility.map((v) => v.school_accounts.school_urn);
    for (const anchor of anchors.length ? anchors : [s.vc_comparator_set_members[0]?.school_urn].filter(Boolean))
      for (const phase of ["ks4", "ks5"] as Phase[]) sets.push({ label: `VC set ${s.id} @${anchor} ${phase}`, anchor, phase, urns: s.vc_comparator_set_members.map((m) => m.school_urn) });
  }

  let differences = 0;
  let profiles = 0;
  for (const set of sets) {
    const urns = profileUrnsFor(set.urns, set.anchor);
    const [full, lean] = await Promise.all([fetchAcademicProfiles(urns, { includeSubjects: true }), fetchTeacherComparatorProfiles(urns, set.phase)]);
    const a = JSON.stringify(project(full, set.phase));
    const b = JSON.stringify(project(lean, set.phase));
    profiles += full.length;
    const fullBytes = JSON.stringify(full.map((p) => ({ ...p, ageGenderCounts: [...p.ageGenderCounts], ageGenderCountsByPeriod: [...p.ageGenderCountsByPeriod].map(([k, v]) => [k, [...v]]) }))).length;
    const leanBytes = JSON.stringify(lean.map((p) => ({ ...p, ageGenderCounts: [], ageGenderCountsByPeriod: [] }))).length;
    if (a !== b) differences++;
    console.log(`${a === b ? "SAME" : "DIFF"}  ${set.label}: ${full.length} schools, ${(fullBytes / 1024).toFixed(0)} KB -> ${(leanBytes / 1024).toFixed(0)} KB`);
  }
  console.log(`\n${sets.length} sets, ${profiles} school profiles, ${differences} with differences in the fields the Teacher page reads`);
  process.exit(differences ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
