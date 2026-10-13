// VicData 0.8 SMT round 1 (R-SMT-YEARS): run under the synthetic GCSE 2025/26 (install-ks4-2025.ts)
// and print, as JSON on the last line, the years SMT's scorecard reads -- GCSE's should move to
// 2025 (provisional), Post-16's stay put. Read-only. Used by scripts/catalogue-rule-tests.ts.
import { smtSchool } from "../../src/lib/smt/school";
import { buildOverview } from "../../src/lib/smt/overview";
import { resolveDefaultNearest } from "../../src/lib/chooser-sets";

const urn = "137625";
const school = (await smtSchool(urn))!;
const near = await resolveDefaultNearest(urn, "ks4");
const o = await buildOverview(school, { kind: "nearest", label: "10 nearest schools", urns: near.rows.map((r: { urn: string }) => r.urn).filter((u: string) => u !== urn) }, { sex: "all", boarding: "all" }, null);
const a8 = o.rows.find((r) => r.key === "attainment8_average")?.period ?? null;
const aps = o.rows.find((r) => r.key === "A level::aps_per_entry")?.period ?? null;
console.log(JSON.stringify({ a8, aps, provisional: school.latest.ks4?.provisional ?? false }));
