// VicData 0.6.1 S3: the series builder's test fixtures, from real dashboard payloads.
//
//   npx -y tsx scripts/view-series-fixtures.ts <dir with data_<urn>_<phase>.json>
//
// Each payload is a school's real /api/teacher/dashboard response, its nearest-10 set and
// those schools' academic profiles (the lift round's captures for 100053 and 117037). This
// derives each column's frame the way the page does -- the same lib calls TeacherDashboard
// makes (teacher-view-measures / -populations / -comparisons) -- and writes them, numbers only,
// to src/lib/view-series.fixtures.json, which src/lib/view-series.test.ts reads. Measures are
// stored by id and rebuilt there (their formatters are functions).
import { readFileSync, writeFileSync } from "node:fs";
import { measuresFor, meanOf, type MeasureId } from "@/lib/teacher-view-panels";
import { bestScale, rangeLabel, type GradeRange } from "@/lib/subject-grades";
import { comparabilityKey, familyLabelFor } from "@/lib/teacher-view-catalogue";
import { deserializeAcademicProfile, subjectYearsFor } from "@/lib/academic-data-view";
import * as M from "@/lib/teacher-view-measures";
import * as P from "@/lib/teacher-view-populations";
import * as X from "@/lib/teacher-view-comparisons";

type Item = { key: string; subject: string; qualificationType: string; label: string; entries: number };

// TeacherDashboard's buildSubjectItems: one item per (subject, qualification) with entries in
// the latest year, largest first.
function buildSubjectItems(entries: { period: number; subject: string; qualificationType: string; entries: number }[]): Item[] {
  const latest = entries.length ? Math.max(...entries.map((e) => e.period)) : null;
  if (latest === null) return [];
  const byKey = new Map<string, Item>();
  for (const e of entries) {
    if (e.period !== latest) continue;
    const key = `${e.subject}::${e.qualificationType}`;
    const existing = byKey.get(key);
    if (existing) existing.entries += e.entries;
    else byKey.set(key, { key, subject: e.subject, qualificationType: e.qualificationType, label: e.subject, entries: e.entries });
  }
  const quals = new Map<string, Set<string>>();
  for (const it of byKey.values()) quals.set(it.subject, (quals.get(it.subject) ?? new Set()).add(it.qualificationType));
  for (const it of byKey.values()) if ((quals.get(it.subject)?.size ?? 0) > 1) it.label = `${it.subject} (${it.qualificationType})`;
  return [...byKey.values()].sort((a, b) => b.entries - a.entries);
}

const dir = process.argv[2];
if (!dir) throw new Error("usage: view-series-fixtures.ts <dir>");

const out: Record<string, unknown>[] = [];
for (const [urn, phase] of [["100053", "ks4"], ["117037", "ks5"]] as const) {
  const data = JSON.parse(readFileSync(`${dir}/data_${urn}_${phase}.json`, "utf8"));
  const entries = data.dashboard.subjectData.entries;
  const gradeRows = data.dashboard.subjectData.gradeDistribution;
  const headline = data.dashboard.headline;
  const qualificationHeadline = data.dashboard.qualificationHeadline;
  const englandAvg = data.dashboard.englandAverages;
  const items = buildSubjectItems(entries);
  // The page's own default tick (its largest subjects) and focus (the first ticked).
  for (const focusItem of [items[0], items.find((i) => i.subject === "History") ?? items[1]]) {
    const ticked = items.slice(0, 4).concat(items.slice(0, 4).includes(focusItem) ? [] : [focusItem]);
    const focusKey = focusItem.key;
    const ownRowsFor = (i: Item) => M.ownHeadlineRows(phase, i, headline, qualificationHeadline);
    const englandIndex = M.englandIndexOf(englandAvg);
    const englandAt = (i: Item, p: number) => M.englandValueAt(englandAvg, englandIndex, phase, i, p);
    const headlineRowsFor = (i: Item, p: number) => ownRowsFor(i).filter((h: { period: number }) => h.period === p);
    const pointsAt = (i: Item, p: number) => M.subjectPointsAt(phase, i, headlineRowsFor(i, p));
    const entriesAt = (i: Item, p: number) => M.subjectEntriesAt(headlineRowsFor(i, p));
    const thresholdAt = (i: Item, p: number) => M.subjectThresholdAt(gradeRows, i, p, phase);
    const hasGrades = (i: Item, p: number) => M.hasGradesAt(gradeRows, i, p);
    const { inFocusQualFamily } = P.focusQualificationFamily(phase, focusItem);
    const family = familyLabelFor(headline, focusItem.subject) ?? "its category";
    const categoryItems: Item[] = P.categoryItemsOf(focusItem, items, headline, inFocusQualFamily);
    const candidateItems: Item[] = P.candidateItemsOf(categoryItems, phase);
    const categoryPeriods = [...new Set(headline.filter((h: { subject: string }) => categoryItems.some((i) => i.subject === h.subject)).map((h: { period: number }) => h.period as number))].sort((a, b) => (a as number) - (b as number)) as number[];
    const focusGrades = gradeRows.filter((g: { subject: string; qualificationType: string }) => g.subject === focusItem.subject && g.qualificationType === focusItem.qualificationType);
    const bandRange: GradeRange | null = M.bandRangeFor(bestScale(focusGrades.map((g: { grade: string }) => g.grade)), null, undefined);
    const label = (i: Item) => (phase === "ks4" ? i.subject : i.label);

    // ------------------------------------------------------------- Column 1 Results
    for (const measureId of measuresFor(phase).map((m) => m.id).filter((id) => id !== "counts")) {
      const usingThreshold = measureId === "threshold";
      const usingBands = measureId === "bands";
      const bandAt = (i: Item, p: number) => M.subjectBandAt(gradeRows, i, p, bandRange);
      const valueFor = (i: Item, p: number) => (usingThreshold ? thresholdAt(i, p) : usingBands ? bandAt(i, p) : pointsAt(i, p));
      const periods = M.periodsForMeasure(measureId, categoryPeriods, categoryItems, thresholdAt, hasGrades);
      const series = P.keepFocusOrFigured(
        categoryItems.map((i) => ({
          key: i.key,
          label: label(i),
          shortLabel: label(i),
          colour: "#888888",
          values: periods.map((p) => valueFor(i, p)),
          benchmark: M.hasEnglandPointsBenchmark(measureId) ? periods.map((p) => englandAt(i, p)) : undefined,
        })),
        focusKey,
      );
      const groups =
        series.length < 2
          ? []
          : [
              { label: `${family} average`, values: P.memberMeans(periods, series) },
              ...(M.hasEnglandPointsBenchmark(measureId) ? [{ label: `England ${family} average`, values: periods.map((_, pi) => meanOf(series.map((r) => r.benchmark?.[pi] ?? null))) }] : []),
            ];
      out.push({
        name: `${urn}/${phase} ${focusItem.subject} results ${measureId}`,
        kind: "subjects",
        host: "teacher.c1.results",
        phase,
        measureId,
        bandLabel: usingBands && bandRange ? rangeLabel(bandRange) : null,
        periods,
        subjects: series,
        focus: focusKey,
        groups,
        groupKind: "category",
        benchmarkKind: usingThreshold ? null : "england",
        benchmarkLabel: usingThreshold ? undefined : "National",
        categoryLabel: family,
        currentBlocked: usingBands && !bandRange,
        // S3b: the number tiles' Grade bands inputs (TeacherDashboard's focusGradeRows).
        gradeBand: usingBands
          ? { range: bandRange, rangeLabel: bandRange ? rangeLabel(bandRange) : null, ownRows: focusGrades.map((g: { period: number; grade: string; entries: number }) => ({ period: g.period, grade: g.grade, entries: g.entries })) }
          : null,
      });
    }

    // ----------------------------------------------------------------- Context
    const groupRows = P.contextGroupRows(phase, headline, qualificationHeadline);
    const inGroup = (q: string) => P.inContextGroup(phase, q);
    const asOrAeaOnly = P.asOrAeaOnlySubjects(items);
    const contextOffer = P.contextOfferOf(items, inFocusQualFamily);
    const schoolSubjectNames = P.schoolSubjectNamesOf(groupRows, asOrAeaOnly);
    const subjectPeriods = [...new Set(headline.filter((h: { subject: string }) => ticked.some((i) => i.subject === h.subject)).map((h: { period: number }) => h.period as number))].sort((a, b) => (a as number) - (b as number)) as number[];
    for (const measureId of ["entries", "points"] as MeasureId[]) {
      for (const against of ["category", "whole", "selected"] as const) {
        const selected = against === "selected" ? contextOffer.slice(1, 5).map((i: Item) => i.key).concat([focusKey]) : [];
        const members: string[] = P.contextMembersOf({ against, schoolSubjectNames, candidateItems, contextOffer, selected, focusItem, inFamily: inFocusQualFamily, asOrAeaOnly, tickedItems: ticked });
        const groupInputs = { phase, measureId, groupRows, gradeRows, bandRange: null, inGroup };
        const groupAverage = subjectPeriods.map((p) => meanOf(members.map((n) => M.contextGroupValue(groupInputs, n, p))));
        const periods = M.periodsForMeasure(measureId, subjectPeriods, ticked, thresholdAt, hasGrades);
        const at = (values: (number | null)[]) => periods.map((p) => values[subjectPeriods.indexOf(p)] ?? null);
        const ctxItems: Item[] = P.contextItemsOf({ focusItem, against, candidateItems, items, contextMembers: members });
        const series = P.keepFocusOrFigured(
          ctxItems.map((i) => ({
            key: i.key,
            label: label(i),
            shortLabel: label(i),
            colour: "#888888",
            values: periods.map((p) => (measureId === "entries" ? entriesAt(i, p) : pointsAt(i, p))),
            benchmark: at(groupAverage),
          })),
          focusKey,
        );
        const groupLabel = against === "category" ? family : against === "selected" ? "Selected subjects" : "All subjects";
        const groupKind = against === "whole" ? "allSubjects" : against === "selected" ? "selectedSubjects" : "category";
        out.push({
          name: `${urn}/${phase} ${focusItem.subject} context ${measureId} ${against}`,
          kind: "subjects",
          host: "teacher.c2.context",
          phase,
          measureId,
          periods,
          subjects: series,
          focus: focusKey,
          groups: [{ label: `${groupLabel} average`, values: at(groupAverage) }],
          groupKind,
          benchmarkKind: groupKind,
          benchmarkLabel: groupLabel,
          deltaHeading: "vs average",
          rankedTable: true,
          rankedViews: true,
          compareAgainstLabel: against === "category" ? family : against === "selected" ? "your selected subjects" : "all subjects",
          cardTrend: against === "whole" ? "focusVsGroup" : undefined,
          currentBlocked: false,
        });
      }
    }

    // --------------------------------------------------------------- Candidates
    out.push({
      name: `${urn}/${phase} ${focusItem.subject} candidates`,
      kind: "candidates",
      phase,
      periods: categoryPeriods,
      subjects: candidateItems.map((i) => ({ key: i.key, label: label(i), shortLabel: label(i), values: categoryPeriods.map((p) => entriesAt(i, p)) })),
      focus: focusKey,
      groupLabel: `${family} average`,
      categoryLabel: family,
      // S3b: the "rank among the school's subjects" population (TeacherDashboard's).
      schoolSubjects: P.schoolSubjectsOf(items, focusItem, focusKey, phase).map((i: Item) => ({ key: i.key, values: categoryPeriods.map((p) => entriesAt(i, p)) })),
    });

    // -------------------------------------------------------------- Comparisons
    const profiles = data.profiles.map(deserializeAcademicProfile);
    const bucket = phase === "ks5" ? comparabilityKey(phase, focusItem.qualificationType) : null;
    const seriesByUrn: Record<string, { results: { period: number; value: number }[]; candidates: { period: number; value: number }[] }> = {};
    for (const profile of profiles) {
      const rows = subjectYearsFor(profile, phase, focusItem.subject, bucket);
      seriesByUrn[profile.urn] = {
        results: rows.flatMap((r) => (r.avgPointScore === null ? [] : [{ period: r.period, value: r.avgPointScore }])),
        candidates: rows.flatMap((r) => (r.entriesTotal === null || r.entriesTotal === undefined ? [] : [{ period: r.period, value: r.entriesTotal }])),
      };
    }
    for (const measureId of ["entries", "points"] as MeasureId[]) {
      const key = measureId === "entries" ? "candidates" : "results";
      const seriesFor = (u: string) => seriesByUrn[u]?.[key] ?? [];
      const schools: { urn: string; name: string; isTarget: boolean; distanceKm?: number | null; independent?: boolean | null }[] = X.comparisonSchools(data.nearest.rows as { urn: string; name: string; isTarget: boolean }[], seriesFor, false);
      const periods = [...new Set(schools.flatMap((s) => seriesFor(s.urn).map((r) => r.period)))].sort((a, b) => a - b);
      out.push({
        name: `${urn}/${phase} ${focusItem.subject} comparisons ${measureId}`,
        kind: "comparisons",
        phase,
        measureId,
        periods,
        schools: schools.map((s) => ({
          urn: s.urn,
          name: s.name,
          isTarget: s.isTarget,
          distanceKm: s.distanceKm ?? null,
          independent: s.independent ?? null,
          values: periods.map((p) => seriesFor(s.urn).find((r) => r.period === p)?.value ?? null),
          counts: periods.map((p) => seriesByUrn[s.urn]?.candidates.find((r) => r.period === p)?.value ?? null),
        })),
        targetName: "This school",
        setLabel: "10 nearest schools",
        subjectLabel: focusItem.subject,
      });
    }
  }
}
writeFileSync(new URL("../src/lib/view-series.fixtures.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} frames`);
