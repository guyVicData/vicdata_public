# Claude Code prompt — Trend & % Change chart-style redesign

Full rationale, live-confirmed evidence, and file/line pointers: `docs/vicdata_phase3_teacher_view_trend_pct_change_redesign_build_brief_v1.md` in this repo. Read that first — this prompt is the task list, the brief is the "why."

Reference mockup (real data, working interactions): https://claude.ai/artifact/YNMP7aepgmEw6YGPkbBVSr

Two items in the brief's "Open items" section are NOT ready to build as specified — see step 8 and step 9 below before touching them.

## 1. Fix Candidates' year-range data source (do this first — several other fixes depend on it)
- `CandidatesPanels.tsx`: swap the `entries` prop's source from `fetchSubjectLevelData()` (raw `dfe_ks4_subject_entries`, 2023/24-on only) to `headline`'s `entriesTotal` (`academic_subject_headline`/`academic_subject_rollup`, real data back to 2020/21) — same source Context (`page.tsx` `entriesAt()`/`subjectPeriods` ~L766-774) and Results already read.
- This also fixes Column 1 Current (the bar chart), which reads the same short `entries` prop.
- Verify: Candidates' `FromYearMenu` should now offer years back to 2020/21, same as Context's does today.

## 2. Fix Candidates Trend to show every subject (not just focus + group average)
- `CandidatesPanels.tsx`: rebuild `focusSeries` (~L110-121) the same way `changeFull` (~L128) already builds its series — every subject in the category, grey-tinted in Current's own left-to-right order, focus subject in accent green drawn last/on top.

## 3. Fix the dead "Trend line" toggle in bars mode
- `TrendChart.tsx` / `TrendBars`: `TrendBars`'s signature (`{ data, measure, fullscreen }`) never receives `showFit`. Either wire a real fit indicator into bars mode, or disable/hide the toggle whenever `trendChartKind()` resolves to bars (i.e. fewer than `TREND_LINE_MIN_YEARS = 4` real published years). After step 1 ships, most cases should cross the threshold into line mode on their own — this fix covers whatever still doesn't.

## 4. Build Option B (bar-chart style, ≤3 years) for Candidates Trend
- Horizontal list, paired bars, no x-axis — reuse the list-bar pattern Column 2/3's Current views already use.
- Number column shows year-on-year change (count + %), direction-coloured (green up / amber down / grey flat) per the app's existing convention.

## 5. Build Option D2 (multi-line, 4+ years) for Candidates Trend
- Triggers on the same `TREND_LINE_MIN_YEARS` threshold, extended from the single-focus case to every subject.
- Each subject's own line indexed to its own first published year = 100 (dashed reference line at 100), NOT a shared headcount axis — this is what keeps small-entry subjects' own real change visible next to large ones.

## 6. Build Option E (Table) alongside B/D2, and Option I (Table) for % Change
- Same component pattern for both: subject rows in grey-tint order, one column per published year, real headcounts, latest-year rank badge, change column (count + %). Sortable by name/year/change.
- **Card/fullscreen split, reused everywhere in this prompt:** dashboard card shows only first + last published year; fullscreen opens every year in between.

## 7. Rebuild Candidates % Change as Option H
- Horizontal diverging list, ranked by % change (most moved first), no x-axis.
- Move the category/group average OUT of the row list entirely — draw it as a labelled dashed reference line instead, matching how Trend and Context already treat their own group averages.
- No separate "Rank" view — H's own ordering already is the rank view.

## 8. Subject-name shortening — table confirmed, build the real mechanism
- Merge the two duplicate truncation functions (`page.tsx`'s `shortSubject`, `CandidatesPanels.tsx`'s own copy) into one shared util.
- Ship the curated table below as the **primary** mechanism, checked first; word-initial algorithmic shortening is the fallback for anything not in it; collision-check safety net still applies on top of both (if two labels shown together still match, lengthen the shorter one until they don't).
- **Before wiring it in:** confirm each table key matches the real `subject`/`label` string as stored (this was drafted against standard UK subject-teacher shorthand, not against the live DB) — mismatched keys just fall through to the fallback rather than breaking anything, but should be corrected.
- **Post-16:** key on (subject, qualification bucket) via `KS5_BUCKET_SUFFIX` below, not subject name alone — KS5 labels already carry a bucket suffix live ("Biology (GCE A level)"), and a school offering the same subject under more than one bucket needs distinguishable short labels for each.

```ts
// First pass, drafted 2026-09-25 -- standard UK subject-teacher shorthand, not yet
// checked against real DB subject-label strings. Verify each key matches the actual
// `subject`/`label` values live before shipping; anything that doesn't match falls
// through to the algorithmic fallback harmlessly, but should be re-keyed to match.
export const SUBJECT_ABBREVIATIONS: Record<string, string> = {
  "English Language": "Eng Lang",
  "English Literature": "Eng Lit",
  "Mathematics": "Maths",
  "Further Mathematics": "Fur Maths",
  "Combined Science": "Comb Sci",
  "Biology": "Bio",
  "Chemistry": "Chem",
  "Physics": "Phys",
  "Additional Science": "Add Sci",
  "Computer Science": "Comp Sci",
  "Statistics": "Stats",
  "History": "History",
  "Geography": "Geog",
  "Religious Studies": "RS",
  "Citizenship Studies": "Citizenship",
  "Philosophy": "Philosophy",
  "Sociology": "Sociol",
  "Psychology": "Psych",
  "Economics": "Econ",
  "Government and Politics": "Gov & Pol",
  "Law": "Law",
  "Classical Civilisation": "Classics",
  "French": "French",
  "German": "German",
  "Spanish": "Spanish",
  "Italian": "Italian",
  "Mandarin Chinese": "Mandarin",
  "Latin": "Latin",
  "Ancient Greek": "Anc Greek",
  "Welsh": "Welsh",
  "Urdu": "Urdu",
  "Polish": "Polish",
  "Arabic": "Arabic",
  "Art and Design": "Art",
  "Photography": "Photog",
  "Music": "Music",
  "Music Technology": "Music Tech",
  "Drama": "Drama",
  "Dance": "Dance",
  "Media Studies": "Media",
  "Film Studies": "Film",
  "Design and Technology": "D&T",
  "Product Design": "Prod Design",
  "Food Preparation and Nutrition": "Food Prep",
  "Textiles": "Textiles",
  "Engineering": "Engineering",
  "Information and Communication Technology": "ICT",
  "Business Studies": "Business",
  "Health and Social Care": "H&SC",
  "Construction": "Construction",
  "Hospitality and Catering": "Hosp & Catering",
  "Travel and Tourism": "Travel & Tourism",
  "Physical Education": "PE",
  "General Studies": "Gen Studies",
  "Critical Thinking": "Crit Thinking",
  "Extended Project Qualification": "EPQ",
  "Core Maths": "Core Maths",
};

// Bucket suffix, appended after the subject abbreviation for KS5 -- e.g. "Bio (AL)"
// vs "Bio (IB)" -- matching dfe-qualification-buckets.ts's real KS5_BUCKETS/KS5_BUCKET_LABEL.
export const KS5_BUCKET_SUFFIX: Record<"alevel" | "ib" | "btec_ocr" | "tlevel" | "other", string> = {
  alevel: "AL",
  ib: "IB",
  btec_ocr: "BTEC",
  tlevel: "TL",
  other: "Oth",
};
```

## 9. Column 2 (Context) — Selected subjects
- Wire Selected-subjects mode to behave exactly like Column 1: steps 2 and 5-7 above, applied to Context's Selected-subjects Trend/% Change.

## 10. Column 2 (Context) — All subjects
- % Change and Table: no change — already list-based, already scale fine at ~20 rows.
- Trend: build Option K — focused subject in green, top 2 risers + top 2 decliners in grey tints as individual lines, everyone else folded into one shaded min–max "rest of school" band.
- Table for All-subjects Trend mirrors the SAME curated set the K chart draws (focus + top 2 risers + top 2 decliners), plus one "Rest of school (N subjects)" summary row (min–max range, not N individual rows). Card view shows this curated set; fullscreen opens the complete list. Do not build this as an independently-computed subset — it must read the same top-movers computation the chart uses.
- **`SubjectPanels.tsx`'s `changeScope` prop needs a third mode** (today: `"focus" | "all"` implied by current usage) to carry this "curated" behaviour, alongside the existing per-subject "focus" and Column-1-style "all". `SubjectPanels.tsx` is shared with Column 1 Results — check that Results' own current behaviour is unaffected by whatever shape this prop change takes.

## 11. Column 3 (Comparisons) — third `vs:` choice
- Do not change the Current/Ranking view or the existing two `vs:` choices (average / one named school) — they're confirmed working as-is.
- Add a third `vs:` menu option, "All schools, individually": your school in the foreground colour, every comparator school as its own grey-tinted line/bar (step 5's convention) while the set is small, falling back to step 10's K pattern (focus + top movers + rest-of-set band) once it isn't. `TrendChart`/`ChangeChart` already take arbitrary series/bar counts — this is data-wiring in `ComparisonsPanels.tsx`, not a new chart component.
- Leave the small/large threshold as a named constant rather than hard-coding today's ~10-school ceiling — the comparator-set chooser (separate, not part of this build) will change what "large" means.
- Sanity-checked and confirmed by Guy, 2026-09-25 — carries the same confidence as steps 1-10 now, no separate check needed once built.

## Explicitly out of scope for this prompt
- The comparator-schools selector/chooser itself (bulk expand, custom saved sets, region/nation averages) — separate, dedicated pass, not part of this build.
- FE colleges getting their own Teacher View dashboard — see "Scenario coverage" below. This was previously listed here as a settled data-sourcing gap; that conclusion is now provisional, not final. Do NOT build anything for it in this pass either way — resolve the open question first.

## Scenario coverage (Post-16, KS2, boarding, IB, FE colleges) — no other code changes needed
Checked against `teacher-view-phases.ts`, `dfe-qualification-buckets.ts`, `default-comparator-lists.ts`, and (for FE) the private `vicdata` ingest repo. Full detail in the review doc; short version — nothing here needs a code change beyond step 8's Post-16 addition above:
- **Post-16:** covered by step 8's addition; everything else above already applies unchanged (measures are phase-aware already).
- **IB schools:** no change needed — IB's own point scale is already kept separate from A-level's. Worth a live spot-check (not a build task) of what the "A*–E rate" measure shows for a pure-IB entry.
- **FE colleges — CORRECTED, provisional.** An earlier pass in this doc concluded there was no dashboard to build for FE colleges at all, on the assumption that no results data exists for them. That assumption was wrong — it conflated the Data View's *roll/headcount* gap (real) with academic *results* (a separate source). `dfe_ks5_subject_results.py` (private `vicdata` repo) ingests DfE's "Schools and colleges — subject entries and grades" dataset for two real vintages (2023/24, 2024/25), and `academic_subject_rollup` has no census join that would exclude FE colleges structurally. Guy recalls FE results already showing in the Data View, "one year only." **Not yet confirmed and NOT ready to build:** whether `academic_subject_headline`/`rollup` genuinely carries real FE-college rows today, and what's behind the one-year-only memory (value-added source vs. entries/grades vs. a real per-vintage ingest gap). Get this confirmed (DB check, Guy, or a question to Claude Code's own session) before scoping any FE-college-specific work — if results do populate normally, no new chart-style work is needed at all, since Columns 1-3 would already work unchanged for an FE college's own dashboard.
- **Boarding schools:** no change — boarding only affects the (already-live, server-side) default comparator-set choice, not the chart styles in this prompt.
- **KS2 — CORRECTED framing.** No code change is still right (KS2 has no subjects/entries concept at all, so steps 1-10 don't apply; Column 3/step 11 applies unchanged since it's phase-agnostic) — but this is currently a dormant code path, not a live-but-unverified one. Per the round-6 card-mechanism build report (2026-09-23): "Teacher view has no KS2 instance at all," stated twice; Guy independently recalls the same. No primary school is onboarded to Teacher View today, so none of this has ever run against a real school — the generic `TEACHER_PHASES` architecture is real and code-complete, it has just never been exercised live. Do not build or test anything against a live KS2 scenario in this pass.
