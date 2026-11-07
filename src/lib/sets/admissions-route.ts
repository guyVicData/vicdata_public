// VicData 0.8 sets round 1 (B6-B11): the Admissions routes' set choice, in one place. Server-only.
//   &fset=<key>   the Feeder schools set (Pipelines; the shapes' feeders' area)
//   &rset=<key>   the Compared against set (Market share, the rivals, the shapes)
// Keys as in ./admissions-page.ts. With neither, the page draws what it drew before this round for a
// school that has saved its own sets, and the default recipe (B8) for one that hasn't.
import type { EntryPoint } from "../admissions/entry-points";
import { savedLists, type AdmissionsCaller } from "../admissions/auth";
import { fetchSchoolTraits } from "../admissions/traits";
import type { SavedList } from "../admissions/lists";
import { buildMenu, pageSets, resolveChoice, type AdmissionsMenu, type ResolvedSet, type SetChoice } from "./admissions-page";
import { canCurate, type SetKind } from "./model";
import { readSets, readUserState } from "./store";

/** Whose personal sets a caller sees: their own; none in a platform admin's View as (the viewed
 * member's own sets aren't readable, and Guy's own are never shown as theirs). */
const profileOf = (c: AdmissionsCaller) => (c.viewAs ? null : c.userId);
const curates = (c: AdmissionsCaller, kind: SetKind) => !c.readOnly && canCurate({ roles: c.roles, isAdmin: !!c.isAdmin, isAccountHolder: !!c.isAccountHolder, lead: c.lead }, kind);

export type RouteSets = { lists: SavedList[]; feeders?: ResolvedSet; rivals?: ResolvedSet };

/** The lists the views read, with the chosen sets applied, and what each set is (for the headers). */
export async function listsForRoute(c: AdmissionsCaller, ep: EntryPoint, sp: URLSearchParams, kinds: SetKind[]): Promise<RouteSets> {
  const [base, traits] = await Promise.all([savedLists(c.reader, c.urn, ep.id), fetchSchoolTraits([c.urn])]);
  const boardingSchool = traits.get(c.urn)?.boarding ?? false;
  let lists = base;
  const out: RouteSets = { lists };
  for (const kind of kinds) {
    const ps = await pageSets(c.reader, c.urn, ep, kind, { profileId: profileOf(c), boardingSchool });
    const r = resolveChoice(ps, ep, kind, sp.get(kind === "feeders" ? "fset" : "rset"), lists, profileOf(c), curates(c, kind));
    lists = r.lists;
    if (kind === "feeders") out.feeders = r;
    else out.rivals = r;
  }
  out.lists = lists;
  return out;
}

/** What the views' answers carry about the sets in use: the header's name and counts. */
export const setsInUse = (r: RouteSets): { feeders?: SetChoice; rivals?: SetChoice } => ({ ...(r.feeders ? { feeders: { ...r.feeders.choice, urns: r.feeders.urns } } : {}), ...(r.rivals ? { rivals: { ...r.rivals.choice, urns: r.rivals.urns } } : {}) });

/** The menu for one page kind, with the current set ticked. */
export async function menuForRoute(c: AdmissionsCaller, ep: EntryPoint, kind: SetKind, key: string | null): Promise<AdmissionsMenu> {
  const [base, traits] = await Promise.all([savedLists(c.reader, c.urn, ep.id), fetchSchoolTraits([c.urn])]);
  const boardingSchool = traits.get(c.urn)?.boarding ?? false;
  const profileId = profileOf(c);
  const ps = await pageSets(c.reader, c.urn, ep, kind, { profileId, boardingSchool });
  const current = resolveChoice(ps, ep, kind, key, base, profileId, curates(c, kind)).choice;
  const lastUsed = profileId ? new Map(Array.from(await readUserState(c.supabase, profileId).catch(() => new Map<string, { lastUsedAt: string | null }>()), ([k, v]) => [k, v.lastUsedAt])) : undefined;
  // The cap counts every active personal set of theirs, of any kind or page.
  const allPersonal = profileId ? (await readSets(c.reader, { schoolAccountId: null, profileId })).sets : [];
  return buildMenu(ps, ep, kind, current, { profileId, canCurate: curates(c, kind), lastUsed, allPersonal });
}
