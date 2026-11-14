# 0.8 Non-mainstream groups: report (the app half, milestones 5–9, v1, 14 Nov 2026)

**The production half (M1–M4) is done and live**: aggregates build 7, every mainstream figure identical, with one migration applied and `feat/non-mainstream-groups` merged and pushed in `~/dev/vicdata`. It has its own report, [`non_mainstream_groups_production_report_v1.md`](non_mainstream_groups_production_report_v1.md), which covers production's before and after, the five named examples, the promote, verify and timings, and the later ingests. This report is the app half.

The prompt is [`vicdata_0_8_non_mainstream_groups_claude_code_prompt_v1.md`](vicdata_0_8_non_mainstream_groups_claude_code_prompt_v1.md), with Guy's NM1–NM12 and the scoping report [`non_mainstream_groups_scope_v1.md`](non_mainstream_groups_scope_v1.md). Every call made along the way is logged under **"2026-11-14: Non-mainstream groups, the app half (M5–M9)"** in `docs/OPEN_QUESTIONS.md`, numbered NMQ1–NMQ29; this report cites them by number.

| | |
|---|---|
| Worktree | `/Users/guy/.t3/worktrees/vicdata_public/t3-688218c0` |
| Branch | `v0.8-non-mainstream-groups`, from `main` 00ca9de; local commits, **not pushed, not merged** |
| App database | **no writes, no migration** |
| Production | read only, through its anon lookups (the app's own calls), for three fixture additions (NMQ3) |

## 1. Milestones

| Milestone | What | Commit |
|---|---|---|
| M1–M4 (production) | done, build 7: see the production report | `~/dev/vicdata` `b03bb0f` (merged) |
| **M5** | The library's **Special, AP and nursery groups** section and its filter, cards and (i). The fixtures. The data layer: the new fields and kinds, the non-mainstream branch of the builders, and the route's body as `dashPayload`. R-NM-SETS in Add to set… and the editor | `11e8eac` |
| **M6** | The Group pages for a special and AP trust or nursery federation: roll, change and FSM against its peer set and pools; the mainstream line; "Results aren't compared"; the (i)s | `f7f9e77` |
| **M7** | Group sets hold one family: the side-by-side says when a set's other-family groups are left out (most of M7 went in with M5, NMQ22) | `a325620` |
| **M8** | A mainstream group's own special, AP and nursery schools placed against their region's pool of their kind in the Schools table; the pooled line at 5+ of a kind | `6939e3d` |
| **M9** | Rules R-NM-*, the catalogue, screenshots, this report | the last commit on the branch |

Nothing in M5–M9 was left unbuilt.

## 2. What was built

### M5: the library (NM10)

**The fixtures** (`docs/v0.8/groups_fixtures`, from production's dry run; NMQ1–NMQ3):
- **Harris and Dukes are regenerated.** Against the committed files they gain keys only. Only the build's own metadata moves (its date, commit and focus list), and no Group page prints it.
- **Nexus (16125), the Birmingham Federation of Maintained Nursery Schools (17126) and Shaw (4499)** are added, in the app's shape. The three ids are in `aggregates.ts`'s fixture tags.
- **The named files are merged.** Production's regenerated rows replace the three groups it re-read. The group sets round's other named groups are kept, so its side-by-side sets still work.
- **Three reads from production** (anon, read-only, `group_comparison_lookup`):
  - named special trusts for Nexus, and named nursery federations for Birmingham, for the side-by-side;
  - `pools` for Harris (its one AP school's region) and Dukes (none).
  - Nexus's `group_aggregate_lookup` on production was checked equal to its fixture, row for row.

**The library** (`/teacher/group/groups`):
- **A section switch:** "Mainstream groups · 1,641" and "Special, AP and nursery groups · 140".
- **The new section** reads production's `non_mainstream` list.
  - **Its filter:** Kind (special and AP trusts, nursery federations), Schools (2–5, 6–10, 11+), and Region (most schools in, or has a school in).
  - **Its (i)** gives the majority rule, the two families, the state-funded pools, nursery FSM and "57 of these 140 groups have two schools".
  - **Its cards** show schools by kind ("21 special · 1 AP · 1 mainstream"), the roll with its same-schools 3-year change, and FSM against the kind's England figure ("FSM 53.4% · state-funded special schools, England 50.9%"). They show no result.
  - Its state is in the address (`section=nm&fam=…&band=…`); the mainstream section's address is unchanged.
- **A special, AP or nursery group's head office opens on its own section**, where "like us" is its family (NMQ4).
- **A group's library page** for a non-mainstream card shows:
  - its schools by kind, roll, FSM and peer places ("9th highest FSM of 11 special and AP trusts with 11+ schools");
  - "Results aren't compared for special and AP schools" in place of the headlines;
  - its schools read the other way round: "Mainstream · in the mainstream line", "Special · FSM 54.2%".
- **The footer** now says these groups are in their own section (NMQ8).

### M6: the Group pages of a non-mainstream group (NM2, NM4–NM7)

All of production's rows for these groups are read through the same lookups. The app reads production's per-school `counted` flag the other way round for these groups (production report §8).

- **Overview**
  - **The group now:**
    - Schools: "18 of 19; 1 mainstream school in its mainstream line".
    - Roll, with its same-schools change since last year, and FSM against its peer set.
    - Its areas, its schools by kind, and the change over 1, 3 and 5 years (same schools).
    - Its peer places, and the nursery FSM (i) where it applies.
  - **Against others:**
    - its family's peer set;
    - the same kinds of school in its regions, matched to its mix;
    - the state-funded pools of its kinds: England, then region, then special LAs, its main kind first.
    - Each row shows schools, pupils, roll change over 1 year (same schools) and FSM. R-MIN-SCHOOLS withholds a pool under 5 ("Too few schools (n)").
    - With a set of groups, it shows them side by side with the median.
  - **Mainstream line:** its mainstream schools against the mainstream pools (their LAs and regions, non-group schools matched to their mix, England, non-group, single-academy trusts). It shows roll, change and FSM; results come in a later version (NMQ12).
  - Map, and Joined and left.
  - **Trends:** roll indexed against the chosen set; **FSM over time** (the group, the set, and England's pool of its main kind); and **Results**, which says "Results aren't compared for special and AP schools" (or "for nursery schools", NMQ13) with the reason. Share of places is now of the family's state-funded places.
- **Academic** shows the no-results state beside Against others and the mainstream line, with no trends row.
- **Pupils** is unchanged: none of its views is a result.
- **Schools** has its own table:
  - kind, ages, roll, FSM beside its region pool's, 3-year roll change beside the pool's, the pool, and joined;
  - mainstream schools read "Mainstream · in the mainstream line";
  - no headline, rank or value added, and no Size and results.
- **The set picker's Default block** lists its peer set, the same kinds in its regions, each pool, and "Nearest in size, special and AP trusts".
- **All phases only** (NMQ11).
- **The (i)s** are new methods for the five new views (`methods-groups.ts`): the line, families, peers, state-funded pools, FSM, nursery FSM and the no-results reasons. The small-groups (i) is in the library.

### M7: group sets (R-NM-SETS)

**A set holds one family** (NMQ9): mainstream groups, special and AP trusts, or nursery federations. Every route enforces it:
- **Add to set…** on another family's card shows one line in place of the sets: "Ark is a mainstream group: special and AP trusts are compared only with special and AP trusts."
- **The editor's Add groups** offers only our family and says so. A stored set that holds another family's group opens with it unticked and the reason given, and saving drops it.
- **The picker's route** (`resolveCompare`) leaves another family's groups out of a stored set or an old `peer_named` link, and the side-by-side says how many.
- **Nearest in size** is our family's.

### M8: mainstream groups' own special, AP and nursery schools (NM11)

- **Each such school in the Schools table** reads, for example, "Special, not in group figures · FSM 47.5% (region 49.6%) · roll +16.8% (region +17.3%) over 3 years", in place of the bare tag.
  - The pool is its region's state-funded pool of its kind; the region comes from its LA (NMQ25).
  - R-MIN-SCHOOLS applies to the pool.
- **The pooled line** (production's `kind_lines`, only at 5+ current schools of one kind) is in The group now on Schools, beside England's pool of the kind. Shaw shows "Its 12 special schools, pooled: 1,727 pupils · FSM 49.9%", against England's 50.9%. Harris and Dukes have none.

## 3. Rules

**Added (all active, each with a runner on the fixtures through `src/lib/groups/non-mainstream.test.ts`):**
- **R-NM-LINE**
- **R-NM-COUNTING**
- **R-NM-POOLS**
- **R-NM-FSM-NURSERY**
- **R-NM-NO-RESULTS**
- **R-NM-SETS**
- **R-NM-OWN-SCHOOLS**

**Updated, and why:**
- **R-GROUP-LIBRARY:** non-mainstream groups are no longer "held out until their own comparison". They are the library's second section, so the statement gains the section and its cards, and the test case says no non-mainstream group is a *mainstream* card.
- **R-GROUP-NON-GROUP:** a non-mainstream group is still a listed group, but non-group, the single-academy trusts, its areas and England are offered only for its mainstream line.

No rule was retired. `docs/catalogue/*.md` is regenerated: 230 rules.

## 4. Tests and parity

| Check | Result |
|---|---|
| tsc | clean (the one `LayoutProps` error in `src/app/layout.tsx` is Next's generated type, present before `next build` writes it; the build passes) |
| eslint | 0 errors; 3 warnings, all in files this round doesn't touch (`PeerTrendChart.tsx`, `SchoolMap.tsx`, a PGlite suite) |
| build | passes |
| Group tests (`src/lib/groups/*.test.ts`, fixture switch on) | **86 / 86** (79 before; `non-mainstream.test.ts` adds 7) |
| Every unit test (`src/**/*.test.ts`, one file per process) | **87 files, 687 pass, 0 fail** (the base: 86 files, 680 pass, 0 fail) |
| Catalogue unit tests | **77 / 77** |
| Rule tests (production reads, the group fixtures) | **PASS 188, FAIL 0, ERROR 0** (MANUAL 15, NONE 19, SUPERSEDED 8); the 7 R-NM rules, R-GROUP-LIBRARY and R-GROUP-NON-GROUP among them |
| PGlite, every suite | all pass. `v08_group_sets` 63/63, `v08_groups_r1` 102. `v08_view_as_editing` 44/44 (run with tsx, as its header says). The PostGIS suites (`la_gss_crosswalk_scilly`, `v08_smt_r3_lsoa_boundaries` 21/21, `v08_smt_r4_catchment` 31/31) ran with PGlite 0.5.5 as their headers say |
| **Parity, data** (`jsondiff.py`): every Harris and Dukes dash response the harness serves (304: each dash, reading, phase and comparison, the stored sets and old links), the sets answer and the schools answer, base 00ca9de against the branch | **0 moves.** Additions only: `peerPlaces.roll_same_schools_1` (no view renders `peerPlaces`), the AP school's `placing`, and the new card fields |
| **Parity, words** (`domtext.mjs`): every Harris and Dukes page (each dash response, the editor for each stored set, Manage sets), base against branch, 1440 and 390, the page's text | **624 pages: 620 identical.** The 4 that differ are Harris's Schools table on All phases (both readings, both widths): Harris Aspire Academy (AP, roll 2) reads "AP, not in group figures · FSM 0.0% (region 56.4%)" where it read "AP · not in group figures" (NM11, by design) |
| The library | changes by design (the section switch, the footer) |

**What can reach a mainstream page at all:**
- `SchoolsTable`: its own table only when the group is non-mainstream; the placing text only where production gives a school a pool.
- `SchoolsNow`: the kind line only where production writes one.
- `ShareOfPlaces`: a new heading only for the two families' sectors.
- `views-sets.tsx`: the left-out line only when a set holds another family's group.
- `GroupDashboard.tsx`: the non-mainstream layout only when `o.nm` is set.
- The dash route now calls `dashPayload`, the same steps moved into one function, which the parity harness also calls.

School pages, school sets and every Teacher, SMT, Admissions and Data View page are untouched.

**The harness** is kept in `docs/v0.8/audit_scripts/non_mainstream_preview/` (as `.txt`, with a README). It renders the dashboards and the library from the server-side builders over the fixtures, with the built CSS, in Playwright's headless Chromium 131 (the installed Chrome crashes).

## 5. Screenshots

`docs/v0.8/non_mainstream_groups_screenshots/`: 13 screens, each at **1440 and 390, in Dark, Light and Mid** (78 PNGs). The Group pages and the library follow Mid; the set editor draws Dark under Mid, as every sets page does. Every figure is from the fixtures (production's build 7). The map tiles read "API key required" in the harness, as in earlier rounds.

| File | What it shows |
|---|---|
| `01-library-special-ap-nursery-section-harris-*` | The library's new section, from Harris: the switch, the (i) opened (the majority rule, families, pools, nursery FSM, "57 of these 140 groups have two schools"), the filter, the cards |
| `02-library-group-page-nexus-*` | Nexus's library page: schools by kind, roll, FSM against England's special schools, its two peer places, "Results aren't compared", its schools read the other way round |
| `03-overview-nexus-*` | Nexus's Overview: the group now (18 of 19, 2,808 pupils, FSM 53.4%), Against others (its 11+ peer set, its kinds in its regions, its pools), roll indexed, FSM over time, Results not compared |
| `04-mainstream-line-nexus-*` | Its mainstream line: Crags Community School against mainstream pools |
| `05-academic-no-results-nexus-*` | Academic: the reasons, beside Against others |
| `06-schools-nexus-*` | Schools: each special and AP school's FSM and roll change beside its region's pool; Crags as the line |
| `07-side-by-side-refused-nexus-*` | An old set of Wellspring, Esteem and Ark: Ark left out, "1 group in this set is left out…"; the median of 2 groups |
| `08-overview-nursery-birmingham-*` | The Birmingham nursery federation: all nursery figures (peer set 13.2%, England's nursery schools 10.1%), the nursery FSM (i), "Results aren't compared for nursery schools" |
| `09-schools-nursery-birmingham-*` | Its 9 nursery schools, each against West Midlands nursery schools |
| `10-add-to-set-refused-nexus-library-*` | Nexus's head office in the mainstream section: Add to set… on a MAT reads "… is a mainstream group: special and AP trusts are compared only with special and AP trusts." |
| `11-editor-refuses-ark-nexus-*` | The editor on that old set: Ark unticked with the line, Add groups offering special and AP trusts only |
| `12-schools-placing-shaw-*` | Shaw's Schools table in full screen: each special school "Special, not in group figures · FSM … (region …) · roll … (region …) over 3 years" |
| `13-schools-pooled-line-shaw-*` | Shaw's The group now on Schools: "Its 12 special schools, pooled" beside England's special schools |

## 6. Later (not built; production's §9, in Guy's order)

1. **SEN in England** (a separate production round): EHCP share, SEN support and primary need, per school.
2. **Destinations:** KS4, then 16–18.
3. **Ofsted:** state-funded inspections and outcomes (MI). **Open for Guy (NM9):** which judgements count as comparable across the pre-2024 grades, the 2024–25 no-grade inspections and the report cards since Nov 2025. This is decided when that ingest is scoped.
4. Then **KS4 Attainment 8 per school within need type**, once primary need is in (NM7). Also the mainstream line's results (NMQ12).

## 7. Nothing blocking the merge

- No migration, and no database write.
- The live site reads production's build 7, which already returns everything the branch reads.
- Merging changes the library (the new section) and the Group pages of non-mainstream groups. It also changes mainstream groups' Schools tables wherever they have a special, AP or nursery school (NM11; 161 groups).
- `~/dev/vicdata_public`, `~/dev/vicdata` and `~/dev/vicdata_non_mainstream` were not touched.
- The scratch base worktree (`git worktree add --detach … 00ca9de`) is in the session scratchpad. `git worktree prune` removes it once the scratchpad goes.

## Guy's commands

These follow the template in `docs/FEEDBACK.md`. The branch is `v0.8-non-mainstream-groups`, local, in the worktree `/Users/guy/.t3/worktrees/vicdata_public/t3-688218c0` (it shares the repository with `~/dev/vicdata_public`). The live site is **`https://vicdata.co.uk`**.

**1. Migrations** — none this round (no app migration; production's was applied with build 7, see the production report).

**2. Merge and push** (the push starts the Render deploy). Run it from `~/dev/vicdata_public` on a clean `main`:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-non-mainstream-groups -m "0.8 Non-mainstream groups (app, M5-M9): the library's Special, AP and nursery section; their Group pages (roll, change and FSM against their own peer sets and state-funded pools; the mainstream line; no results compared); group sets of one family; mainstream groups' special, AP and nursery schools placed against their region's pool" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand from the Render dashboard.

**4. Wait until /api/version shows the merge:**

```
until curl -s https://vicdata.co.uk/api/version | grep -q "$(git -C ~/dev/vicdata_public rev-parse --short HEAD)"; do sleep 20; done; echo deployed
```

**5. Republish** — none this round (no dashboard configs changed).

**6. Set fixed** — none this round (no feedback items).

**7. Live check**, signed in as a platform admin, by peek. A group with no group account is named `group:{its production id}`, and every peek is read-only.

1. **The library's new section:** `https://vicdata.co.uk/teacher/group/groups?lookAs=group:3320&as=head_office&peek=1&section=nm`. It should show 140 groups, with the (i) opened ("57 of these 140 groups have two schools"). Kind → Nursery federations gives 34. Each card shows FSM against its kind's England figure and no result.
2. **Nexus's dashboard:** `https://vicdata.co.uk/teacher/group/overview?lookAs=group:16125&as=head_office&peek=1`.
   - The group now: 18 of 19 schools, 2,808 pupils, FSM 53.4%.
   - Against others: Special and AP trusts with 11+ schools (55.8%), State-funded special schools, England (50.9%).
   - Mainstream line: Crags Community School.
   - Results: "Results aren't compared for special and AP schools". Academic says the same.
3. **A nursery federation:** `https://vicdata.co.uk/teacher/group/overview?lookAs=group:17126&as=head_office&peek=1`. Every figure is a nursery figure (All nursery federations 13.2%, England's nursery schools 10.1%), with the nursery FSM (i) and "Results aren't compared for nursery schools".
4. **A group set refusing a mainstream group:** `https://vicdata.co.uk/teacher/group/groups?lookAs=group:16125&as=head_office&peek=1&section=mainstream`. Open Add to set… on any card: it reads "… is a mainstream group: special and AP trusts are compared only with special and AP trusts." A peek is read-only, so Add to set… is disabled there. To see the refusal itself, make a group account for Nexus (Platform → Group accounts) with yourself as head-office admin, sign in as it, and use Add to set… or the editor's Add groups.
5. **Shaw's Schools table:** `https://vicdata.co.uk/teacher/group/schools?lookAs=group:4499&as=head_office&peek=1`. Each of its 12 special schools and its AP school reads "Special, not in group figures · FSM … (region …) · roll … (region …) over 3 years". The group now shows "Its 12 special schools, pooled", beside England's special schools.
