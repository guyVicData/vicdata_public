# VicData Member Data View — initial page load latency: diagnosis (v1)

*Investigation only, no fix built yet — per direct instruction, "report back with the confirmed root cause and real timing breakdown before fixing anything." Written 2026-09-15 after Guy's own live report of 30-45s initial page loads, reproduced across multiple schools, and his own isolated finding that `/api/data-view/default-lists` alone takes 12-14s. Every number below is a real, directly measured figure against production (`https://vicdata.co.uk`), via a real login (`signInWithPassword`) and the testing-only school switcher — not estimated or assumed.*

**Correction, 2026-09-15 (same day): §2's original claim below — "a single chunk of 40 entity IDs takes ~10-11s against the remote API" — was a real measurement of the wrong thing, not a fabrication or a one-off fluke, caught when Guy's own independent standalone test of the identical RPC came back consistently fast (~200ms-1s) and the two results couldn't both be right at face value. The original test called `lookupReferenceData()` (the wrapper) and reported its TOTAL time as if it were one round trip — but that wrapper has its own internal, PLAIN SEQUENTIAL pagination loop (`src/lib/vicdata-reference.ts:66-82`), and because `fetchCensusFactsBatched` calls it with no `periodMin`/`periodMax`/`breakdowns` scoping at all, a single 40-school chunk against `dfe_school_census` returns **every year and every breakdown category** on record — 39,748 rows for 40 real Norfolk schools, forcing **40 sequential paginated round trips** (PostgREST's 1000-row-per-page cap) inside what I was calling "one chunk." Each individual page is genuinely fast (~150-330ms, matching Guy's own standalone reading) — the ~10s was 40 of those, awaited one at a time, not a single slow remote call. Section 2 is left as originally written below, with this correction and the real mechanism in the new §2a — logged rather than silently rewritten, so the wrong turn is visible, not erased.*

---

## 1. Confirmed root cause: `buildLaComparatorSet`

`buildLaComparatorSet` (`src/lib/default-comparator-lists.ts:213`) is called unconditionally inside `buildDefaultComparatorLists`'s own `Promise.all` (`src/lib/default-comparator-lists.ts:709-715`) for any target with a real `la_name` — i.e. on essentially every ordinary page load, not an on-demand action. It builds List 2 ("Home LA, all sectors").

Timed in isolation, calling the real exported function directly against production data:

| School | LA | Real post-filter candidate pool | `resolveSchoolTypeCategory` | `buildLaComparatorSet` alone |
|---|---|---|---|---|
| 147505 (Norfolk school) | Norfolk | 100 schools (3 chunks of 40) | 416ms | **11,724ms** |
| 100053 (Acland Burghley) | Camden | small (1 chunk) | — | 4,399ms |
| 116437 (Hampshire school) | Hampshire | large (5 chunks of 40) | — | **15,028ms** |

This alone accounts for essentially the entire 12-14s Guy measured on `/api/data-view/default-lists` — every other piece of that endpoint's own work is cheap (`resolveSchoolTypeCategory` above; the initial `schools` table query for the LA candidate pool is 200ms for Norfolk's real 455 candidates, confirmed directly).

## 2. Confirmed at the mechanism level: the remote reference API, not local computation

`buildLaComparatorSet` calls `fetchCensusFactsBatched` (`src/lib/data-view-profiles.ts:53`) over the *entire* filtered candidate pool (no cap applied before this call — the `LIST2_CAP = 30` cap only applies in the loop *after* facts have already been fetched for every candidate). That function chunks into groups of 40 (`CENSUS_FETCH_CHUNK`) and fetches with concurrency 4 (`CENSUS_FETCH_CONCURRENCY`), each chunk hitting `lookupReferenceData` (`src/lib/vicdata-reference.ts`) — a separate, remote Supabase project (`hrqrbvrrhlidpoybezhs`, the `vicdata` ingest repo's own database).

Called directly and in isolation, a **single** chunk of 40 real entity IDs:

```
Chunk 1 (40 entityIds): 9,594ms
Chunk 2 (40 entityIds): 11,177ms
```

This is not a concurrency or pipelining problem — one lone round-trip for 40 IDs genuinely takes ~10-11 seconds against the remote API right now. Norfolk's 100 candidates (3 chunks) fit inside one concurrency-4 round → matches the measured 11.7s. Hampshire's larger pool (5 chunks) needs two rounds → matches the measured 15.0s. Larger LAs (more chunks, more rounds) scale worse, roughly linearly in units of ~10s per concurrency-4 round.

## 2a. Corrected mechanism, verified via the real exported function, order-independent

Verified with `lookupReferenceData` (`src/lib/vicdata-reference.ts`) itself, unmodified — not a reimplementation — called directly against production with the real Norfolk chunk used throughout this investigation:

```
Real lookupReferenceData(), UNSCOPED (matches fetchCensusFactsBatched today): 10,073ms, 39,748 facts
Real lookupReferenceData(), SCOPED to periodMin/periodMax = 2025 only:           498ms,  5,160 facts
```

That's a real ~20x difference from adding parameters `lookupReferenceData` **already accepts** (`periodMin`/`periodMax` are optional params on its own existing signature — `fetchCensusFactsBatched` (`src/lib/data-view-profiles.ts:62`) simply never passes them). No new code was needed to produce the fast number above.

**Ruled out the cold-connection/first-call hypothesis explicitly**, per the request to check it rather than assume: ran scoped, then unscoped (different 40 URNs, connection already warm), then scoped again, all in one process:

```
SCOPED (called first):                                          483ms, 5,160 facts
UNSCOPED (called second, connection already warm):            11,580ms, 44,320 facts
SCOPED (called third):                                          398ms, 5,160 facts
```

Order has no effect — scoped stays fast whether it runs first or third; unscoped stays slow even with a warm connection. This rules out TLS/connection warm-up as the explanation and confirms it's real data volume forcing real sequential pagination.

**Why unscoped returns so much**: `dfe_school_census` records roughly 129 distinct breakdown values per school per year (5,160 rows ÷ 40 schools, period-scoped) — age×sex (the `full_time|part_time`/`male|female`/`aged_N` shape `AGE_BREAKDOWN_RE` in `src/lib/roll-data.ts:32` matches), plus boarding, FSM, EAL and others `buildLaComparatorSet` never reads. Across every year on record (not just the current one), that's ~994 rows/school, 39,748 for a 40-school chunk — comfortably past PostgREST's 1000-row page cap, forcing up to 40 pages.

**What `buildLaComparatorSet` actually needs**: exactly one period (`CURRENT_CENSUS_PERIOD`, via `singleAgeGenderCountsForPeriod` at `src/lib/roll-data.ts:149`, which itself discards anything not matching `AGE_BREAKDOWN_RE`) for a single roll-total-nonzero check (`default-comparator-lists.ts:262-269`). Everything else in the unscoped response is fetched, paginated for, and thrown away.

**Not yet tested, flagged as a further real opportunity, not verified in this pass**: scoping `p_breakdowns` too (on top of the period scope) would very likely drop this from ~6 sequential pages (5,160 rows) to a single page, since the age/gender breakdowns alone are a small subset of the ~129/school/year total — but this needs a real, correct list of the breakdown strings this call actually needs (`AGE_BREAKDOWN_RE`'s own four-way cross product, `(full_time|part_time)_(female|male)_aged_N` for whatever the real age range is) confirmed against live data before relying on it, not assumed from the regex alone.

**A second call site with the same shared function, not fully investigated in this pass**: `fetchDataViewProfiles` (`src/lib/data-view-profiles.ts:186`, backing `/api/data-view/schools`, §5 above) calls the same unscoped `fetchCensusFactsBatched`, but genuinely needs multi-year data (`DataViewSchoolProfile.trend: RollSnapshot[]`, "full real history, ascending by period") — so period-scoping the *shared* function's default behaviour would break it. Any fix here needs the narrowing to be a parameter `buildLaComparatorSet`'s own call site opts into, not a change to `fetchCensusFactsBatched`'s default behaviour for every caller. Whether breakdown-scoping alone (without touching period range) would help that call site too is a real, separate question not investigated here.

## 3. Confirmed: none of the last four commits are implicated

Checked independently, not just trusting Guy's own check. Of the last four commits (`5c328c8`, `97b6d7a`, `8c2d88e`, `25acf4c`):

- `5c328c8`, `97b6d7a`, `25acf4c` don't touch `src/lib/default-comparator-lists.ts`, `src/lib/data-view-profiles.ts`, or `src/lib/vicdata-reference.ts` at all.
- `8c2d88e` touches `default-comparator-lists.ts` — `git show 8c2d88e -- src/lib/default-comparator-lists.ts` shows its entire diff on this file is four label/note string replacements (the "boarding quintile" jargon rewording). `buildLaComparatorSet`, `fetchCensusFactsBatched`, and the `Promise.all` shape are byte-identical before and after.

None of these four commits touch query logic, the candidate-pool computation, or the remote-API call pattern anywhere in this path.

## 4. New regression, or pre-existing and simply never fixed?

**Pre-existing, not a recent regression**, as best as this investigation can determine.

`git log --follow -p -- src/lib/default-comparator-lists.ts`, traced back to the very first commit that built the Member Data View feature (`c56c1a4`, "Build member Data View: shell, filters, default lists, Dashboard, Rankings, Map, PDF"), shows `inLaAllSectorsList` — the direct predecessor of `buildLaComparatorSet`, later generalised into it (2026-09-06, "UX refinements round 1, B3" per that function's own header comment) — already called `fetchCensusFactsBatched(byDistance.map((r) => r.urn))` over the *entire* uncapped candidate pool, structurally identical to today's code. The shape of this bug has never changed since the feature's first commit.

It also predates the "Member Data View performance architecture" round (`1eb749d`, 2026-09-07) that fixed the *same class* of problem for the Boarding-quintile recipe (List 3), Region, and Nation — `git show 1eb749d -- src/lib/default-comparator-lists.ts` shows that round added `boardingQuintileListFast` (a precomputed-table fast path) and the `school_region_nation`/`region_nation_set` machinery, but never touched `buildLaComparatorSet`/`inLaAllSectorsList` at all. That round's own commit message describes the root cause it was fixing in language that applies just as much to List 2: *"boarding-quintile comparator took ~41-71s from fetching ~403 school profiles via chunked PostgREST pagination across a separate Supabase project, then computing... in TypeScript."* This is a genuine gap in that round's own scope, not something that later broke.

**Update after §2a's correction**: the ~10s/chunk originally measured in this investigation is not a real remote-API latency figure at all (see §2a) — it's the cost of unscoped, multi-page pagination. Re-examined with that in mind: `boardingQuintileList`'s own live facts fetch (`default-comparator-lists.ts:342`, the exact function whose 71.6s the September round documented and then routed around via `boardingQuintileListFast`) calls the **same** unscoped `fetchCensusFactsBatched`, with the same missing `periodMin`/`periodMax`. That round's own fix (precomputed tables, reached for a boarding-quintile-scale ~403-candidate pool) was a real, working fix for that call site, but its own diagnosis — "dominated by per-chunk network round-trip latency to the remote vicdata reference API" — was very likely describing this SAME unscoped-pagination cost, not genuine per-request remote latency, just never isolated to that specific mechanism at the time. Worth being honest about: this doesn't change the earlier conclusion (pre-existing, not a recent regression) — if anything it reinforces it, since it means this exact inefficiency has been present, uncorrected, in every one of this module's facts-fetching call sites since the feature's first commit, including the one that WAS "fixed" (worked around with a precomputed table, its own root cause not actually addressed at the source).

**Honest read**: this call has very likely always cost this much for any school whose LA has a big-enough same-phase candidate pool. It gates the very first, passive page load rather than an on-demand button click (unlike the Boarding recipe, which was only paid for when a member actually clicked "Nearest 10" for a boarding school) — which plausibly explains why it was never isolated and reported the way the Boarding/Region/Nation cases were: nothing about it looks unusual from the outside, it just makes the whole page slow every time.

## 5. New finding: a second slow request in the critical path, not covered by Guy's own testing

`/api/data-view/schools` (`fetchDataViewProfiles`, `src/lib/data-view-profiles.ts:186`) calls the **same** `fetchCensusFactsBatched(urns)` (`src/lib/data-view-profiles.ts:197`). Guy's own report measured this endpoint at "under 600ms" — almost certainly tested with a small URN list, not the real payload an actual page load sends.

A real initial page load requests `target.urn + list1.schools (10) + list2.schools (up to 30)` — up to **41 URNs**. Tested with the real, actual URN list each of these two schools' own `default-lists` response produces:

```
147505: default-lists 12,495ms  →  schools (41 real urns) 6,726ms  →  sequential total 19,222ms
116437: default-lists 14,198ms  →  schools (41 real urns) 6,697ms  →  sequential total 20,895ms
```

Critically, `DataViewShell.tsx`'s own Step 3 profile-fetch effect only starts once Step 2 (`default-lists`) has resolved and set `activeSet` — client-side, these two requests run **sequentially**, not in parallel. So the real server-side critical path for a first page load is **~19-21 seconds**, not the ~12-14s Guy's own isolated test of `default-lists` alone found.

## 6. What this investigation could not directly verify

No real DevTools Network-tab trace of an actual page load was captured — claude-in-chrome (the Chrome browser extension) was unreachable this session, consistent with every prior round this whole build has gone through. So the following remain unconfirmed, not ruled in or out:

- Client-side hydration/render overhead on top of the ~19-21s server-side critical path above.
- Genuine Vercel serverless cold-start behaviour — this investigation's own repeat calls were effectively "warm" (back-to-back), so cold start wasn't isolated as its own contributor.
- Real end-user network conditions (this investigation ran from a different network than Guy's own live reports).

The ~19-21s confirmed sequential server-side total already accounts for the large majority of the gap between Guy's own 12-14s single-endpoint measurement and the reported 30-45s full-page-load figure; the remainder is plausibly explained by the items above, though none of them were measured directly.

## 7. Recommended next step (not yet built, per instruction to report back first) — superseded by §2a's correction

**Original recommendation (below), superseded.** §2a's correction changes what the right fix looks like: the bottleneck isn't "the remote API is inherently slow, replace the data source" — it's "this call site asks for far more data than it uses, and pays a real pagination tax for it." That reframes the fix from an infrastructure project into a small, surgical, low-risk one:

**Likely real fix, not yet built**: give `fetchCensusFactsBatched` (`data-view-profiles.ts:53`) optional `periodMin`/`periodMax` (and, pending the further breakdown-scoping check §2a flags as unverified, optional `breakdowns`) parameters that thread straight through to `lookupReferenceData`'s own already-existing ones — then have `buildLaComparatorSet`'s own call site (`default-comparator-lists.ts:262`) pass `periodMin: CURRENT_CENSUS_PERIOD, periodMax: CURRENT_CENSUS_PERIOD`, the only period it ever reads. `fetchDataViewProfiles` (`data-view-profiles.ts:197`, needs full multi-year trend data — §2a) keeps calling it unscoped, exactly as today, so nothing about that call site changes. Verified in this investigation via the real, unmodified `lookupReferenceData` function that this alone takes a single 40-school Norfolk chunk from 10,073ms to 498ms (§2a) — projected (not yet measured end-to-end through the real `buildLaComparatorSet`, since that would mean editing the real source) to bring Norfolk's whole `buildLaComparatorSet` call from ~11.7s to roughly ~1s (one concurrency-4 round, worst real chunk ~500-1000ms), and Hampshire's from ~15s to roughly ~2s (two rounds).

This is a much smaller, lower-risk change than building a new precomputed table — no new migration, no new recompute job, no new staleness-vs-freshness tradeoff to reason about — and it directly targets the actual confirmed mechanism rather than replacing a data source that (per §2a) was never really the problem. `boardingQuintileList`'s own live facts fetch (§4's update) has the identical fixable shape, though it's not on the hot path any more (routed around by the precomputed `boardingQuintileListFast`) so fixing it there is a nice-to-have, not urgent.

**Still open, would need a real check before building anything**: the exact real breakdown-string list needed for the further breakdowns-scoping win (§2a's own flagged-unverified item), and whether `fetchDataViewProfiles`'s own call site could similarly benefit from breakdown-scoping (it needs multiple periods, but likely not every breakdown category either) — neither investigated in this pass.

---

*Original recommendation, written before §2a's correction, kept for the record rather than deleted:*

> Same proven fix pattern already used for Boarding/Region/Nation: push this into a precomputed table or a real SQL aggregate rather than fetching-and-computing in application code on every request. Given `school_current_snapshot` (the large-set design v1's own precomputed per-school current/anchor breakdown, already keyed by `urn`, already kept fresh by `scripts/recompute-census-derived.ts`) already exists and already backs the Region/Nation choropleth's own per-school figures, the likely quickest real fix is reading LA-comparator candidates' current-period rolls from that table directly instead of `fetchCensusFactsBatched` against the remote reference API. Worth confirming `school_current_snapshot` actually covers the fields List 2's own roll-total-and-nonzero check needs before committing to this as the whole answer, not assumed.

---

## 8. Fix built, verified, deployed (2026-09-15, same day)

Built exactly to §7's revised scope: `fetchCensusFactsBatched` (`data-view-profiles.ts`) gained optional `periodMin`/`periodMax` params threaded straight through to `lookupReferenceData`'s own already-existing ones (default `undefined`/`undefined`, so every other caller is unaffected); `buildLaComparatorSet`'s own call site (`default-comparator-lists.ts:262`) now passes `periodMin: CURRENT_CENSUS_PERIOD, periodMax: CURRENT_CENSUS_PERIOD`. `fetchDataViewProfiles` (backing `/api/data-view/schools`) deliberately left unscoped, exactly as before. Breakdown scoping and `boardingQuintileList`'s own identical-shape (but no longer hot-path) call both left alone, per direct instruction.

**Local verification, real unmodified functions, before pushing**:

| School | `buildLaComparatorSet` before | after | speedup |
|---|---|---|---|
| 147505 (Norfolk) | 12,189ms | 891ms | 13.7x |
| 100053 (Camden) | 3,572ms | 614ms | 5.8x |
| 116437 (Hampshire) | 13,843ms | 1,496ms | 9.3x |

Output confirmed byte-identical pre/post fix for all three (school list including order, label, key — `JSON.stringify` equality, not eyeballed).

**Live production verification, after deploy** (`https://vicdata.co.uk`, real login, same three schools):

| School | `default-lists` before | after | `schools` (41 urns) before | after | sequential total before | after |
|---|---|---|---|---|---|---|
| 147505 (Norfolk) | 11,987ms | **1,102ms** | 6,261ms | 6,866ms | 18,248ms | **7,968ms** |
| 100053 (Camden) | 4,002ms | **770ms** | 4,679ms | 4,922ms | 8,681ms | **5,692ms** |
| 116437 (Hampshire) | 14,268ms | **1,085ms** | 6,614ms | 7,008ms | 20,882ms | **8,093ms** |

`/api/data-view/schools` is essentially unchanged, as expected — it was never in scope, and genuinely needs the full multi-year fetch it still does. It's now the dominant remaining cost in the sequential critical path, and (per §2a/§7) very likely has its own, separate breakdown-scoping opportunity — not investigated or touched this round.

**Output correctness confirmed against live production, not just the local test**: fetched the real, live, post-fix `/api/data-view/default-lists` response for all three schools and diffed `list2.schools`/`list2.label` against the local pre-fix baseline captured before any code change — byte-identical for all three, live label strings ("In Norfolk (all sectors)" etc.) unchanged.

`npx tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 7 pre-existing, unrelated baseline problems). Committed as `f5d60fd`, pushed to `origin/main`.

**Net result**: the sequential critical path this investigation set out to explain drops from ~18-21s to ~6-8s for these three real schools — roughly 2.3-2.6x faster end to end, entirely from the one scoped call site. The remaining ~6-8s residual is now `/api/data-view/schools`'s own genuine, unscoped, multi-year fetch — a real, separate, honestly-flagged follow-up, not fixed in this pass.

---

## 9. Follow-up fix: `/api/data-view/schools` breakdown-scoping (2026-09-15, same day)

Built the follow-up flagged in §7/§8: `fetchDataViewProfiles` can't be period-scoped (genuinely needs every year for `DataViewSchoolProfile`'s own `trend`/`ageGenderCountsByPeriod` fields), but real live data confirmed it doesn't need every breakdown category `dfe_school_census` records either.

**Verified before building, independently, not just trusting the prior grep**: read every function in the real data-flow path from `fetchCensusFactsBatched`'s output to the final `DataViewSchoolProfile` (`buildRollSnapshot`, `buildRollTrend`, `singleAgeGenderCountsForPeriod`, `boardersGenderSplitFromFacts` — all in `roll-data.ts`/`data-view-profiles.ts`) — confirmed the entire real breakdown surface ever read is `AGE_BREAKDOWN_RE`-matched age/gender facts plus `boarders_male`/`boarders_female`/`boarders_total`. Nothing else, anywhere in the real path (`shapeCurrent`/`shape2019` derive from already-parsed `AgeGenderCounts`, not raw facts; `feParticipation` comes from an entirely separate source, `dfe_fe_participation*`, unaffected by scoping `dfe_school_census`).

**Real age range confirmed live**, not assumed from `AGE_BANDS`' own 0-19 display span: queried real `dfe_school_census` data across a 60-mainstream + 20-post-16/FE-adjacent sample (genuine 16-99/16-25/16-30 institutions included specifically to check for anything wider than the app's own model) — every real age observed is **0-19**, exactly matching `AGE_BANDS`. The breakdown list (`CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS`, `data-view-profiles.ts`) is built **programmatically** from `AGE_BANDS`' own real min/max, not hand-typed — 83 real strings (80 age × `{full_time,part_time}` × `{female,male}` + 3 `boarders_*`), confirmed to generate exactly that count.

**Real magnitude, measured not projected, per direct instruction not to assume a repeat of the period-scoping win**: the same real sample showed 163 distinct breakdown strings total, with only 50.4% of facts (3,008 of 5,968) matching the age/boarders shape this codebase reads — the other half is a genuinely separate, parallel breakdown category (`full_time_female_year_group_11`, `full_time_male_early_1`, `part_time_female_reception`, etc.) that `AGE_BREAKDOWN_RE` has never matched and every current consumer already silently discards, today, unscoped. This is a real but meaningfully smaller win than period-scoping — roughly halving row volume, not eliminating multi-page pagination the way narrowing to one year did.

**Fix**: `fetchCensusFactsBatched` gained an optional `breakdowns?: string[]` param, threaded straight through to `lookupReferenceData`'s own already-existing one (default `undefined`, every other caller unaffected). `fetchDataViewProfiles`'s own call site passes `CENSUS_AGE_GENDER_BOARDING_BREAKDOWNS` but deliberately **not** `periodMin`/`periodMax` — still needs every year. `buildLaComparatorSet` left completely untouched, per direct instruction (already fast from §8's fix, not worth the extra risk here).

**Local verification, real functions, real 41/34-URN payloads reused verbatim between pre/post runs** (same URN set both times, not re-derived, to keep the comparison apples-to-apples):

| School | before | after | speedup |
|---|---|---|---|
| Camden (100053) | 5,794ms | 2,007ms | 2.89x |
| Hampshire (116437) | 7,931ms | 2,355ms | 3.37x |
| Norfolk (147505) | 7,332ms | 2,418ms | 3.03x |

**Output correctness — whole-array `JSON.stringify` equality, every field, not just roll totals** (`trend`, `ageGenderCountsByPeriod`, `boardersGenderSplit`, `shapeCurrent`/`shape2019`, `feParticipation`, all of it): byte-identical pre/post fix for all three schools.

**Both named edge cases confirmed directly, empirically, not just by code inspection**:
- FE/ILR fallback: Worcester Sixth Form College, urn `144888` (a real academy-converted 16-19 institution with genuine non-null `feParticipation.under19` data — 1,780 real pupils, real male/female split, `current: null`) — byte-identical pre/post fix.
- Zero-period-skip: Reigate College, urn `145005` (`roll-data.ts`'s own named example) — byte-identical pre/post fix. Both pre- and post-fix show `current: null, trend: []` currently — this school's own real data has apparently moved on from the specific quirk that comment describes (or the comment's own historical example no longer reproduces the same way); either way, confirmed unaffected by this change specifically, which is what mattered here.

**Live production verification, after deploy** (`https://vicdata.co.uk`, real login, same three schools, fresh production "before" reading taken immediately before the deploy):

| School | `default-lists` (unaffected, for reference) | `schools` (41/34 urns) before | after | speedup | sequential total after |
|---|---|---|---|---|---|
| Norfolk (147505) | 1,031ms | 6,271ms | **2,467ms** | 2.54x | **3,498ms** |
| Camden (100053) | 623ms | 4,818ms | **2,076ms** | 2.32x | **2,699ms** |
| Hampshire (116437) | 1,126ms | 6,352ms | **2,426ms** | 2.62x | **3,552ms** |

Production `profiles.length` cross-checked against the local pre-fix baseline for all three schools — matches exactly (29/34/31).

`npx tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 7 pre-existing, unrelated baseline problems). Committed as `f195208`, pushed to `origin/main`, deployed and verified live.

**Cumulative net result, both fixes together**: the real sequential critical path (`default-lists` → `schools`) this whole investigation set out to explain has gone from the original ~18-21s (§1/§5) to **~2.7-3.6s** for these three real schools — roughly 6-7x faster end to end. `/api/data-view/schools` is no longer the dominant cost; both endpoints are now comfortably sub-4s.
