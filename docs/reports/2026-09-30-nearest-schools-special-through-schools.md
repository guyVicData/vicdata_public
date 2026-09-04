# nearest_schools: special-school gating, state through-school widening, and the overall-size contradiction

2026-09-30. `supabase/migrations/20260930120000_nearest_schools_special_and_through_school.sql`,
`src/lib/surrounding-schools.ts`. Item 4 is investigation/proposal only, no code changed.

## 1. Investigation (before any fix)

### Real `establishment_type` values containing "special"

Pulled every distinct value among open schools:

| count | establishment_type | group |
|---|---|---|
| 952 | Other independent special school | Special schools |
| 419 | Community special school | Special schools |
| **341** | **Academy special converter** | **Academies** |
| 154 | Special post 16 institution | Other types |
| **133** | **Free schools special** | **Free Schools** |
| **98** | **Academy special sponsor led** | **Academies** |
| 75 | Foundation special school | Special schools |
| 52 | Non-maintained special school | Special schools |

No false positives — every one of these 8 is genuinely special-education-related.
`"Special post 16 institution"` is a real but *different* population (FE-sector, not
K-12 SEN) — already excluded by the existing group filter regardless (group is "Other
types"), so it's untouched by this fix, and deliberately **not** matched by a blanket
`ilike '%special%'` (which would have caught it). The three bold rows — 572 real
schools total — are the confirmed leak: their `establishment_type_group` is
`'Academies'`/`'Free Schools'` like any ordinary academy, so the current inclusion-list
filter lets them straight through.

### How Cambridge School's original "8 nearest senior phase special schools" figure was actually built

Checked directly, not assumed: **it was not built from a genuine special-school pool
at all.** Re-ran the real matching pipeline for Cambridge School (Community special
school) as it stood before any fix — 8 real matches, of which only **2** were
genuinely special schools (both via the exact leak above: Ormiston Queensmill Academy,
`Academy special converter`; Ormiston Kensington Queensmill Academy, `Free schools
special`). The other **6** were ordinary mainstream academies (Phoenix Academy, Ark
Burlington Danes Academy, Hammersmith Academy, Kensington Aldridge Academy, All Saints
Catholic College, West London Free School) — real, nearby, age-overlapping schools
that happened to pass the filter, not special-education comparators by any reasonable
reading. The dedicated `'Special schools'` group is excluded from the candidate list
unconditionally, for every target special or not, with no special-schools-only branch
to fall back to — so a special-school target's own pool was never anything but "nearby
mainstream schools plus whichever leak-through specials happened to be close."

## 2. Fix — special schools gated both ways

New migration drops and recreates `nearest_schools` (same `drop function if exists` /
`create function` pattern as `20260807109000_feeder_candidates_local_rivals_fields.sql`,
since Postgres treats a changed parameter list as a different signature under `CREATE
OR REPLACE`). Adds a real, symmetric `is_special` check computed once in the `target`
CTE — `establishment_type_group = 'Special schools' OR establishment_type IN
('Academy special converter', 'Academy special sponsor led', 'Free schools special')`
— reused for both branches:

- **Mainstream target** → candidates must be in the mainstream group list **and** not
  one of the three named leak types (plus the existing AP/referral exclusion,
  unconditional either way).
- **Special-school target** → candidates must themselves be `is_special` by the same
  definition. No sector split within this branch (every real special-school
  `establishment_type_group` value is structurally never `'Independent schools'`, so
  the existing sector-equality gate was already moot for this population — confirmed,
  not just assumed).

Applied live via `supabase db push --yes --debug` — confirmed `DROP FUNCTION` →
`CREATE FUNCTION` → `GRANT` all completed successfully.

### comparator_candidates — same hole, confirmed, not fixed this round

Spot-checked directly: an unfiltered `comparator_candidates` call for Cambridge School
returns **zero** special-school candidates — its top 15 (ordered by closeness to
Cambridge's own pupil count) were all ordinary mainstream **primary** schools nationally,
no special schools, and no age/phase relevance at all (this RPC has no age-overlap
filter the way `nearest_schools` does). It uses the exact same mainstream-group-only
inclusion list with no `establishment_type`-level exclusion at all — the identical
hole, arguably worse since it also lacks the AP/referral exclusion `nearest_schools`
already had. Flagged per instruction, not fixed this round.

## 3. State through-school sector widening

New `p_relax_sector` parameter, default `false` (every existing call unaffected unless
it opts in). `findSurroundingSchools` now computes
`targetPhase.length > 1 && target.establishment_type_group !== "Independent schools"`
and passes it through — independent through-schools' own matching is untouched, exactly
as scoped.

### Real verification, Steiner Academy Hereford (URN 135672)

Reconstructed the **exact** pre-fix behaviour via a raw query (the live function has
already been replaced, so this re-implements the old `20260809103000` migration's own
WHERE clause verbatim) rather than assuming: within the old same-sector, mainstream-
group-only, nearest-40 candidate buffer, real through-school-shaped candidates existed
only out to **~50km**, and of the 3 found, **2 were themselves undetected special
schools** (New Siblands School, Culverhill School — both `Academy special converter`,
the exact leak item 2 fixes) and only **1** was a genuine same-sector through-school
peer (Pinvin CofE Academy, Academy converter, 50.4km away). This fully explains Guy's
own observed "1 real match."

**After both fixes together**: raw candidate buffer (relaxed sector, special schools
now excluded) contains exactly **1** real through-school candidate within the nearest
40 schools — but it's now **Hereford Cathedral School With A Junior School**
(Independent, 9.1km away), not the special-school false-positive or the 50km
mainstream match. The **count** didn't grow for Steiner specifically — genuine
through-schools of *either* sector are simply this rare near Hereford (rural LA) —
but the fix replaced a wrong, far-away, partly-fake match with the one real, much
closer candidate that actually exists. Reported honestly: this does **not** match
"confirm a materially larger pool" for this specific school; the mechanism is proven
correct, the real population nearby is just this thin.

**Broader real check** (167 real, genuinely-mainstream state through-schools found
nationally, filtered to exclude special/AP types): spot-checked 8 of them across
different LAs — current (post-fix) pool sizes of 0, 2, 2, 2, 4, 0, 4, 2. Materially
non-zero for most (6 of 8), confirming the fix has real, positive effect broadly, even
though Hereford's own rural geography happens to be the thinnest case in the set.

### Regression checks

- **Independent through-school** (University College School, URN 100065): 10 matched,
  all `Independent schools` group — sector gate correctly *not* relaxed (target's own
  group is Independent, so `relaxSectorForThroughSchool` evaluates false).
- **Mainstream non-through-school** (Acland Burghley, URN 100053): 5 matched, all
  genuine mainstream academies/LA-maintained/free schools, no special schools, no
  cross-sector leak — consistent with expected unaffected behaviour.

## 4. "Overall size" vs per-phase contradiction — investigation and options, no fix

### Reproduced exactly, real numbers

Steiner Academy Hereford: whole roll (ages 5+) = **300**. Peer pool: 44 real
`Academies`-group Herefordshire peers, 43 with usable roll data, **sum 10,888, average
253.2**. Of those 43, only **1** is itself a through-school — **42 of 43 (98%) are
single-phase**. Ratio 300/253.2 = **1.185**, over the 1.15 "large" threshold
(`TOPIC3_SIZE_BAND_THRESHOLD`). This is the exact, reproduced root cause: comparing a
through-school's combined roll against a peer average overwhelmingly built from
single-phase schools.

### Is this structurally impossible for a single-phase school? Checked, not assumed — the answer is more nuanced than "impossible"

The claim that a single-phase school's own "overall" and "per-phase" comparisons
"use the same numbers by construction" is only exactly true for the **numerator**
(the target's own roll). The **denominator** (peer average) genuinely differs even for
a single-phase target — "overall" draws on *every* same-group LA peer regardless of
phase, "per-phase" draws only on same-tag peers — so a divergence is not logically
ruled out. Checked two real single-phase schools directly rather than trusting the
logic alone:

- Acland Burghley (Senior only): overall band (45 peers, avg 327.3) = **large**;
  same-tag-only band (9 peers, avg 834.4) = **large**. Match.
- Thomas Coram Centre (Junior only, Camden): overall band (46 peers, avg 347.4) =
  **small**; same-tag-only band (36 peers, avg 200.5) = **small**. Match.

Both real cases agree — empirically, in practice, this doesn't surface for
single-phase schools (through-schools are rare enough that they don't meaningfully
skew a mostly-single-phase LA's own "all-phase" average away from what a same-phase
peer group would show). Not a mathematical guarantee, but the real data checked
supports treating this as a through-school-specific problem.

### National scale

**167 real, genuinely-mainstream state through-schools** (same figure used for item 3's
own broader check) — the same rare population. Every one of them is exposed to this
exact contradiction whenever its own combined roll and its LA peer average diverge from
what the per-phase clauses independently show (not measured per-school this round, but
structurally present for all 167 given the shared root cause).

### Two options, real mockups, no fix applied

**Current (broken) sentence, live, byte-exact:**
> "The school is large — it has early-years provision, and the junior phase (Years
> 1–6) is medium, about the same size as the Herefordshire average, and the senior
> phase (Years 7–11) is small, smaller than the Herefordshire average."

**Option A — restrict "overall" to same-structure (through-school) peers, same-sector-widening principle as item 3.** Real risk: Herefordshire's own through-school peer pool is exactly as thin as item 3's (1 real Academies-group peer; combining state+independent per item 3's widening would still likely leave only 1–2 real LA-level peers) — a statistically thin comparison, and in some LAs would return null entirely (`peerRollCount === 0`), silently dropping the "overall" clause. Real, but may not be meaningfully more informative than no claim at all in the sparser LAs — would need checking against a less rural LA to see if the pool is usably larger there.

**Option B — drop the "overall" claim entirely for through-schools, lead straight into the (already correct) per-phase breakdown.** Real mockup, restructured from the current template:
> "The school has early-years provision. The junior phase (Years 1–6) is medium, about the same size as the Herefordshire average, and the senior phase (Years 7–11) is small, smaller than the Herefordshire average."

No fix applied — real decision needed on which direction (or a third option) before
implementing, per instruction.

## Checks

`tsc --noEmit` and `eslint` clean on `surrounding-schools.ts`. Migration applied live,
confirmed via protocol log (`DROP FUNCTION` → `CREATE FUNCTION` → `GRANT` all
succeeded).
