# VicData 0.8: Group sets — brief (v1, for Guy to amend)

Branch `feat/group-sets-academic`, worktree `~/dev/vicdata_public_group`. Test group: **Harris Federation** (production `3320`, MAT, 59 current schools, peer band "MATs 41+" with 16 trusts). Second fixture: Dukes (`club_iss:dukes-education`, independent company).

SMT-style Academic for groups is **parked**. That investigation is in `group_sets_academic_investigation_v1.md`, kept for later.

---

## 1. What this round does

A head office can:

1. **browse every other group** in a library and find the ones worth comparing with ("groups like us");
2. **collect groups into comparison sets**, like playlists, and choose one in the same set picker schools use, shown side by side;
3. **make subsets of its own schools** that filter its pages.

**Not in this round:**
- SMT-style Academic;
- sums for a subset;
- "same region" sets;
- anything for a school's SMT (it keeps only its own group as a comparison set, as decided 13 Oct).

## 2. What's real today (checked 8 Nov; re-verify before building)

- **Group pages** (`/teacher/group/{overview,schools,academic,pupils}`, `GroupDashboard.tsx`):
  - "Compared against" is a `PillMenu` (`GroupDashboard.tsx:214-248`) over `?compare=`. It offers `peer_band | non_group | areas | england | mix_matched | peer_named:a,b,c` (`src/lib/groups/dash.ts:92-110`), with up to 3 named groups and "+ name" chips in Against others (`views.tsx:168-181`). The choice is held only in the URL.
  - No Group page uses `SetSelector`, the sets tables or `/sets`.
  - The Schools tab draws the pill but ignores it (`api/group/dash/route.ts:43`).
  - Academic and Pupils sort named-group candidates from the smallest group up (`route.ts:47`), which is a bug.
- **Figures are production's**, through `group_aggregate_lookup`, `group_comparison_lookup` (which includes `peer_named:<id>`, each group's own figures) and `group_schools_year_lookup` (`src/lib/groups/aggregates.ts`). The app selects and words them; it does not compute them.
- **Production's comparison sets:**
  - set ids: `england:*` (3), `non_group:state|independent` (2), `peer:*` (15 bands), `la:*` (454), `region:*` (27);
  - **no single-academy trust pool**;
  - `non_group:state` = state mainstream schools in no `mat` or `federation` (`ingest/group_aggregates.py:750,794`), so it **includes single-academy trusts, and foundation-trust schools too**;
  - peer bands exist for `mat`, `federation` and `independent_company`/`independent_charity` only, with **none for foundation trusts**.
- **Groups in production** (current members, 2+ schools): MAT 1,116 (357 with 11+, biggest 98); federation 482 (biggest 9); foundation trust 74 (biggest 30); independent company 42, charity 59, other 35.
  - Sponsor records (788 with 2+) duplicate trusts; Harris is `3319` sponsor and `3320` MAT.
  - Single-academy trusts: 917, each of one school.
- **There is no "list every group" lookup.** `groupIndex()` (`src/lib/groups/production.ts:75-96`) calls `school_groups_lookup` for every school in England in batches. That's fine as a cached background read, too slow to browse on.
- **Sets model** (`20261121090000_v08_sets_r1.sql`, live):
  - `sets` / `set_members` / `set_user_state`; school sets are owned by a `school_account_id`; personal sets by a profile (`school_account_id` may be null); cap of 8 active personal sets; `save_set` RPC.
  - Members are school URNs only.
  - Live: 6 rows, Leighton Park's.
- **Head office:**
  - `group_memberships.role` is `head_office_admin | head_office`, and `is_group_admin()` / `is_group_member()` exist, so **no new flag is needed** for Q6.
  - Live: `group_accounts` and `group_memberships` have **0 rows**. Create Harris's account (Platform → Group accounts) before any live check.
- **Return navigation:**
  - `RETURN_PREFIXES` (`src/lib/sets/return-to.ts:10`) has no `/teacher/group`.
  - `ReturnContext` is school-centred (`urn`, `schoolName`; product `admissions | smt | teacher`).

## 3. Who

- **Head-office members** (both roles): the library, the group's sets, their own My sets (cap 8, shared with any other personal sets they hold).
- **Head-office admins:**
  - also curate the group's sets: create, change, archive, pin, set the group's default;
  - "Share with the group" on a personal set (§6.6).
- **Platform admins:** through View as or peek (`as=head_office`), read-only, as today. No writes from a peek.
- **A member school's SMT** viewing the Group pages under a grant: the Default block plus the group's sets, read-only, with no My sets and no library. (§9 D2)
- Everyone else: nothing (404, as now).

## 4. The groups library

**Route:** `/teacher/group/groups?account=` (the browse page) and `/teacher/group/groups/{groupId}?account=` (a group's page). It sits in the Group nav beside Overview to Pupils, and the set editor's "Add groups" opens it (§5.4).

**Who appears:**
- MAT, federation, foundation trust, independent company / charity / other, each with **2+ current schools**.
- Likely members are included and labelled ("+3 likely").
- Left out:
  - sponsor records (one body under two records shown once, as `school-sets.ts` already does by member list);
  - single-academy trusts as cards (they are one pooled benchmark, §5.2);
  - self-declared groups;
  - our own group (it's always row 1 anyway).

**A card** (like an album):
- **artwork:** a map thumbnail of its schools;
- the name, its **type** and size ("MAT · 41 schools", "+2 likely");
- regions (the top 2 plus "+n");
- phases (primary / secondary / post-16 counts);
- one headline figure for the phase in view, against England;
- "Add to set…".
- A tick on cards already in the set being edited.

**Filters and sort:**
- **Groups like us** (default): same type and size band, then nearest in size.
- Type, size band, region (any school in it, or most schools in it: §9 D5), phases (has secondary / has post-16 / primary only).
- Search by name, including former names where production has them.
- Sort: groups like us, size, name, headline.
- A phone shows the same cards in one column, with the filters in a bottom sheet.

**A group's page** (like an album page):
- the header (artwork, name, type, size, regions, source, "likely" count);
- its schools as the tracklist (name, LA, phase, roll, headline), with a map;
- its rank in its own type band where one exists ("9th of 16 MATs with 41+");
- "Add to set…".
- Read-only, with no link into that group's own dashboards.

**Data:**
- A new production lookup, `group_index_lookup()`: one row per listed group with type, current and likely counts, region and phase counts, the headline per phase (latest year), and the peer band.
- Cached for an hour like the other lookups. The fixtures gain a cut of it.
- The map thumbnails use `group_schools_lookup` per group, fetched lazily as cards scroll in.

## 5. Comparison sets (sets of groups)

### 5.1 The picker

- The one `SetSelector`: label "Compared against", the button holding the set name and "n groups".
- Three blocks: **Default**, **Group sets** (creator "Head office", its own colour), **My sets** ("n of 8").
- Then Edit this set…, New set…, Manage sets. Edit and New are hidden for a peek, View as and a school's SMT.
- It replaces the Compared-against `PillMenu`, the named-groups chips and the Mix-matched toggle on **Overview, Academic and Pupils**. Schools gets the subset selector instead (§6).
- Old `?compare=` links keep working, mapped to the new keys; `peer_named:a,b` opens as an unsaved set of those groups.

### 5.2 The Default block (computed, never stored; starting points)

| Default | What it is | Source |
|---|---|---|
| **Our size band** (the page's default) | "MATs 41+ (16)": the band's pooled figure, as today | `peer:<type>:<band>` |
| **Non-group schools** | state (or independent, by the group's sector) schools in no listed group and no single-academy trust | `non_group:*`, **redefined** (§8) |
| **Single-academy trusts** | the 917 single-academy trusts' schools, pooled | **new** `sat:all` (§8) |
| **Our areas** | all schools in our LAs, weighted to our spread | `areas:la` |
| **England** | | `england:all` |
| **Nearest in size, same type** | 5 groups side by side, plus the median | `peer_named:<5 ids>` (each group's own figures) |

- Pooled defaults (size band, non-group, SATs, areas, England) are one row each.
- "Nearest in size" is a set of groups like any other (§5.3).
- Mix-matched non-group stays available as a row in Against others.

### 5.3 How a set of groups is shown

- **Side by side.**
  - Row 1 is our group, highlighted. Then each group in the set (cap **8**, one setting: `GROUP_SET_CAP`). Then **the set's median**.
  - The median is of the groups' own figures, one vote per group with a figure, labelled "n of m groups".
- Every row shows its **type and size** ("MAT · 41").
- **Mixed types are allowed:**
  - the median is labelled "**mixed types**" when the set mixes them;
  - a measure a type lacks (Progress 8 at an independent group) reads "**not published**", and the row stays.
- **Rankings stay same-type**, from production's peer bands: "4th of 16 MATs with 41+". A foundation trust has no band, so no rank (§9 D4).
- The Weighting switch (pupil-weighted / average school) applies to each row; the median follows it.
- The Reading switch (members at the time / listed now) applies to every row; production has both readings.
- **Trend charts:**
  - our group, the set's median and the set's middle half as a band;
  - one group highlighted on hover or tap; all rows in the full-screen table (§9 D3).
- Where it lands, panel by panel:
  - **Overview, Against others:** the side-by-side table.
  - **Overview / Academic trends:** as above.
  - **Academic, Results now:** our group against the median and England, plus a "set, side by side" view.
  - **Pupils:** roll and change side by side.
  - **The map** is unaffected (it's our schools).

### 5.4 The set editor in group mode

- The same `SetEditor`, laid out like a playlist (header with map artwork, name, description, creator pill, totals, last changed by; Save, Save as…, Share, ···).
- Rows are **groups**: type, size, regions, headline.
- A tick means "in the set".
- "Add groups" opens the library as a sheet, filtered to "groups like us".
- At 8 groups, further ticks are refused with "8 is the most a set holds".
- Opened as `/sets/edit?account=…&kind=group_peers&returnTo=…`. "Back to Harris Federation · Overview", Cancel and Save all leave the same way (R-SETS-WAY-BACK).
- **Manage sets** opens `/sets?account=`, the same library listing the group's sets and My sets.

## 6. Subsets of our own schools (a filter)

1. A second selector on Group pages, labelled **"Showing"**: "All 59 schools" (default), the group's subsets, My subsets.
2. A subset is a set of **our own schools**, made in the same editor (school rows, our members only, likely members offered and labelled).
3. **It filters:**
   - the Schools table;
   - the map;
   - Joined and left;
   - every per-school list (Schools ranked, Value added's schools, Improving and declining, Leaving at 16, Entry cohorts, Projections, Market share).
4. **Group-level figures stay whole-group.** Every filtered page carries one line: "**Showing 18 of 59 schools · group figures are for all 59**". There are no subset sums.
5. A school that has left the group since the subset was made drops out of the filter, and the set view says so ("2 schools have left Harris since this was made").
6. **"Share with the group"** (admins): on a personal set (of groups or of our schools), it makes a group set from it (§9 D6). The same rules apply as for comparison sets.

## 7. Storage (one additive migration; written and PGlite-tested here, applied by Guy)

- **`sets`:**
  - `owner_scope` gains `'group'`, plus `group_account_id uuid references group_accounts on delete cascade`;
  - `creator_kind` gains `'head_office'`;
  - `kind` gains `'group_peers'` (members are groups) and `'group_schools'` (members are our schools);
  - the owner check: a group set has `group_account_id` and no school or owner; a personal set may carry `group_account_id` only if its owner is a member of that group;
  - the one-default index gains `group_account_id`.
- **`set_members`:**
  - `member_group_id text` (production group id) beside `urn` (now nullable), with exactly one set;
  - unique `(set_id, coalesce(urn,''), coalesce(member_group_id,''))` replaces the primary key.
  - A trigger caps a `group_peers` set at 8; the app reads the cap from one setting, and the trigger is the backstop.
- **Functions / RLS:**
  - `can_curate_sets` gains a group branch: `is_group_admin(group_account_id)`;
  - read a group set: `is_group_member(group_account_id)` or platform admin;
  - `check_set_creator` accepts `'head_office'` only for a group admin.
  - A member school's SMT reads group sets through the **server** after `dashViewer` has checked its live grant. Grants depend on production membership, which RLS can't see, the same reason grants are service-role-only now.
- **`save_set`:** `group_account_id` in the insert, `member_group_id` in the members loop.
- **Tests:** R-SETS-RLS group cases:
  - Harris admin, Harris member, another group's admin, a school's SMT, a school's Admissions lead, platform admin, anon;
  - the cap of 8.
- **Applying:** twice-safe and additive; applied with `db query -f` + `migration repair` (never `db push`).

## 8. Production changes (`~/dev/vicdata`, ingest + lookups)

1. **`group_index_lookup()`**: §4's card data, one row per listed group.
2. **Single-academy trusts pooled:** a new comparison set `sat:all`, plus its `la:<code>:sat` and `region:<code>:sat` cells if "our areas" ever splits by it.
3. **Non-group redefined** so nothing is counted twice: `non_group:state` = state mainstream schools in **no MAT, federation or foundation trust and no single-academy trust**, i.e. LA-maintained schools outside a federation or foundation trust.
   - Today `STATE_GROUP_TYPES = {"mat","federation"}`, so it holds SATs and foundation-trust schools.
   - The `non_group_areas` and `mix_matched_non_group` reweightings follow the new definition.
   - The report shows the before and after for Harris and Dukes.
4. Fixtures regenerated (`docs/group_aggregates_fixtures`), including the index and `sat:all`. `verify` and `timing` are re-run.
5. Not needed: pooled figures for custom sets (side by side uses each group's own figures, which `peer_named:` already returns).

## 9. Open decisions

- **D1. Production order.** §8 changes production's definitions, which the Group pages already show. Build the app against fixtures first and promote production after you've seen the before/after? Recommend yes.
- **D2. A member school's SMT on the Group pages:** Default plus the group's sets, read-only (recommended), or Default only?
- **D3. Trend charts with a set:** median + middle-half band + hover a group (recommended), or every group's line (up to 9)?
- **D4. Foundation trusts** have no peer band (74 groups, 2 with 11+). Leave them unranked (recommended), or have production add foundation-trust bands?
- **D5. The region filter in the library:** "has a school in" or "most schools in"? Recommend "most schools in", with "has a school in" as a toggle.
- **D6. "Share with the group":** move the personal set to the group, freeing a slot (recommended, like Propose for schools), or copy it?
- **D7. Library headline per card:** the phase in view's headline (A8 for secondary, A-level APS for post-16, KS2 for primary) against England (recommended), or roll and 3-year change only (avoids phase mismatch across mixed groups)?
- **D8. Peer band as the page default:** keep it (as today), or let admins set the group's own default set (the sets model supports one default per owner and kind)? Recommend both: the band until an admin sets one.

## 10. Milestones

- **M1, production** (`~/dev/vicdata`, own branch): `group_index_lookup`, `sat:all`, non-group redefined; fixtures; report with before/after. Not promoted until D1.
- **M2, storage:** the migration, PGlite tests, apply/verify/rollback scripts under `supabase/ops/`.
- **M3, the library:** browse page, group page, filters, groups like us, Add to set; phone layout.
- **M4, comparison sets:**
  - `SetSelector` on Overview, Academic and Pupils;
  - the Default block;
  - the editor and `/sets` in group mode with the way back (`RETURN_PREFIXES` + `/teacher/group`, `product: "group"`);
  - side-by-side rows, the median, mixed types, not published, same-type ranks;
  - `?compare=` mapping;
  - the named-candidates sort bug fixed.
- **M5, subsets:** the Showing selector and filter, the "18 of 59" line, leavers dropping out, Share with the group.
- **M6:** rules (below), catalogue regenerated, screenshots at 1440 and 390 in both themes (headless harness, Harris fixtures), the report with your commands.

**Rules to add:**
- R-GROUP-LIBRARY (who's listed, groups like us);
- R-GROUP-SET-PICKER (the blocks, Default contents);
- R-GROUP-SET-SIDE-BY-SIDE (rows, median, cap, mixed types, not published, same-type ranks);
- R-GROUP-SUBSET-FILTER (what filters, the whole-group line);
- R-GROUP-SETS-RLS;
- R-GROUP-NON-GROUP (no school counted twice across non-group, SATs and groups).
