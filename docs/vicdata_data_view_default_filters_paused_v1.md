# Data View: default-tick the filter row — PAUSED before wiring in

Status: **parked, not live**. `data-view-filters.ts` gained a new
`defaultDataViewFilterState()` function (plus an export of the previously-private
`sumAgeGender` helper it needs), but it is **not called anywhere in the app**.
`DataViewShell.tsx`'s filter state still initialises from
`emptyDataViewFilterState()` alone, exactly as before this round — confirmed by
grep across `src/` immediately before committing. The live app's behaviour is
completely unaffected: blank filters on first load, no default ticks, same as
every prior round.

## What was being built

The feature: instead of every Phase/Gender/Boarding/Sector pill starting blank
on first load, default-tick whichever pills are genuinely true about the
target school's own real profile — so the initial view already reads as "this
school's real position," and a member narrows or relaxes from a real starting
point rather than from nothing.

`defaultDataViewFilterState(school)` was added exactly as specified: phase
bands seeded from `school.phase` (plus a real-data check for Early Years, plus
Post-16/Adult for an FE-participation institution), gender from the school's
own typology gender tag, boarding from its own typology boarding tag, sector
from its own typology sector tag.

The wiring (a one-time seeding effect in `DataViewShell.tsx`, keyed on the
school's URN so it fires once per school and never overwrites a member's own
manual clicks) was built, verified to compile cleanly, and then **reverted**
once real-data verification surfaced three genuine problems — see below. The
function itself stays in `data-view-filters.ts`, clearly marked "PARKED... NOT
called anywhere," rather than deleted, so the next round doesn't have to
rebuild it from scratch.

## Why it was paused — three real bugs found verifying against real data

Verification did exactly what was asked ("a couple of ordinary schools'
headline numbers are unchanged before/after," "an FE college's Current Roll
is checked deliberately") — and found real breakage, not a clean pass, in the
"ordinary schools" case specifically.

**1. Boarding silently makes phase narrowing inert for the majority of
schools.** `filteredCount()` has a long-standing, deliberate, pre-existing
rule (documented in this same file, from an earlier round): "boarding-status,
when active, replaces the displayed count with the whole-school boarders/day
figure and ignores any active phase/age narrowing." `defaultDataViewFilterState`
ticks `boarding` (e.g. "Day pupils") for any school with a real typology
boarding tag — which is nearly every real school. The result: the phase pills
render as lit, but the actual number shown is governed entirely by the
boarding branch, silently ignoring phase, until a member manually unticks
"Day pupils." This is exactly what masked the next two bugs during initial
testing — several schools' "before/after" checks coincidentally matched
*because* the boarding branch was returning the whole-school total regardless
of what the phase pills claimed, not because the phase seeding was correct.

**2. Post 16 never gets ticked for an ordinary school with a real sixth
form.** The phase-seeding loop copies `school.phase` (typology.ts's `PhaseTag[]`)
1:1 into `phaseBands`. It does **not** replicate `relevantAgeBandsFor`'s own,
separate "always offer Post 16 whenever `statutoryHighAge >= 16`" logic — a
rule that exists specifically because `typology.ts`'s `phaseTags()` never puts
"Senior" and "Post 16" in the same tag set for one school (a documented,
deliberate decision from an earlier round). Confirmed on real data: Acland
Burghley (urn 100053) has 329 real pupils in the Post-16 age range
(`ageRangeForBand("Post 16", ...)` = ages 16–18) — a substantial, real
population, invisible from the default state once boarding isn't masking it.
Direct per-age dump (real 2025 census data):

```
age 16: 160 pupils
age 17: 153 pupils
age 18: 16 pupils
Post-16-only total: 329
```

**3. Gender seeding from the nominal tag undercounts a real mixed cohort.**
`defaultDataViewFilterState` ticks gender from the school's own typology
`GenderTag` (a GIAS policy classification), not from real headcount
composition — the same distinction this codebase already documents elsewhere
(`typology.ts`'s own comment: "Camden School for Girls records 'Girls' despite
a genuinely mixed sixth form — an authoritative classification, not a
headcount artifact"). Confirmed on real data: William Ellis School (urn
100056, nominally tagged "Boys") has a real mixed cohort — 771 real
whole-school pupils vs 653 when sliced to Boys-only, a genuine 118-pupil gap
(not simulated/estimated — this actually surfaced through `filteredCount`'s
boarding-branch gender-slicing once boarding was also seeded, but the
underlying data fact — a nominally single-sex school with real pupils of the
other sex — would cause the identical undercount via the phase branch too,
once bug #1 above is fixed).

### What was verified as working correctly

- The FE-college branch (item 3 of the original build): urn 130408 (Ealing,
  Hammersmith and West London College) has real under-19 (1,950) and real
  adult (9,690) participation data. `defaultDataViewFilterState` correctly
  ticks both Post 16 and Adult (both real, both `>0`), giving a Current Roll of
  11,640 — a genuine, real, visible change from the old blank-filter default
  (1,950, under-19 only) — confirming the flagged "this may genuinely move for
  FE colleges" behaviour works exactly as intended for that one branch.
- `sumAgeGender`'s export and the Early-Years/FE-participation branches of the
  new function are otherwise straightforward and weren't implicated in any of
  the three findings above.

## What resolving this needs (not decided yet, deliberately)

Each of the three findings is a real design choice, not something to guess at
unilaterally:

1. Should `boarding` simply not be defaulted at all when `phaseBands` is also
   being seeded (since `filteredCount` can't honestly combine the two)? Or
   should `filteredCount`'s own boarding-priority rule be revisited for this
   specific default-seeding context (a bigger, separate change)?
2. Should the phase-seeding loop mirror `relevantAgeBandsFor`'s own
   "Post 16 whenever `statutoryHighAge >= 16`" check, independent of whether
   "Senior" is in `school.phase`?
3. Should gender seeding check the school's own *real* headcount composition
   (e.g. only default to a single gender when the other sex's real count is
   genuinely zero) rather than the nominal typology tag?

## Files changed

- `src/lib/data-view-filters.ts`: `defaultDataViewFilterState()` added
  (unused/unreferenced, clearly marked "PARKED"), `sumAgeGender` exported.
- `src/components/data-view/DataViewShell.tsx`: reverted to its
  previously-committed state — no import, no seeding effect, no ref. Filter
  state still initialises from `emptyDataViewFilterState()` alone.

No commit before this one wired `defaultDataViewFilterState` into the live
app, so there is nothing to roll back beyond this pause itself.
