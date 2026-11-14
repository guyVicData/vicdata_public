// VicData 0.8 front door 2b (M1; Guy, 13 Nov: "sort now"): the two home tiles Part 1 left without a figure,
// worked out from the very answer their walk's first screen draws, through the same route and parameters,
// so the tile and the walk can't disagree (R-HOME-TILES).
//
//   SMT Context          "▲ 4.1% children nearby, next 5 years": the projection tile of the walk's first
//                        screen (DV-SMT-C-NOW, ContextNow), from /api/smt/context (the area read).
//   Head office Academic "47.3 Attainment 8, group · England 45.9": the group's results headline for the
//                        phase in view (the first phase with a group figure, as the walk's first screen,
//                        GRP-A-NOW, answers it), from /api/group/dash's academic build.
//
// Pure: the homes fetch late (late-figure.ts) and the tests run these on real fixtures.
import { arrowed } from "@/lib/signed-delta";
import { MEASURE_UNIT } from "@/lib/groups/dash";
import type { GroupAcademic } from "@/lib/groups/dash-r3";
import type { Context } from "@/lib/smt/context";

export type LateTileFigure = { figure: string; unit: string } | null;

/** The SMT Context walk's read (its first screen's): the area around the school, the whole school's ages. */
export function smtContextUrl(urn: string): string {
  return `/api/smt/context?urn=${urn}&area=around&level=whole`;
}

/** ContextNow's projection tile value, word for word (changeWord(pct, 1) there). */
export function projectionWord(changePct: number): string {
  return arrowed(changePct, (x) => `${x.toFixed(1)}%`, 1);
}

/** SMT Context's tile: the children nearby over the projection's horizon, or none (never a placeholder). */
export function smtContextFigure(c: Pick<Context, "now"> | null | undefined): LateTileFigure {
  const p = c?.now?.projection;
  if (!p || !Number.isFinite(p.changePct)) return null;
  const years = p.to - p.from;
  return { figure: projectionWord(p.changePct), unit: years > 0 ? `children nearby, next ${years} ${years === 1 ? "year" : "years"}` : `children nearby by ${p.to}` };
}

/**
 * The group dashboard route's address as head office's walks ask it (GroupWalk): the same parameters in
 * the same order, so the tile's read and the walk's are one request (and one cache entry).
 */
export function groupWalkDashUrl(dash: string, account: string | null, compare: string | null): string {
  const q = new URLSearchParams({ dash, reading: "at_time", focus: "all" });
  if (account) q.set("account", account);
  if (compare) q.set("compare", compare);
  return `/api/group/dash?${q.toString()}`;
}

/** The comparison a group walk opens on (GroupWalk): Schools reads no set; the rest "Nearest in size". */
export const groupWalkCompare = (dash: string): string | null => (dash === "schools" ? null : "nearest");

/** The figure as the group answers write it (group-answers.ts fig). */
export function groupFig(v: number, unit: "pct" | "points" | "va"): string {
  return unit === "pct" ? `${v.toFixed(0)}%` : unit === "va" ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}` : v.toFixed(1);
}

/** The headline the walk's first screen answers with: the first phase with a group figure on its lead measure. */
export function groupAcademicHeadline(a: Pick<GroupAcademic, "headlines"> | null | undefined) {
  const h = a?.headlines.find((x) => x.measures[0]?.group?.weighted != null) ?? null;
  const m = h?.measures[0] ?? null;
  if (!h || !m || m.group?.weighted == null) return null;
  const unit = MEASURE_UNIT[m.measure] ?? "points";
  return { headline: h, measure: m, unit, group: m.group.weighted, england: m.england?.weighted ?? null };
}

/** Head office Academic's tile: the group's headline against England, or none. */
export function groupAcademicFigure(a: Pick<GroupAcademic, "headlines"> | null | undefined): LateTileFigure {
  const h = groupAcademicHeadline(a);
  if (!h) return null;
  return { figure: groupFig(h.group, h.unit), unit: `${h.measure.label}, group${h.england !== null ? ` · England ${groupFig(h.england, h.unit)}` : ""}` };
}
