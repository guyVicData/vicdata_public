# Dashboards review (main a648be5, 14 Nov 2026) — read-only

Sources: `src/catalogue/dashboards/{teacher,smt,admissions}.ts`, `src/catalogue/{dataviews,smt,admissions}.ts`,
`src/components/groups/dash/GroupDashboard.tsx` (LAYOUT, GROUP_VIEWS, headerOf), `src/lib/front-door/{walks,teacher-screens}.ts`,
`src/components/front-door/{role-walks,charts}.tsx`, colour code in `src/lib/{subject-family-colours,teacher-view-theme,teacher-view-trend-styles}.ts`.
Screenshots read: front_door_2b (teacher_gcse_mid, dumbbell_dashboard_light, group_academic_mid, smt_overview_mid, admissions_pipelines_mid),
front_door_crosscheck/walk_many_3, consistency/smt_110110_pupils_main, smt_academic_r2/after-AC-PM-Entries-light.
No fresh renders. KS2 has no seeded dashboard config (DASHBOARDS = Teacher ks4/ks5, Admissions, SMT) and no walk; not reviewed further.

## Ranked findings

### High
1. **The Admissions walk shows the wrong charts for two screens** — `src/components/front-door/role-walks.tsx:293-296`.
   `DV-ADM-P-NOW` draws `<EntryTrend as="bars">` (that is DV-ADM-P-ENTRY-BARS, not the dashboard's EntryNow tiles);
   `DV-ADM-P-PIPELINE` draws `<PoolTrends>` (that is DV-ADM-P-POOL-INDEXED). So screens 2 and 4 show the same chart, and the
   dashboard's default Pipeline chart (PipelineChart, counted then from births) never appears in the walk although "Show me" sends you to it.
   Fix: render `EntryNow` and `PipelineChart` as `AdmissionsDashboard.viewBody` does (`AdmissionsDashboard.tsx:625-633`); better, export viewBody and call it, as groupWalkView does for Group.
2. **The walk's "Has our position changed?" chart is not on the dashboard** — walk `gcse/post16-nearby` screen 5 names `DV-C3-TR-CHART` but draws
   "the school's place among its nearest, year by year" (a rank line, `teacher-screens.ts` case `nearby-trend`). DV-C3-TR-CHART draws the school's
   value against the set average/one school, not its rank. MISSING. Fix: add a "Rank over time" form to Comparisons › Trends (DV-C3-TR-RANK), or point the walk at C3-TR-CHART and draw what it draws.
3. **The walk's "nearby and nationally" chart is weaker on the dashboard** — walk `entries-area`/`points-area` draws school + N nearest (average) + LA + England;
   DV-C1-CAND-TR-GEO-CHART / DV-C1-RES-TR-GEO-CHART compare `averages` only (LA, region, England), so the nearest-schools line is not there.
   Fix: add the nearest-set average as an optional compare line on the geography chart (compare kind `nearest`, as the ViewSpec already allows).
4. **SMT Overview market-share title doesn't match the drawing** — `src/components/smt/views/Lines.tsx:167` titles "Market share at 11+, against the 10 nearest schools",
   but the grey line is the *largest rival* only (key: "Largest rival (Reading Blue Coat School)", smt_overview_mid_1440). Fix title: "Market share at 11+: you and your largest rival, [first]–[latest]".
5. **Mini-map / "On the dashboard" spots point to the wrong panel** (walks.ts `spot`, used by MiniMap and Show me):
   | Screen | spot | actually lives |
   |---|---|---|
   | DV-ADM-P-POOL-INDEXED | col 0 row 1 | c2 Trends (col 1) |
   | DV-ADM-P-ENTRY-LINE | col 1 row 1 | c1 Trends (col 0) |
   | DV-ADM-M-SHARE-LINE | col 0 row 1 | c3 Trends (col 2) |
   | DV-SMT-C-BIRTHS | col 0 row 1 | c2 Now ("Map" panel) |
   | DV-SMT-C-NEARBY | col 1 row 1 | c2 Now |
   | DV-SMT-P-AREA | col 1 row 1 | c3 Trends (col 2) |
   | GRP-P-PROJECTION | col 2 row 1 | p-projection (col 1) |
   | GRP-P-GROWING | col 1 row 1 | p-growing (col 2) |
   | GRP-A-IMPROVING | col 1 row 1 | a-improving (col 2) |
   Fix: derive `spot` from the dashboard config / group LAYOUT instead of hand-writing it, and add a test in walks.test.tsx.

### Medium
6. **No subject-group colour on any dashboard chart.** Teacher Context bars/list/dumbbell use a grey ramp with the focus in the accent
   (`tintInOrder`, `teacher-view-trend-styles.ts:34`); trend lines get a categorical palette by *rank order* (`paletteInOrder`), so a subject's colour changes when its rank does
   and cycles past ~7 hues. The walk instead colours the focus's category (SUBJECT_FAMILY_COLOURS via `charts.tsx:29`) and greys the rest (walk_many_3: History/RS amber).
   So the walk and the dashboard disagree for the same view (DV-C2-CUR-BARS, DV-C2-TR-DUMBBELL), and the dumbbell's walk note ("colour is free to mean the subject area") is not true of either.
   SMT Academic "By subject area" (DV-SMT-A-AREAS) and Group "Subject areas" (GRP-A-AREAS) group by area with headings only, no colour.
   Fix: one rule — bars/dots coloured by subject family (SUBJECT_FAMILY_COLOURS), focus in the accent with an outline, keyed; apply in tintInOrder/paletteInOrder, DumbbellView, SMT AreasView row swatches, Group areas row swatches.
7. **The family palette has near-identical hues and clashes with fixed colours** (`subject-family-colours.ts:28`): sciences_maths blue #1d4ed8, business_law indigo #4338ca, languages violet #6d28d9 sit within ~40° (Dark: #93c5fd/#a5b4fc/#c4b5fd are almost indistinguishable pastels);
   health_care green ≈ GCSE accent #34d399 (a Health & Care peer reads as the focus on GCSE); languages violet ≈ Post-16 accent #a78bfa; humanities amber #b45309/#fcd34d ≈ England #a86f00/#c98500; arts pink ≈ nearest-schools #d55181; enterprise orange ≈ SMT accent.
   Fix: re-pick 8 hues spaced ≥40° and away from the accents and reference colours (e.g. drop indigo for teal-grey or brown), run the dataviz validator for Light/Dark/Mid, and skip a family hue within 40° of the phase accent as paletteInOrder already does.
8. **SMT Entries mix colours mean two things** — `smt/views/Academic.tsx:743` MIX_COLOURS uses `--ac-above` (blue) and `--ac-below` (orange), which on the same dashboard mean "above/below the set"; and it cycles after 5 groups.
   Fix: give qualification groups their own neutral categorical set (or SUBJECT_PALETTE), never the above/below tokens.
9. **Repeated chart on Group Academic one panel apart** — GRP-A-TREND (a-trend) offers an "A-level points" chip; GRP-A-POST16 (a-post16, next panel) draws the same A-level points line against the same set (`dash-r3.ts:198`). Both titled "Results against MATs with 41+ schools" (group_academic_mid_1440).
   Fix: drop the Post-16 chips from GRP-A-TREND when GRP-A-POST16 is shown (make a-trend GCSE/KS2 only) or merge the panels.
10. **Dashboard dumbbell is hard to read and weaker than the walk** — DV-C2-TR-DUMBBELL defaults to the category (4 rows), the walk asks "more than other subjects?" on the whole school; scale runs from 0 so a ring and dot 18 entries apart on ~240 overlap (dumbbell_dashboard_light_1440).
   Fix: scale from the smallest value drawn (axis labelled), and open the dumbbell on "All subjects" when reached from the walk (Show me with `against=whole`).
11. **Trend charts have no value axis** — SMT Overview roll/results/market lines, Admissions cohort/pipeline/pool lines, Group results trends, SMT Pupils pool/area (all screenshots above). Only the start/end years are labelled; indexed charts don't mark the 100 line.
    Fix: label min/max (or 3 ticks) on the y axis and draw/label the 100 baseline on indexed charts.

### Low
12. Clipped content: Teacher Results tiles third tile cut ("+0.4 above the England…", teacher_gcse_mid_1440); Group Academic Current cuts "Post-16 points 34.29 / 5th" (group_academic_mid_1440); Admissions feeder flags truncated mid-word; SMT Pupils area chart label "includes children not yet bor". Comparisons map: the "3 km" ring label sits under the school's dot.
13. SMT Overview results trend header says "2021/22 to 2025/26"; the axis ends at 24/25 (Post-16 latest). Header should use the drawn years.
14. Stale evidence: dumbbell_dashboard_light_1440 shows "Average ▼ 14" while every row rose — already fixed in `teacher-dumbbell.ts:47-55`; re-shoot.

## Coverage table: walk screen → chart → dashboard view

| Walk · screen | Walk chart | Dashboard view | Status |
|---|---|---|---|
| gcse/post16-many 1 | entries tiles | DV-C1-CAND-CUR-TILES (Candidates c1 Current) | same |
| many 2 | bars, category | DV-C2-CUR-BARS | present; dashboard greys peers (walk colours category) |
| many 3 | bars, whole school | DV-C2-CUR-BARS + Compare against All subjects | present, needs pill; no category colour |
| many 4 | entries lines | DV-C1-CAND-TR-ACTUAL (not the rail default, Indexed) | same |
| many 5 | dumbbell, whole school | DV-C2-TR-DUMBBELL (Candidates only) | weaker: opens on category, scale from 0 |
| many 6 | school + nearest + LA + England | DV-C1-CAND-TR-GEO-CHART | weaker: no nearest line |
| well 1 | points tiles | DV-C1-RES-CUR-TILES | same |
| well 2 | grade shares + England ticks | DV-C1-RES-CUR-GRADES | present only on the Grade bands pill (walk is on Average points) |
| well 3-4 | bars category / whole | DV-C2-CUR-BARS (Results) | as many 2-3 |
| well 5 | points lines | DV-C1-RES-TR-CHART | same |
| well 6 | school + nearest + LA + England | DV-C1-RES-TR-GEO-CHART | weaker: no nearest line |
| nearby 1 | dot plot of nearest | DV-C3-CUR-MAP | dashboard stronger (real map) |
| nearby 2-3 | hbars entries/points | DV-C3-CUR-BAR | same |
| nearby 4 | ranking | DV-C3-CUR-RANKING | same |
| nearby 5 | rank year by year | DV-C3-TR-CHART named, but it draws value vs set average | **MISSING** |
| smt-overview 1-6 | NOW, SCORECARD, ROLL-LINE, RESULTS-LINE, MARKET-LINE, FLAGS | same components | same |
| smt-academic 1-6 | A-NOW, A-CHART, A-AREAS, A-GRADES, A-TREND-LINE, A-LINES | same components | same |
| smt-pupils 1-6 | P-NOW, P-SHAPE, P-ENTRIES, P-LEAVING, P-PHASES, P-AREA | same components | same |
| smt-context 1 | C-NOW | same | same |
| smt-context 2 | C-MAP | walk shows a link, no chart | walk gap (dashboard has it) |
| smt-context 3-5 | C-BYAGE, C-BIRTHS, C-NEARBY | same components | same |
| smt_primary-academic | — | no KS2 views | MISSING on both (logged) |
| admissions-pipeline 1 | named P-NOW, draws ENTRY-BARS | EntryNow | **mismatch** (#1) |
| admissions-pipeline 2 | named P-PIPELINE, draws PoolTrends | PipelineChart | **mismatch** (#1) |
| admissions-pipeline 3-5 | P-MAP, P-POOL-INDEXED, P-ENTRY-LINE | same components | same (walk drops LA/England flags: PoolTrends defaults) |
| admissions-market 1-6 | M-NOW, M-BARS, M-MAP, M-MOMENTUM, M-SHARE-LINE, M-ACAD-RANK | same components | same |
| group-* (21 screens) | groupWalkView → the dashboard's own ViewBody | GRP-* | same (walk is pupil-weighted, Default set) |

## Titles

House rule applied: what is measured, for whom, when, against what.

**Empty templates:** DV-C1-RES-CUR-TILES, DV-C1-RES-CUR-GRADES, DV-C1-CNT-CUR-DIST have `titleTemplate: ""` (dataviews.ts). Proposed:
"[subject] results, [year]: [measure] against England"; "[subject] grades, [year]: share at each grade, against England"; "[subject]: pupils at each grade, [year]".

**Same title, different drawing (two forms read the same):**
- DV-C1-CAND-TR-INDEXED and -ACTUAL: both "Entries in [category]" → "Entries in [category], indexed ([first year] = 100)" / "Entries in [category], [first]–[latest]".
- DV-C2-TR-INDEXED / -ACTUAL: both "Entries in [comparison-group]" → same split.
- DV-C1-RES-CUR-BAR / -TABLE, DV-C2-CUR-BARS / -LIST / -TABLE: "Results by subject in …" never names the measure or year → "[measure] by subject in [group], [year]" (e.g. "Average points by subject in Languages & Literature, 2025/26").
- DV-ADM-M-SHARE-LINE and -SHARE-NUM: both "Your market share at [entry], year by year" (fine as forms); DV-ADM-M-VS-LINE / -VS-BARS "Your [entry-year] against the [rivals]" don't say the measure → "Your Year 7 roll against your rivals', indexed ([base] = 100)".
- DV-ADM-M-ROLL-LINE "[entry age band] roll, indexed: you and the [rivals]" vs VS-LINE: nearly the same chart; say "Years 7–11 roll" vs "Year 7 roll".
- GRP-A-TREND and GRP-A-POST16 inner title both "Results against [set]" → "GCSE results against [set], [first]–[latest]" / "Post-16 results (A-level points per entry) against [set], …".
- GRP-O-ROLL "Combined roll, indexed" and GRP-P-ROLL "Roll, indexed" are the same RollTrend; GRP-O-RESULTS "Results by phase" and GRP-A-TREND "Results trend" are the same ResultsTrend. Give each one name.

**Vague / generic:**
- Panel tags "Trends" (SMT config panel names, smt.ts:25-55; Admissions trend panels; Group headerOf for O-ROLL, O-RESULTS, S-GROWING, A-TREND, A-POST16, A-BANDS, P-ROLL, P-GROWING, N-FSM). Use the subject of the panel: "Roll", "Results", "Market share", "Entries mix".
- SMT: "Grade profile" → "Grades in bands, [level], [year]"; "Last year to this, every line" → "Change since last year, every headline measure"; "The set's schools, rising and falling" → "[measure]: change since [year] at each school in the set"; "Births, indexed" → "Births in [area], indexed ([year] = 100)"; "Children nearby over time" → "Children aged [ages] within [km] km, [first]–[latest], indexed"; "Projection" (rail) / "School-age population, projected" → add area and years; DV-SMT-O-MAP "[school] and [set]" → "[school] and [set] on the map, sized by roll"; rail label "Chart" (DV-SMT-A-CHART) → "Ranked chart".
- Admissions: "Academic: your rank among the rivals" → "[measure], [year]: your rank among your rivals"; "Share needed to hold numbers steady" → add "[entry], [years]".
- Group labels used as titles: "Schools", "Map", "Shapes", "Who is growing", "Results trend", "Share of places", "Subject areas" → e.g. "Member schools: roll and headline, [census]", "Member schools on the map, sized by roll", "Each school's shape by age, [census]", "Each school's roll, indexed ([base] = 100)", "Subject areas: gap to England in points per entry, [stage] [year]".
- Teacher walk vs dashboard titles differ for the same view: walk "[subject] Results over time: average points" vs dashboard "Results in [category]: each subject's line"; adopt the walk's measure-naming wording on the dashboard.

## Repeated tables / rankings
- Group Academic: GRP-A-TREND's A-level chip repeats GRP-A-POST16 (next panel) — drop the chip (#9).
- SMT Academic (Entries mode): DV-SMT-A-NOW lists each qualification group's entries, share and 3-year counts; DV-SMT-A-MIX-TABLE (c3 Trends) is the same numbers by year. Keep the bars (MIX) and drop MIX-TABLE, or make MIX-TABLE add the set's typical share.
- SMT Academic: DV-SMT-A-MOVES ("Biggest moves") is DV-SMT-A-AREAS's Entries-mode "2022/23 → 24/25" column re-sorted. Keep, but say "top 5 up, top 5 down" so it adds a cut; otherwise merge into AREAS as a sort.
- Admissions Market › Rivals: DV-ADM-M-DONUT, -BARS and -TABLE are the same rows (school, pupils, share); BARS already has `withDonut`. Drop the standalone DONUT.
- Admissions Market › Trends: SHARE-NUM and SHARE-RANKS are one ShareTable with `ranks` on/off (`AdmissionsDashboard.tsx` viewBody) — merge as a column toggle.
- SMT Academic: DV-SMT-A-CHART and DV-SMT-A-TABLE draw the same ranked set (chart vs table) — fine as forms; DV-SMT-A-SETMOVES repeats A-TABLE's change column — merge as a sort on A-TABLE.
- Cross-dashboard (acceptable, but name them the same): GRP-O-ROLL = GRP-P-ROLL; GRP-O-RESULTS = GRP-A-TREND; GRP-O-MAP on Overview and Schools; DV-SMT-O-NOW and DV-SMT-P-NOW and DV-ADM-P-NOW all repeat roll / day-boarding / size by phase.
