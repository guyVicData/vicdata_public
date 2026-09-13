# Build report: Academic Results front end (vicdata_public)

Brief: `docs/vicdata_phase3_academic_results_frontend_build_brief_v1.md`. Built and
tested locally only; nothing committed or pushed, per instruction.

## Pre-flight check (the brief's own hard gate)

Confirmed directly, before writing any code, that `academic_headline_lookup`,
`academic_subject_family_lookup` and `academic_geography_lookup` exist, are granted to
`anon`, and return real rows via a real anon-key HTTP call from this repo's own code
(not just a local `psql` session against `vicdata`):

```
academic_headline_lookup {p_entity_ids:["100001"], p_ks_stage:"ks4"} -> real rows
academic_subject_family_lookup {...} -> real rows
academic_geography_lookup {p_ks_stage:"ks4", p_grouping_type:"national", p_family_id:"whole_school"} -> real rows
```

The RPC bridge is confirmed built and working. Proceeded.

## Real, unanticipated finding, resolved with you directly before building: KS2

`academic_headline_snapshot`, `academic_subject_family_rollup` and
`academic_geography_aggregate` all have `ks_stage check (in ('ks4','ks5'))` — KS2 is
structurally absent from every precomputed Academic Results table, confirmed against
the real migrations. KS2 data does exist (`dfe_ks2_attainment`, 574k rows in
`canonical_facts_current`), reachable only via the older generic
`reference_data_lookup` RPC on raw facts — no headline snapshot, no LA/region/national
aggregation, no subject-family taxonomy (KS2 has no "subjects," just Reading/Writing/
Maths/GPS/Science domains).

Raised this directly rather than guessing; you chose **"degraded KS2, ship now"**:
build KS2 wherever raw facts genuinely support it (free snapshot line, Data View
headline stat/map), with no LA/region/national context, no trend-since-2021/22 badge
(KS2's own real data starts 2022/23), no rankings, no family breakdown for KS2 — every
gap flagged in the UI/wording, not silently absent. Built accordingly throughout.

## A second real finding, not anticipated by the brief: the Academic tab had zero wiring

Investigated the real, live code (not the docs, which the brief itself warns are stale
logs) before building anything. `DataViewShell.tsx`'s own `TOPIC_TABS` array had
`active: false` as a hardcoded literal for Academic — no click handler, no topic-switch
state existed at all. `MapView`/`GraphsView`/`RankingsView`/`DataViewSchoolProfile` are
all written end-to-end against Rolls' own fields (roll counts, gender, boarding,
shape) — not topic-parameterized in any way.

Per the brief's own instruction ("confirm directly how [the comparator-set machinery]
is currently wired... flag anything that turns out to be more Rolls-specific than
expected rather than silently forking it"): built a **parallel** set of Academic view
components (`AcademicMapView`/`AcademicGraphsView`/`AcademicRankingsView`, a new
`AcademicSchoolProfile` type) rather than trying to generalise the existing Rolls
components — confirmed genuinely necessary, not a shortcut. What IS genuinely shared
and reused unchanged: the comparator-set **selection** state (`tickedUrns`/`addedUrns`/
`activeSet`, all just URNs + a label — confirmed topic-agnostic by reading the code),
`ComparatorSidebar`, `ViewSwitcher`, `PdfExportButton`, and several real chart
primitives (`SpreadStrip`/`spreadData`, `DivergingBarChart`, `SortedBarChart`,
`rankDescendingWithTies`/`chunkedRankingDisplay`/`trendBadge` from `data-view-cards.ts`
— all confirmed genuinely generic before reuse, not re-implemented).

## What was built

### 1. Free State of School "Academic snapshot" card

`src/components/dashboard/AcademicSnapshotCard.tsx`, wired into
`src/app/schools/[urn]/page.tsx` in place of `<ComingSoonCard title="Academic
snapshot" />`. One line per key stage the school actually has (omitted entirely if
absent, same discipline as every other section on this page), wording per the
summary-wordings doc §1, plus the "become a member" link-through.

**Real, verified output** (server-rendered HTML, real local data, URN 121673,
Huntington School — a real through-school with GCSE + A-level):

> Huntington School's GCSE pupils achieved an average Attainment 8 score of 48.2 in
> 2024/25.
> Huntington School's A-level students achieved an average of 38.5 UCAS points per
> entry in 2024/25.
> *See how this compares — become a member.*

**Real, verified output for a KS2-only primary** (URN 118707, St Peter's Methodist
Primary School):

> 63% of St Peter's Methodist Primary School's Year 6 pupils met the expected standard
> in reading, writing and maths in 2024/25.

Both confirmed via a real HTTP fetch against the actual running dev server (not just
`tsc`/`eslint`) — see Verification section below for how.

### 2. Data View "Academic" tab

- `src/components/data-view/DataViewShell.tsx`: `TOPIC_TABS` is now real state
  (`DataViewTopic`, lifted into `activeTopic`), Rolls/Academic are both real, clickable
  tabs (Destinations/Context stay disabled placeholders — genuinely unbuilt). Switching
  to Academic swaps only the main content area (a new `AcademicDataView` sibling
  component) and hides Rolls-only chrome (`FilterBar`, the set-suggestion banner, the
  print-only summary line) that doesn't apply to academic measures rather than showing
  inert controls. `ComparatorSidebar` stays exactly as before, with one exception:
  `regionOption`/`nationOption` are passed as `null` while Academic is active, so
  Region/Nation are simply never offered as selectable sets — the mechanism Part C's
  scope boundary is enforced through, not a separate flag.
- `src/lib/academic-data-view.ts`: the data layer. `AcademicSchoolProfile` type,
  `fetchAcademicProfiles(urns)` (batches `lookupAcademicHeadline`/
  `lookupAcademicSubjectFamily` for ks4+ks5, `lookupReferenceData` for
  `dfe_ks2_attainment`, plus the school's own census age-gender facts for the map's
  population sizing — all fetched independently of Rolls' own equivalent fetch, not
  threaded through it, so this module has no dependency on Rolls' own fetch timing).
  Per-stage constants (`HEADLINE_MEASURE`/`GRADE_BAND_MEASURE`/`TREND_BASELINE_PERIOD`
  etc) hold every real, ingested field name used — see Judgement calls below for the
  KS4 grade-band default.
- `src/app/api/data-view/academic-schools/route.ts`: the batched fetch endpoint, same
  membership gate as the existing `/api/data-view/schools` route (approved membership
  at `anchorUrn`).
- `src/components/data-view/AcademicDataView.tsx`: the tab's own shell — fetches
  profiles for target + ticked + added URNs, a KS2/GCSE/A-level switcher (only stages
  the TARGET school actually has, defaulting GCSE → A-level → KS2), then renders
  Map/Graphs/Rankings.
- `src/components/data-view/AcademicMapView.tsx`: headline level only (see Explicitly
  not built below). Circle size = population at the stage's relevant age (10/15/17),
  read from the same real census source Rolls' own map uses, per spec §3a's own
  explicit reasoning (the academic ingest has no cohort headcount field at all).
  Colour: trend (change in the headline measure since the stage's baseline year) or
  grade-band (the stage's real threshold field), both toggleable.
- `src/components/data-view/AcademicGraphsView.tsx`: three of the spec's four
  sections — Overview (headline stat + trend badge + spread-strip against the ticked
  set), Growth/decline since baseline (diverging bar chart), Context over time (a
  target-vs-group-average trend line + a same-year bar across the ticked set). Section
  4 (subject/family breakdown) not built — see below.
- `src/components/data-view/AcademicRankingsView.tsx`: single active-metric ranking
  (the stage's headline measure) + rank-over-time, same Top 10/Around this school/
  Bottom 3 chunking and shared-rank-ties convention as Rolls' own Rankings, reusing
  `rankDescendingWithTies`/`chunkedRankingDisplay` directly. Ticked-comparator-set
  only, no Region/Nation scale (Part C).

## Real bug found and fixed via testing (not just code review)

`NextResponse.json({ profiles })` silently serialises a `Map` field to `{}` —
`JSON.stringify` has no native `Map` support at all. `AcademicSchoolProfile.
ageGenderCounts` is a `Map<age, {male, female}>`; without a fix, every real population
count would have vanished across the `/api/data-view/academic-schools` boundary with
no error, and the map would have silently drawn every circle at the same fallback
radius. Caught by hitting the real route with `curl` and inspecting the response, not
by inspection alone. Fixed with a `serializeAcademicProfile`/`deserializeAcademicProfile`
pair (array-of-tuples on the wire, reconstructed to a `Map` client-side) — same pattern
`data-view-serialize.ts` already established for `DataViewSchoolProfile`'s own `Map`
fields. Re-tested after the fix; real population counts (e.g. Huntington School: age 15
— 119 male/123 female; age 17 — 53 male/62 female) now come through correctly.

## Comparator-set carryover — confirmed, not assumed

`tickedUrns`/`addedUrns`/`activeSet` are the exact same React state already lived in
`DataViewShell` before this round — `AcademicDataView` receives them as props and
fetches its own academic profiles for that same URN set; there is no second, parallel
selection mechanism and no fresh proximity search. This is structurally guaranteed by
the code (the same state variables feed both Rolls' and Academic's content), not just
asserted — see the diff to `DataViewShell.tsx`.

## Judgement calls — reasoning, not defaults

- **KS4 grade-band default threshold**: English & Maths grade 9–4/9–5
  (`engmath_94_percent`), not EBacc. Chosen because it's the more universally-cited
  "5 in English and maths" GCSE headline figure in DfE's own performance-table press
  framing; EBacc is a real, valid alternative, not wrong. A third UI dimension to pick
  the basket (spec §9's own open question) was not built this round — flagged, not
  attempted, given how much else this round covers.
- **Subject-family metrics do not get their own Rankings entry** — only the
  whole-school headline measure is ranked, consistent with Rolls' own deliberate
  single-metric cut-down. Currently moot in practice since family-level Graphs/Map
  weren't built either (see below), but the decision stands for when they are.
- **Minimum-N threshold for small-cohort suppression**: still not decided. This round
  never reached the subject-level table (§6) where it would apply — genuinely
  unresolved, not silently punted past a place it mattered.

## Explicitly NOT built this round — a real, flagged scope reduction

The brief's own "explicitly deferred" list (grade-band below headline, vocational/BTEC
conversion, new comparator-set types) was respected. Beyond that, given the real size
this round turned out to be once the Academic tab's zero-wiring was discovered (see
above), the following were **not** built, and are flagged here rather than shipped
half-finished:

- **Family-level Map (§3b) and Graphs section 4 (subject/family breakdown, §4)** — both
  need a category/subject drill-down filter this round didn't reach, plus per-family
  re-aggregation across the ticked set.
- **Subject-level Map (§3c) and the subject-level table inside Overview (§6)** — the
  one genuinely new UI element this topic needs (a "list of things," not a stat or
  chart), plus KS5 value-added with its confidence-interval framing. Needs raw
  `dfe_ks4_subject_entries`/`dfe_ks5_subject_results(_historic)` facts via
  `reference_data_lookup`, not yet wired in.
- **`academic_geography_lookup` (LA/region/national aggregates) is not consumed by any
  UI this round** — re-read the frontend spec's own Map/Graphs/Rankings sections
  carefully and found no concrete place in this round's scope that actually calls for
  LA/region/national context (Map and Graphs' "context" both compare against the ticked
  set, not a geography aggregate); not wired in rather than inventing a use for it.
- **`ComparatorSidebar`'s "compared with" numbers panel stays Rolls-shaped** even while
  the Academic tab is active (it still shows roll figures) — building an
  academic-equivalent panel duplicates non-trivial existing logic for comparatively low
  value this round; the selection UI, not the figures display, is the part genuinely
  shared.
- **Print/PDF export** for the Academic tab: the print-only summary line is hidden
  while Academic is active (rather than showing stale Rolls figures), but no
  Academic-specific print treatment was built to replace it.

## Verification

- `npx tsc --noEmit`: clean across the whole project, both before and after every
  change in this round.
- `npx eslint` on every new/modified file: clean (two real issues were caught and
  fixed — a `setState`-in-effect ordering issue in `AcademicDataView.tsx`, and an
  unused constant in `AcademicMapView.tsx`).
- **Real, live end-to-end testing** (browser automation wasn't available in this
  session — no Claude-in-Chrome connection — so this was done via the actual running
  dev server + `curl`, not just unit-level checks):
  - Started `vicdata_public`'s own local Supabase stack for real (it wasn't running at
    the start of this round) — its default ports collide with `vicdata`'s own running
    stack, so its `supabase/config.toml` ports were temporarily remapped for this
    session only, then reverted (`git diff` on that file is clean).
  - Synced real `schools` data into the local stack from `vicdata`'s own local RPC
    (`scripts/sync-schools.js`, 52,584 real rows) — this script and the switch-school
    testing route (`/api/testing/switch-school`, already built for exactly this
    purpose per `docs/vicdata_data_view_open_questions.md`) are real, existing
    developer tools, not something built for this report.
  - Confirmed the free snapshot card's real server-rendered HTML for a real
    through-school (Huntington School, URN 121673) and a real KS2-only primary
    (St Peter's Methodist Primary, URN 118707).
  - Confirmed the `/api/data-view/academic-schools` route end-to-end with a real
    authenticated session (a test user created via the local GoTrue admin API, an
    approved membership via the testing switch-school route) — real KS4/KS5 headline,
    family, and population data returned for three real through-schools, and real KS2
    degraded data for two real primary schools.
  - Did **not** achieve a full interactive browser click-through of the Academic Data
    View tab itself (Map/Graphs/Rankings rendering, the KS switcher, tick-list
    interaction) — no browser tool was available this session. The data layer feeding
    those views (the part most likely to hide a real bug, and where one was in fact
    found and fixed) is verified end-to-end; the React rendering code is `tsc`/`eslint`
    clean and closely mirrors Rolls' own proven component shapes, but hasn't been
    visually confirmed in a rendered page. Flagging this explicitly rather than
    claiming a browser test that didn't happen.

## Confirmations

- Nothing was written to hosted/production: every command that touched a Supabase
  instance explicitly overrode `VICDATA_API_URL`/`VICDATA_ANON_KEY`/
  `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` to local values; neither
  repo's own `.env` (hosted) was read into any command's environment. Both local test
  Supabase stacks have been stopped since testing finished.
- No existing Rolls behaviour regressed: every change to `DataViewShell.tsx` is
  additive/conditional on the new `activeTopic` state, which defaults to `"rolls"` —
  when it's `"rolls"` (the only state that existed before this round), every branch
  renders exactly as it did before this round (confirmed by reading the full diff, not
  assumed) — see the diff for the exact, narrow set of changes.
- Do not commit or push, as instructed — stopping here.
