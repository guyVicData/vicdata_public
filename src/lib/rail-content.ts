// 0.8 SMT feedback round 1 (F-6, F-5; R-RAIL-HIDES-EMPTY): a view with nothing to show has no rail icon.
// One rule for every product's rails (SMT, Admissions, Groups; Teacher's hosts already offer a view's
// button only when it has data). Each product says, per view, whether it has content (`hasContent`);
// this file decides the rail and where a panel opens. Pure, client-safe.
//
// What counts as "nothing to show": the school has no data for the view (no flags, no located schools,
// no census years to draw, no sixth form to follow). A view that explains something the reader can act
// on or needs to know (rivals not chosen yet in Admissions, a level it isn't for, a reserved round) keeps
// its icon. While a view's data is loading or has failed, it has content (it is never hidden on a guess).

export type HasContent = (id: string) => boolean;

/** The rail's items with content, in order. Never empty: with nothing anywhere, the first stays, so the
 * panel still says why. */
export function visibleRail<T extends { id: string }>(items: readonly T[], has: HasContent): T[] {
  const out = items.filter((it) => has(it.id));
  return out.length ? out : items.slice(0, 1);
}

/** The view a panel shows: `active` when it has content, else the next view after it that has (wrapping
 * round), so a panel that would open on an empty view opens on the next one instead. */
export function activeWithContent<T extends { id: string }>(items: readonly T[], active: string, has: HasContent): string {
  const shown = visibleRail(items, has);
  if (shown.some((it) => it.id === active)) return active;
  const at = items.findIndex((it) => it.id === active);
  for (let i = 1; at >= 0 && i <= items.length; i++) {
    const it = items[(at + i) % items.length];
    if (shown.some((s) => s.id === it.id)) return it.id;
  }
  return shown[0]?.id ?? active;
}

/** A series has a line to draw: two or more real points. */
export const drawsLine = (pts: readonly { value: number | null }[] | null | undefined) => (pts ?? []).filter((p) => p.value !== null && Number.isFinite(p.value)).length >= 2;
/** A series has a row to show: one or more real points. */
export const hasPoint = (pts: readonly { value: number | null }[] | null | undefined) => (pts ?? []).some((p) => p.value !== null && Number.isFinite(p.value));
