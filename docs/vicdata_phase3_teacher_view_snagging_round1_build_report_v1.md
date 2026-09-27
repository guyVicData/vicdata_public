# Teacher view snagging round 1: build report (v1)

Brief: `vicdata_phase3_teacher_view_snagging_round1_build_brief_v1.md`. Prompt: `…_claude_code_prompt_v1.md` (both read in full). Built on `59034ba`, so the trend-map-legend round had already landed. **Committed locally, not pushed.**

| Commit | What |
|---|---|
| `ad9ba27` | Part 1: the Context donut (two confirmed defects fixed; the reported symptom not reproduced live, see below) |
| `9931bef` | Part 2: number tiles as the default view in Column 1's Current panel |
| `afd3c0e` | Part 3: Context "All subjects" stops curating; new card graph |
| `8ec4376` | Part 2 follow-up: one ranking helper, not two |
| `e054dd9` | Part 4: a ranking comparator gets tiles, not a map, plus its population's true average |
| (this commit) | This report, the round's three docs, and screenshots |

Every commit passed `tsc --noEmit`, `eslint` and `next build`. `eslint src` shows the same 7 problems as before this round, none of them in these files.

## Where the brief's grounding was off (checked before building)

- **Column 1 Candidates' Current panel is `CandidatesPanels`, not `SubjectPanels`.** Candidates has bars and a list; SubjectPanels' donut, bar and table trio belongs to Context and Results. So Part 2's tiles went into **both** components. This is the same miss as the content round.
- **A shared rank helper already existed:** `rankByValue` in `teacher-view-panels.ts`, used by Column 3. Part 2 first extracted YearTable's `rankOf` as a new `rankDescending`, which duplicated it. `8ec4376` folds everything into `rankByValue`. One visible change: tied subjects in the Trend and % change tables now share a rank, as Column 3's schools always have.
- **Part 4's `SetOption` needed no `kind` field.** A ranking, saved or not, always reaches the page as `chooserChoice.kind === "ranking"`, resolved through `/api/teacher/chooser-set`. The page already knew; it now passes a `rankingSet` prop.
- **The legend prop (Part 3) needed no generalising.** The trend-map-legend round left it generic: `PanelRender.legend` is a `ReactNode`, and SubjectPanels builds it for any `changeScope === "individual"`. Context's "All subjects" picks it up by becoming "individual".

## Part 1: the donut

**Not reproduced live.** The Chrome extension wasn't connected and localhost is gated, so there was no signed-in session. I'm saying so plainly, as the prompt asks. Here's what was checked instead.

- **Hypothesis 2 (a stale re-render): ruled out.** There's no `React.memo`/`useMemo` between `page.tsx` and `ShareDonut`, and no keyed subtree that survives a focus change. `ColumnPanels` and `CardBox` call their children fresh on each render, and `ShareDonut` holds only a size measurement. The numerator and denominator are plain values recomputed on every render.
- **Hypothesis 1 (two controls confused): the likeliest reading, not confirmed.** Guy's words were "when different subjects selected using subject selector… proportion… compared with other selected subjects… nb other graphs change". That fits the site's own subject selector (the ticked list that drives Column 1) better than Context's Selected-subjects picker.
  - Context defaults to **"All subjects"**, whose denominator is the whole school's entries. Ticking different subjects in the site's selector changes Column 1 and the focus chips ("other graphs change"), but by design it can't move that denominator. If Guy expects the donut's group to be *his selected subjects* while on "All subjects", that's a definition change, not a bug fix. **Guy's call, not built.**
  - A focus change in "All subjects" does move the numerator. Real data for The Chase at GCSE: History 6.8%, Geography 7.1%, English Language 11.8% of 1,928 entries in 2024/25.
- **Two real defects found and fixed (`ad9ba27`):**
  1. In **"Selected subjects"** the group was exactly the ticked set, so a focus subject not ticked in the picker was divided by a group it wasn't in. The "share" could pass 100% (ShareDonut clamps it), and the "Selected subjects average" left the focus out. The page's own §4.2 comment says the group is self-inclusive; now it is, in this mode too.
  2. The legend's **"All other entries — N"** printed the group *total*, which includes the focus: 1,928 where the others are 1,796. It now prints the group less the focus.
- **For a live repro:** on The Chase, Candidates, Context on "All subjects": (a) switch the focus subject in the site's selector (the % should change); (b) tick or untick subjects in the site's selector without changing focus (the % won't change, by design). Then switch Context to "Selected subjects" and repeat (b) using Context's own picker (the % should change). If (a) doesn't move, that's a real bug this round didn't find.

## Part 2: number tiles (`NumberTiles.tsx`, new default in Column 1)

**Layout** (my call, flagged):
- **Main figure:** 40px bold on the card (56px in fullscreen), with the label under it ("History entries in 2024/25", "History average point score in 2024/25").
- **Subsidiary tiles:** each is a bordered `--box-bg` tile, icon beside a 19px figure (26px fullscreen), with one detail line under that. Three fit across a ~400px card and wrap only on a narrower one.
- **Icons:** new glyphs in `PanelIcons`: tiles (the view button), podium (rank in group), building (rank in school), arrow (change), average bars (average) and flag (England).
- **Why no reused visual:** `PhaseBreakdownCard` is a list of rows, not tiles, so there was no tile convention to reuse. I borrowed its type scale and muted tones.

**Candidates** (`CandidatesPanels`):
- **Main:** the focused subject's entries this year.
- **Rank in category:** `rankByValue` over the category, "of 3 in Humanities & Social Sciences".
- **Rank in school:** among every comparable subject at the school, "of 27 subjects at school". This comes from a new `schoolSubjects` prop: the same population Context's All subjects reads, one entry per subject at GCSE as Column 1 counts them, excluding AS/AEA.
- **Change:** `changeOver` across the whole published span, "since 2020/21".

**Results** (`SubjectPanels`, behind an opt-in `tiles` prop so Context is unchanged):
- **Main:** the active measure's figure, unit-aware.
- **Rank in category.**
- **Middle tile:** **the school's average across all subjects** (not a rank), per Guy's correction. It's the mean of `groupValueFor` over every subject at the school, i.e. Context's own "All subjects average". Context follows the Results sub-measure, so the two are the same measure. **Flag:** this is an unweighted mean of subject averages, not a pupil-weighted school APS, so it isn't the same as a DfE school-level figure.
- **England gap:** the focused row's own England anchor (the bars' marker, `englandAt`), "above/below the England average", or "level" when it rounds to nothing. On a grade-threshold measure there's no England figure, so the tile is absent there.

**Checked on real data** (The Chase, GCSE History, 2024/25): 132 entries, 2nd of 3, 6th of 27, +61% since 2020/21; 5.3 points, school average 5.5, +0.6 above England (England History 4.72).

## Part 3: Context "All subjects"

- **No more curation.** `changeScope="curated"` (Option K) is gone from SubjectPanels (Context was its only caller); "All subjects" is `"individual"`. The Trend table lists every subject **on the card too** (Guy's "in table view" is unqualified). The card's list scrolls, starting at the focused row. **Flag:** at 27 rows that's a long scroll in a small box, but it's what was asked.
- **Fullscreen:** every subject is its own line, with the rail's "Subjects shown" show/hide legend.
  - **Flag:** 27 lines against a 7-colour palette means colours repeat. The legend names each line, and lines can be hidden.
  - **Possible follow-up, not built:** a "hide all but the focus" shortcut for the legend.
- **The card's graph (the one new design decision):** `cardTrend="focusVsGroup"`, which is the focused subject's line against the **dashed "All subjects average"** (`groups[0]`), with a two-entry legend. It's indexed or actual per the existing toggle. It's the same two-line shape as Results' classic Trend against England.
- **"Selected subjects" is unchanged:** its card still draws every selected subject.
- **Dead code:** SeriesViews' generic Option K helpers (`curatedKeys`, MultiTrend's `curated`, YearTable's `curate`) are now unused. I left them in place rather than widen the diff; say if they should go.

## Part 4: rankings (`chooser-sets.ts`, `ComparisonsPanels.tsx`)

**Server.** `resolveRankingSet` now also returns:
- `target` and `targetSeries`: the school's own headline figure, latest and per year;
- `averageLatest` and `average`: the population's true mean, over each school's latest figure (the basis the rank uses) and per year, with a school count.

The average covers the ranking's own schools only: the target counts when it's in the ranking, and not when it has only been placed against it. **Same fetch, no second query:** these come from the headline rows the resolver already pulls to rank the whole population, never from the top-15-plus-neighbours sample it hands the column.

**Performance.** Measured on live data:

| Ranking | Cold call | Warm call |
|---|---|---|
| Post-16 England | 9.3 s | 3.6 s |
| Post-16 West Midlands | 1.3 s | 0.5 s |
| GCSE England | 10.6 s | 5.8 s |

All of that time is the existing headline lookup; the averages add only a pass over rows already in memory. **Figures:** 843rd of 2,545 (England) and 67th of 290 (West Midlands), matching the chooser round's report.

**The column, with a ranking active:**
- **No Map icon.** The **Number tiles** view is the default: the school's headline figure, "843rd of 2,545 in this set", and the set's average **for the same year as the main figure**. That year choice is mine, so the tile matches the graph; the rank itself is on each school's latest figure.
- **Graph:** the school against "Set average" (two bars).
- **Trend's "vs: Average":** the population's own per-year average, "Average across this set (2,545 schools)".
- **Summary and collapsed headline:** the whole-population rank.
- **Choosing a list of schools again** brings the Map back as the default.

**Flag, the measure.** The ranking and its average are on the phase headline (A-level APS, or Attainment 8), because that's what the population is ranked on. So the tiles always show that measure, and the label names it.
- When Column 3 is on another measure (Candidates, or a subject chip), there's no population figure to draw from. There, the graph keeps the sample's schools, and Trend's average line is relabelled **"Average of the schools shown"** rather than implying it's the set's.
- A true population average for entries or a single subject would need population-wide subject data, which is a new and heavier fetch. It wasn't built.

## Checks

- **Headless previews on real data.** The real components (`CandidatesPanels`, `SubjectPanels`, `ComparisonsPanels`) ran on real figures, captured server-side with the app's own library calls (The Chase: GCSE subjects, England anchors, the Post-16 England ranking). Committed in `docs/screenshots/snagging_round1_v1/`:
  - Part 2: tiles on the card in dark and light, and Results in fullscreen;
  - Part 3: the card graph and table, and fullscreen with the legend;
  - Part 4: ranking tiles, graph and Trend.
- **Found and fixed in these previews:**
  - the tiles wrapped two-plus-one on a real card width, where Guy asked for a row;
  - the fullscreen tiles' detail text was undersized;
  - the set-average tile disagreed with the graph (the latest-of-each figure versus that year's);
  - the graph's average label truncated.
- **Not checked live:** the donut repro (above) and everything on the real signed-in page.

## For Guy's live look (after a push, hard-reload)

1. **Donut:** the repro steps in Part 1, then tell me which control you meant.
2. **Column 1 Current** opens on tiles (Candidates and Results). Switch measure on Results: the tiles change units, and on a grade rate the England tile disappears.
3. **Context → All subjects:** the card Trend is two lines; its table lists every subject; fullscreen has every line plus the legend. Selected subjects is unchanged.
4. **Column 3 → Choose schools → Regional & national rankings → Done:** no Map icon, tiles by default (for The Chase at Post-16, 843rd of 2,545), and the graph and Trend are against the set average. Switch Column 1 to Candidates: the tiles stay on A-level APS, and Trend's line reads "Average of the schools shown". Choose "10 nearest": the Map is back.
