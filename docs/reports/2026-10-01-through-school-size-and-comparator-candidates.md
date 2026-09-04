# Through-school "overall size" fix + comparator_candidates special-school leak

2026-10-01. `src/lib/narrative-lookup.ts`, `src/lib/narrative.ts`,
`supabase/migrations/20261001120000_comparator_candidates_special_schools.sql`.
Follows directly from `docs/reports/2026-09-30-nearest-schools-special-through-schools.md`.

## 1. Item 4 — drop "overall size" for through-schools (Option B)

`computeTopic3SizeSentence` now computes `isThroughSchool = effectiveTags.length > 1`
right after `effectiveTags` itself — reusing that same enrollment-aware variable
(already the function's own authoritative "how many real phases" signal for the
per-phase clauses) rather than re-deriving the nominal `phaseTags()` check item 3's
sector-relaxation fix uses in the unrelated `surrounding-schools.ts` module. When true,
the whole-roll-vs-all-phase-peer-average computation is skipped entirely — `overallBand`
stays `null`. `targetRoll === 0` still gates the whole sentence (a school with no real
roll at all has nothing to say regardless); `peerRollCount === 0` now only gates when
the overall claim is actually being made, since a through-school no longer needs
usable all-phase peer data to say anything.

`formatSizeSentence` (`narrative.ts`) now takes `overallBand: SizeBand | null`. Every
branch that used to prefix `"The school is ${overallBand} — "` now checks for `null`
first and, when null, opens with `"The school has early-years provision. "` (if
applicable) followed by the per-phase content capitalised to open its own sentence,
dropping the blanket claim entirely. Non-through-schools always get a real `SizeBand`
(unchanged), so their own output path is untouched.

### Verified live, real sentences

- **Steiner Academy Hereford** (rural, thin peer pool): *"The school has early-years
  provision. The junior phase (Years 1–6) is medium, about the same size as the
  Herefordshire average, and the senior phase (Years 7–11) is small, smaller than the
  Herefordshire average."* — exact match to the report's own target mockup.
- **Roundhay School** (Leeds, non-rural, larger LA peer pool): *"The school has
  early-years provision. The junior phase (Years 1–6) is large, larger than the Leeds
  average."* — only one clause rendered (its own Senior-phase headcount had no usable
  peer data that period, an existing, unrelated per-tag degrade, not something this
  fix touches) — confirms the same drop-the-overall-claim behaviour holds in a denser
  LA too, not just Hereford's own thin case.
- **Acland Burghley School** (single-tag "Senior" — its own Senior/sixth-form split
  produces two *clauses* but is not a through-school by `effectiveTags.length`):
  *"The school is large — both phases, secondary and sixth form, are larger than the
  Camden average."* — byte-identical to before this change, confirming the
  Senior-split mechanism (two clauses from one phase tag) is correctly distinguished
  from a genuine through-school (two-plus distinct phase tags) and stays on the
  unaffected path.

## 2. comparator_candidates special-school leak — fixed

Same symmetric `is_special` pattern as the `nearest_schools` fix, applied via a new
`target` CTE (this function previously only pulled `target_pupils` via an inline
subquery) — reused for both branches exactly as before: mainstream targets exclude the
three real leak types (`Academy special converter`, `Academy special sponsor led`,
`Free schools special`) on top of the existing mainstream-group inclusion list;
special-school targets match only real special-school candidates (the dedicated
`'Special schools'` group or those same three types). Also added the alternative-
provision/referral substring exclusion `nearest_schools` already had, which this
function never had at all. No parameter or return-column change, so `CREATE OR
REPLACE FUNCTION` was safe here (unlike `nearest_schools`, which needed `DROP FUNCTION`
first for its new parameter). Applied live via `supabase db push --yes --debug`,
confirmed via `supabase migration list` (local matches remote, no pending).

### Verified live

- **Cambridge School** (special-school target): all 12 real candidates checked are
  genuinely special-education types — Community special school, Academy special
  converter, Free schools special, Other independent special school, Foundation
  special school. Zero mainstream leak-throughs, a complete turnaround from the report's
  own finding (previously all-mainstream-primary, zero relevance).
- **Acland Burghley School** (mainstream target): all 12 real candidates are genuinely
  mainstream (Academy converter, Community school, Foundation school, Academy sponsor
  led) — no special schools, confirming the mainstream path is unaffected.

## Checks

`tsc --noEmit` and `eslint` clean on every touched file. Migration applied live,
confirmed via `supabase migration list`.
