// VicData 0.8 database load: the ten heaviest production reads, timed on the anon path (the app's own
// calls, over HTTP, as a page makes them), three runs each with no app cache, one after another.
//
//   npx -y tsx --env-file=.env scripts/db-timings.ts OUT.json [--paged]
//
// --paged forces today's paged reference reads (reference_data_lookup with p_limit/p_offset), for the
// "before" figures once the one-call functions are live. Read-only. Run at a quiet time.
import { writeFileSync } from "node:fs";
import { callReferenceRpc, clearReferenceReads, forcePagedReads, lookupAcademicHeadline, lookupAcademicSubjectFamily, lookupAcademicSubjectGradeRollup, lookupAcademicSubjectHeadline, lookupAcademicSubjectQualificationHeadline, lookupAgeGenderTotals, lookupReferenceData } from "../src/lib/vicdata-reference";
import { CENSUS_AGE_BREAKDOWNS } from "../src/lib/admissions/data";
import { KS2_HEADLINE } from "../src/lib/admissions/ranks";
import { cachedRankingPopulation } from "../src/lib/chooser-sets";
import { defaultRankingFilters, matchesRanking, NATIONAL } from "../src/lib/comparator-chooser";
import { rankRpcArgs } from "../src/lib/subject-ranking";
import { CURRENT_CENSUS_PERIOD } from "../src/catalogue/years";
import { createServerAnonSupabaseClient } from "../src/lib/supabase";

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("usage: db-timings.ts OUT.json [--paged]");
  forcePagedReads(process.argv.includes("--paged"));
  const sb = createServerAnonSupabaseClient();
  const urnsIn = async (la: string, phase: string, n: number) =>
    ((await sb.from("schools").select("urn").eq("la_name", la).eq("phase", phase).limit(n)).data ?? []).map((r: { urn: string | number }) => String(r.urn));
  const census40 = await urnsIn("Worcestershire", "Secondary", 40);
  const kent750 = await urnsIn("Kent", "Primary", 750);
  const sec150 = await urnsIn("Birmingham", "Secondary", 150);
  const nat = (await cachedRankingPopulation(null, "ks4", null)).filter((r) => matchesRanking(r, defaultRankingFilters(NATIONAL))).map((r) => r[0]);
  const rankArgs = rankRpcArgs({ urns: nat, targetUrn: "137625", phase: "ks4", subject: "History", familyId: "humanities_social", qualificationType: null, measure: { kind: "points" }, period: null });

  const calls: [string, () => Promise<unknown>][] = [
    ["reference_data_lookup: census, 40 schools, every age, every year", () => lookupReferenceData({ sourceId: "dfe_school_census", entityIds: census40, breakdowns: CENSUS_AGE_BREAKDOWNS })],
    ["reference_data_lookup: KS2 headline, every school in England", () => lookupReferenceData({ sourceId: "dfe_ks2_attainment", breakdowns: [KS2_HEADLINE], periodMin: 2022 })],
    ["reference_data_age_gender_totals: 750 schools (a map view)", () => lookupAgeGenderTotals({ sourceId: "dfe_school_census", entityIds: kent750, period: CURRENT_CENSUS_PERIOD })],
    ["academic_subject_headline_lookup: 20 schools", () => lookupAcademicSubjectHeadline({ entityIds: census40.slice(0, 20), ksStage: "ks4" })],
    ["academic_subject_grade_rollup_lookup: one school, GCSE", () => lookupAcademicSubjectGradeRollup({ entityIds: ["137625"], ksStage: "ks4", periodMin: 2021 })],
    ["academic_subject_qualification_headline_lookup: one school, Post-16", () => lookupAcademicSubjectQualificationHeadline({ entityIds: ["117037"], ksStage: "ks5" })],
    ["academic_subject_rank_lookup: The Chase GCSE History points, national (6,159 schools)", () => callReferenceRpc("academic_subject_rank_lookup", rankArgs)],
    ["academic_subject_family_lookup: 150 schools, GCSE", () => lookupAcademicSubjectFamily({ entityIds: sec150, ksStage: "ks4" })],
    ["academic_headline_lookup: every school in England, GCSE", () => lookupAcademicHeadline({ ksStage: "ks4" })],
    ["area_projection: The Chase, 8 km", () => callReferenceRpc("area_projection", { p_urn: "137625", p_radius_miles: 5 })],
    ["area_context: The Chase, 8 km", () => callReferenceRpc("area_context", { p_urn: "137625", p_radius_miles: 5 })],
  ];
  const results: { call: string; ms: number[]; ok: boolean; note?: string }[] = [];
  for (const [name, run] of calls) {
    const ms: number[] = [];
    let ok = true;
    let note: string | undefined;
    for (let i = 0; i < 3; i++) {
      clearReferenceReads();
      const t = Date.now();
      try {
        await run();
      } catch (e) {
        ok = false;
        note = (e instanceof Error ? e.message : String(e)).slice(0, 160);
      }
      ms.push(Date.now() - t);
    }
    results.push({ call: name, ms, ok, note });
    console.log(`${name}: ${ms.join(" / ")} ms${ok ? "" : ` FAILED ${note}`}`);
  }
  writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), paged: process.argv.includes("--paged"), results }, null, 1));
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
