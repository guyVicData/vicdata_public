// VicData 0.8 SMT Academic by qualification: each qualification group's comparison set (R-SMT-GROUP-SETS;
// plan §2 "Comparison sets", prompt §2). Server-only.
//
// Default: the 10 nearest schools offering that qualification, widening the net -- Teacher's rule reused
// end to end (findSurroundingSchools: the same distance order, sector, phase and gender rules and the same
// widen-the-net backfill, the Teacher default's relaxed gender rule) with one filter on top, "offers the
// qualification" (the academic comparator widen's exact-qualification filter, here per SMT group). The
// pill names it ("10 nearest offering IB"). A set the SMT chose holds across groups: each view keeps that
// set's schools offering the group and says how many ("4 of 12 offer EPQ").
//
// GCSE value added at an independent or IGCSE school (R-SMT-VA-INDEPENDENT): the 10 nearest STATE
// schools with Progress 8 (independents have none).
import { cachedReference } from "../server-cache";
import { schoolSyncStamp } from "../school-sync-stamp";
import { findSurroundingSchools } from "../surrounding-schools";
import { buildDefaultComparatorLists } from "../default-comparator-lists";
import { resolveNearestOption } from "../nearest-option";
import { CURRENT_CENSUS_PERIOD, PROGRESS8_LAST_PERIOD } from "@/catalogue/years";
import { APPLIED_KEY, APPLIED_LABEL, GROUP_LABEL, groupOfQualification, type AppliedType, type RealGroup } from "./qual-groups";
import { figure, population, SMT_MEASURES, type Population } from "./population";
import { qualRows } from "./academic-data";

export type GroupSet = { kind: string; label: string; urns: string[]; chosen: boolean; reachKm: number | null };

/** Which of these schools offer a Post-16 group: entries (or a published figure) in either of the two
 * latest years. Headline groups from the national headline read (no extra read); EPQ, Core Maths and AS
 * from the subject x qualification rollup, for these schools only. */
export async function offering(group: RealGroup, urns: string[], latest: number, pop?: Population, applied?: AppliedType): Promise<Set<string>> {
  const years = [latest, latest - 1];
  if (group === "epq" || group === "coremaths" || group === "as") {
    const rows = await qualRows(urns, "ks5", latest - 1);
    return new Set(rows.filter((r) => years.includes(r.period) && groupOfQualification(r.qualification) === group).map((r) => r.urn));
  }
  const p = pop ?? (await population("ks5"));
  const has = (u: string, k: string) => years.some((y) => (figure(p, u, y, k) ?? 0) > 0);
  return new Set(
    urns.filter((u) =>
      group === "alevel"
        ? has(u, "A level::aps_per_entry") || has(u, "bucket:alevel::entries")
        : group === "applied" && applied
          ? has(u, `${APPLIED_KEY[applied]}::aps_per_entry`) || has(u, `${APPLIED_KEY[applied]}::value_added`)
          : group === "applied"
          ? has(u, "Applied general::aps_per_entry") || has(u, "Tech level::aps_per_entry") || has(u, "bucket:btec_ocr::entries")
          : group === "ib"
            ? has(u, "bucket:ib::entries")
            : has(u, "bucket:tlevel::entries"),
    ),
  );
}

const reach = (m: { easting: number | null; northing: number | null }[], at: { easting: number | null; northing: number | null } | null) => {
  if (!at || at.easting === null || at.northing === null) return null;
  const d = m.filter((x) => x.easting !== null && x.northing !== null).map((x) => Math.hypot(x.easting! - at.easting!, x.northing! - at.northing!) / 1000);
  return d.length ? Math.max(...d) : null;
};

/** A group's default set: the 10 nearest offering it (cached per school, group and sync). Applied is
 * per DfE type (Applied general, Tech level): each line ranks among schools with that type. */
export async function groupDefaultSet(urn: string, group: RealGroup, latest: number, at: { easting: number | null; northing: number | null } | null, applied?: AppliedType): Promise<GroupSet> {
  const sync = await schoolSyncStamp();
  const t = group === "applied" ? applied : undefined;
  return cachedReference(`smt:groupset:${urn}:${group}:${t ?? ""}:${latest}:sync:${sync}`, async () => {
    const pop = await population("ks5");
    const matched = await findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { genderMode: "relaxed", filterBeforeFacts: true, extraFilterUrns: (c) => offering(group, c, latest, pop, t) });
    const urns = matched.map((m) => m.urn).filter((u) => u !== urn);
    return { kind: "nearest", label: `${urns.length} nearest offering ${t ? APPLIED_LABEL[t] : GROUP_LABEL[group]}`, urns, chosen: false, reachKm: reach(matched, at) };
  });
}

/** An independent or IGCSE school's GCSE value-added set: the 10 nearest state schools with Progress 8. */
export async function stateP8Set(urn: string, at: { easting: number | null; northing: number | null } | null): Promise<GroupSet> {
  const sync = await schoolSyncStamp();
  return cachedReference(`smt:state-p8-set:${urn}:sync:${sync}`, async () => {
    const pop = await population("ks4");
    const withP8 = async (c: string[]) => new Set(c.filter((u) => figure(pop, u, PROGRESS8_LAST_PERIOD, SMT_MEASURES.ks4.p8) !== null));
    const matched = await findSurroundingSchools(urn, CURRENT_CENSUS_PERIOD, { genderMode: "relaxed", stateOnly: true, filterBeforeFacts: true, extraFilterUrns: withP8 });
    const urns = matched.map((m) => m.urn).filter((u) => u !== urn);
    return { kind: "nearest", label: `${urns.length} nearest state schools with Progress 8`, urns, chosen: false, reachKm: reach(matched, at) };
  });
}

/** GCSE's Default (Results and Entries, and Progress 8 at a state school): the chooser's own "10 nearest"
 * at GCSE, as Teacher's GCSE default resolves it (chooser-sets.ts resolveDefaultNearest's list: the IGCSE
 * filter, the boarding recipe where it applies). Resolved here, so an IGCSE school whose dashboard set is
 * its Post-16 one still compares its GCSEs with GCSE schools. */
export async function gcseDefaultSet(urn: string): Promise<GroupSet> {
  const sync = await schoolSyncStamp();
  return cachedReference(`smt:gcse-default-set:${urn}:sync:${sync}`, async () => {
    const lists = await buildDefaultComparatorLists(urn, { only: "nearest", gcse: true });
    const chosen = resolveNearestOption(lists.list1, lists.boardingBand, lists.boardingRecipe, null);
    const schools = (chosen?.schools ?? []).filter((s) => s.urn !== urn);
    const reachKm = schools.reduce<number | null>((m, s) => (s.distanceKm === null ? m : Math.max(m ?? 0, s.distanceKm)), null);
    return { kind: "nearest", label: `${schools.length} nearest schools`, urns: schools.map((s) => s.urn), chosen: false, reachKm };
  });
}
