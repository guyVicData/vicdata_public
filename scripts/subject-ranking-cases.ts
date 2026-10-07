// VicData 0.6.6: the subject ranking's named cases, both paths.
//
//   npx -y tsx --env-file=.env scripts/subject-ranking-cases.ts [OUT.json] [--only=substring]
//
// For each case: the ranking population (national, or the school's own region; one case with
// filters that exclude the school), the app's own answer (fallbackFigures + rankFigures, the
// path used until academic_subject_rank_lookup is applied) and, when the function is live, its
// answer, compared field by field (numbers to 1e-9). Before the migration is applied the
// function is absent and only the fallback is timed.
//
// OUT.json (optional) gets each case's arguments and the app's answer; the ingest repo's
// tests/subject_rank_lookup/run_pglite.mjs runs the migration on PGlite against it, which is
// how the function was proved identical before it could be applied.
import { writeFileSync } from "node:fs";
import { cachedRankingPopulation } from "../src/lib/chooser-sets";
import { defaultRankingFilters, matchesRanking, NATIONAL, type RankingFilters } from "../src/lib/comparator-chooser";
import { resolveTargetRegionNation } from "../src/lib/region-nation-comparator";
import { fallbackFigures, rankByFunction, rankFigures, rankRpcArgs, type RankMeasure, type SubjectRankingRequest } from "../src/lib/subject-ranking";

type Case = {
  name: string;
  urn: string;
  phase: "ks4" | "ks5";
  subject: string;
  family: string;
  qual: string | null;
  measure: RankMeasure;
  scope: "national" | "region";
  filters?: Partial<RankingFilters>;
};

const CHASE = { urn: "137625", phase: "ks4", subject: "History", family: "humanities_social" } as const;
const GCSE = "GCSE (9-1) Full Course";
const KINGS = { urn: "117037", phase: "ks5", subject: "Mathematics", family: "sciences_maths", qual: "GCE A level" } as const;
const CROYDON = { urn: "130432", phase: "ks5", subject: "Business Studies", family: "business_law", qual: "BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*" } as const;
const band = (scaleIndex: number, top: string, bottom: string): RankMeasure => ({ kind: "band", scaleIndex, top, bottom });

const CASES: Case[] = [];
for (const scope of ["national", "region"] as const) {
  CASES.push(
    { name: `Chase GCSE History points (${scope})`, ...CHASE, qual: null, measure: { kind: "points" }, scope },
    { name: `Chase GCSE History Grade 4+ (${scope})`, ...CHASE, qual: GCSE, measure: { kind: "threshold" }, scope },
    { name: `Chase GCSE History band 9-7 (${scope})`, ...CHASE, qual: GCSE, measure: band(0, "9", "7"), scope },
    { name: `Chase GCSE History grade 9 (${scope})`, ...CHASE, qual: GCSE, measure: band(0, "9", "9"), scope },
    { name: `Chase GCSE History counts selection 6-5 (${scope})`, ...CHASE, qual: GCSE, measure: band(0, "6", "5"), scope },
    { name: `Chase GCSE History Candidates (${scope})`, ...CHASE, qual: null, measure: { kind: "entries" }, scope },
    { name: `Kings A level Maths points (${scope})`, ...KINGS, measure: { kind: "points" }, scope },
    { name: `Kings A level Maths A*-A (${scope})`, ...KINGS, measure: band(2, "A*", "A"), scope },
    { name: `Croydon BTEC Ext Dip Business points (${scope})`, ...CROYDON, measure: { kind: "points" }, scope },
  );
}
CASES.push(
  { name: "Kings A level Maths A*-E (national)", ...KINGS, measure: { kind: "threshold" }, scope: "national" },
  { name: "Croydon BTEC Ext Dip Business D*D*D*-DDD (national)", ...CROYDON, measure: band(7, "Distinction*-Distinction*-Distinction*", "Distinction-Distinction-Distinction"), scope: "national" },
  // A school excluded by its own filters, placed against the population (state school, independent ranking)
  { name: "Chase GCSE History Grade 4+ (national, independent only: excluded)", ...CHASE, qual: GCSE, measure: { kind: "threshold" }, scope: "national", filters: { sectors: ["Independent"] } },
  // The largest subjects nationally (timing), and a VRQ with historic short codes (the set-level mapping)
  { name: "Chase GCSE English Language Grade 4+ (national)", urn: "137625", phase: "ks4", subject: "English Language", family: "languages_literature", qual: GCSE, measure: { kind: "threshold" }, scope: "national" },
  { name: "Chase GCSE Maths band 9-7 (national)", urn: "137625", phase: "ks4", subject: "Maths (General)", family: "sciences_maths", qual: GCSE, measure: band(0, "9", "7"), scope: "national" },
  { name: "VRQ L3 Nutrition / Diet D*-D (national)", urn: "144888", phase: "ks5", subject: "Nutrition / Diet", family: "health_care", qual: "VRQ Level 3", measure: band(5, "Distinction*", "Distinction"), scope: "national" },
);

const out = process.argv.slice(2).find((a) => !a.startsWith("--"));
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const close = (a: unknown, b: unknown, path: string, bad: string[]): string[] => {
  if (typeof a === "number" && typeof b === "number") {
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) bad.push(`${path}: ${a} vs ${b}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) bad.push(`${path}: length ${a.length} vs ${b.length}`);
    else a.forEach((x, i) => close(x, b[i], `${path}[${i}]`, bad));
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, bad);
  } else if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) bad.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return bad;
};

async function main() {
  const written: unknown[] = [];
  let differences = 0;
  for (const c of CASES.filter((x) => !only || x.name.includes(only))) {
    const region = c.scope === "region" ? await resolveTargetRegionNation(c.urn) : null;
    const scope = c.scope === "region" && region?.regionCode && region.regionName ? { kind: "region" as const, code: region.regionCode, name: region.regionName } : NATIONAL;
    const filters: RankingFilters = { ...defaultRankingFilters(scope), ...(c.filters ?? {}) };
    const population = await cachedRankingPopulation(scope.kind === "region" ? scope.code : null, c.phase, null);
    const req: SubjectRankingRequest = {
      urns: population.filter((r) => matchesRanking(r, filters)).map((r) => r[0]),
      targetUrn: c.urn,
      phase: c.phase,
      subject: c.subject,
      familyId: c.family,
      qualificationType: c.qual,
      measure: c.measure,
      period: null,
    };
    let t0 = performance.now();
    const app = rankFigures(req, await fallbackFigures(req));
    const appMs = Math.round(performance.now() - t0);
    t0 = performance.now();
    const fn = await rankByFunction(req);
    const fnMs = Math.round(performance.now() - t0);
    const where = scope.kind === "region" ? scope.name : "England";
    const head = `${c.name}: ${where}, ${req.urns.length.toLocaleString()} schools; rank ${app.targetRank ?? "-"} of ${app.ranked} (${app.period ?? "no year"}${app.inRanking ? "" : ", school not in the ranking"}); fallback ${appMs} ms`;
    if (fn) {
      const fnDoc: Partial<typeof fn> = { ...fn };
      delete fnDoc.source;
      const bad = close(app, fnDoc, "", []);
      differences += bad.length ? 1 : 0;
      console.log(`${head}; function ${fnMs} ms; ${bad.length ? `${bad.length} DIFFERENCES` : "IDENTICAL"}`);
      for (const b of bad.slice(0, 5)) console.log("    ", b);
    } else console.log(`${head}; function not applied yet`);
    written.push({ name: c.name, ms: appMs, args: rankRpcArgs(req), ts: app });
  }
  if (out) writeFileSync(out, JSON.stringify(written));
  process.exit(differences ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
