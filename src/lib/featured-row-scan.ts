// VicData 0.8 feedback deploy gate, F-22 (R-FEATURED-ROW-EVERYWHERE): "ALL table / rank views the focus
// school should be highlit." A source scan, run by the rule test and the unit test: every table or rank
// view that takes a focus school marks that school's row with data-featured-row (featuredRow() in
// src/components/shell/accent.ts sets it and the tint), and no row of schools appears in src without the
// mark unless it is listed below with the reason it has no focus row. A new table of schools that forgets
// the tint fails here until it is tinted or listed.

/** The table and rank views that take a focus school (or, on a group, the school picked): each must mark
 * the focus row. Rows keyed by something other than a URN (Teacher's series and sort tables) are only
 * checked here. */
export const FOCUS_TABLES: { file: string; view: string }[] = [
  { file: "src/components/teacher/SortTable.tsx", view: "Teacher: sortable table (Comparisons, Context)" },
  { file: "src/components/teacher/SchoolRankingTable.tsx", view: "Teacher: ranking table" },
  { file: "src/components/teacher/SeriesViews.tsx", view: "Teacher: change and year tables" },
  { file: "src/components/admissions/views/Tables.tsx", view: "Admissions: rivals table" },
  { file: "src/components/admissions/views/Bars.tsx", view: "Admissions: rivals ranked by size" },
  { file: "src/components/admissions/panels/Academic.tsx", view: "Admissions: the rivals' results" },
  { file: "src/components/groups/dash/views.tsx", view: "Groups: against others, every school, joined and left" },
  { file: "src/components/groups/dash/views-r3.tsx", view: "Groups: schools ranked, value added, leaving at 16, market share, projection" },
  { file: "src/components/data-view/RankingsView.tsx", view: "Data View: Rankings (rank, over time, large set)" },
  { file: "src/components/data-view/AcademicRankingsView.tsx", view: "Data View: academic Rankings" },
  { file: "src/components/data-view/SubjectDeepDiveDrawer.tsx", view: "Data View: the subject deep dive" },
];

/** Rows of schools with no focus row to tint, each with why. `has` picks the element (a fragment of its
 * opening tag); without it, every school row in the file. */
export const NO_FOCUS_ROWS: { file: string; has?: string; why: string }[] = [
  { file: "src/components/admissions/setup/Setup.tsx", why: "Admissions set-up: choosing rivals, no focus row" },
  { file: "src/components/sets/SetEditor.tsx", why: "sets round 1: the set editor lists the set's schools and suggestions; the school the set is about is never one of them" },
  { file: "src/components/sets/SetView.tsx", why: "sets round 1: a set's numbered list of its schools; the school it is about is never one of them" },
  { file: "src/components/admissions/views/Momentum.tsx", why: "rivals' momentum lists the rivals only (the school is filtered out)" },
  { file: "src/components/admissions/views/ShapeAndSize.tsx", why: "shape cards, a chart (the featured profile is drawn apart)" },
  { file: "src/components/admissions/views/Tables.tsx", has: 'className="border-t border-[var(--panel-border)] text-[var(--chip-fg)]"', why: "the feeder table lists the feeders, never the school" },
  { file: "src/components/admissions/views/Bars.tsx", has: "grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_52px]", why: "change in share: a diverging bar chart; the school's bar is in the accent and its name bold" },
  { file: "src/components/admissions/panels/Academic.tsx", has: "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_44px]", why: "results change: a diverging bar chart; the school's bar is in the accent and its name bold" },
  { file: "src/components/ConsortiumMemberList.tsx", why: "a consortium's public page lists its members; no member is the focus" },
  { file: "src/components/SurroundingSchoolsMemberList.tsx", why: "the public page's nearest schools leave the school out" },
  { file: "src/components/admin/PlatformScreen.tsx", why: "Platform's list of schools: an admin table, the selected row has its own mark" },
  { file: "src/components/teacher/chooser/screens.tsx", why: "the comparison-set chooser's tick list, no focus row" },
  { file: "src/components/dashboard-config/TeacherDashboard.tsx", why: "KS2's nearest primaries leave the school out" },
  { file: "src/components/data-view/DivergingBarChart.tsx", why: "a bar chart: the school's bar is outlined and its name bold" },
  { file: "src/components/data-view/SortedBarChart.tsx", why: "a bar chart: the school's bar is red and its name bold" },
  { file: "src/components/groups/dash/views-r3.tsx", has: "<li key={e.urn}>", why: "the schools without a figure, in a note" },
  { file: "src/components/groups/dash/views.tsx", has: 'className="mt-1"', why: "the schools outside England, beside the map" },
  { file: "src/components/groups/dash/views.tsx", has: "rounded-[8px] p-1", why: "shape cards, a chart (the picked school's card keeps its tint)" },
  { file: "src/components/groups/GroupAccess.tsx", why: "group access: managing members, no focus" },
  { file: "src/components/groups/GroupHome.tsx", why: "the group home lists each group's schools; none is picked" },
  { file: "src/components/groups/library/GroupLibraryPage.tsx", why: "group sets M3: a group's page in the library lists ANOTHER group's schools (its tracklist); none is the focus" },
  { file: "src/components/sets/GroupSetEditor.tsx", why: "group sets M5: the editor lists a subset's schools and the group's schools to add; a tick list, no focus row" },
];

export type ScannedRow = { file: string; line: number; tag: string; marked: boolean; listed: string | null };

const ROW_KEY = /key=\{[A-Za-z_.]*(?:urn|Urn)\}/g;

/** Every <tr>, <div> or <li> keyed by a school's URN in one file: marked (data-featured-row, directly or
 * through featuredRow()), or listed with its reason. */
export function scanRows(file: string, text: string): ScannedRow[] {
  const out: ScannedRow[] = [];
  for (const m of text.matchAll(ROW_KEY)) {
    const at = m.index!;
    const start = text.lastIndexOf("<", at);
    const tag = /^<(tr|div|li)\b/.exec(text.slice(start, start + 4))?.[1];
    if (!tag) continue; // a component (its own rows are scanned in its file), an <option>, a marker
    const next = text.indexOf("<", at);
    const open = text.slice(start, next === -1 ? at + 800 : Math.min(next, at + 800));
    const marked = /featuredRow\(|data-featured-row/.test(open);
    const hit = NO_FOCUS_ROWS.find((x) => x.file === file && (!x.has || open.includes(x.has)));
    out.push({ file, line: text.slice(0, at).split("\n").length, tag, marked, listed: hit?.why ?? null });
  }
  return out;
}

/** The scan's findings: focus tables that don't mark their row, and school rows neither marked nor listed. */
export function featuredRowFindings(files: { file: string; text: string }[]): { unmarkedTables: string[]; unlisted: ScannedRow[]; rows: ScannedRow[] } {
  const byFile = new Map(files.map((f) => [f.file, f.text]));
  const unmarkedTables = FOCUS_TABLES.filter((t) => !/featuredRow\(|data-featured-row/.test(byFile.get(t.file) ?? "")).map((t) => t.file);
  const rows = files.flatMap((f) => scanRows(f.file, f.text));
  const unlisted = rows.filter((r) => !r.marked && !r.listed);
  return { unmarkedTables, unlisted, rows };
}
