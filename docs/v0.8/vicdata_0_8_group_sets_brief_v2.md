# VicData 0.8: Group sets — brief (v2)

v2 folds in Guy's answers to v1's §9 (D1–D8, 8 Nov). The decisions are recorded in §9; the body says what they mean.

Branch `feat/group-sets-academic`, worktree `~/dev/vicdata_public_group`. Production work is in `~/dev/vicdata` on its own branch and worktree.

- **Test group:** Harris Federation (production `3320`, MAT, 59 current schools, peer band "MATs 41+" with 16 trusts).
- **Second fixture:** Dukes (`club_iss:dukes-education`, independent company).

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
- anything for a school's SMT beyond D2 (on its own pages it keeps only its own group as a comparison set, as decided 13 Oct).

## 2. What's real today (checked 8 Nov; re-verify before building)

- **Group pages** (`/teacher/group/{overview,schools,academic,pupils}`, `GroupDashboard.tsx`):
  - "Compared against" is a `PillMenu` (`GroupDashboard.tsx:214-248`) over `?compare=`. It offers `peer_band | non_group | areas | england | mix_matched | peer_named:a,b,c` (`src/lib/groups/dash.ts:92-110`), with up to 3 named groups and "+ name" chips in Against others (`views.tsx:168-181`). The choice is held only in the URL.
  - No Group page uses `SetSelector`, the sets tables or `/sets`.
  - The Schools tab draws the pill but ignores it (`api/group/dash/route.ts:43`).
  - Academic and Pupils sort named-group candidates from the smallest group up (`route.ts:47`), which is a bug.
- **Figures are production's**, through `group_aggregate_lookup`, `group_comparison_lookup` (which includes `peer_named:<id>`, each group's own figures) and `group_schools_year_lookup` (`src/lib/groups/aggregates.ts`). The app selects and words them.
- **Production's comparison sets** (`group_comparison_set`):
  - set ids: `england:*` (3), `non_group:state|independent` (2), `peer:*` (15 bands), `la:*` (454), `region:*` (27);
  - **no single-academy trust pool**;
  - `non_group:state` = state mainstream schools in no `mat` or `federation` (`ingest/group_aggregates.py:750,794`), so it **includes single-academy trusts and foundation-trust schools**;
  - `non_group:independent` = independents in no `independent_*` group of any size.
- **Peer bands** exist for `mat`, `federation`, `independent_company`, `independent_charity` (`PEER_TYPES`, `group_aggregates.py:48`).
  - **Gaps (D4 check):**
    - `foundation_trust` has no band: 74 groups with 2+ schools;
    - `independent_other` has no band: 35 groups, all 2–5 schools;
    - two bands hold **one group only**, ranking it "1st of 1": independent charities 6–10 and 21–40.
- **Groups in production** (current members, 2+ schools): MAT 1,116 (357 with 11+, biggest 98); federation 482 (biggest 9); foundation trust 74 (biggest 30); independent company 42, charity 59, other 35.
  - Sponsor records (788 with 2+) duplicate trusts; Harris is `3319` sponsor and `3320` MAT.
  - Single-academy trusts: 917.
- **There is no "list every group" lookup.** `groupIndex()` (`src/lib/groups/production.ts:75-96`) calls `school_groups_lookup` for every school in England in batches.
- **Sets model** (`20261121090000_v08_sets_r1.sql`, live):
  - school sets owned by a `school_account_id`; personal sets by a profile; cap of 8 active personal sets; `save_set` RPC;
  - members are school URNs only;
  - live: 6 rows, Leighton Park's.
- **Head office:**
  - `group_memberships.role` is `head_office_admin | head_office`, and `is_group_admin()` / `is_group_member()` exist (groups r1 migration). **No new flag is needed** for admins.
  - Live: `group_accounts` and `group_memberships` have **0 rows**. No group uses the site yet.
- **Return navigation:**
  - `RETURN_PREFIXES` (`src/lib/sets/return-to.ts:10`) has no `/teacher/group`.
  - `ReturnContext` is school-centred.

## 3. Who

- **Head-office members** (both roles): the library, the group's sets (use, and **Duplicate** to My sets), their own My sets (cap 8).
- **Head-office admins:**
  - also curate the group's sets: create, change, archive, pin, **Make default**;
  - **Share with the group** on a personal set (moves it, §6.6).
- **Platform admins:** through View as or peek (`as=head_office`), read-only. No writes from a peek.
- **A member school's SMT** with a current grant, on the Group pages:
  - the Default block plus the group's sets, read-only;
  - **no library, no editing, no My sets of groups** (D2);
  - the group's default (D8) applies to them too.
- Everyone else: nothing (404, as now).

## 4. The groups library

**Route:** `/teacher/group/groups?account=` (browse) and `/teacher/group/groups/{groupId}?account=` (a group's page). It sits in the Group nav beside Overview to Pupils for head office only, and the set editor's "Add groups" opens it (§5.4). Its jobs are **groups like us** and **Add to set…**.

**Who appears:**
- MAT, federation, foundation trust, independent company / charity / other, each with **2+ current schools**.
- Likely members are included and labelled ("+3 likely").
- Left out:
  - sponsor records (one body under two records shown once);
  - single-academy trusts as cards (they are one pooled benchmark, §5.2);
  - self-declared groups;
  - our own group (it's row 1 anyway).

**A card** (like an album):
- **artwork:** a map thumbnail of its schools;
- the name, its **type** and size ("MAT · 41 schools", "+2 likely");
- **regions, main region first:** "London · also South East, East";
- phases (primary / secondary / post-16 counts);
- **roll and 3-year change**;
- **one results headline for the phase in view, against England** (D7):
  - on "All phases", the group's main phase, labelled: "Secondary · A8 46.2, England 45.9";
  - an independent group with no published results reads "**Results not published**";
- "Add to set…", and a tick on cards already in the set being edited.

**Filters and sort:**
- **Groups like us** (default): same type and size band (or all of its type, §5.2), then nearest in size.
- Type, size band, phases (has secondary / has post-16 / primary only).
- **Region** (D5): "**Most schools in**" by default, "**Has a school in**" as a toggle. A group tied between regions counts in both.
- Search by name.
- Sort: groups like us, size, name, headline.
- A phone shows one column, with the filters in a bottom sheet.

**A group's page** (like an album page):
- the header (artwork, name, type, size, regions, source, likely count);
- its schools as the tracklist (name, LA, phase, roll, headline), with a map;
- its same-type rank ("9th of 16 MATs with 41+", "12th of 74 foundation trusts");
- "Add to set…".
- Read-only.

**Data:**
- Production's new `group_index_lookup()` (§8), cached for an hour, with a fixture cut.
- Map thumbnails from `group_schools_lookup` per group, fetched lazily.

## 5. Comparison sets (sets of groups)

### 5.1 The picker

- The one `SetSelector`: label "Compared against", the button holding the set name and "n groups".
- Three blocks: **Default**, **Group sets** (creator "Head office", its own colour), **My sets** ("n of 8").
- Then Edit this set…, New set…, Manage sets. Hidden for a peek, View as and a school's SMT; Duplicate is still offered to head office on a group set.
- It replaces the Compared-against `PillMenu`, the named-groups chips and the Mix-matched toggle on **Overview, Academic and Pupils**. Schools gets the subset selector instead (§6).
- Old `?compare=` links keep working, mapped to the new keys; `peer_named:a,b` opens as an unsaved set of those groups.

### 5.2 The Default block (computed, never stored; starting points)

| Default | What it is | Source |
|---|---|---|
| **Our size band** | "MATs with 41+ schools (16)", pooled. For a type with no bands, or a band holding only us: "**All foundation trusts (74)**" etc. | `peer:<type>:<band>` or `peer:<type>:all` (§8) |
| **Non-group schools** | schools of our sector in **no listed group and no single-academy trust** | `non_group:*`, redefined (§8) |
| **Single-academy trusts** | the single-academy trusts' schools, pooled | new `sat:all` (§8) |
| **Our areas** | all schools in our LAs, weighted to our spread | `areas:la` |
| **England** | | `england:all` |
| **Nearest in size, same type** | 5 groups side by side, plus the median | `peer_named:<5 ids>` |

- Pooled defaults are one row each.
- Mix-matched non-group stays as a row in Against others.
- **The page's default** (D8):
  - our size band (all foundation trusts for them) until an admin uses **Make default** on a group set;
  - that default applies to the whole group, granted schools included;
  - if the set is deleted, the default falls back to the size band;
  - anyone can still switch in the picker.

### 5.3 How a set of groups is shown

- **Tables are side by side:**
  - row 1 is our group, highlighted; then each group in the set (cap **8**, one setting `GROUP_SET_CAP`, so 9 rows with ours); then **the set's median**;
  - the median is of the groups' own figures, one vote per group with a figure, labelled "n of m groups".
- Every row shows its **type and size**.
- **Mixed types are allowed:**
  - the median is labelled "**mixed types**" when the set mixes them;
  - a measure a type lacks reads "**not published**", and the row stays.
- **Rankings stay same-type:** "4th of 16 MATs with 41+", "12th of 74 foundation trusts".
- The Weighting switch applies to each row, and the median follows it. The Reading switch applies to every row.
- **Trend charts** (D3):
  - **Panel:**
    - our group (solid), the set's median and the middle-half band;
    - no hover or pinning;
    - with **fewer than 4 groups** the band is dropped and the (i) says why;
    - the band's (i): "middle half of the N groups in this set".
  - **Large view:**
    - every group's line, thin and muted, ours in full colour on top;
    - a list of the set's groups beside the chart: hover or click brings a line forward, click pins it (tap on a phone);
    - median and band stay, with a toggle to hide them.
- Where it lands:
  - **Overview, Against others:** the side-by-side table.
  - **Overview / Academic trends:** as above.
  - **Academic, Results now:** our group against the median and England, plus the set side by side.
  - **Pupils:** roll and change side by side.
  - The map is unaffected.

### 5.4 The set editor in group mode

- The same `SetEditor`, laid out like a playlist.
- Rows are **groups**: type, size, regions, headline.
- A tick means "in the set".
- "Add groups" opens the library as a sheet, filtered to groups like us.
- At 8, further ticks are refused: "8 is the most a set holds".
- Opened as `/sets/edit?account=…&kind=group_peers&returnTo=…`. "Back to Harris Federation · Overview", Cancel and Save leave the same way (R-SETS-WAY-BACK).
- **Manage sets** opens `/sets?account=`, listing the group's sets and My sets.
- Group sets offer **Duplicate** (to My sets) to every head-office member.

## 6. Subsets of our own schools (a filter)

1. A second selector on Group pages, labelled **"Showing"**: "All 59 schools" (default), the group's subsets, My subsets.
2. A subset is a set of **our own schools**, made in the same editor (our members only, likely members offered and labelled).
3. **It filters:** the Schools table, the map, Joined and left, and every per-school list.
4. **Group-level figures stay whole-group**, with one line: "**Showing 18 of 59 schools · group figures are for all 59**". No subset sums.
5. A school that has left the group drops out of the filter, and the set view says so.
6. **Share with the group** (admins) **moves** a personal set (of groups or of our schools) to the group, freeing the slot. **Duplicate** on any group set gives a private copy.

## 7. Storage (one additive migration; written and PGlite-tested here, applied by Guy)

- **`sets`:**
  - `owner_scope` gains `'group'`, plus `group_account_id uuid references group_accounts on delete cascade`;
  - `creator_kind` gains `'head_office'`;
  - `kind` gains `'group_peers'` and `'group_schools'`;
  - owner check: a group set has `group_account_id` and no school or owner; a personal set may carry `group_account_id` only if its owner is a member;
  - the one-default index gains `group_account_id` (Make default; a deleted default falls back in the app).
- **`set_members`:**
  - `member_group_id text` beside `urn` (now nullable), exactly one set; unique `(set_id, coalesce(urn,''), coalesce(member_group_id,''))`;
  - a trigger caps `group_peers` at 8 (the app reads one setting; the trigger is the backstop).
- **Functions / RLS:**
  - `can_curate_sets` gains the group branch, `is_group_admin(group_account_id)`;
  - read: `is_group_member(group_account_id)` or platform admin;
  - `check_set_creator` accepts `'head_office'` only for a group admin;
  - Share with the group = an update of `owner_scope` by an admin who owns the personal set (a dedicated function, since the policies stop owner changes);
  - a member school's SMT reads group sets through the **server**, after `dashViewer` checks its live grant.
- **`save_set`:** `group_account_id` and `member_group_id`.
- **Tests:** R-SETS-RLS group cases: Harris admin, Harris member, another group's admin, a school's SMT, a school's Admissions lead, platform admin, anon; the cap; Share; Duplicate.

## 8. Production changes (`~/dev/vicdata`; made directly, since no group uses the site: D1)

1. **`group_index_lookup()`**: one row per listed group (§4), with:
   - type and current / likely counts;
   - regions (count of schools per region, main first);
   - phases;
   - roll and 3-year change;
   - the headline per phase (latest year) and England's;
   - its own peer set id.
2. **`sat:all`**: the single-academy trusts' schools pooled, both readings, every year and phase. A new kind `sat` in `group_comparison_lookup`.
3. **Peer sets for types without a band**: `peer:foundation_trust:all` ("All foundation trusts"; Guy's `ft:all`, named in the peer family so it ranks like a band) and `peer:independent_other:all`. A group alone in its band (independent charities 6–10, 21–40) also takes its type's `:all` set, and every group of the type counts in that set's ranking.
4. **Non-group redefined**, so no school is counted twice across a group, non-group and the SAT pool. Each state school counts in exactly one of:
   - a **listed group** (MAT, federation, foundation trust with 2+ current schools);
   - the **SAT pool**;
   - **non-group**.
   
   Independents: a listed independent group, else non-group. The `non_group_areas` and `mix_matched_non_group` reweightings follow. The app's source note says "excludes single-academy trusts and schools in any listed group".
5. Fixtures regenerated (`docs/group_aggregates_fixtures`, plus the index and `sat:all`); `verify` and `timing` re-run.
6. **The build report** carries a before/after table: **every benchmark that moves**, with old figure, new figure and school count (Harris and Dukes at least, plus the national sets).

## 9. Decisions (Guy, 8 Nov)

- **D1:** make the production changes directly, plus `ft:all`. Before/after table in the report; update the non-group source note.
- **D2:** a member school's SMT (current grant) gets Default + the group's sets, read-only. No library, editing or My sets of groups.
- **D3:** panel (ours, median, band; no band under 4 groups, with the (i) saying why) and large view (every line muted, ours on top, a list to bring forward or pin; median and band toggle). Tables side by side.
- **D4:** foundation trusts rank against all foundation trusts, with no band. Production adds `ft:all`. Any other type with the gap gets the same rule: `independent_other`, and the two one-group bands.
- **D5:** region filter "Most schools in" by default, "Has a school in" toggle; ties count in both; main region first on cards.
- **D6:** Share with the group moves the set; Duplicate on group sets for a private copy.
- **D7:** every card shows roll and 3-year change plus one results headline for the phase in view against England; on All phases the main phase, labelled; "Results not published" for independents without them.
- **D8:** pages open on the size band (all foundation trusts for them) until an admin uses Make default. It applies to the whole group, granted schools included; a deleted default falls back to the band; anyone can switch.

## 10. Milestones

- **M1, production** (`~/dev/vicdata`, own branch): §8 1–6, promoted to production. Report with the before/after.
- **M2, storage:** the migration, PGlite tests, apply/verify/rollback scripts under `supabase/ops/group_sets/`.
- **M3, the library:** browse page, group page, filters, groups like us, Add to set; phone layout.
- **M4, comparison sets:**
  - `SetSelector` on Overview, Academic and Pupils;
  - the Default block and Make default;
  - the editor and `/sets` in group mode with the way back (`RETURN_PREFIXES` + `/teacher/group`, `product: "group"`);
  - side by side, the median, mixed types, not published, same-type ranks;
  - trend panel and large view (D3);
  - `?compare=` mapping;
  - the named-candidates sort bug fixed.
- **M5, subsets:** the Showing selector and filter, the "18 of 59" line, leavers dropping out, Share with the group, Duplicate.
- **M6:** rules, catalogue regenerated, screenshots at 1440 and 390 in both themes (headless harness, Harris fixtures), the report with Guy's commands.

**Rules to add:**
- R-GROUP-LIBRARY;
- R-GROUP-SET-PICKER;
- R-GROUP-SET-SIDE-BY-SIDE;
- R-GROUP-SET-TRENDS;
- R-GROUP-SET-DEFAULT;
- R-GROUP-SUBSET-FILTER;
- R-GROUP-SETS-RLS;
- R-GROUP-NON-GROUP (each school in exactly one of a listed group, the SAT pool or non-group);
- R-GROUP-RANK-SAME-TYPE.
