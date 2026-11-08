# Group pages: the shared set picker and SMT Academic — investigation and plan (v1)

Branch `feat/group-sets-academic` (worktree `~/dev/vicdata_public_group`, off `main` at `b3b05f5`). Nothing built yet; nothing merged. Test group: **Harris Federation** (production `group_id` `3320`; fixtures `harris_*`).

Checked directly: the code on `main`, the sets migration (`supabase/migrations/20261121090000_v08_sets_r1.sql`), the groups r1 migration, the live app database (Supabase `lnhulykjlxmoneappnsp`), and production's group-aggregates report (`~/dev/vicdata/docs/vicdata_group_aggregates_report_v1.md`).

**Grounding facts that shape everything below**

- Sets round 1 **and** its return navigation (R-SETS-WAY-BACK, the set editor's "Back to …") are on `main`.
- Live: `sets` has 6 rows, Leighton Park's converted school sets. `group_accounts`, `group_memberships` and `group_view_grants` have **0 rows**. No head office uses VicData live yet, so no group data needs migrating.
- The Group pages never touch the sets system.
- Group figures are **precomputed in production** (`group_aggregate_lookup`, `group_comparison_lookup`, `group_schools_year_lookup`), for headline measures only:
  - results: `ks2_rwm`, `ks4_a8`, `ks4_em5`, `ks4_em4`, `ks5_aps_alevel`, `ks5_aps_all`;
  - value added: `ks4_p8`, `ks5_va_alevel`;
  - plus subject areas.
  
  There is **nothing per qualification type** (Applied general, Tech level, IB, EPQ, Core Maths, AS, T level), no entries or mix by qualification, no grade profile and no subject-level VA. SMT Academic is built on exactly those.

---

## 1. Every Group page and component, and what each uses today

| Page | Component | Sets / comparison today | Results / VA / entries today |
|---|---|---|---|
| `/teacher/group` (home) | `GroupHome.tsx` | none | none (summary line from `/api/group/home`); "Our schools" links to `/teacher/smt?headOffice={urn}` (`GroupHome.tsx:236`) |
| `/teacher/group/overview` | `GroupDashboard dash="overview"` → `views.tsx` | "Compared against" `PillMenu` (`GroupDashboard.tsx:214-248`) over `compare=` (URL only, `history.replaceState`); "+ name" chips in Against others (`views.tsx:168-181`); Mix-matched toggle (`views.tsx:182-186`) | Against others table, Results trend: production `weighted` / `average_school` |
| `/teacher/group/schools` | same, `dash="schools"` | the pill is drawn but **the route ignores `compare`** (`api/group/dash/route.ts:43`) | per-school headline, in-group rank, national rank, VA; links to `/teacher/smt?headOffice=` (`dash.ts:534`) |
| `/teacher/group/academic` | same, `dash="academic"` → `views-r3.tsx`, builder `dash-r3.ts:71 buildAcademic` | same pill | GRP-A-NOW, RANKED, AREAS, VA, TREND, POST16, IMPROVING, BANDS (placeholder). All from production lookups; the app only picks values, takes medians and ranks |
| `/teacher/group/pupils` | same, `dash="pupils"` | same pill | n/a (roll, entry, leaving, market share, projections) |
| `/teacher/group/access`, `/join` | `GroupAccess.tsx`, inline | none | none |

Shared kit already in use: the shell (ControlBar, RailPanel, Rows, PillMenu, MethodNote), Admissions' tiles and charts, SMT's `useSmt`, `fmt`/`Td`/`Th`/`Unit`/`arrowOf`/`dirClass`. **Nothing from SMT Academic and no `SetSelector`.**

The only place groups meet the sets model is the other way round. A member school is offered its group as a read-only computed set ("All Harris Federation schools", `src/lib/groups/school-sets.ts`, id `group:{id}`, creator `group`) in its own Teacher/SMT picker.

**Existing defects found on the way** (not fixed):

- Academic and Pupils sort named-group candidates by distance from **0** schools, so the smallest groups come first (`route.ts:47`; Overview passes `n_schools`).
- GRP-A-AREAS computes the set's points per entry but never shows it, although its footnote says "hover a row".
- The Schools tab draws a Compared-against pill with no data behind it.
- `academic.ts:850` (SMT, GCSE VA, column 1): the middle-half summary indexes `vals` (unsorted, nulls dropped) by `boardRows` (sorted, nulls kept), so it removes the wrong row. Its p75 also includes the school. **This changes a number on SMT today.**
- Head office in `?headOffice=` SMT:
  - gets **no saved or group sets**, because `/api/teacher/saved-comparator-sets` has no head-office branch and returns 403 at `route.ts:166`;
  - still sees **Edit this set / New set** (gated only on `member.viewAs`, `SmtDashboard.tsx:345`), which lead to an editor it can't use.

---

## 2. How group sets are stored now, and whether they fit the sets tables

**Today nothing is stored.**
- The comparison is a URL parameter: `peer_band | non_group | areas | england | mix_matched | peer_named:a,b,c`.
- The comparison figures are production's, one series per kind.
- Named groups are up to three production groups, chosen from `namedCandidates` (same type, nearest in size, top 12).

**Fit against the sets tables as they are:**

| Need | Fits today? |
|---|---|
| A head-office person's **personal** set | **Yes.** `owner_scope='personal'`, `school_account_id` null, `creator_kind='me'`. RLS lets the owner read and write; the cap of 8 applies across all their personal sets. |
| A set **curated for the group** (read by all of Harris head office) | **No.** A school set requires `school_account_id` (FK `school_accounts`) and `creator_kind` in admissions/smt/school_admin. There is no group owner, no group curator function, and `check_set_creator` would reject it. |
| A set whose members are **groups** (Harris against Ark and United Learning) | **No.** `set_members.urn` is a school URN (`^\d{5,7}$`). |
| Phase | **Partly.** `phase` is `ks4`/`ks5`. The Group focus also has `primary` and `all`; a whole-group set (phase null) fits any page. |
| `focus_urn` | Not applicable: the focus is a group. |
| `set_user_state` (last used, folder) | **Yes**, as is (per profile, any key). |
| Peek / View as reads | **Yes**: service role after `resolveCaller`, as for schools. |

**Migration outline** (not written):

1. `sets`:
   - `owner_scope` gains `'group'`;
   - new `group_account_id uuid references group_accounts(id) on delete cascade`;
   - `creator_kind` gains `'head_office'`;
   - `focus_group_id text` (production group id, optional).
   
   Rewrite the owner check:
   - a group set has `group_account_id`, with no school and no owner;
   - a school set has no `group_account_id`;
   - a personal set may carry `group_account_id` only if the owner is a member of it.
   
   Extend the one-default unique index to `(group_account_id, kind, phase)`.
2. `set_members`:
   - new `member_group_id text` (production group id);
   - `urn` becomes nullable;
   - check that exactly one of the two is set;
   - the primary key moves to a surrogate key, or to unique `(set_id, coalesce(urn, ''), coalesce(member_group_id, ''))`.
   
   A group member is expanded to its current schools at read time.
3. Functions:
   - `can_curate_group_sets(account)`: `is_group_admin(account)`, or every `is_group_member` (decision D3);
   - `can_read_set` / `can_write_set` and the four `sets_*` policies gain the group branch;
   - read: `is_group_member(group_account_id)` or platform admin;
   - `check_set_creator` accepts `'head_office'` for group sets.
   
   A member school's SMT reading the group page under a grant reads group sets through the **server** (service role, after `dashViewer` has checked the live grant). Grants depend on production membership, which RLS can't see, the same reason grants are service-role-only today.
4. `save_set` already writes whatever columns it is given. It needs `group_account_id` in the insert list and `member_group_id` in the members loop.
5. Additive and twice-safe. Test in PGlite (`supabase/tests/`), including R-SETS-RLS cases for:
   - head office A against group B;
   - head office against a school set;
   - a school member against a group set.
   
   Apply with `db query -f` and `migration repair`, never `db push`.

If D1 below is "personal sets only for now", **no migration is needed** for part 1.

---

## 3. What "adapted for groups" should mean, panel by panel

**The core problem.** SMT's metric definitions (per qualification, entries from one total, XS-XL, subject VA, DfE bands) exist only per school. Production's group figures cannot reproduce them. To match SMT, the group view must be **computed in this app from the member schools' own rows**: `qualRows(urns)`, `population()`, `subjectVa(urns)` and the subject-level grade data, all of which already take a URN list. Membership comes from `group_schools_lookup` with the same reading (members at the time / listed now). Harris has about 50 schools, which is well within what SMT already reads for a set plus England.

**Aggregation rules** (the same definitions as SMT, combined as production does):

- **Points per entry** (A level, Applied, IB, T level, the "All" bucket, subject areas): `Σ points ÷ Σ entries`, i.e. entries-weighted. This is exact: a school's APS × entries = its points.
- **Attainment 8, Grade 5+ E&M**: weighted by KS4 pupils (production's definition).
- **Entries and shares**: sums of the same subject × qualification rows, so the one-entry-total rule (R-SMT-ENTRIES-ONE-TOTAL) holds for the group by construction.
- **Grade profile**: summed grade counts. Exact.
- **VA (P8, A level VA, the qualification-level VA)**: the cohort-weighted mean of the schools' published VA, as production does (P8 by pupils covered, A level VA by A level students).
  - DfE bands don't exist for a group. Either show no band, or a VicData-calculated range from the combined standard error (each school's CI ÷ 3.92), marked † as VicData's (decision D6).
- **Weighting switch** (pupil-weighted vs average school) stays, as on the Group pages today.

| SMT panel | For a group | Notes |
|---|---|---|
| Column 1 "now" (A-NOW): one line per qualification, value, last year, place in set, England place | **Aggregate**: the group's figure per line, its place among the comparison set's schools (or groups), England's figure | "n of m schools" under each line (the members with a figure) |
| The set, ranked (CHART / TABLE / MAP) | **Per school**: the member schools ranked, with the comparison set's middle half and median as the band, England as a line | The "you" row becomes "Highlight a school" (the pill already exists); the map shows members; a toggle could interleave the set's own schools (D5) |
| Subject areas (AREAS) | **Both**: the group's points/share per area and subject against the set and England; open an area to see its member schools | Group subject rows withheld below production's rule: fewer than **2 schools with 10+ entries** (`meta.subject_min`), as on the Group pages now |
| Grade profile (GRADES) | **Aggregate** | summed counts |
| Trend band (TREND-LINE / TABLE) | **Aggregate** line against the set's middle half | as SMT |
| Every line (LINES) | **Per school** | one line per member; highlight one |
| Moves, Set moves | **Aggregate** (the group's subject entries, L against L−2) | per-school moves in the drill-down |
| Mix, Mix table | **Aggregate**, with a per-school stacked option | the "started/stopped" sentence names schools, not "the school" |
| Against | **Aggregate**: the group's share against the set's typical share | |
| XS-XL sizes | **Per school only** | a group total isn't a school's entry; in the aggregate say "3 of 12 schools XL" or omit |
| VA (all) | **Both**: the group's weighted VA in column 1, the member schools with their DfE bands on the board | Progress 8: independents excluded and counted; Harris is all state |

**Suppression and small cohorts**

- We aggregate **published figures only**. A school whose cell is suppressed or absent contributes nothing and is listed with its reason, as production's `excluded` does: IGCSE, not published, joined after, no results, outside England. Because the suppressed value never enters the sum, the group total minus the other schools' published figures **cannot** reveal it. There is no secondary-disclosure path.
- **Every group figure carries its coverage**: "41 of 47 schools · 6,120 pupils". Where coverage is partial, the figure is labelled as covering those schools, not the group.
- **Per-school thresholds keep SMT's values**: results need 5+ entries per subject (`MIN_SUBJECT_ENTRIES`), and no XS-XL badge under 10 sizing schools.
- **Group-level thresholds**:
  - a subject or area is shown only with **≥2 schools with 10+ entries** (production's rule), so a group figure is never one school's figure under another name;
  - a qualification line needs ≥2 contributing schools; with exactly 1 it says "only {school} offers this" and links to that school.
- **IGCSE**: the school is out at GCSE headline (R-IGCSE-SUBJECT for areas), as now.
- **Members at the time vs listed now**: applied per year to who is in the sum, as the Group pages do.

**Parity risk.** For headline measures, the group's in-app A8 or A-level APS must equal production's `weighted` figure to the rounding. If they differ, the Group Overview and Group Academic show two numbers for one thing. The plan includes a parity check on Harris and Dukes for every headline measure and year, with any difference explained before shipping (D2).

---

## 4. `headOffice=` SMT and the Group pages

They answer different questions:
- `?headOffice={urn}` is **one member school's own SMT**, read-only, with that school's sets.
- The Group pages are **the group as a whole**.

Neither should replace the other. They should **share components**:

- **Group Academic** becomes SMT Academic's views fed a group-shaped `Academic`. The per-school rows on its board, Every line and the drill-downs link to `/teacher/smt/academic?headOffice={urn}` with the same mode, level and qualification. Today both links land on SMT Overview.
- **Fix in passing** (small, same area):
  - head office in `headOffice=` SMT gets its school's sets: a read-only head-office branch in `saved-comparator-sets`;
  - head office does not see Edit/New set there.
- The member school's SMT keeps the computed "All Harris Federation schools" set as now.

---

## 5. Shared components that change, and the risk to SMT and school views

| Shared piece | Change | Risk to SMT / school views | Guard |
|---|---|---|---|
| `src/lib/smt/academic.ts` | **Not forked.** Extract the per-line metric functions (`fig`, `computedPoints`, share, VA pick, `placeIn`) into a module both builders call. Add `buildGroupAcademic(group, members, state, set)` returning the same `Academic` type with an optional `focus: {kind:'group', name, members}` and `you:false` rows | **Medium**: refactoring the definitions SMT just shipped | Every R-SMT-* rule runner unchanged and green; a before/after JSON diff of `buildAcademic` for 110110 and two others in both modes and all levels (must be byte-identical) |
| `src/components/smt/views/Academic.tsx` | Wording from a focus label ("Your school" → "Harris Federation"; "the school's entries" → "the group's entries") through `SMT_NOTES` variables, not hard-coded; a `highlight` urn in place of `you` | **Low-medium**: wording, `data-ac-row="you"` and `featuredRow` | `smtRender` runners; the R-SMT-NOTES catalogue check; light/dark screenshots of SMT Academic before/after |
| `SmtDashboard.tsx` | **No change** to SMT. Group Academic gets its own frame in `GroupDashboard` (rail, header, captions) calling the same view components | **Low** | — |
| `SetSelector.tsx` | **None.** It is product-agnostic; it needs a `group` menu builder (`groupMenu.ts`) like `teacherMenu.ts` | **None** | — |
| `src/lib/sets/model.ts` | `OwnerScope` + `'group'`, `creator 'head_office'`, `setFitsPage` for group phases | **Low**: type-level; the school paths unchanged | `sets.test.ts`, `library.test.ts` |
| `return-to.ts` / `editor-return.ts` | `/teacher/group` in `RETURN_PREFIXES`; `ReturnContext` gets `product:'group'` and an account instead of a URN ("Back to Harris Federation · Academic") | **Low** | `return-to.test.ts` + new group cases (and the open-redirect cases stay) |
| `/sets/edit`, `/sets`, `/sets/[id]` | A group mode: the account from `?account=`; candidate schools anywhere (+ named groups when D4 = yes); "How close" measured from the group's members (nearest member), not one school | **Medium**: the editor is school-membership-centred (`edit/page.tsx:56`) | Editor and library tests; the school editor's screenshots unchanged |
| `src/lib/groups/dash-r3.ts`, `views-r3.tsx` | The academic builder and views retire (Overview, Schools and Pupils keep theirs) | **None** to SMT | Group rule runners updated |

---

## 6. Proposed plan (after your go-ahead)

- **M1, storage** (only if D1 includes group-curated sets): the migration above, written and PGlite-tested. Its R-SETS-RLS group cases are not applied; you apply it with the commands in the report.
- **M2, the picker on Group pages**: `SetSelector` replaces the Compared-against `PillMenu` on Overview, Academic and Pupils (Schools gets none, since it never used one).
  - Default block: production's benchmarks (peer band, non-group, areas, England, mix-matched). Group sets block. My sets.
  - Edit / New / Manage open `/sets/edit` and `/sets` in group mode, with the way back.
  - `?compare=` links keep working, mapped to the new keys.
  - On Overview and Pupils, a stored set (schools or groups) needs its own comparison figures (D7).
- **M3, the shared metrics**: extract from `academic.ts`; the SMT byte-identical diff; fix `academic.ts:850` as a separate commit, with your OK (D9).
- **M4, Group Academic** = SMT Academic's views on `buildGroupAcademic`:
  - Results / Entries / Value added modes, level and qualification chips, per the table in §3;
  - coverage lines and suppression;
  - links to `headOffice=` SMT Academic;
  - Harris and Dukes parity against production's headlines.
- **M5**: `headOffice=` SMT set fixes (§4), rules and the catalogue regenerated, screenshots at 1440 and 390 in both themes (headless harness, Harris fixtures), the report with your commands.

---

## 7. Decisions

See the block in the chat reply (D1-D9).
