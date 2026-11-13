# 0.8 Non-mainstream groups: scoping report (v1, 13 Nov 2026)

This is a read-only scoping report. Nothing was built, and no database was written to.

**The milestone.** Guy decided on 8 Nov (LF3, N2: `group_sets_pools_like_for_like_v2.md`) that a group more than half of whose current schools are special, AP, PRU or nursery is a **non-mainstream group**. These groups are held out of the size bands, the library and the group set picker. They get their own comparison: against other non-mainstream groups and against special, AP and nursery pools, never mainstream ones. This report says what that comparison could be built from, so Guy can choose before anything is built.

**Evidence.**
- Counts come from production's group-aggregates inputs as fetched on 8 Nov 19:25 (`~/dev/vicdata_group_sets/.cache/group_aggregates/inputs.pkl`). They were run through production's own functions (`ingest/group_aggregates.py`: `schools_frame`, `aggregated_groups`, `non_mainstream_groups`) and the library's listing rules (`group_index`).
- FSM coverage is from a read-only query on production (`hrqrbvrrhlidpoybezhs`, `dfe_school_fsm`, 2025/26).
- What DfE and Ofsted publish is from their own pages (sources at the end).
- The scripts are in this session's scratchpad. They aren't kept.

## Headline findings

1. **There are 140 non-mainstream groups with two or more schools** (163 bodies of any size; 214 records counting sponsor duplicates). They are 105 special/AP trusts, 34 nursery federations and 1 mixed federation. Together they hold 650 schools. They are small: 100 of the 140 have five schools or fewer.
2. **Production already holds two fair measures for them: roll (with its change) and FSM.** Both cover almost every state special, AP, PRU and nursery school. Production has no EHCP share, primary need, destinations or Ofsted data. All four are published by DfE or Ofsted at school level and would need new ingests.
3. **Results are mostly unusable.**
   - KS2 reading, writing and maths is 0% at 630 of the 652 special schools that have a KS2 figure.
   - DfE publishes no school-level KS4 for AP or PRUs, only figures by LA.
   - Special schools' Attainment 8 exists for 375 of 1,070 schools. Only 7 non-mainstream groups have five or more schools with it.
   - Progress 8 stops after 2023/24.
4. **Special pools are big enough at England and region level.** Special schools have 63–169 per region, and 98 of 150 LAs have at least 5. AP and nursery pools are only usable at England and region level: just 17 LAs (AP) and 23 LAs (nursery) reach 5 schools.
5. **164 mainstream groups have their own special, AP or nursery schools: 308 schools in all.** Most of these groups (104) have just one. Only 11 have five or more, and none has five AP schools. A fair comparison for them is school by school, against the matching pool.

---

## 1. The non-mainstream groups today

**How they're counted.** `non_mainstream_groups()` takes every aggregated group: official, not a single-academy trust, with at least one current member. It flags a group when more than half of its current member schools are special, AP, PRU or LA nursery schools (`school_kind`).

| Count | Groups | What it is |
|---|---|---|
| All flagged records | **214** | MAT 96, sponsor 51, federation 52, foundation trust 15 |
| …less sponsor records | 163 | all 51 sponsor records hold exactly the same schools as a MAT already counted |
| **…with 2 or more current schools** (what the library would list) | **140** | MAT 84, federation 49, foundation trust 7 |

The brief's "about 190" was 155 special/AP groups plus about 33 nursery federations, sponsor records included. On the 8 Nov inputs the same counting gives 214 records, or **140 distinct listable bodies**. This report uses the 140 from here on.

**By kind** (of the 140; a group's kind is what more than half its schools are):

| Kind | Groups | MAT | Federation | Foundation trust | Schools held |
|---|---|---|---|---|---|
| Special and AP trusts | 105 | 84 | 14 | 7 | |
| – special only | 60 | | | | |
| – special and AP | 19 | | | | |
| – AP only | 8 | | | | |
| – special (and AP) with some mainstream schools | 18 | | | | |
| Nursery federations | 34 | – | 33 + 1 with a primary | – | |
| Mixed (no kind has a majority) | 1 | – | 1 (The Orchards Federation: 1 nursery, 1 special, 1 mainstream) | – | |
| **All** | **140** | 84 | 49 | 7 | **650**: 386 special, 109 AP/PRU, 92 nursery, 63 mainstream |

None is an independent group. GIAS has 973 open independent special schools, and only one of them is in any VicData group. The big independent special-school chains aren't groups in VicData at all (see decision 11).

**Sizes** (current schools):

| Size | Special/AP | Nursery | Mixed | All |
|---|---|---|---|---|
| 2 | 37 | 20 | – | 57 |
| 3–5 | 29 | 13 | 1 | 43 |
| 6–10 | 28 | 1 | – | 29 |
| 11–20 | 9 | – | – | 9 |
| 21–40 | 2 | – | – | 2 |

**Regions** (each group's main region, the one where most of its schools are; 20 groups span more than one region):

| London | West Midlands | South East | East of England | East Midlands | South West | North East | North West | Yorkshire and The Humber |
|---|---|---|---|---|---|---|---|---|
| 25 | 24 | 19 | 18 | 15 | 12 | 11 | 9 | 7 |

**Five named examples:**

| Group | Type | Schools | Region(s) | What it shows |
|---|---|---|---|---|
| Wellspring Academy Trust | MAT | 33: 9 special, 8 AP, 16 mainstream | Yorkshire 26, East Midlands 7 | the largest; it crosses the line by one school (17 of 33) |
| Nexus Multi Academy Trust | MAT | 23: 21 special, 1 AP, 1 mainstream | Yorkshire 18, East Midlands 5 | a large, almost all-special trust |
| The Eden Academy | MAT | 9 special | London 5, North West 3, North East 1 | a special trust spread across regions |
| WAVE Multi Academy Trust | MAT | 11: 10 AP, 1 special | South West | the largest AP trust |
| The Birmingham Federation of Maintained Nursery Schools | Federation | 9 nursery | West Midlands | the largest nursery federation |

Kent Special Educational Needs Trust (KSENT; a foundation trust of 11 Kent special schools) is a sixth example, and a case of a non-academy group.

**Two things the majority rule does today:**
- **It's sharp at the line.** 23 listed groups have exactly half of their schools non-mainstream, so they stay mainstream. Examples are Central Learning Partnership Trust (8 of 16) and Eastern Education Group Trust (5 of 10). Wellspring is out on 17 of 33.
- **20 non-mainstream groups have mainstream schools, 63 in all, and those schools still count in the group's own figures.** Only the special, AP, PRU and nursery schools are "not counted". So Wellspring's own figures today are its 16 mainstream schools' figures, held out of every comparison. The other side follows from the code (`counted` is by kind): **a group made only of special, AP or nursery schools has no figures at all today.** Its pages list its schools, each tagged "not in group figures".

## 2. The candidate measures

These are for state special schools (community, foundation, academy and free-school special: 1,070 open in England), AP (PRUs and AP academies and free schools: 330) and LA nursery schools (373).

**Special post-16 institutions are left out.** GIAS has 166 of them, and `school_kind` counts them as special. They have no census or FSM rows, and none is in a non-mainstream group.

| Measure | In production? | Published by | School level? | Years | Coverage (England / the 140 groups' schools) | Small numbers | Fair between groups? | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Roll and change** | yes (`dfe_school_census`, by age) | DfE, Schools, pupils and their characteristics | yes | 2019/20–2025/26 | special 1,051 of 1,070; AP 294 of 330; nursery 373 of 373 / 566 of 587 | none: a count | yes, read as size and growth. Special and AP rolls follow places the LA commissions, so "growth" means commissioning, not choice. Use same-schools change. | **Usable** |
| **FSM %** | yes (`dfe_school_fsm`) | DfE, same release | yes | 2019/20–2025/26 | special 1,054 of 1,070 (mean 50–61% by type); PRU 143 of 144 (54%); AP academies and free schools 183 of 186 (47–68%); nursery 373 of 373 (10.1%) | DfE's own suppression; no zeros-as-figures (fixed 14 Oct) | yes within special and AP. **Nursery FSM measures something else**: an under-5 is only eligible on a full-day place, so 10% isn't comparable with a school's figure. Nursery should only be compared with nursery. | **Usable** (nursery: with that caveat) |
| **EHCP share** (and SEN support) | **no** | DfE, Special educational needs in England (school-level underlying data: `ehc_plan`, `sen_support`) | yes | annual, January census | state special, PRU, AP, nursery and non-maintained special; independent schools via a separate return | small counts may be suppressed: check at ingest | in special schools it's close to 100% for everyone, so it hardly separates them. It does separate AP trusts and mixed groups. | **Doesn't exist yet**; useful mainly for AP and mixed groups |
| **Primary need** (ASD, SEMH, SLD, PMLD, MLD…) | **no** | DfE, same release (`sen_primary_need`, school level) | yes | annual | state schools including special and PRU; **not** independent schools | small counts may be suppressed: check at ingest | **the key context measure.** An SEMH trust and a PMLD trust differ more than any two mainstream MATs. It is what would make any outcome comparison fair: compare like-need with like-need, or reweight by need mix. | **Doesn't exist yet**; the most valuable new ingest |
| **Destinations** (KS4 leavers; 16–18 for post-16) | **no** | DfE, Key stage 4 destination measures (institution level) | yes, for institutions with a cohort of 6+ | latest: 2023/24 leavers (published 2025/26) | special schools and AP are in the cohort; how many institutions get published figures needs checking at ingest | **cohorts under 6 fully suppressed**. Special KS4 cohorts have a median of 17, so most pass; many AP cohorts may not. | yes: "sustained education, employment or training" means the same in every kind of school, and it's the outcome special and AP leaders cite | **Doesn't exist yet**; likely usable for special, thinner for AP |
| **Ofsted** | **no** | Ofsted, state-funded schools inspections and outcomes (management information, monthly) | yes | every inspection | every state special school, PRU, AP academy and nursery school | none | as a share of schools by latest outcome, yes. But no single-word grade since Sept 2024, and report cards since Nov 2025, so groups' schools carry judgements from different frameworks. Needs a rule for which judgements are comparable. | **Doesn't exist yet**; usable with a framework rule |
| **KS2 RWM %** | yes (`dfe_ks2_attainment`) | DfE | yes | 2022/23–2024/25 | 652 special schools have a figure in 2024/25, but **630 of them are 0%**. AP and nursery: none. | DfE's own | **no.** Most special-school pupils work below the test standard, so 0% is the expected result, not a measure. | **Doesn't usefully exist** |
| **KS4 Attainment 8** | yes (academic headline) | DfE | special: yes; **AP: no**, LA-level only | 2021/22–2025/26 | special 375 of 1,070 (826 have 15-year-olds); AP 0 / 136 of the groups' special schools. **64 of the 140 groups have at least one school with it; 7 have five or more.** | DfE's own; median cohort 17 | barely. It ranges 0.1–34.9 (median 4.0) and is driven by need type. It's only fair within a need type, which needs primary need first. | **Thin**: per school, not as a group figure |
| **Progress 8** | yes | DfE | special: yes | **ends 2023/24** (no KS2 baseline for 2024/25 and 2025/26) | special 331 in 2023/24; none after | | no current year | **Doesn't exist now** |
| **KS5** | yes | DfE | | | no special or AP school has an A-level figure | | – | **Doesn't exist** |
| Area deprivation | yes (`school_area_deprivation`) | ONS IMD round the school's postcode | yes | | all | | weak: special and AP pupils travel far, so the school's area isn't their area | Not recommended |

DfE also publishes school-level absence and suspensions for special schools and PRUs. Neither is in production or in this brief, but both are candidates for a later round.

**Pupil minimums.** The existing ones still apply: a school counts in a phase from 10 pupils (`PHASE_MIN_PUPILS`), and DfE's own suppression applies. For destinations, DfE's cohort-of-6 rule does the job. For a group's own figure there's no school minimum (a 2-school group has figures today). R-MIN-SCHOOLS (5 schools) is a rule for pools and benchmarks.

## 3. Pools production could build

These are open schools in England, with the definitions above. R-MIN-SCHOOLS means a pool needs at least 5 schools with the figure.

| Pool | Schools | By region | By LA | With KS4 A8 (2025/26) |
|---|---|---|---|---|
| England, special | 1,070 (roll: 1,051) | 63–169 per region: **all 9 pass** | 150 LAs; **98 pass** (901 schools) | 375; by region 24–70, **all pass**; by LA **only 19 pass** |
| England, AP and PRU | 330 (roll: 294) | 18–53: **all pass** | 142 LAs; **17 pass** (median 2) | none (not published per school) |
| England, nursery | 373 | 18–74: **all pass** | 100 LAs; **23 pass** (median 3) | – |
| Non-maintained special (separate) | 52 | – | – | 21 |
| Independent special (separate) | 973 | – | – | 291; no FSM, no primary need |

**Peer sets of non-mainstream groups,** like the mainstream size bands:
- **Special and AP trusts, 105:** 2–5 schools (66), 6–10 (28), 11+ (11). All three bands pass 5.
- **Nursery federations, 34:** one set.
- AP-majority trusts (8 AP-only plus a few AP-led mixes) are too few for a set of their own.

**What to use.** England and region pools are usable for every kind. LA pools only work for special schools, and even then not for results.

## 4. Mainstream groups' own special and AP schools

These are listed mainstream bodies (each once; 1,681 in all). Each of these schools shows on its group's page today as "special · not in group figures".

- **164 groups have at least one: 308 schools** (231 special, 60 AP/PRU, 17 nursery). There are 135 MATs, 19 federations, 9 foundation trusts and 1 independent company.
- **Most have one school:** 104 groups have 1, 25 have 2, 14 have 3, 10 have 4, and 11 have 5 or more.
- **Largest:** The Shaw Education Trust (13 of 31 schools), Central Learning Partnership Trust (8 of 16), Community Inclusive Trust (8 of 19), Reach South (7 of 20) and Ormiston (6 of 44).
- **Five or more of one kind:** 7 groups have five or more special schools. None has five AP schools.
- **Coverage** is the same as above: 220 of the 231 special schools have a roll, 135 a KS2 figure (almost all 0%) and 94 an A8.

**A fair comparison for them:**
- **Per school, against the matching pool.** Each special school's roll change and FSM (later EHCP, primary need, destinations and Ofsted) sits against special schools in its region and England, in the Schools table where the "not in group figures" tag is now. This works for all 308 schools and needs no group minimum.
- **A pooled "your special schools" line** only where a group has 5 or more of that kind (7 groups). Below that, it identifies the schools and swings too much.
- They stay out of the group's own mainstream figures, as LF1 decided.

## 5. Proposed milestone

### The smallest useful first version

**Measures:** roll, same-schools roll change and FSM. Production already holds all three, they cover nearly every school, and they're fair (nursery FSM compared only with nursery). Each group also gets a count of its schools by kind and region.

**Pools:**
- England special, England AP/PRU and England nursery;
- region special, region AP/PRU and region nursery (LA special as an option);
- peer sets: special/AP trusts in 3 size bands, and nursery federations as one set.

**Pages:**
- **Library:** a separate "Special, AP and nursery groups" section or filter. Its cards show schools by kind, roll and change, and FSM against the kind's England figure. The (i) states the majority rule.
- **The group's dashboard,** for a non-mainstream group: its own figures over its special/AP/nursery schools, against its peer set and the pools. No results tiles, with "Results aren't compared for special and AP schools" and a reason.
- **Group set picker:** non-mainstream groups can be picked, but only into a set with other non-mainstream groups.
- **Mainstream groups' Schools table:** the special/AP school's FSM and roll change against its region's pool, in place of the bare tag.

**Second version** (each needs Guy's yes):
- ingest SEN in England (EHCP share, SEN support, primary need);
- then destinations (KS4, 16–18);
- then Ofsted, with a framework rule;
- KS4 A8 only per school, within need type, once primary need is in.

### What production would need (`~/dev/vicdata`)

- **The group's kind** (`special_ap` / `nursery` / `mixed`) stored on the group, and in the build meta next to `non_mainstream_groups`.
- **A counting rule that flips for these groups.** Their special, AP and nursery schools count in their figures, which today have none. Their mainstream schools need a decision (decision 2).
- **New pools in `set_rows`** (`england:special`, `england:ap`, `england:nursery`, `region:{kind}:{code}`, optionally `la:special:{code}`), and **new peer sets** (`peer:special_ap:{band}`, `peer:nursery`), with R-MIN-SCHOOLS on each.
- **FSM in the group aggregates.** It isn't an input today: `fetch_inputs` reads census, KS2, KS4 and KS5 only. It would come in as a pupil-weighted share (eligible over headcount).
- **Index rows for non-mainstream groups,** flagged, with their own peer set. Today `group_index` drops them.
- For the second version: new ingests for SEN in England, KS4 and 16–18 destinations, and Ofsted MI (Ofsted's is a judgement series, the roadmap's "different shape").

### What the app would need (this repo)

- **Library** (`src/lib/groups/library.ts`, `library-page.ts`, `GroupLibraryPage.tsx`): the new section or filter, and its cards.
- **Group dashboard** (`src/lib/groups/dash.ts`, `src/components/groups/dash/`): a non-mainstream measure set (roll, change, FSM), the new comparison kinds, a "no results compared" state and the (i).
- **Group sets** (`group-sets.ts`, `GroupSetEditor.tsx`): non-mainstream groups only alongside non-mainstream groups.
- **Schools table:** placing within the pool for not-counted schools in mainstream groups.
- **Catalogue methods** (`src/catalogue/methods-groups.ts`): the majority rule, the kinds, the pools and the nursery FSM caveat.
- New fixtures in `docs/v0.8/groups_fixtures`: one special trust (e.g. Nexus), one nursery federation (Birmingham) and one mainstream group with special schools (Shaw).

### Risks

- **The line is sharp.** Wellspring is out on 17 of 33 schools, while 23 groups at exactly half stay in. A trust that opens one school can change family.
- **Groups straddling the line have mainstream schools with nowhere to go** (20 groups, 63 schools) unless decision 2 gives them one.
- **Without primary need, special trusts get compared on roll and FSM only.** That is honest but thin, and FSM differs by need type too.
- **Nursery FSM is easily misread** next to school FSM.
- **Small groups:** 57 of the 140 have two schools. A group figure is then close to one school's figure. This is allowed (as for mainstream federations) but worth an (i).
- **Ofsted's frameworks are mixed** across 2024–2026. A shared tally could mislead without a rule.
- **Independent special schools are outside VicData's groups,** so the special trust pools are state-only. A group page should say "state-funded special schools".

### Decisions for Guy

1. **The line:** keep "more than half" (Wellspring out on 17 of 33; 23 groups at exactly half stay mainstream), or move it, e.g. to half or more?
2. **Mainstream schools inside a non-mainstream group** (20 groups, 63 schools): (a) count them in a separate mainstream line against mainstream pools; (b) list them, not counted; or (c) leave them as they are, counted in the group's own figures and compared with nothing.
3. **One family or two:** special/AP trusts and nursery federations as two families with separate pools and peer sets (recommended), or one non-mainstream family?
4. **Peer sets:** special/AP trusts in 2–5, 6–10 and 11+ bands, and nursery federations as one set?
5. **First-version measures:** roll, same-schools change and FSM only, with nursery FSM compared only with nursery?
6. **Pools:** England and region for each kind, plus LA for special schools only (98 LAs pass), or no LA pools?
7. **Results:** none in the first version (KS2 is 0% at 630 of 652 special schools; no AP KS4 per school; P8 ends 2023/24); later KS4 A8 per school within need type?
8. **New ingests, in order:** SEN in England (EHCP share and primary need) first, then destinations, then Ofsted. Which, and when?
9. **Ofsted, if it comes in:** which judgements count as comparable across the pre-2024 grade, the 2024–25 no-grade inspections and the report cards?
10. **Library:** a separate section, a filter on the existing library, or both? And can a non-mainstream group be picked into a group set only with other non-mainstream groups?
11. **Mainstream groups' own special/AP schools** (164 groups, 308 schools): school-by-school placing against the region's pool in the Schools table, plus a pooled line only where the group has 5 or more of a kind (7 groups)? In this milestone or the next?
12. **Out of scope, to confirm:** independent special schools (973, almost none in VicData groups), special post-16 institutions (166, no census or FSM) and non-maintained special schools (52).

---

Sources:
- [Special educational needs in England: data guidance (DfE, EES)](https://explore-education-statistics.service.gov.uk/find-statistics/special-educational-needs-in-england/2024-25/data-guidance) and [methodology](https://explore-education-statistics.service.gov.uk/methodology/special-educational-needs-in-england)
- [Key stage 4 destination measures methodology (DfE, EES)](https://explore-education-statistics.service.gov.uk/methodology/key-stage-4-destination-measures-methodology)
- [KS4 local authority alternative provision data (DfE, EES)](https://explore-education-statistics.service.gov.uk/data-catalogue/data-set/5dd3a2f8-017c-4b9c-bc38-23c864770dd6) and [Key stage 4 performance 2024/25](https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2024-25/explore)
- [FFT Education Datalab: Progress 5, a measure for AP and special schools](https://ffteducationdatalab.org.uk/wp-content/uploads/2024/03/parta.docx)
- [Ofsted: inspection information for state-funded schools from September 2026](https://www.gov.uk/government/publications/school-inspection-toolkit-operating-guide-and-information/inspection-information-for-state-funded-schools-for-use-from-september-2026) and [state-funded schools inspections and outcomes as at 31 August 2026](https://www.gov.uk/government/statistics/state-funded-schools-inspections-and-outcomes-as-at-31-august-2026)
