// 0.8 SMT feedback round 1: the round's figures for the report, read-only, through the app's own lib.
//   npx -y tsx --env-file=.env docs/v0.8/audit_scripts/smt_fb1/figures.ts [urn ...]
import { smtSchool } from "../../../../src/lib/smt/school";
import { buildOverview } from "../../../../src/lib/smt/overview";
import { buildPupils } from "../../../../src/lib/smt/pupils";
import { resolveDefaultNearest } from "../../../../src/lib/chooser-sets";
import { setPhaseOf } from "../../../../src/lib/smt/levels";

async function one(urn: string) {
  const school = (await smtSchool(urn))!;
  const near = await resolveDefaultNearest(urn, setPhaseOf(school.phases));
  const set = { kind: "nearest", label: setPhaseOf(school.phases) === "ks5" ? "10 nearest with a sixth form or 16+ provision" : "10 nearest schools", urns: near.rows.map((r: { urn: string }) => r.urn).filter((u: string) => u !== urn) };
  const o = await buildOverview(school, set, { sex: "all", boarding: "all" }, null);
  const p = await buildPupils(school, set, { sex: "all", boarding: "all" }, { phase: "whole", area: null }, null);
  console.log(`\n== ${school.name} (${urn}) independent=${school.independent} boarding=${school.boarding} igcse=${!!school.phases.igcse} set="${o.set.label}" short="${o.set.short}"`);
  for (const r of o.rows) console.log(`  ${r.label.padEnd(34)} ${String(r.value).padEnd(10)} set=${r.set ? `${r.set.rank}/${r.set.of}` : "-"} region=${r.region ? `${r.region.rank}/${r.region.of} ${r.region.name}` : "-"} england=${r.england ? `${r.england.rank}/${r.england.of}` : "-"} trend=${r.since ? `${r.since.change.toFixed(2)} ${r.since.unit} ${r.since.period}` : "-"}`);
  console.log("  entry tiles:", JSON.stringify(o.now.entry));
  console.log("  pupils leaving (last):", JSON.stringify(p.leaving.at(-1)));
  console.log("  p8:", o.p8.status);
}
(async () => {
  const urns = process.argv.slice(2);
  for (const u of urns.length ? urns : ["110110", "137625"]) await one(u);
})();
