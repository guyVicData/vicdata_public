// 0.8 SMT Academic (R-SMT-YEARS): run under the synthetic Post-16 2025/26 (install-ks5-2025.ts) and print,
// as JSON on the last line, the years Academic's Post-16 views read in each mode -- every trend should run
// to 2025 with no code change, value added from 2023/24. Read-only.
import { smtSchool } from "../../src/lib/smt/school";
import { academicOffer, buildAcademic } from "../../src/lib/smt/academic";
import { parseAcademic } from "../../src/lib/smt/qual-groups";

const s = (await smtSchool("100053"))!;
const offer = await academicOffer(s);
const out: Record<string, unknown> = {};
for (const mode of ["results", "entries", "va"]) {
  const a = await buildAcademic(s, parseAcademic(new URLSearchParams(`level=post16&mode=${mode}&group=alevel`), offer), { kind: "nearest", label: "", urns: [] });
  out[mode] = { period: a.period, trend: a.trends.school.map((p) => p.year), alevel: a.lines.find((l) => l.key === "alevel")?.value ?? null, last: a.lines.find((l) => l.key === "alevel")?.last ?? null };
}
console.log(JSON.stringify(out));
process.exit(0);
