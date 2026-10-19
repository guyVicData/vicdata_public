// 0.8 SMT feedback round 2: SMT Overview under three comparison sets, read-only, through the routes' own
// functions -- the default "10 nearest with a sixth form or 16+ provision", "Local rivals" (its 5 nearest)
// and a saved-style set (its 6th-10th nearest and the next 5 nearby). Used by the report and the rule runners.
//   npx -y tsx --env-file=.env docs/v0.8/audit_scripts/smt_fb2/sets.ts [urn]
import { smtSchool, type SmtSchool } from "../../../../src/lib/smt/school";
import { buildOverview, type Overview, type SmtSet } from "../../../../src/lib/smt/overview";
import { resolveDefaultNearest } from "../../../../src/lib/chooser-sets";
import { setPhaseOf } from "../../../../src/lib/smt/levels";
import { nearbyCandidates } from "../../../../src/lib/admissions/rungs";

export async function threeSets(urn: string): Promise<{ school: SmtSchool; sets: SmtSet[] }> {
  const school = (await smtSchool(urn))!;
  const phase = setPhaseOf(school.phases);
  const near = (await resolveDefaultNearest(urn, phase)).rows.map((r: { urn: string }) => r.urn).filter((u: string) => u !== urn);
  const more = (await nearbyCandidates(urn)).map((c) => c.urn).filter((u) => u !== urn && !near.includes(u)).slice(0, 5);
  return {
    school,
    sets: [
      { kind: "nearest", label: phase === "ks5" ? "10 nearest with a sixth form or 16+ provision" : "10 nearest schools", urns: near },
      { kind: "urns", label: "Local rivals", urns: near.slice(0, 5) },
      { kind: "saved", label: "Our saved comparison set", urns: [...near.slice(5), ...more] },
    ],
  };
}

export const overviewFor = (school: SmtSchool, set: SmtSet) => buildOverview(school, set, { sex: "all", boarding: "all" }, null);

export function summary(o: Overview): string[] {
  const out = [`set "${o.set.label}" (${o.set.size} schools), short "${o.set.short}"`];
  for (const r of o.rows) out.push(`  ${r.label}: set ${r.set ? `${r.set.rank}/${r.set.of} (${r.set.label})` : "-"} region ${r.region ? `${r.region.rank}/${r.region.of}` : "-"} england ${r.england ? `${r.england.rank}/${r.england.of}` : "-"}`);
  out.push(`  sizes: ${o.now.setSizes.map((b) => `${b.label} ${b.total} ${b.rank}/${b.of} median ${b.median === null ? "-" : Math.round(b.median)}`).join("; ")}`);
  out.push(`  roll lines: ${o.trends.roll.lines.map((l) => `${l.key}="${l.label}"`).join(", ")} (base ${o.trends.roll.base})`);
  const m = o.trends.market;
  out.push(`  market: ${m.status === "ready" ? `${m.rivals} rivals, against "${m.setRivals}", largest ${m.rivalName}, share ${m.school.at(-1)?.value?.toFixed(1)}%` : m.reason}`);
  out.push(`  map schools: ${Object.keys(o.schools).length}; results bands: ${o.trends.results.map((t) => `${t.stage} n=${t.band.at(-1)?.n}`).join(", ")}`);
  return out;
}

if (process.argv[1]?.endsWith("sets.ts")) {
  (async () => {
    for (const urn of process.argv.slice(2).length ? process.argv.slice(2) : ["110110"]) {
      const { school, sets } = await threeSets(urn);
      console.log(`\n== ${school.name} (${urn}) boarding=${school.boarding}`);
      for (const s of sets) for (const l of summary(await overviewFor(school, s))) console.log(l);
    }
  })();
}
