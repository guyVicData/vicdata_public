// VicData 0.6.1 S3b: the series builder for a numbers view -- NumberTiles' main figure and
// tiles, then the instance's own Figures (round 3: params.tiles / mainLabel, applied by
// src/lib/tile-figures.ts exactly as ConfiguredNumberTiles applies them).
//
// For each host the tiles are worked out as that host works them out today, from the same
// lib calls on the same frame (currentRowsWithDelta, rankByValue, bandRate, changeOver,
// directionOf), keyed by the ids tile-figures.ts registers:
//   subjects     Column 1 Results (SubjectPanels): category / count / england-average / england
//   candidates   Column 1 Candidates (CandidatesPanels): category / school / change
//   comparisons  Comparisons on a ranking set only (ComparisonsPanels): rank / average, on
//                the ranking's own measure, from its whole population (R-RANKING-SAMPLE)
// null = the host draws it (no tiles here, no subjects, a band with no range).
import { applyMainLabel, applyTileFigures, readTileParams, type TileVars } from "@/lib/tile-figures";
import { bandRate } from "@/lib/subject-grades";
import { currentRowsWithDelta, ENTRIES_MEASURE, rankByValue } from "@/lib/teacher-view-panels";
import { academicYearLabel } from "@/lib/teacher-view-theme";
import { changeOver, directionOf, signed } from "@/lib/teacher-view-trend-styles";
import type { CandidatesFrame, ComparisonsFrame, SubjectsFrame, SeriesFrame } from "./frames";
import type { BuildContext, TileData, ViewSeries } from "./series";

// 1 -> "1st", 2 -> "2nd", 11 -> "11th", 22 -> "22nd". (NumberTiles re-exports it.)
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n.toLocaleString()}${suffix}`;
}

type Built = { title: string | null; main: { figure: string; label: string } | null; tiles: TileData[]; vars: TileVars };

export function buildNumbers(f: SeriesFrame, ctx: BuildContext): ViewSeries | null {
  const built = f.kind === "subjects" ? subjectTiles(f) : f.kind === "candidates" ? candidateTiles(f) : rankingTiles(f);
  if (!built) return null;
  const params = readTileParams(ctx.params ?? null);
  return {
    kind: "numbers",
    heading: null,
    title: built.title,
    leaf: { leaf: "numberTiles", main: applyMainLabel(built.main, params, built.vars), tiles: applyTileFigures(built.tiles, params, built.vars) },
  };
}

// SubjectPanels' Results tiles.
function subjectTiles(f: SubjectsFrame): Built | null {
  if (!f.tiles || f.currentBlocked || f.subjects.length === 0) return null;
  const { measure, periods } = f;
  const latestIdx = f.state.latestIdx;
  const latest = latestIdx >= 0 ? periods[latestIdx] : null;
  const rows = currentRowsWithDelta(f.subjects, latestIdx, !!f.benchmarkLabel);
  const focusedKey = (f.subjects.find((s) => s.key === f.focus) ?? f.subjects[0])?.key ?? null;
  const tileFocus = rows.find((r) => r.s.key === focusedKey) ?? null;
  const main = tileFocus && latest !== null ? { figure: tileFocus.value === null ? "—" : measure.format(tileFocus.value), label: `${tileFocus.s.label} ${measure.noun} in ${academicYearLabel(latest)}` } : null;
  const tiles: TileData[] = [];
  const gradeBand = f.gradeBand;
  if (gradeBand && tileFocus && tileFocus.value !== null) {
    const inBand = latest !== null && gradeBand.range ? bandRate(gradeBand.ownRows.filter((r) => r.period === latest), gradeBand.range) : null;
    if (inBand) {
      tiles.push({ key: "count", icon: "GradesIcon", figure: inBand.met.toLocaleString(), detail: `of ${inBand.entries.toLocaleString()} graded entries at ${(gradeBand.rangeLabel ?? "").toLowerCase()}`, vars: { total: inBand.entries } });
    }
    if (tileFocus.bench !== null) {
      tiles.push({ key: "england-average", icon: "AverageIcon", figure: measure.format(tileFocus.bench), detail: `England, ${(gradeBand.rangeLabel ?? "").toLowerCase()}` });
      const gap = tileFocus.value - tileFocus.bench;
      const dir = measure.formatDelta(gap).replace("−", "+") === measure.formatDelta(0) ? "flat" : directionOf(gap);
      tiles.push({ key: "england", icon: "FlagIcon", figure: measure.formatDelta(gap), detail: dir === "flat" ? "level with England" : `${dir === "up" ? "above" : "below"} England`, direction: dir, vars: { direction: dir === "flat" ? "level with" : dir === "up" ? "above" : "below" } });
    }
  } else if (tileFocus && tileFocus.value !== null) {
    const inCategory = rankByValue(rows.map((r) => ({ key: r.s.key, value: r.value })));
    const rank = inCategory.get(tileFocus.s.key);
    if (rank && inCategory.size > 1) {
      tiles.push({ key: "category", icon: "PodiumIcon", figure: ordinal(rank), detail: `of ${inCategory.size} in ${f.categoryLabel ?? "its category"}`, vars: { total: inCategory.size } });
    }
    if (tileFocus.bench !== null) {
      tiles.push({ key: "england-average", icon: "AverageIcon", figure: measure.format(tileFocus.bench), detail: `England average for ${tileFocus.s.label}` });
      const gap = tileFocus.value - tileFocus.bench;
      const dir = measure.formatDelta(gap).replace("−", "+") === measure.formatDelta(0) ? "flat" : directionOf(gap);
      tiles.push({
        key: "england",
        icon: "FlagIcon",
        figure: measure.formatDelta(gap),
        detail: dir === "flat" ? "level with the England average" : `${dir === "up" ? "above" : "below"} the England average`,
        direction: dir,
        vars: { direction: dir === "flat" ? "level with" : dir === "up" ? "above" : "below" },
      });
    }
  }
  const vars: TileVars = {
    subject: tileFocus?.s.label,
    category: f.categoryLabel,
    school: f.schoolName,
    year: latest === null ? undefined : academicYearLabel(latest),
    measure: measure.noun,
    range: gradeBand?.rangeLabel?.toLowerCase(),
  };
  // Results titles no Current view over its tiles (the rank tile names the category).
  return { title: null, main, tiles, vars };
}

// CandidatesPanels' tiles.
function candidateTiles(f: CandidatesFrame): Built | null {
  if (f.subjects.length === 0) return null;
  const { periods, subjects } = f;
  const focused = subjects.find((s) => s.key === f.focus) ?? subjects[0];
  const latest = periods.length ? periods[periods.length - 1] : null;
  const latestIdx = periods.length - 1;
  const focusedNow = focused && latest !== null ? focused.values[periods.indexOf(latest)] ?? null : null;
  const main = focused && latest !== null ? { figure: focusedNow === null ? "—" : ENTRIES_MEASURE.format(focusedNow), label: `${focused.label} entries in ${academicYearLabel(latest)}` } : null;
  const tiles: TileData[] = [];
  if (focused && focusedNow !== null && latestIdx >= 0) {
    const inCategory = rankByValue(subjects.map((s) => ({ key: s.key, value: s.values[latestIdx] ?? null })));
    const r = inCategory.get(focused.key);
    if (r && inCategory.size > 1) {
      tiles.push({ key: "category", icon: "PodiumIcon", figure: ordinal(r), detail: `of ${inCategory.size} in ${f.categoryLabel ?? "its category"}`, vars: { total: inCategory.size } });
    }
    if (f.schoolSubjects?.length) {
      const inSchool = rankByValue(f.schoolSubjects.map((s) => ({ key: s.key, value: s.values[latestIdx] ?? null })));
      const rs = inSchool.get(focused.key);
      if (rs) tiles.push({ key: "school", icon: "SchoolIcon", figure: ordinal(rs), detail: `of ${inSchool.size} subjects at school`, vars: { total: inSchool.size } });
    }
    const change = changeOver(focused.values);
    const firstIdx = focused.values.findIndex((v) => v !== null);
    if (change && change.percent !== null && firstIdx >= 0) {
      tiles.push({
        key: "change",
        icon: "ChangeArrowIcon",
        figure: signed(Math.round(change.percent), (v) => `${v}%`),
        detail: `since ${academicYearLabel(periods[firstIdx])}`,
        direction: directionOf(Math.round(change.percent)),
        vars: { "from-year": academicYearLabel(periods[firstIdx]) },
      });
    }
  }
  const vars: TileVars = { subject: focused?.label, category: f.categoryLabel, school: f.schoolName, year: latest === null ? undefined : academicYearLabel(latest) };
  return { title: focused && latest !== null ? `${focused.label} ${f.currentLabel ?? "Candidates"}: ${academicYearLabel(latest)}` : null, main, tiles, vars };
}

// ComparisonsPanels' tiles: a ranking set only, always on the ranking's own measure.
function rankingTiles(f: ComparisonsFrame): Built | null {
  const rs = f.ranking?.figures;
  if (!f.ranking || !rs) return null;
  const tiles: TileData[] = [];
  if (rs.targetRank) tiles.push({ key: "rank", icon: "PodiumIcon", figure: ordinal(rs.targetRank), detail: `of ${rs.ranked.toLocaleString()} in this set`, vars: { total: rs.ranked } });
  // The set's average for the SAME year as the main figure; the latest-of-each average the
  // rank is on only where that year has none.
  const avg = (rs.target ? f.ranking.averageAt(rs.target.period) : null) ?? rs.averageLatest;
  if (avg !== null) tiles.push({ key: "average", icon: "AverageIcon", figure: rs.measure.format(avg), detail: "average across this set" });
  const vars: TileVars = { subject: f.subjectLabel ?? undefined, school: f.targetName, year: rs.target ? academicYearLabel(rs.target.period) : undefined, measure: rs.measureName };
  return {
    title: `${f.targetName}'s rank in the ${f.setLabel.toLowerCase()}: ${rs.measureName}`,
    main: rs.target ? { figure: rs.measure.format(rs.target.value), label: `${f.targetName} ${rs.measureName} in ${academicYearLabel(rs.target.period)}` } : null,
    tiles,
    vars,
  };
}
