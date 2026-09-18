# Build report: Academic Results stage-2 review fixes (UI/UX)

Brief: `docs/vicdata_phase3_academic_results_stage2_ux_fixes_brief_v1.md`. Built and
tested locally only; nothing committed or pushed, per instruction. Stage 1
(wiring/functionality) was already committed, pushed, and confirmed live before this
round started.

**Browser tool check**: checked at the start of this round and again before the
real-execution verification pass below. No Claude-in-Chrome connection was available
this session (`tabs_context_mcp` returned "Browser extension is not connected").
Consistent with every prior round this session — no pixel-level screenshot of the
rebuilt Map/Graphs/Rankings was taken. Verification below is real code + a real local
dev server + real production functions called directly against real data (the same
methodology this session's own prior rounds used whenever the browser tool was
unreachable — see `docs/vicdata_data_view_open_questions.md`'s own "Verification
methodology" notes), not a re-implementation, a mock, or a hypothetical.

## Items 1-5 — stage-tab rename and visibility/ordering/positioning fixes

1. **Rename**: `STAGE_LABEL.ks5` changed from `"A-level"` to `"Post-16"`
   (`academic-data-view.ts`) — the tab now correctly names the whole key stage, not
   just its dominant qualification type.
2. **Stage switcher moved into the same row as the Map/Graphs/Rankings tabs**: a
   `stageSwitcherSlot` div is rendered as a sibling of `TopicTabs`' own `<nav>` in
   `DataViewShell.tsx`, and `AcademicDataView.tsx` portals its `KsStageSwitcher` into
   that slot via `createPortal` — it used to render inside `AcademicDataView`'s own
   in-flow header, a row below where Guy expected it.
3. **Whole-tab gating**: the Academic topic tab is now disabled
   (`academicHasData` in `DataViewShell.tsx`) based on raw `stagesPresent(profile)`
   — a school with genuinely no KS2/KS4/KS5 data at all gets a disabled tab, not a
   clickable tab that opens to an empty view.
4. **Per-button gating, separate concern from #3**: the GCSE stage button
   specifically is filtered out of `filteredStages` when `igcseExclusionLikely` is
   true, independent of the whole-tab check above — a school excluded from GCSE
   reporting but with real KS2/KS5 data still gets a usable tab, just without a GCSE
   button.
5. **Default-stage priority fixed**: `effectiveStage` now falls back
   `ks5 → ks4 → first available`, rather than opening on whichever stage happened to
   be first in an arbitrary array order.

Also structural, underpinning #2-3: `AcademicDataView` is now **always mounted**
(`DataViewShell.tsx` no longer gates it behind `activeTopic === "academic"`), hidden
via a `hidden` attribute on its own root div rather than unmounted — its portal and
data-fetch effects (including item 11's widening effect) stay live while the Rolls
tab is active, so switching back to Academic doesn't need to refetch. Only the
*heavy* view tree (Map/Graphs/Rankings, i.e. the live Leaflet instance) is
additionally gated on `isActiveTopic`, to avoid a second live map mounting underneath
the visible Rolls one.

**Verification**: `npx tsc --noEmit` and `npx eslint` both clean on every file
touched for this group (confirmed again as part of this report's own full re-run
below). Re-read the actual current code for all five items directly (not just
trusted from an earlier turn's own notes) — `STAGE_LABEL`, the portal wiring, the
`availableStages`/`filteredStages`/`effectiveStage` fallback chain, and the
always-mounted/`hidden` pattern in `DataViewShell.tsx` are all present exactly as
described. No visual confirmation of the actual tab row layout or the stage switcher
sitting in its new position (needs a browser, none available) — flagging this
plainly rather than implying it.

## Items 6-9 — Map parity with Rolls' own MapView

6. `AcademicMapView.tsx` now renders its own `ViewSwitcher`/`PdfExportButton`
   overlays directly on the map canvas (`absolute left-3/right-3 top-3 z-[1000]`),
   matching `MapView.tsx` exactly — `AcademicDataView`'s in-flow header row now skips
   both when `activeView === "map"`.
7. Legend repositioned/restyled to match Rolls' own (`bottom-3 left-3`,
   `bg-white p-3 shadow-sm dark:bg-neutral-950`) — was `bottom-2 left-2`, smaller, a
   different dark-mode shade.
8. `CategoryFilter` moved below the map specifically for the Map view (its own bordered
   row under the map div), rather than sitting in the header row above it like Graphs.
9. `fitBounds(trimmedBoundsFor(bounds), { padding: [40, 40], maxZoom: 13 })` now
   re-runs on every marker-set change (new dependency-array entries), using the same
   2%-percentile outlier trim as `MapView.tsx`'s own `trimmedBoundsFor` (duplicated
   locally, matching this file's existing "small self-contained copy" convention) —
   the map used to open at a fixed `zoom=11` centred on the target and never
   auto-fit at all.

**Verification**: confirmed by reading `AcademicMapView.tsx` in full this round —
all four items are present exactly as described (overlay positions/classes,
`fitBounds` call and its dependency array, `CategoryFilter`'s conditional placement).
`tsc`/`eslint` clean. No visual confirmation that the overlays render in the right
positions or that auto-fit-to-bounds actually behaves correctly on screen — needs a
browser, none available, flagged the same way as items 1-5.

## Items 10-11 — KS5 selector default bug and comparator-set sizing

**Root cause, item 10** (confirmed against real data, not assumed): the KS5
qualification-type selector used to force its default to the target school's own
*dominant* cohort by entries count. For Acland Burghley (100053), that's
**"Academic" at 111 entries vs. A-level's 102** — but Acland Burghley has
`ks5QualTypes.ib = false` (confirmed again this round, see below), and
`ks5HasCohortEntries(p, "Academic")` requires the real, ground-truth IB flag, not
just a raw "Academic" cohort field. So auto-selecting "Academic" as the default
silently read as "comparing this school's peers on IB," which almost none of its
real geographic peers (ordinary state secondaries) have — the comparator group's own
`ks5HasCohortEntries` check excluded nearly everyone, and the Map/Graphs/Rankings
rendered as if the whole set had no usable KS5 data.

**Fix**: the forced default is gone. `ks5Cohort` state now starts and can stay
`null`, meaning "every school in the comparator set is measured on its OWN real
dominant cohort" (`ks5MeasureFor(profile, selected)` in `academic-data-view.ts`,
threaded through Map/Graphs/Rankings for every per-school value/colour/rank/caption
computation). No cohort-based exclusion happens at all in this default state — the
KS4-style exclusion-note mechanism (`ks5ExcludedUrns`) is only ever populated once a
user explicitly clicks a specific cohort pill.

**Root cause, item 11**: even with a specific cohort explicitly selected (e.g. a
user clicking "A level"), the ticked comparator set is a fixed nearest-N list that
was never guaranteed to have real data for whatever cohort gets selected —
`findSurroundingSchools()` only ever matched on sector/phase/gender, with no
awareness of academic data at all.

**Fix**: `findSurroundingSchools()` (`surrounding-schools.ts`) gained an optional,
default-preserving `extraFilterUrns` parameter, applied once per already-fetched
candidate chunk inside its existing skip-and-backfill loop. A new API route,
`/api/data-view/academic-comparator-widen`, calls it with a KS5-data-awareness
filter (either "has any real KS5 data" in the default state, or "has real entries
for the specific selected cohort") to backfill the comparator set up to a real 10
whenever the ticked set alone falls short — reusing the existing engine end to end,
not new selection logic, per the brief's own instruction.

### Design judgement call, named explicitly (item 10)

With no cohort selected, a mixed comparator group is genuinely being compared on
**different underlying measures** — one school's circle/bar/rank might be on "average
points per A-level entry," another's on "average points per IB entry." These are not
literally the same scale. The call made here: show it anyway, per-school, honestly
labelled, rather than forcing one shared measure across a mixed group (which is the
exact bug being fixed) or hiding the comparison entirely. Concretely:
- **Map**: each circle's tooltip names its own specific cohort/measure (already
  per-marker, so this was close to free); the legend caption becomes generic
  ("change in each school's own qualification-type headline measure") rather than
  naming one cohort that isn't really what every circle shows.
- **Graphs**: the shared chart primitives (`SpreadStrip`/`DivergingBarChart`/
  `SortedBarChart`) are Rolls-shared components, deliberately not modified this
  round — their captions use the same generic wording as the Map's legend instead of
  per-point labels.
- **Rankings**: this is the sharpest version of the tradeoff — a ranking implies
  ordinal comparability, and mixing measures is more visibly a "different units"
  problem than a scatter/spread chart. Built anyway (per the brief's own explicit
  ask), with each row in `RankTable` showing its qualification type alongside its
  figure in the default/mixed state only (a new `cohortLabelByUrn`-style prop on the
  local, non-shared `RankTable`) — withheld when one cohort IS explicitly selected,
  since it would just repeat the section title on every row. **This is the real,
  named tradeoff for Guy to weigh in on** — the alternative (only ranking schools
  that share the target's own resolved cohort, shrinking the ranked set) was
  considered and rejected in favour of always showing a full, labelled set, but it's
  a genuine judgement call, not an obviously-correct one.

### Flagged back to Guy, not decided (item 11's own note)

Whether the same "widen to guarantee ~10 real schools" principle should also replace
KS4's own IGCSE-exclusion behaviour (which currently just shrinks the comparator set
when schools are excluded, with no backfill) is a real, separate, open design
question. **Not touched this round** — KS4's exclusion mechanism is exactly as it
was before this round started.

### Real-execution verification (not code inspection alone)

Ran a local dev server (`npm run dev`) and a script importing and calling the
**actual production functions directly** (`fetchAcademicProfiles`, `ks5MeasureFor`,
`dominantKs5Cohort`, `ks5HasCohortEntries`, `findSurroundingSchools`) against real
data — the same "import the real function, don't re-implement it" methodology this
session's own prior rounds used. `.env` in this repo points at both hosted Supabase
projects directly (`lnhulykjlxmoneappnsp` for vicdata_public's own data,
`hrqrbvrrhlidpoybezhs` for vicdata's data via `VICDATA_API_URL`) — there is no
separate local-only stack for this repo's normal dev flow, so this was a read-only
(anon-key, `SELECT`-only) query against the same shared hosted project every prior
round's own local dev server has used for its own real-data verification. **No writes
of any kind were made anywhere** — this is a strictly reading verification method,
same as querying the free-card/Overview data in the Stage-1 report.

```
=== Target profiles: dominant cohort resolution (item 10 default) ===
Acland Burghley School (100053): has_ib=false, stagesPresent=ks4,ks5
  dominantKs5Cohort = Academic
  ks5MeasureFor(null) = cohort:Academic measureKey:Academic::aps_per_entry
  ks5HasCohortEntries(A level) = true
Sevenoaks School (118952): has_ib=true, stagesPresent=ks4,ks5
  dominantKs5Cohort = Academic
  ks5MeasureFor(null) = cohort:Academic measureKey:Academic::aps_per_entry
  ks5HasCohortEntries(A level) = false
```

Confirms the real bug precisely: Acland Burghley's own dominant cohort really is
"Academic" with `has_ib: false` (exactly the brief's own named case) — but it also
has real A-level entries of its own (`ks5HasCohortEntries(A level) = true`), so the
**target's own circle/bar/rank never goes empty** on any cohort selection; the
symptom was always about the *comparator set*.

Checked the plain nearest-10 (no KS5 awareness at all — what the ticked set looked
like structurally before this round) for real KS5/A-level coverage:

```
8/10 have any real KS5 data; 8/10 have real A-level entries specifically (pre-widening).
```

So for this specific school, the raw nearest-10 already has decent A-level coverage
— the "map goes empty" symptom Guy saw live was the OLD forced-"Academic"-default
bug (above), not a thin-pool problem for this exact school+cohort pair. Item 11's
widening logic is still real, necessary infrastructure for the general case, which
was verified directly:

```
=== Item 11: widening the comparator set for Acland Burghley, explicit A level cohort ===
Matched 10 real schools with real A-level KS5 entries: St Aloysius' College, City of
London Academy Highgate Hill, Haverstock School, St Mary Magdalene Academy, Regent
High School, Highgate Wood Secondary School, The UCL Academy, City of London Academy
Highbury Grove, Maria Fidelis Catholic School FCJ, Harris Academy St John's Wood.

=== Sevenoaks: IB cohort widening ===
Matched 10 real schools with real confirmed-IB ("Academic") entries: Worth School,
Jeannine Manuel School, RGS Surrey Hills, Halcyon London International School,
Brentwood School, Dwight School London, Lycee International de Londres, Buckswood
School, Charterhouse, Haileybury College.
```

The Sevenoaks IB-cohort result is the clearest proof the widening filter is real and
qualification-type-aware, not a no-op: it returns a completely different, genuinely
IB-appropriate set of schools (day and boarding schools known for IB provision), not
just "the same nearest 10 regardless of filter."

### Verification summary (whole round)

- `npx tsc --noEmit`: clean, across the whole project, after every item.
- `npx eslint` on every touched file: clean (one real violation was found and fixed
  along the way — `react-hooks/set-state-in-effect` on the item-11 widening effect,
  fixed by moving every `setKs5WidenedUrns` call, including the two early "reset to
  empty" branches, inside the effect's own async callback rather than directly in
  the effect body).
- `npm run build`: clean, full production build, all 35 routes compiled including
  the new `/api/data-view/academic-comparator-widen` route.
- Real execution against real data for items 10-11, both named schools, as detailed
  above — not code inspection alone, per the brief's own explicit instruction.
- **Not verified**: the actual visual rendering of any of the 11 items in a real
  browser (tab position, stage-switcher placement, map overlay positions, legend
  wording on screen, per-row cohort labels in the Rankings table) — no
  Claude-in-Chrome connection this session, flagged plainly rather than implied.

## Confirmations

- Nothing committed or pushed; nothing written to hosted/production — every check
  this round was read-only (verified again just before writing this report: `git
  status` shows only the expected modified/new files, no staged changes).
- Local dev server (`npm run dev`) stopped; the one temporary verification script
  lives only in this session's own scratchpad directory, not in the repo.
- No unrelated regressions: `tsc`/`eslint`/`build` all clean across the whole
  project, not just the touched files.
- Stopping here, as instructed — Guy will review all 11 items against
  Acland Burghley and Sevenoaks (and the live site more broadly) himself.
