// VicData 0.8 database load: the cases that prove academic_subject_rank_lookup answers exactly as it did
// once it reads precomputed figures (ingest 20261017130000_academic_subject_rank_figures.sql).
//
//   npx -y tsx --env-file=.env scripts/rank-figures-cases.ts OUT.json
//
// Writes each case's name and the function's arguments, exactly as the app sends them (rankRpcArgs):
// GCSE and Post-16; national, regional and a custom set (the 10 nearest); points, entries, rates and a
// few grade bands (the computed path); IGCSE schools; Leighton Park Biology. Read-only: the populations
// come from the app database, the family ids from production's subject reads.
//
// The ingest repo runs them twice: tests/rank_figures/run_pglite.mjs (PGlite, before the migration is
// applied) and verify_rank_figures.py (production, after the build: the new lookup against _v1).
import { writeFileSync } from "node:fs";
import { cachedRankingPopulation, resolveDefaultNearest } from "../src/lib/chooser-sets";
import { defaultRankingFilters, matchesRanking, NATIONAL } from "../src/lib/comparator-chooser";
import { resolveTargetRegionNation } from "../src/lib/region-nation-comparator";
import { fetchSubjectLevelDataForSchools } from "../src/lib/academic-data-view";
import { rankRpcArgs, type RankMeasure, type SubjectRankingRequest } from "../src/lib/subject-ranking";

const out = process.argv[2];
if (!out) throw new Error("usage: rank-figures-cases.ts OUT.json");

const GCSE = "GCSE (9-1) Full Course";
type School = { urn: string; name: string };
const KS4_SCHOOLS: School[] = [
  { urn: "137625", name: "The Chase" },
  { urn: "110110", name: "Leighton Park (IGCSE)" },
  { urn: "100053", name: "Acland Burghley" },
  { urn: "136622", name: "Alcester Grammar" },
  { urn: "135061", name: "Wolverley" },
  { urn: "117037", name: "King's Worcester (IGCSE)" },
];
const KS4_SUBJECTS = ["Biology", "History", "Mathematics", "English Language", "Geography", "Computer Science", "Religious Studies", "French", "Art and Design", "Chemistry"];
const KS5: { urn: string; name: string; subject: string; qual: string }[] = [
  { urn: "117037", name: "King's Worcester", subject: "Mathematics", qual: "GCE A level" },
  { urn: "117037", name: "King's Worcester", subject: "Biology", qual: "GCE A level" },
  { urn: "110110", name: "Leighton Park", subject: "Mathematics", qual: "GCE A level" },
  { urn: "130432", name: "Croydon College", subject: "Business Studies", qual: "BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*" },
  { urn: "118952", name: "118952", subject: "Biology", qual: "GCE A level" },
  { urn: "136622", name: "Alcester Grammar", subject: "History", qual: "GCE A level" },
];

const nationalOf = async (phase: "ks4" | "ks5") =>
  (await cachedRankingPopulation(null, phase, null)).filter((r) => matchesRanking(r, defaultRankingFilters(NATIONAL))).map((r) => r[0]);
const regionOf = async (urn: string, phase: "ks4" | "ks5") => {
  const t = await resolveTargetRegionNation(urn);
  if (!t?.regionCode) return null;
  const scope = { kind: "region" as const, code: t.regionCode, name: t.regionName ?? t.regionCode };
  return (await cachedRankingPopulation(t.regionCode, phase, null)).filter((r) => matchesRanking(r, defaultRankingFilters(scope))).map((r) => r[0]);
};
const nearestOf = async (urn: string, phase: "ks4" | "ks5") => (await resolveDefaultNearest(urn, phase)).rows.map((r: { urn: string }) => r.urn).filter((u: string) => u !== urn);

const cases: { name: string; args: ReturnType<typeof rankRpcArgs> }[] = [];
const push = (name: string, req: SubjectRankingRequest) => cases.push({ name, args: rankRpcArgs(req) });
const fam = new Map<string, string | null>();
const familyOf = async (phase: "ks4" | "ks5", urn: string, subject: string) => {
  const k = `${phase}|${subject}`;
  if (!fam.has(k)) fam.set(k, (await fetchSubjectLevelDataForSchools([urn], phase)).subjectFamilyMap[subject] ?? null);
  return fam.get(k)!;
};

async function main() {
  for (const phase of ["ks4", "ks5"] as const) {
    const national = await nationalOf(phase);
    if (phase === "ks4") {
      for (const s of KS4_SCHOOLS) {
        const region = await regionOf(s.urn, phase);
        const nearest = await nearestOf(s.urn, phase);
        for (const subject of KS4_SUBJECTS) {
          const familyId = await familyOf(phase, s.urn, subject);
          const base = { targetUrn: s.urn, phase, subject, familyId, period: null } as const;
          const m = (kind: RankMeasure["kind"]) => ({ kind }) as RankMeasure;
          push(`${s.name} GCSE ${subject} points (national)`, { ...base, urns: national, qualificationType: null, measure: m("points") });
          push(`${s.name} GCSE ${subject} Grade 4+ (national)`, { ...base, urns: national, qualificationType: GCSE, measure: m("threshold") });
          if (["Biology", "History", "Mathematics"].includes(subject)) {
            push(`${s.name} GCSE ${subject} entries (national)`, { ...base, urns: national, qualificationType: null, measure: m("entries") });
            if (region) push(`${s.name} GCSE ${subject} points (region)`, { ...base, urns: region, qualificationType: null, measure: m("points") });
            push(`${s.name} GCSE ${subject} Grade 4+ (10 nearest)`, { ...base, urns: nearest, qualificationType: GCSE, measure: m("threshold") });
            push(`${s.name} GCSE ${subject} points 2023/24 (national)`, { ...base, urns: national, qualificationType: null, measure: m("points"), period: 2023 });
          }
          if (subject === "History") push(`${s.name} GCSE History band 9-7 (national, computed path)`, { ...base, urns: national, qualificationType: GCSE, measure: { kind: "band", scaleIndex: 0, top: "9", bottom: "7" } });
        }
      }
    } else {
      for (const s of KS5) {
        const region = await regionOf(s.urn, phase);
        const nearest = await nearestOf(s.urn, phase);
        const familyId = await familyOf(phase, s.urn, s.subject);
        const base = { targetUrn: s.urn, phase, subject: s.subject, familyId, qualificationType: s.qual, period: null } as const;
        for (const kind of ["points", "entries", "threshold"] as const) {
          push(`${s.name} ${s.qual} ${s.subject} ${kind} (national)`, { ...base, urns: national, measure: { kind } as RankMeasure });
          if (region) push(`${s.name} ${s.qual} ${s.subject} ${kind} (region)`, { ...base, urns: region, measure: { kind } as RankMeasure });
          push(`${s.name} ${s.qual} ${s.subject} ${kind} (10 nearest)`, { ...base, urns: nearest, measure: { kind } as RankMeasure });
        }
        // No qualification: the rates' "every qualification" case
        push(`${s.name} ${s.subject} A*-E, every qualification (national)`, { ...base, urns: national, qualificationType: null, measure: { kind: "threshold" } });
      }
    }
  }
  writeFileSync(out, JSON.stringify(cases, null, 1));
  console.log(cases.length, "cases written to", out);
}

main().then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
