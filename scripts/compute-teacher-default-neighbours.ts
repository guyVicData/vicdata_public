// VicData 0.6.7 (Part 2 A): the Teacher view's Post-16 default comparison set, precomputed.
//
//   npx -y tsx --env-file=.env scripts/compute-teacher-default-neighbours.ts --out DIR [--urns a,b,c] [--sample N] [--seed S] [--concurrency 4]
//   npx -y tsx --env-file=.env scripts/compute-teacher-default-neighbours.ts --verify DIR [--concurrency 4]
//
// Runs the app's OWN function for each school -- exactly what resolveDefaultNearest does at
// Post-16 before ranking the set: buildDefaultComparatorLists(urn, { only: "nearest", post16:
// true }) then resolveNearestOption(list1, boardingBand, boardingRecipe, null), the school
// itself removed -- so the stored list cannot drift from the live one. Why an app script and
// not Python in the ingest repo: the inputs live in the app's own Supabase project (schools,
// school_nearest_neighbours, the nearest_schools RPC) and its TypeScript typology
// (effectivePhaseTags, phaseTags, genderTag) -- data and rules the ingest doesn't have.
//
// Read-only: the anon key only (the same reads the live route makes). It writes two files:
//   DIR/teacher_default_neighbours.csv   entity_id,rank,neighbour_id,distance_km
//   DIR/stamp.json                       list_kind, census_period, ks5_periods, computed_at, schools
// which the ingest repo's backfill_teacher_default_neighbours.py loads into vicdata-production
// (the write happens there, with the ingest's own credentials; no write key here).
//
// Which schools: every school whose Teacher page offers Post-16 (the app's own test,
// teacher-view-phases.ts hasCurrentPhaseData: a KS5 row in the current national period with
// usable data), except FE colleges, whose default is the nearest FE colleges (not precomputed).
//
// --verify DIR recomputes every school in DIR's CSV in this process and compares: same
// schools, same order, same distances (exactly). Exit 1 on any mismatch.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildDefaultComparatorLists } from "../src/lib/default-comparator-lists";
import { resolveNearestOption } from "../src/lib/nearest-option";
import { CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";
import { fetchAcademicProfiles } from "../src/lib/academic-data-view";
import { hasCurrentPhaseData } from "../src/lib/teacher-view-phases";
import { lookupAcademicCurrentPeriods, lookupAcademicHeadline } from "../src/lib/vicdata-reference";

export const LIST_KIND = "post16_nearest_10";
type Row = { urn: string; distanceKm: number | null };

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** The Post-16 default set exactly as resolveDefaultNearest builds it, before resolveFixedSet. */
export async function post16DefaultList(urn: string): Promise<{ fe: boolean; rows: Row[] }> {
  const lists = await buildDefaultComparatorLists(urn, { only: "nearest", post16: true });
  if (lists.schoolTypeCategory === "fe_college") return { fe: true, rows: [] };
  const chosen = resolveNearestOption(lists.list1, lists.boardingBand, lists.boardingRecipe, null);
  return { fe: false, rows: (chosen?.schools ?? []).filter((s) => s.urn !== urn).map((s) => ({ urn: s.urn, distanceKm: s.distanceKm })) };
}

async function eligibleSchools(ks5Current: number): Promise<string[]> {
  const rows = await lookupAcademicHeadline({ ksStage: "ks5", periodMin: ks5Current, periodMax: ks5Current });
  const candidates = Array.from(new Set(rows.map((r) => r.entity_id))).sort();
  const out: string[] = [];
  for (let i = 0; i < candidates.length; i += 50) {
    const profiles = await fetchAcademicProfiles(candidates.slice(i, i + 50));
    for (const p of profiles) if (hasCurrentPhaseData(p, "ks5", { ks5: ks5Current })) out.push(p.urn);
  }
  return out.sort();
}

async function pool<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const csvRows = (urn: string, rows: Row[]) => rows.map((r, i) => `${urn},${i + 1},${r.urn},${r.distanceKm === null ? "" : r.distanceKm}`);

async function main() {
  const concurrency = Number(arg("concurrency") ?? 4);
  const verify = arg("verify");
  if (verify) {
    const lines = readFileSync(path.join(verify, "teacher_default_neighbours.csv"), "utf8").trim().split("\n").slice(1);
    const stored = new Map<string, string[]>();
    for (const l of lines) (stored.get(l.split(",")[0]) ?? stored.set(l.split(",")[0], []).get(l.split(",")[0])!).push(l);
    const stamp = JSON.parse(readFileSync(path.join(verify, "stamp.json"), "utf8")) as { schools: string[] };
    let bad = 0;
    const t0 = Date.now();
    await pool(stamp.schools, concurrency, async (urn) => {
      const fresh = csvRows(urn, (await post16DefaultList(urn)).rows);
      const was = stored.get(urn) ?? [];
      if (fresh.join("|") !== was.join("|")) {
        bad++;
        console.log(`MISMATCH ${urn}\n  stored: ${was.map((l) => l.split(",").slice(2).join("@")).join(" ")}\n  live:   ${fresh.map((l) => l.split(",").slice(2).join("@")).join(" ")}`);
      }
    });
    console.log(`verified ${stamp.schools.length} schools: ${bad} mismatches (${Math.round((Date.now() - t0) / 1000)} s)`);
    process.exit(bad ? 1 : 0);
  }
  const out = arg("out");
  if (!out) throw new Error("--out DIR or --verify DIR");
  const periods = await lookupAcademicCurrentPeriods();
  const ks5 = periods.ks5 ?? null;
  if (ks5 === null) throw new Error("no current KS5 period");
  let schools = arg("urns") ? arg("urns")!.split(",") : await eligibleSchools(ks5);
  const sample = arg("sample");
  if (sample) {
    let s = Number(arg("seed") ?? 1);
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    schools = [...schools].map((u) => [rand(), u] as const).sort((a, b) => a[0] - b[0]).slice(0, Number(sample)).map((x) => x[1]).sort();
    const extra = (arg("plus") ?? "").split(",").filter(Boolean);
    schools = Array.from(new Set([...schools, ...extra])).sort();
  }
  const t0 = Date.now();
  const times: number[] = [];
  const results = await pool(schools, concurrency, async (urn, i) => {
    const t = Date.now();
    const r = await post16DefaultList(urn);
    times.push(Date.now() - t);
    if (i % 100 === 0) console.log(`${i}/${schools.length} ${Math.round((Date.now() - t0) / 1000)} s`);
    return { urn, ...r };
  });
  const kept = results.filter((r) => !r.fe);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "teacher_default_neighbours.csv"), ["entity_id,rank,neighbour_id,distance_km", ...kept.flatMap((r) => csvRows(r.urn, r.rows))].join("\n") + "\n");
  writeFileSync(
    path.join(out, "stamp.json"),
    JSON.stringify({ list_kind: LIST_KIND, census_period: CURRENT_CENSUS_PERIOD, ks5_periods: [ks5 - 1, ks5], computed_at: new Date().toISOString(), schools: kept.map((r) => r.urn) }, null, 1),
  );
  times.sort((a, b) => a - b);
  console.log(
    `${kept.length} schools (${results.length - kept.length} FE colleges skipped), ${kept.reduce((a, r) => a + r.rows.length, 0)} rows, ${kept.filter((r) => r.rows.length < 10).length} with fewer than 10; ` +
      `${Math.round((Date.now() - t0) / 1000)} s at concurrency ${concurrency}; per school median ${times[Math.floor(times.length / 2)]} ms, p95 ${times[Math.floor(times.length * 0.95)]} ms`,
  );
  process.exit(0);
}

if (process.argv[1]?.endsWith("compute-teacher-default-neighbours.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
