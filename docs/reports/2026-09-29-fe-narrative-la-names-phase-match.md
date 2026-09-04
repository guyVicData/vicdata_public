# FE opening sentence + gender split fallback, LA display names, nearest-matched phase-match investigation

2026-09-29. `src/app/schools/[urn]/page.tsx`, `src/lib/narrative.ts`,
`src/lib/narrative-lookup.ts`, `src/lib/la-sector-composition.ts`,
`src/lib/population-trend-lookup.ts`, `src/lib/market-share.ts`, new
`src/lib/la-name-display.ts`. Part 3 is investigation only, no code changed.

## PART 1 — FE current-state opening sentence + gender split card

Both gaps traced to the same root cause as the previous round's `FeCollegeLocalContextCard`
fix: the FE-template branch's existing paragraph/card logic only ever read the
crosswalk-scoped `feUnder19Snapshot`/`feAdultSnapshot`, never the aggregate `ilrSnapshot`
(`dfe_fe_participation_academy`) that's the *only* source for Hereford-shaped institutions.

### 1. New opening sentence — `feParagraphPhaseGender`

Added to `narrative.ts`, mirroring `paragraph1PhaseGender`'s own phase/age-range/gender
structure: fixed literal `"16+ college"` (no census age-band data exists on this branch
to derive a real phase tag from), age range via the same `yearGroupSingleLabel` utility
over `school.statutory_low_age`/`statutory_high_age`, gender composition via the same
`classifyGenderComposition`. Prepended as the new first entry in `feNarrativeParagraphs`.

**Female/male source priority** (page.tsx, computed once, shared with the gender-split
fallback below): aggregate `ilrSnapshot` first if real (already whole-institution) →
else both crosswalk-scoped snapshots summed if both real (two distinct populations,
safe to add) → else whichever single one exists alone. Verified against real data:
queried `dfe_fe_participation`/`_adult`/`_academy` directly for Hereford, Rochdale, and
Trafford and Stockport — confirmed the crosswalk-scoped and aggregate sources are
**structurally mutually exclusive in practice** (no institution checked has both real),
so no double-counting risk exists today.

**Verified live, real rendered sentences:**
- Hereford (143929): *"Hereford Sixth Form College is a 16+ college, with pupils from
  Year 12 to Year 13. It is co-educational, with girls making up 56% of all students."*
  (age range confirmed to convert exactly as expected: `yearGroupSingleLabel(16)` =
  "Year 12", `yearGroupSingleLabel(19)` = "Year 13" (capped at YEAR_GROUP_MAX=13). 56%
  matches the real aggregate figures, 1,230F/960M.)
- Trafford and Stockport (130519): *"...is a 16+ college, with pupils from Year 12 to
  Year 13. It is co-educational, roughly balanced, with boys making up 51% of all
  students."* — uses the summed crosswalk path (under19: 2520F/3340M + adult:
  2350F/1790M = 4870F/5130M = 51.3% male), confirmed by hand against real fetched data.
  This college never had this opening sentence before either — now fixed generally,
  not just for the aggregate-only shape.
- Rochdale (144463) and Solihull (144887): same fix confirmed, real distinct
  percentages (57% and 50% respectively).

### 2. Gender split card fallback

`GenderSplitCard`'s FE-branch render now falls back to `ilrSnapshot` when
`feUnder19Snapshot` itself isn't real. Priority here is deliberately the **opposite**
order from the paragraph above: under-19-if-real, else aggregate-if-real — because this
card's peer comparison (`feGenderPeers`, left untouched, still gated on
`feUnder19Snapshot` alone) is inherently under-19-specific, so the under-19 figure is
the right one to prefer when available; the aggregate is a last-resort self-data-only
fallback. New subtitle when falling back: *"ILR participants, whole institution — not
under-19-specific. Shown as a share."* — deliberately not claiming "U19 participants."

**Verified live:**
- Hereford: Gender split card now renders, real donut 56.16% female / 43.84% male
  (exactly 1,230/2,190), correct fallback subtitle, no peer donut (peer is null,
  `GenderSplitCard`'s own existing behaviour, unchanged).
- Trafford and Stockport: completely unchanged — "U19 participants" subtitle, real
  under19Snapshot figures, unaffected by the fallback.

`feGenderPeers` left exactly as-is per instruction — a real, separate, known follow-up
(no peer population exists yet for aggregate-only institutions) — not addressed this
round.

**Regression check:** Acland Burghley (mainstream branch) — *"Acland Burghley School is
a senior school, with pupils from Year 7 to Year 13."* — unchanged, `paragraph1PhaseGender`
itself untouched.

## PART 2 — Local authority display names

### Investigation (read-only, before any code)

Pulled every distinct real `la_name` among this database's 183 real open-school LAs
(and `la_gss_crosswalk.la_name` independently, a second table that stores its own
copy): **exactly 3 real LAs hit the ONS ceremonial-suffix pattern** —
`"Herefordshire, County of"`, `"Bristol, City of"`, `"Kingston upon Hull, City of"`.
Both tables agree (no divergence). `"Bournemouth, Christchurch and Poole"` was checked
and correctly excluded — that comma is the real, official name of a merged unitary
authority (three towns), not an ONS suffix; the fix's regex doesn't match it.

**Confirmed decisive, before touching any code**: both `age_profile_aggregates.scope_key`
and `roll_aggregates.scope_key` store the **raw** ceremonial name (`"Herefordshire, County
of"`, not `"Herefordshire"`) — queried directly, one real row each, only under the raw
string. Cleaning `la_name` before either of those lookups (or any other lookup keyed on
it) would have silently broken the join for all 3 affected LAs.

### Fix

New `src/lib/la-name-display.ts`: `cleanLaNameForDisplay()`, a general suffix-stripping
regex (`", (Royal Borough|London Borough|Unitary Authority|County|City|Borough|District)
of$"`), not a hardcoded 3-name replace — covers the real pattern generally, in case a
future LA hits a suffix word these 3 don't happen to use today.

Applied **only** at confirmed genuine display call sites, after tracing every real use
of `la_name`/`laName` across the codebase (`grep` across every `.ts`/`.tsx` file, ~70
matches reviewed individually):

- `computeLaSectorComposition` (`la-sector-composition.ts`) and `lookupPopulationTrend`
  (`population-trend-lookup.ts`) each do their own real query with the raw name
  *before* returning it — cleaned only in the object they return, since every real
  downstream consumer of that returned field (`RollCard`, `paragraph2SectorSize`,
  `feParagraphLocalContext`, `renderLocalSixthFormProvisionSentence`,
  `PopulationTrendSection`'s possessive header and `BirthsColumn`) only ever
  interpolates it into prose.
- `computeTopic3SizeSentence` (`narrative-lookup.ts`) mixes both concerns in one
  function — its own `.eq("la_name", laName)` peer-search query stays raw; only its
  final `formatSizeSentence(...)` call (pure display) gets the cleaned value.
- `market-share.ts`'s `estimateMarketShare` — a second, independent `la_gss_crosswalk`
  query (`PaidTrendsSection`'s "an estimated X% of {laName} births" prose) — same
  pattern, cleaned only at the two return points, after the real `ons_births` lookup
  (keyed on `gss_code`, never touched).
- Four direct `page.tsx` call sites cleaned at the JSX prop itself
  (`ConsortiumGroupPage`, `paragraph4LocalContext`, `PhaseBreakdownCard`,
  `LaBoardersCard`) — none of these do a lookup with the value themselves.
- Every real lookup/join call site (`getContextAggregates`, `lookupAgeBandDistributions`,
  `lookupLaSixthFormSectorTotals`, `sixth-form-sector-aggregates.ts`, the peer-search
  inside `computeTopic3SizeSentence`) left completely untouched, still keyed on the raw
  string.

### Verified live

- Hereford (143929, FE branch): *"There are 10 schools with sixth forms in
  Herefordshire and 3 FE colleges."* — ceremonial suffix gone.
- A real Herefordshire mainstream school (John Kyrle High School and Sixth Form Centre
  Academy, 136399): `RollCard`'s sentence, the population-trends panel's possessive
  header (*"Herefordshire's school population"*), and the births column header
  (*"Births in Herefordshire"*) all clean — **and the underlying joins still found real
  data**: LA age-profile series real (non-empty bars), births series real (1,586 →
  1,397 across 2021–2025, exact match to the raw `ons_births` figures independently
  queried). No silent join breakage.
- St Mary Redcliffe and Temple School (Bristol, 109327): *"Bristol's school
  population"*, *"Births in Bristol"* — clean, real data confirmed present.
- St Mary's College Voluntary Catholic Academy (Kingston upon Hull, 144104):
  *"Kingston upon Hull's school population"*, *"Births in Kingston upon Hull"* — clean,
  real data confirmed present.
- No raw `", County of"` / `", City of"` string found anywhere in any of the pages
  checked.

## PART 3 — Nearest-matched phase-match investigation (no fix, per instruction)

**School**: The Hereford Church of England Academy, real URN **135662** (resolved from
the given URL), statutory age 11–16, own nominal `phaseTags()` = `["Senior"]`.

**Real matched pool** (`findSurroundingSchools`, live): 8 schools found.

| roll | statutory age | nominal phaseTags | school |
|---|---|---|---|
| 105 | 11–19 | `["Senior"]` | Barrs Court School |
| 117 | 7–16 | `["Junior","Senior"]` | The Brookfield School |
| 345 | 3–16 | `["Junior","Senior"]` | The Steiner Academy Hereford |
| 443 | 11–16 | `["Senior"]` | Aylestone School |
| 568 | 11–16 | `["Senior"]` | Kingstone High School |
| 745 | 11–16 | `["Senior"]` | St Mary's RC High School |
| 942 | 11–16 | `["Senior"]` | Whitecross Hereford |
| 1,089 | 11–16 | `["Senior"]` | The Bishop of Hereford's Bluecoat School |

The two very small ones Guy flagged are Barrs Court School (roll 105) and The
Brookfield School (roll 117) — confirmed the real two smallest.

**The originally-proposed mechanism (nominal-vs-real phase-tag mismatch) does NOT
hold for this case** — checked directly, not assumed:
- Barrs Court School: real per-age census — ages 11–15 only, **0 primary-age pupils**,
  105 genuinely secondary-age pupils. `effectivePhaseTags()` (real enrollment-aware)
  = `["Senior"]`, identical to its nominal tag. A genuinely, currently senior-phase
  school by its real enrollment, not a primary school with a stale nominal range.
- The Brookfield School: real per-age census — ages 6–15, 37 primary-age + 80
  secondary-age pupils, genuinely spanning both phases. `effectivePhaseTags()` =
  `["Junior","Senior"]`, identical to its nominal tags. A genuine, real all-through
  school, not a mislabelled primary.

**The real mechanism, found instead**: both schools are `establishment_type =
"Academy special converter"` — genuine special/SEN schools, filed under
`establishment_type_group = "Academies"`. Per `typology.ts`'s own `sectorTag()` (an
existing, deliberate, documented rule — special-school types under the Academies/Free
Schools establishment_type_group resolve to sector `"State"`, not `"Special Schools"`),
these pass as legitimate "State" sector candidates and land in a mainstream
"nearest state senior schools" pool despite being small, specialist SEN institutions
that don't read as comparable to a reader expecting mainstream comprehensives.

**Real national scope check** (8 real mainstream senior-phase schools, one per distinct
LA, spread from Camden to Enfield — 54 total real candidates checked across their real
matched pools):

- **Phase-tag mismatch (the originally-hypothesized mechanism): 0 of 54.** Not found
  anywhere in this sample — the hypothesis, while a real and reasonable thing to
  suspect given the module's own documented tradeoff, does not appear to be an active
  problem in current real data.
- **Special-school-as-"State"-sector (the mechanism actually found): 6 real
  instances, across 6 of the 8 pools sampled (75%)** — The Bridge School (roll 260,
  appeared in two different schools' pools), Heron Academy (roll 86), Maudsley and
  Bethlem Hospital School (roll 1 — a real hospital school), Oak Hill School (roll 49),
  Fern House School (roll 79). A genuinely widespread, real pattern, not a one-off.

No fix proposed or scoped, per instruction.

## Checks

`tsc --noEmit` and `eslint` clean across every touched file (Parts 1–2). Part 3 made no
code changes.
