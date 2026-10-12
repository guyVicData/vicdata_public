// VicData 0.7 admissions r1: the report's hand-checks -- The Chase's 11+ ladder and King's
// Worcester's 11+ market share, from the raw census rows, then the library's results. Read-only.
//   npx -y tsx --env-file=.env docs/v0.7/audit_scripts/admissions_r1_handcheck.ts
import { buildPipeline } from "../../../src/lib/admissions/pipeline";
import { buildMarketShare } from "../../../src/lib/admissions/market";
import { entryPoint } from "../../../src/lib/admissions/entry-points";
import { lookupReferenceData } from "../../../src/lib/vicdata-reference";

const ft = (age: number) => [`full_time_male_aged_${age}`, `full_time_female_aged_${age}`];
async function rawAt(urns: string[], age: number, period: number) {
  const rows = await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: urns, periodMin: period, periodMax: period, breakdowns: ft(age) });
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.entity_id, (by.get(r.entity_id) ?? 0) + (r.value_numeric ?? 0));
  return by;
}
async function main() {
  const p = await buildPipeline("137625", entryPoint("11+")!, { today: new Date("2026-10-07") });
  const set = p.sets.find((s) => s.age === 10)!.urns;
  console.log("## The Chase 137625, 11+ (15 nearest state primaries)\n");
  console.log("| School | age 10, 2024/25 (-> 2025 entry) | age 10, 2025/26 (-> 2026) | age 9, 2025/26 (-> 2027) | age 4, 2025/26 (-> 2032) |\n|---|---|---|---|---|");
  const [a10_24, a10_25, a9_25, a4_25] = await Promise.all([rawAt(set, 10, 2024), rawAt(set, 10, 2025), rawAt(set, 9, 2025), rawAt(set, 4, 2025)]);
  const tot = [0, 0, 0, 0];
  for (const u of set) {
    const v = [a10_24.get(u) ?? 0, a10_25.get(u) ?? 0, a9_25.get(u) ?? 0, a4_25.get(u) ?? 0];
    v.forEach((x, i) => (tot[i] += x));
    console.log(`| ${p.schools[u]?.name ?? u} (${u}) | ${v.join(" | ")} |`);
  }
  console.log(`| **Sum** | **${tot.join("** | **")}** |\n`);
  const own = await rawAt(["137625"], 11, 2025);
  console.log(`The Chase's own age-11 pupils, 2025/26: ${own.get("137625")}.`);
  console.log("\nLibrary:");
  for (const x of p.ladder.past.slice(-2)) console.log(`- ${x.entryYear} pool ${x.pool} (${x.source}, age ${x.rungAge}, census ${x.censusPeriod})`);
  for (const x of p.ladder.future) console.log(`- ${x.entryYear} pool ${Math.round(x.pool!)} [${Math.round(x.low!)}-${Math.round(x.high!)}] (${x.source}${x.rungAge !== null ? `, age ${x.rungAge}` : `, born ${x.birthYear}`}, ${x.yearsToGo} steps)`);
  console.log(`- drift ${p.ladder.drift?.low.toFixed(4)}-${p.ladder.drift?.high.toFixed(4)} (${p.ladder.drift?.n} matched ratios); births calibration ${p.ladder.calibration?.mean.toFixed(4)} (${p.ladder.calibration?.low.toFixed(4)}-${p.ladder.calibration?.high.toFixed(4)}); blend ${p.blend.map((b) => `${b.laName} ${(b.weight * 100).toFixed(1)}%`).join(", ")}`);
  console.log(`- current share needed: ${p.hold.current?.cohort} / ${p.hold.current?.pool} = ${p.hold.current?.share.toFixed(2)}%; 2027 ${p.hold.needed[0].share?.toFixed(2)}%`);

  const m = await buildMarketShare("117037", entryPoint("11+")!);
  const urns = ["117037", ...m.rivals];
  console.log("\n## King's School, Worcester 117037, 11+ market share (10 nearest schools teaching Year 7)\n");
  console.log("| School | age 11, 2023/24 | 2024/25 | 2025/26 |\n|---|---|---|---|");
  const ys = await Promise.all([2023, 2024, 2025].map((y) => rawAt(urns, 11, y)));
  const t2 = [0, 0, 0];
  for (const u of urns) {
    const v = ys.map((y) => y.get(u) ?? 0);
    v.forEach((x, i) => (t2[i] += x));
    console.log(`| ${m.schools[u]?.name ?? u} (${u}) | ${v.join(" | ")} |`);
  }
  console.log(`| **Sum** | **${t2.join("** | **")}** |\n`);
  for (const y of [2023, 2024, 2025]) {
    const r = m.entryAge.rows.find((x) => x.urn === "117037" && x.period === y)!;
    console.log(`- ${y}: King's ${r.count} / ${m.entryAge.totals[y]} = ${r.share?.toFixed(2)}%, rank ${r.rank} of ${urns.length}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
