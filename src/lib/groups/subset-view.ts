// VicData 0.8 group sets, M5 (brief v2 §6; R-GROUP-SUBSET-FILTER): a subset of the group's own schools
// applied to a Group page. Pure and client-safe. It FILTERS every list of schools -- the Schools table,
// the map, Joined and left, Schools ranked, value added, entry cohorts, leaving at 16, market share, the
// per-school projections -- and never touches a group-level figure: the group's own figures stay
// whole-group ("Showing 18 of 59 schools · group figures are for all 59"). No subset sums. A school that
// has left the group drops out of the filter (subsetFilter), and the page says so.
import type { GroupOverview, GroupSchools } from "./dash";
import type { GroupAcademic, GroupPupils } from "./dash-r3";
import { allSchoolsWords, leftWords, showingWords, subsetFilter, type GroupSetRow } from "./group-sets";

type Urned = { urn: string };
export type SubsetDash = {
  map?: (Urned & Record<string, unknown>)[];
  membership: (Urned & Record<string, unknown>)[];
  schools?: GroupSchools;
  academic?: GroupAcademic;
  pupils?: GroupPupils;
  overview?: GroupOverview;
  now?: GroupOverview;
};

export type SubsetApplied = { kept: Set<string>; left: string[]; line: string; leftLine: string | null; n: number; total: number };

/** The subset in force: its schools still in the group (`current`), the ones that have left, the line. */
export function subsetOf(set: Pick<GroupSetRow, "members"> | null, current: string[], total: number): SubsetApplied | null {
  if (!set) return null;
  const { kept, left } = subsetFilter(set.members, current);
  return { kept: new Set(kept), left, line: showingWords(kept.length, total), leftLine: left.length ? leftWords(left.length) : null, n: kept.length, total };
}

/** The page's answer with every list of schools narrowed to the subset; group figures as they were. */
export function filterDash<D extends SubsetDash>(d: D, keep: Set<string>): D {
  const has = (x: Urned) => keep.has(x.urn);
  const out: D = { ...d, membership: d.membership.filter(has) };
  if (d.map) out.map = d.map.filter(has);
  if (d.schools) {
    const rows = d.schools.rows.filter(has);
    out.schools = { ...d.schools, rows, counts: { listed: d.schools.counts.listed, shown: rows.length, withHeadline: rows.filter((r) => r.headline).length, withoutHeadline: rows.filter((r) => !r.headline).length } };
  }
  if (d.academic) {
    const a = d.academic;
    out.academic = {
      ...a,
      headlines: a.headlines.map((h) => ({ ...h, excluded: h.excluded.filter(has) })),
      ranked: { ...a.ranked, rows: a.ranked.rows.filter(has) },
      va: { alevel: { ...a.va.alevel, rows: a.va.alevel.rows.filter(has) }, p8: { ...a.va.p8, rows: a.va.p8.rows.filter(has) } },
    };
  }
  if (d.pupils) {
    const p = d.pupils;
    out.pupils = { ...p, entries: p.entries.filter(has), leaving: p.leaving.filter(has), market: { ...p.market, rows: p.market.rows.filter(has) } };
  }
  return out;
}

/** The Showing selector's default row: "All 59 schools". */
export const allRow = (total: number) => ({ key: "all", name: allSchoolsWords(total), countText: `${total} school${total === 1 ? "" : "s"}` });
