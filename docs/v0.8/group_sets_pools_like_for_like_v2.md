# Group pools: like for like, round 2 — LF1–LF4 folded in, checks, and what needs a decision (v2)

Guy's answers of 8 Nov (LF1–LF4, D9). The checks raised things that need a decision (§4), so this stops there, per the instruction:
- nothing promoted;
- D9 not built;
- M2 not started.

## 1. What's done

On the production branch `feat/group-pools-like-for-like` (commit `db7a27b`, on top of the untouched `feat/group-sets-production`):

- **LF1 + LF2:**
  - special schools (any kind), AP, PRUs and LA nursery schools are out of every figure: the groups' own, every pool's, the share of places, the reweightings and the subject areas;
  - they stay members, each listed with the reason (`special` / `ap` / `pru` / `nursery`; words in `meta.reasons`).
- **LF3:** a group more than half of whose current schools are special, AP or PRU is a Special and AP trust (`special_ap`):
  - held out of the mainstream peer sets and out of the index (the library);
  - **155** groups (all types, sponsor records included); among the 1,784 listed, 105 were mostly special/AP.
- **LF4** (production side): the group's excluded list carries each such school with its reason, so the app can write "54 of 55 schools; 1 alternative provision not counted".

**Tests:** 25 unit tests pass. New ones:
- a special academy is listed and not counted, and is out of England and the band;
- nursery schools are in no pool's roll;
- special and AP trusts are held out of the peer sets and the index;
- every state school counts once, now on counted schools.

**Before/after for both readings** (M1, live, against this branch; same inputs):
- `~/dev/vicdata_group_sets/docs/vicdata_group_pools_before_after_final_at_time.md`
- `…_final_listed_now.md`

| Set | Measure | M1 (live) | Now | Schools | Listed now: M1 → now |
|---|---|---|---|---|---|
| England (all) | Attainment 8 2025/26 | 47.09 | 47.44 | 3,899 → 3,670 | same |
| England (state) | Attainment 8 2025/26 | 47.27 | 47.63 | 3,524 → 3,295 | same |
| England (all) | Roll 2025/26 | 8,791,004 | 8,652,673 | 22,986 → 21,747 | same |
| Non-group state | Attainment 8 | 48.27 | 48.36 | 581 → 567 | 48.56 → 48.61 |
| Single-academy trusts | Attainment 8 | 53.00 | 53.17 | 454 → 441 | 53.11 → 53.28 |
| MATs 41+ | Attainment 8 | 46.09 | 46.22 | 269 → 262 | 46.10 → 46.22 |
| All foundation trusts | Attainment 8 | 41.45 | 43.79 | 39 → 25 | 41.41 → 43.82 |
| Federations 2–5 | Attainment 8 | 42.82 | 44.67 | 27 → 21 | same |
| Harris: non-group in its LAs | Attainment 8 | 53.36 | 55.44 | 41 → 38 | 52.85 → 54.73 |
| Harris: its areas | Attainment 8 | 50.06 | 50.51 | 287 → 267 | 49.40 → 49.82 |
| Harris itself | Roll | 42,940 | 42,938 | 55 → 54 (its AP school) | 48,960 → 48,958 |

- **Groups' own figures move** for 271 groups (roll) and 88 (A8) at the time; 282 and 95 listed now.
- **The library** holds **1,644** groups:
  - MAT 1,025, federation 420, foundation trust 64, independent charity 59, independent company 41, independent other 35;
  - it was 1,784. The difference is the special and AP trusts, plus the nursery-only federations (§4, N2).

## 2. England against DfE (LF1's check)

DfE, *Key stage 4 performance 2025/26* (provisional, Explore Education Statistics), national rows:

| DfE row | Schools | Pupils | Attainment 8 |
|---|---|---|---|
| State-funded mainstream | 3,312 | 616,093 | **47.4** |
| of which LA-maintained mainstream | 534 | 102,711 | 47.6 |
| of which academies and free schools | 2,761 | 511,419 | 47.4 |
| City technology colleges | 3 | 639 | 53.6 |
| FE 14–16 colleges | 14 | 1,324 | 12.7 |

**VicData's state pool (`england:state`) reads 47.63 over 3,295 schools and 609,936 pupils.** Joined school by school to DfE's institution-level file for 2025/26 (the same release), **it is identical**:
- the same 3,295 schools;
- every school's pupil count and Attainment 8 equal;
- 609,936 pupils and 47.626 in both.

The 0.2 gap to DfE's 47.4 headline is DfE's national total counting three more things:
- **3 CTCs**: GIAS types them as independent schools, so VicData puts them in the independent sector;
- **14 FE 14–16 colleges**: GIAS "Colleges", not mainstream here; A8 12.7;
- **about 4,200 pupils in no school's row**: national 614,130 pupils for the LA-maintained, academy and free-school types, against 609,936 in the school rows.

The 2024/25 final shows the same pattern: DfE 47.1, VicData 47.39 over the same composition.

**But the Group pages' England is `england:all`**, which includes independent schools: 47.44, over 3,670 schools of which 375 are independent. Labelling it "England, mainstream state-funded" would be wrong, which is §4 E1. The match to DfE's 47.4 is a coincidence.

## 3. Teacher, SMT and Admissions (LF1's report; nothing changed)

**They don't use the same England as the Group pages, nor quite the same as each other.** None of their school-based England figures filters by school type in VicData's code: a school is England if DfE publishes a row for it.

| Product | England figure | Who's in it | Weighting |
|---|---|---|---|
| **Teacher** | Results England anchor (GCSE per subject; Post-16 per subject × qualification) | every school DfE lists with a non-Welsh LA; special, AP, independent and **IGCSE schools all in**; minimum 1 school | entry-weighted average |
| Teacher | Grade bands, England | as above; minimum 5 schools | entry counts |
| Teacher | National ranking (chooser) | `region_nation_set` + `sectorTag`: special, independent and FE in; **PRUs and nurseries out**; IGCSE out of the headline rank, in subject ranks | rank; plain mean |
| Teacher | KS2 England headline | none | – |
| **SMT** | A8 / P8 / Post-16 places, the P8 strip, the scorecard | DfE's headline snapshot, every school with the figure: special, AP, independent in; IGCSE out at GCSE | rank over schools; strip p25–p75 |
| SMT | Roll and boarders rank | every school type | rank |
| SMT | Size bands, the pupils' England line | mainstream type groups only (GIAS "Special schools" out; special/AP academies and PRUs in) | mean / headcount |
| **Admissions** | Headline ranks | as SMT (the same `academic_headline_snapshot`, the same `rankIn`) | rank |
| Admissions | Subject ranks | Teacher's ranking population | rank |
| Admissions | Pool trends | mainstream type groups | headcount |

**What would move if all were made like for like** (left for Guy's decision):
1. **Teacher's England averages**, GCSE and Post-16 per subject: special schools and AP out, which raises England's average points in most subjects. IGCSE in or out is a separate existing rule (R-IGCSE-SUBJECT keeps them in).
2. **SMT's and Admissions' England places** ("Nth of N in England") on A8, P8 and A-level: special and AP out, so N falls by about 230 at GCSE and ranks improve slightly. The P8 strip moves.
3. **Teacher's national ranking:** special schools out (PRUs and nurseries already are).
4. **SMT and Admissions roll ranks:** special, AP, PRU and nursery out.
5. **The size-band and pupils lines:** already mainstream groups. Taking special/AP academies and PRUs out would move them slightly.

## 4. What needs a decision

```
E1  Which England the Group pages show. Today it's england:all (state and independent mainstream,
    A8 47.44). Options:
    (a) by sector, like non-group: a state group sees "England, mainstream state-funded"
        (england:state, 47.63) and an independent group sees "England, independent mainstream"
        (england:independent);
    (b) keep england:all, labelled "England, all mainstream schools (state-funded and independent)".
    Recommend (a). It's a one-line change in group_comparison_lookup's 'england' kind, plus the
    label and (i).

E2  The (i)'s note on DfE. VicData's state figure equals DfE's school-level data exactly, but sits
    0.2 above DfE's headline (47.63 against 47.4). Recommend (i): "From DfE's school-level results;
    DfE's own England headline also counts city technology colleges, FE 14–16 colleges and pupils
    not in any school's figures, so it reads slightly lower (47.4 in 2025/26)." And, separately:
    classify the 3 CTCs as state-funded (GIAS types them independent): recommend yes, in production.

E3  Teacher, SMT and Admissions (§3): no change this round, as instructed. Do you want a later item
    to bring their England in line? It is a cross-product change, with the "what would move" list
    above.

N1  Roll and nursery-age pupils (LF2's check). Roll counts every age 0–19, in the groups' own
    figures and every pool alike, and the same as the app's school rolls (AGE_BANDS starts at 0),
    so the definition is consistent. The mix isn't: pupils aged 0–3 (nursery classes in primaries)
    are 4.25% of non-group's roll, 4.62% of federations 2–5, 2.8% of the MAT bands and 0.98% of
    the single-academy trusts. Options:
    (a) leave it; roll is every pupil on roll, as the school pages count it;
    (b) group rolls and pools from age 4 (reception) up, which would differ from the school pages.
    Recommend (a). Change and growth are like for like (same schools, same ages), and
    every phase roll (primary 5–10, secondary 11–15, post-16 16–18) already leaves nursery ages out.

N2  Nursery-only federations. With nursery schools out of figures (LF2), federations made only of
    nursery schools have no figures and drop out of the library (about 33 groups; 47 federations in
    all leave the library with the special ones). Recommend: hold them out like the special and AP
    trusts, and add them to the same milestone ("nursery federations"), rather than a type of
    their own now.
```

**The to-do item for `claude/vicdata_todo.md`** (that file isn't in either local checkout, so it's here for you to paste):

> **Special and AP trusts: their own comparison** (from group sets, 8 Nov).
> - A group more than half special, AP or PRU (155 now) is compared only with other special and AP trusts and with special/AP pools, never mainstream.
> - Scope first: which measures exist and are fair to compare (roll and change, EHCP share, FSM, primary need, destinations, Ofsted, and KS2/KS4 only where cohorts pass R-MIN-SCHOOLS and the pupil minimums), then Guy chooses.
> - Held out of the library until it lands.
> - Includes nursery-only federations (N2), and later a comparison for a mainstream group's own special/AP schools (LF4's "not counted" schools).

## 5. Next, after your answers

1. Fold E1, E2 and N1/N2 into `feat/group-pools-like-for-like`, then re-run the before/after.
2. On your confirmation that `feat/group-sets-production` is merged: merge this branch on top, then promote and verify.
3. In the app:
   - the England label and (i);
   - LF4's "n of m schools" line;
   - the combined roll's (i) "mainstream schools";
   - the Schools table's "AP · not in group figures" tags;
   - D9 (R-MIN-SCHOOLS on every group pool).
4. Then M2.

Sources:
- [Key stage 4 performance 2025/26 (DfE, Explore Education Statistics)](https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2025-26)
- [KS4 accountability metrics by school type (data set)](https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/181e61e2-7dac-4cab-a2da-8fee9ea2a865)
- [KS4 institution level (data set)](https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/bf138f04-daa2-4759-b950-937a17a4c675)
