# Build report: GCSE comparison exclusion for IGCSE-heavy independent schools

Brief: `docs/vicdata_phase3_academic_results_gcse_exclusion_brief_v1.md`. Supersedes the
stage-1 fixes round's own Part D (the caveat-alongside-a-number approach) — Parts A, B,
C from that round (`AcademicMapView.tsx`'s Leaflet remount fix, the Category filter
fixes, the map tooltip fix) were left exactly as they were; this round only touched
Part D and its replacement. Built and tested locally only; nothing committed, pushed,
or touched on hosted/production, per instruction.

**Browser tool check**: checked again at the start of this round (`tabs_context_mcp`)
— still no Claude-in-Chrome connection available this session, same as every prior
round. The brief specifically asked for a real visual check this time (group note
rendering, chart composition changing) since a code read can't fully confirm that —
that check was **not** performed and is not implied below. In its place, this round
used a real Next dev server against the local remapped stack and curled the actual
server-rendered HTML for all 7 named schools (works for the free snapshot card, which
is server-rendered) plus a standalone script exercising the exact same group-filtering
logic the Data View components use against real fetched profiles (the closest
available substitute for the Data View checks, which are client-rendered after a
browser-side fetch and can't be curled).

## A real blocker this round hit, and how it resolved

The brief said vicdata's own `docs/vicdata_phase3_academic_results_summary_wordings_v1.md`
§11 had "already been rewritten to the final decided design and wording." Checked
directly before writing anything (`git diff`, `Read`) — at that point §11 still
contained only the old stage-1 caveat text, not the new wording. Flagged this to Guy
directly rather than redrafting it myself (the brief's own explicit instruction was
"use it as written, don't redraft it") after finishing Part 1 (the gate itself),
which was fully self-contained and unblocked. Guy then added the real wording (`git
diff --stat` showed 79 lines added) and confirmed to re-read fresh. Re-read directly —
§11 now has real, complete wording for all three note shapes (target-excluded,
ticked-schools-excluded singular/plural, whole-set-excluded) — used verbatim below, not
redrafted.

## Part 1 — the gate itself

`igcseExclusionLikely` in `academic-data-view.ts` now reads:

```
if (profile.establishmentTypeGroup !== "Independent schools") return false;
const engmath94 = headlineValueAt(profile.ks4, y.period, "engmath_94_percent");
const attainment8 = headlineValueAt(profile.ks4, y.period, "attainment8_average");
return engmath94 === 0 && attainment8 !== null && attainment8 > 5;
```

`ebacc_94_percent` dropped (redundant — EBacc requires English+Maths, so it's 0
whenever `engmath_94_percent` is). `establishment_type_group` threaded onto
`AcademicSchoolProfile` (one more column on `fetchAcademicProfiles`'s existing
`schools` select, not a new fetch) and onto `SchoolRow`/the returned profile object.
`WireAcademicSchoolProfile`/`serializeAcademicProfile`/`deserializeAcademicProfile`
needed no separate edit — all three just spread the profile object, so the new plain
string/null field carries through automatically.

**Re-verified with real execution against all seven named schools** (not just the
original three from stage-1), via `fetchAcademicProfiles` + `igcseExclusionLikely`
against the local remapped stack:

```
102684 King's College School (Independent schools) -> igcseExclusionLikely: true   [expect true]
110110 Leighton Park School (Independent schools) -> igcseExclusionLikely: true   [expect true]
110125 Wellington College (Independent schools) -> igcseExclusionLikely: true   [expect true]
110155 Crosfields School (Independent schools) -> igcseExclusionLikely: false   [expect false]
118952 Sevenoaks School (Independent schools) -> igcseExclusionLikely: true   [expect true]
121673 Huntington School (Local authority maintained schools) -> igcseExclusionLikely: false   [expect false]
125340 Charterhouse (Independent schools) -> igcseExclusionLikely: true   [expect true]
```

Every one of the seven matched the brief's own expected boolean exactly.

## Part 2 — where exclusion applies, and the visible note

Computed once in `AcademicDataView.tsx` (the only component with target + ticked
profiles together), gated to `effectiveStage === "ks4"` so KS2/KS5 views are
completely unaffected, and threaded down as a plain `ks4ExcludedUrns: Set<string>`
prop to Graphs/Rankings/Map alongside what they already receive.

Three new wording functions added to `academic-data-view.ts`
(`ks4ExclusionTargetSentence`, `ks4ExclusionGroupNote`, `ks4ExclusionWholeGroupSentence`),
each returning §11's real text verbatim (parameterised by real school name(s)/set
label, not redrafted). The old `IGCSE_EXCLUSION_CAVEAT` constant and its two call
sites are gone.

- **Free snapshot card** (`AcademicSnapshotCard.tsx`): the GCSE line is dropped
  entirely and replaced by §11's target-excluded sentence when
  `igcseExclusionLikely(profile)` fires. "below" vs. "instead" resolved from whether
  this school's own KS5 line will actually render further down the same card
  (`stagesPresent` returns ks2/ks4/ks5 in that fixed order, so "below" is literally
  true whenever it's used).
- **Data View Overview** (`AcademicGraphsView.tsx`): if the *target* is excluded, the
  headline stat area shows the same sentence (`"instead"`, since this is a stage-tab
  switch, not a scroll) in place of the number, and the Overview's own spread strip is
  skipped for that case. Growth/decline and Context-over-time still render, using a
  new `comparableGroup` (target + ticked, minus every KS4-excluded school) for every
  group calculation — spread, growth bars, trend lines, same-year bar — so an excluded
  school's real Attainment 8 number never enters an average. If one or more *ticked*
  (non-target) schools are excluded, §11's singular/plural group note appears near the
  top of each affected section (Overview's spread block, Growth/decline, Context-over-
  time — shown separately in each, per the brief's own "wherever the group's
  composition has actually changed" instruction, not just once globally). If
  `comparableGroup` ends up empty (target and every ticked school excluded — only
  possible together, since the target excluded is a precondition), Growth/decline and
  Context-over-time show §11's whole-set sentence instead of an empty chart.
- **Rankings** (`AcademicRankingsView.tsx`): "This school's position" and "Position
  over time" both show the target sentence when the target is excluded (in place of
  the existing "no real data" fallback, so the two read differently — one is a real
  data gap, the other is an intentional exclusion). The ranked tables use
  `comparableGroup` the same way Graphs does, with the same group note/whole-set
  sentence logic. Needed adding `activeSetLabel` as a new prop to this component (it
  didn't receive one before this round — Rankings never needed a comparator-set label
  until this round's group note needed one).
- **Map** (`AcademicMapView.tsx`): an excluded school (target or ticked — the map has
  no separate "this school" callout the way Overview/Rankings do, so both are named
  together in one note) gets no circle at all; `withCoords` now filters on
  `!ks4ExcludedUrns.has(p.urn)` alongside the existing coordinate check. The group
  note (or whole-set sentence, if every school in view is excluded) appears near the
  map's own legend, in the same bottom-left panel as the existing size/colour legend
  text. Needed adding `activeSetLabel` as a new prop here too, for the same reason.

**Deliberately not touched**: the Subject/family breakdown section (Section 4 of
Graphs) — entries share and average point score are a different real metric class
from Attainment 8/EBacc, not named anywhere in the brief's own Part 2 list of affected
surfaces, and the brief's "what NOT to build" section doesn't mention it either. Left
exactly as it was; flagging this scope call explicitly rather than silently assuming
it should also be gated.

**Real execution verification, group/comparator-set behaviour** (the brief's own
"via the real route or equivalent server-side check" instruction) — a standalone
script fetching real profiles and replicating the exact same group-filtering logic
the components use, against three real scenarios:

```
=== A: mixed excluded/non-excluded ticked set (target NOT excluded) ===
Group: Huntington School, Leighton Park School, Wellington College, Crosfields School, Sevenoaks School
Excluded: Leighton Park, Wellington College, Sevenoaks
Group note: "3 schools aren't shown in this GCSE comparison — Leighton Park School,
  Wellington College, Sevenoaks School: DfE's performance tables exclude IGCSEs,
  which these schools use instead of reformed GCSEs."
Comparable group for averaging: Huntington School=48.2, Crosfields School=69.9
Real average, excluded schools genuinely NOT counted: 59.05 (n=2, "of 2" not "of 5")

=== B: target itself excluded, ticked set fully comparable ===
Target excluded: true — sentence fires correctly, "instead" (Overview context)
Comparable group for averaging: Huntington School=48.2, Crosfields School=69.9
(target's own number correctly excluded from the average too)

=== C: whole comparator group excluded (target + every ticked school) ===
Whole group excluded: true — "None of the schools in this comparator set have
  comparable GCSE figures to show here — try A-level, or a different comparator set."
Comparable group for averaging: (none)
```

All three shapes produced exactly the expected behaviour — excluded schools are
genuinely removed from the denominator/average, not just hidden while still pulling
a number down, and the whole-set case is correctly distinguished from a simple
target-exclusion (it only fires when literally nothing comparable remains).

**Real dev-server HTML, free card** — curled all seven named schools plus the two
controls against a real Next dev server pointed at the local remapped stack:

- Leighton Park, Wellington College, Sevenoaks, Charterhouse, King's College School
  Wimbledon (all five expected-`true` schools): GCSE line replaced by the exclusion
  sentence, "below" (all five have real KS5 lines rendering under it), no GCSE number
  anywhere on the card.
- Huntington School (control): real GCSE line, "...Attainment 8 score of 48.2 in
  2024/25." — unaffected.
- Crosfields (independent but not excluded): real GCSE line, "...Attainment 8 score
  of 69.9 in 2024/25." — unaffected, confirming the gate isn't over-firing on every
  independent school.

## Verification summary

- `npx tsc --noEmit`: clean, both after Part 1 and after Part 2.
- `npx eslint` on every changed file (`academic-data-view.ts`, `AcademicSnapshotCard.tsx`,
  `AcademicDataView.tsx`, `AcademicGraphsView.tsx`, `AcademicRankingsView.tsx`,
  `AcademicMapView.tsx`): clean, no issues.
- Real execution, not just types: the gate re-verified against all seven named
  schools; the free card's real server-rendered HTML confirmed for all seven plus two
  controls; the group/comparator-set exclusion logic verified against three real
  scenarios (mixed exclusion, target-only exclusion, whole-set exclusion) using real
  fetched data, confirming excluded schools are genuinely removed from averages/
  rankings rather than merely hidden.
- **Not verified, plainly**: the Data View Overview/Rankings/Map surfaces are
  client-rendered after a browser-side fetch, so curling the page HTML doesn't show
  their real resolved output the way the free card's server-rendered HTML does — no
  browser tool was available this session (checked again at the start, per
  instruction) to visually confirm the group note actually rendering in place, or a
  chart's composition actually changing on screen. The underlying logic was verified
  as directly as possible without one (see above); the actual rendered interaction is
  unconfirmed.

## Confirmations

- Nothing written to hosted/production: all testing used the local Supabase stacks
  (`vicdata` on default ports, `vicdata_public` remapped 54331/etc via a temporary
  `config.toml` sed edit, reverted afterward — `git diff` on `config.toml` is clean)
  with explicit local env overrides. Both stacks stopped since testing finished.
- No unrelated regressions: `tsc`/`eslint` clean across the whole project.
- `git status` clean of test artifacts — the two temporary verification scripts
  (`verify_gcse_exclusion.tmp.ts`, `verify_gcse_exclusion_part2.tmp.ts`) and the temp
  dev server/log used for the free-card curl checks were all removed after use.
- Do not commit or push, as instructed — stopping here. Guy will review Leighton
  Park, Wellington College, Crosfields, and Huntington School himself before anything
  ships.

## Next in the queue

The KS5 cohort brief (`docs/vicdata_phase3_academic_results_ks5_cohort_brief_v1.md`)
is queued to start next, per instruction — independent of this round (KS5-only vs.
this round's KS4-only scope), but touching the same `academic-data-view.ts` file via
different exports, so it'll be re-read fresh rather than worked from a stale mental
model of it.
