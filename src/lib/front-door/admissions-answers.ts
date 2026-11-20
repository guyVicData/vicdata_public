// VicData 0.8 review fixes (14 Nov, M1 and M3): the Admissions walks' written answers, one per view, from
// the dashboard routes' own answers (pipeline, market share, rivals) -- the figures the view draws. Every
// screen answers its own question in a sentence; a missing figure says so in one honest sentence, never a
// blank or a fragment ("…from births after that. up 3%"). Pure, so the tests run it on fixtures.
import { periodLabel } from "@/catalogue/years";
import type { MarketView, PipelineView, RivalsView } from "@/lib/admissions/views-api";
import { changedWords, listJoin, num, ordinal, pctWords, placeOf, plural } from "./words";

type PipelineOk = Exclude<PipelineView, { empty: string }>;
export type AdmissionsAnswerData = { label: string; p: PipelineOk | null; m: MarketView | null; r: RivalsView | null };

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : num(v));
const lastPt = <T extends { value: number | null }>(pts: T[]) => [...pts].reverse().find((x) => x.value !== null) ?? null;

/** The feeder schools behind the pool, each counted once (a school in two rungs' sets is one school). */
export function feederCount(p: PipelineOk): number {
  return new Set(p.rungSets.flatMap((s) => s.schools.map((x) => x.urn)).filter((u) => u !== p.school?.urn)).size;
}

export function admissionsAnswer(view: string, d: AdmissionsAnswerData): string {
  const { label, p, m, r } = d;
  const noPool = `No pool is published for ${label} yet.`;
  const noMarket = `No market share is published for ${label} yet.`;
  switch (view) {
    case "DV-ADM-P-NOW": {
      if (!p) return noPool;
      const past = p.ladder.past.filter((x) => x.pool !== null);
      const last = past[past.length - 1];
      const cohort = p.now.cohort;
      const pool = last ? `${n(last.pool)} children were in the ${label} pool for September ${last.entryYear}` : `No ${label} pool is counted yet`;
      return `${pool}; ${cohort === null ? "the school has no census count at that age yet" : `the school had ${n(cohort)} at ${label} in ${periodLabel(p.now.period)}`}.`;
    }
    case "DV-ADM-P-PIPELINE": {
      if (!p) return noPool;
      const c = p.change;
      if (!c) return `The pool for ${label} year by year: counted where the census has the children, from births after that.`;
      return `The ${label} pool goes from ${n(c.from)} in ${c.fromYear} to ${n(c.to)} in ${p.changeYear ?? "later years"} (${pctWords(c.pct)}): counted where the census has the children, from births after that.`;
    }
    case "DV-ADM-P-MAP": {
      if (!p) return noPool;
      const k = feederCount(p);
      return k ? `${plural(k, "feeder school")} make the ${label} pool; the map sizes each by its pupils aged ${p.poolTrends.age} and colours it by trend.` : `No feeder schools are listed for ${label} yet.`;
    }
    case "DV-ADM-P-HOLD-LINE":
    case "DV-ADM-P-HOLD-TABLE": {
      // Leighton Park prep (20 Nov): the SMT Pupils walk ends here. A requirement, not a forecast (R-ADM-HOLD-SHARE).
      if (!p) return noPool;
      const h = p.hold;
      const needed = h.needed.filter((x) => x.share !== null);
      if (!h.current || !needed.length) return `No share needed can be worked out for ${label}: the school has no entry cohort or pool there yet.`;
      // The year the dashboard's own view marks (ShareNeeded's target): the pipeline's change year, else the fourth.
      const far = needed.find((x) => x.entryYear === p.changeYear) ?? needed[Math.min(3, needed.length - 1)];
      const now = h.current.share;
      const gap = far.share! - now;
      const how = Math.abs(gap) < 0.5 ? "about the same share as now" : gap > 0 ? `${gap.toFixed(1)} points more than now` : `${Math.abs(gap).toFixed(1)} points less than now`;
      return `To take ${n(h.current.cohort)} at ${label} again, the school needs ${far.share!.toFixed(1)}% of the pool by September ${far.entryYear} (${how}: ${now.toFixed(1)}% in ${h.current.entryYear}). A requirement, not a forecast.`;
    }
    case "DV-ADM-P-POOL-INDEXED": {
      if (!p) return noPool;
      const t = p.poolTrends;
      const f = lastPt(t.indexed.feeders);
      if (!f || t.base === null || f.year === t.base) return `Not enough past pools yet to say whether the ${label} pool is growing.`;
      const la = lastPt(t.indexed.la);
      const en = lastPt(t.indexed.england);
      const others = [la && la.year === f.year ? `${t.laName ?? "the LA"} ${pctWords(la.value! - 100)}` : "", en && en.year === f.year ? `England ${pctWords(en.value! - 100)}` : ""].filter(Boolean);
      const dir = f.value! - 100 > 0.5 ? "Growing" : f.value! - 100 < -0.5 ? "Shrinking" : "Holding level";
      return `${dir}: your feeders' ${t.age}-year-olds have ${changedWords(f.value! - 100)} since ${periodLabel(t.base)}${others.length ? `, against ${listJoin(others)}` : ""}.`;
    }
    case "DV-ADM-P-ENTRY-LINE": {
      if (!p) return noPool;
      if (p.now.cohort === null) return `The school has no census count at ${label} yet.`;
      return `${n(p.now.cohort)} at ${label} in ${periodLabel(p.now.period)}${p.now.changePct !== null && p.now.base ? `, ${pctWords(p.now.changePct)} since ${periodLabel(p.now.base.period)}` : ""}.`;
    }
    case "DV-ADM-M-NOW": {
      const s = m?.summary;
      if (!s || s.share == null) return noMarket;
      return `${s.share.toFixed(1)}% of the ${label} pupils at you and your rivals joined you in ${periodLabel(s.latest)}${s.rank ? `, ${placeOf(s.rank, s.of, "schools by share")}` : ""}.`;
    }
    case "DV-ADM-M-BARS": {
      if (!m) return noMarket;
      const rows = m.entryAge.rows.filter((x) => x.period === m.summary.latest && x.share !== null).sort((a, b) => b.share! - a.share!);
      const lead = rows[0];
      if (!lead) return noMarket;
      const name = (u: string) => m.schools[u]?.name ?? u;
      const me = m.summary.rank ? placeOf(m.summary.rank, m.summary.of, "by share") : null;
      return lead.urn === m.urn
        ? `You hold the largest share at ${label}: ${lead.share!.toFixed(1)}% in ${periodLabel(m.summary.latest)}, 1st of ${m.summary.of}.`
        : `${name(lead.urn)} holds the largest share at ${label} (${lead.share!.toFixed(1)}% in ${periodLabel(m.summary.latest)})${me ? `; you are ${me}` : ""}.`;
    }
    case "DV-ADM-M-MAP": {
      if (!m) return noMarket;
      const d2 = m.extras.filter((e) => e.urn !== m.urn && e.distanceKm !== null).map((e) => e.distanceKm!);
      if (!m.summary.rivals) return `No rivals are listed for ${label} yet.`;
      return `${plural(m.summary.rivals, "rival")} on the map${d2.length ? `, from ${Math.min(...d2).toFixed(1)} km to ${Math.max(...d2).toFixed(1)} km away` : ""}; each is sized by its pupils aged ${m.entry?.age ?? ""}.`.replace(/aged \./, "at the entry age.");
    }
    case "DV-ADM-M-MOMENTUM": {
      if (!m) return noMarket;
      const name = (u: string) => m.schools[u]?.name ?? u;
      const ch = Object.entries(m.summary.shareChange).filter((e): e is [string, number] => e[1] !== null).sort((a, b) => b[1] - a[1]);
      if (!ch.length) return `Not enough years of share yet to see who is gaining at ${label}.`;
      const top = ch[0];
      const bottom = ch[ch.length - 1];
      const pp = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} percentage points`;
      const who = (u: string) => (u === m.urn ? "you" : name(u));
      const since = periodLabel(m.summary.first);
      if (top[1] <= 0) return `No school has gained share at ${label} since ${since}; ${who(bottom[0])} lost the most (${pp(bottom[1])}).`;
      return `Since ${since}, ${who(top[0])} gained the most share at ${label} (${pp(top[1])})${bottom[1] < 0 ? ` and ${who(bottom[0])} lost the most (${pp(bottom[1])})` : ""}.`.replace(/^Since (\S+), you/, "Since $1, you");
    }
    case "DV-ADM-M-SHARE-LINE": {
      const s = m?.summary;
      if (!s || s.share == null) return noMarket;
      if (s.changePts == null || s.first === s.latest) return `Your share at ${label} is ${s.share.toFixed(1)}% in ${periodLabel(s.latest)}; there's only one year so far.`;
      return `Your share at ${label} has ${changedWords(s.changePts, 1, " percentage points")} since ${periodLabel(s.first)}, to ${s.share.toFixed(1)}% in ${periodLabel(s.latest)}.`;
    }
    case "DV-ADM-M-ACAD-RANK": {
      const o = r?.overall;
      if (!r) return `No rivals' results are published for ${label} yet.`;
      if (!o) return `The school has no ranked headline result${r.resultsPeriod ? ` for ${periodLabel(r.resultsPeriod)}` : ""}, so it isn't placed among its rivals.`;
      return `${ordinal(o.rank)} of ${o.of} among you and your rivals on ${o.measure}${r.resultsPeriod ? ` in ${periodLabel(r.resultsPeriod)}` : ""}${o.national ? `; ${placeOf(o.national.rank, o.national.of, "in England")}` : ""}.`;
    }
  }
  return `See this view on the dashboard for ${label}.`;
}
