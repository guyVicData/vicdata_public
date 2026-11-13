# VicData 0.8 Group sets: report (M1 to M6)

**Branch:** `feat/group-sets-academic`, worktree `~/dev/vicdata_public_group`. Local commits, nothing pushed.
**Spec:** `vicdata_0_8_group_sets_brief_v2.md` (Guy's D1–D8, 8 Nov). **This round's prompt:** `vicdata_0_8_group_sets_m4_m6_claude_code_prompt_v1.md` (13 Nov), run unattended.
**Every call I made** is logged under "2026-11-13: group sets M4–M6" in `docs/OPEN_QUESTIONS.md`, numbered 1 to 25. This report refers to them as OQ1 to OQ25.

**No group uses the site yet.** The live counts on 13 Nov were `group_accounts` 0, `group_memberships` 0 and `sets` 6 (Leighton Park's, 99 members): the same as 8 Nov.

## 1. How far it got

| Milestone | State | Commits |
|---|---|---|
| M1, production (`~/dev/vicdata`) | Done, promoted, merged into production's `main` 13 Nov (`437a211`; it contains `b190b91`). See [`group_sets_m1_report_v1.md`](group_sets_m1_report_v1.md) and the like-for-like pools ([`group_sets_pools_like_for_like_v2.md`](group_sets_pools_like_for_like_v2.md)) | production's |
| M2, storage | Written and PGlite-tested, **not applied** (it goes live with the merge) | `459e26a`, `abc2981`, `e7689d6` |
| M3, the library | Done | `ebcf76f` |
| Merge of `main` | Done, no conflicts (OQ1) | `fa79371` |
| **M4, comparison sets** | Done | `5d97df3` |
| **M5, subsets** | Done | `1ad536c` |
| **M6, rules, screenshots, report** | Done | the last commit on the branch |

**Nothing is left of the brief's M4 to M6.** What isn't built, on purpose:
- non-mainstream groups' own comparison (LF3, N2): a later milestone;
- "Make default" for a subset (OQ23);
- a `/sets/<id>` page for a group set. Manage sets opens the editor instead (OQ15).

## 2. What the §2 re-check found (OQ2)

The brief's §2 facts all held after the merge. Only line numbers had moved:
- **The Compared-against `PillMenu`:** `GroupDashboard.tsx:221-254`. It was 214-248.
- **The compare keys:** `dash.ts:104`, `:134` and `:146`. They were 92-110.
- **The named-group chips and the Mix-matched toggle:** `views.tsx:179-198`. They were 168-181.
- **The Schools tab ignoring the pill:** `route.ts:43`.
- **The sort bug:** `route.ts:47`.
- **`RETURN_PREFIXES`:** `return-to.ts:10`. Unchanged.
- **The school-centred `ReturnContext`:** `:48`. Unchanged.

Two things are real that §2 doesn't mention:
- M3's library, built on the `group_index_lookup` fixture;
- `sat:all` rows already in the comparison fixtures.

Production's `origin/main` still contains `b190b91` (OQ3).

## 3. What was built

### M4: comparison sets of groups

**The picker.** Overview, Academic and Pupils now use the one `SetSelector` (R-GROUP-SET-PICKER). The button reads "Compared against", then the set's name and "n groups". The menu has three blocks:
- **Default**, computed and never stored:
  - our size band ("MATs with 41+ schools", 16 groups; "All foundation trusts" where a type has no bands);
  - non-group schools;
  - single-academy trusts (state groups only);
  - our areas;
  - England, by sector;
  - "Nearest in size, same type" (5 groups).
- **Group sets**, made by the head office and tagged "Head office" in the group's colour (OQ7).
- **My sets**, "n of 8".

Below the blocks come Edit this set…, New set…, Make default and "Make the size band the default" (admins only), Duplicate to My sets (on a group set) and Manage sets.

A member school's SMT, View as and a peek get the Default block and the group's sets, read-only: no actions and no My sets (D2).

This replaces three things: the Compared-against pill, the named-group chips and the Mix-matched toggle. Mix-matched stays as a row of Against others (OQ6). On a phone the picker sits under the phase chips and opens as a bottom sheet (OQ22).

**The page's default (D8, R-GROUP-SET-DEFAULT).** The page opens on the size band until an admin makes a group set the default. If that set is deleted or archived, the page falls back to the band. Make default is two `save_set` calls (OQ8).

**Side by side (R-GROUP-SET-SIDE-BY-SIDE, R-GROUP-RANK-SAME-TYPE).** The table shows:
- our group first and highlighted;
- each group in the set, with its type and size and its rank within its own type;
- the set's median. It is one vote per group with a figure, never ours, labelled "n of m groups", and "mixed types" when the set mixes them.

An independent group's Progress 8 and KS2 read "not published" (OQ11). The Weighting switch applies to every row, and the median follows it.

Where it appears:
- **Overview, Against others:** the table, with England as a reference row under it (OQ9).
- **Academic, Results now:** the set's headline side by side, with the median and England.
- **Pupils, Now:** roll and change side by side.

**Trends (D3, R-GROUP-SET-TRENDS).**
- **The panel** shows ours, the median and the middle half (25th to 75th percentile). There is no band under 4 groups, and the (i) says why. There is no hover or pinning.
- **Full screen (the large view)** draws every group's line muted, with ours on top. A list beside the chart brings a line forward or pins it, and a toggle shows or hides the median and band.

This applies to the roll trends (Overview, Pupils) and the results trends (Overview, Academic, Post-16).

**The editor and `/sets` in group mode.**
- **The editor** opens at `/sets/edit?account=…&kind=group_peers&returnTo=…`:
  - each row is a group: type, size, regions, headline;
  - a tick means "in the set";
  - **Add groups** opens the library as a sheet, filtered to groups like us;
  - "8 is the most a set holds" (`GROUP_SET_CAP`);
  - Save, Save as (My sets, or Group sets for admins), Share with the group, Make default, Archive, Delete.
- **Manage sets** is `/sets?account=`.
- **The way back:** `/teacher/group` was added to `RETURN_PREFIXES`, with product `group`. The editor's Back reads "Back to Harris Federation · Overview".
- **The library's "Add to set…"** (left over from M3) now saves through the same path.
- **School pages are untouched.** The school editor, library and set view don't change (OQ15).

**Old links.** Old `?compare=` links still work (OQ6). `peer_named:a,b` opens as an "Unsaved set" of those groups, up to 8, with "Save this set…".

**The named-candidates sort is fixed (OQ16).** Candidates now come from the library's index, sorted by the group's own size. The page no longer scans every school in England.

### M5: subsets of our own schools

**The Showing selector (R-GROUP-SUBSET-FILTER)** is on every Group page: "All 59 schools", the group's subsets and My subsets.

**What it filters:**
- the Schools table;
- the map;
- Joined and left;
- every per-school list: Schools ranked, value added, entry cohorts, leaving at 16, market share and the projections.

**What it doesn't filter:** every group-level figure stays whole-group, with the line "Showing 18 of 59 schools · group figures are for all 59". There are no subset sums (OQ21).

**Leavers.** A school that has left the group drops out of the filter. The page, the editor and Manage sets say so (OQ24).

**Making and sharing subsets.** Subsets are made in the same editor (`kind=group_schools`): current members only, with likely members offered and labelled.
- **Share with the group** (admins) moves a personal set, of groups or of schools, to the group (D6).
- **Duplicate** gives a private copy.

### M6: rules, catalogue and screenshots

See §5 (rules), §6 (screenshots) and §7 (tests and parity).

## 4. Storage as built

**The M2 migration is unchanged since 8 Nov.** That is `supabase/migrations/20261121100000_v08_group_sets.sql`, with apply, verify and rollback in `supabase/ops/group_sets/`. M4 and M5 needed nothing more (OQ8). `apply_group_sets.sql` is the migration wrapped in `begin … commit`, plus its own `schema_migrations` row.

**The live history.** It holds `20261121090000` (sets r1) and `20261122090000` (subject entry size). This migration's version, `20261121100000`, falls between them. It is applied by `db query`, never `db push`, so the order doesn't matter.

**What it adds:**
- **`sets.group_account_id`.**
  - `owner_scope` gains `'group'`;
  - `creator_kind` gains `'head_office'`;
  - two new kinds: `group_peers` (a set of groups) and `group_schools` (a subset).
  - School kinds never carry a group, and group kinds never carry a school, entry point, phase, focus school, audience or rung.
- **`set_group_members (set_id, group_id, position)`**, its own table (OQ, 8 Nov). A trigger caps it at 8. `set_members` keeps its key and save path, and holds a subset's schools.
- **One default per head office and kind** (a partial unique index).
- **`share_set_with_group(uuid)`**, which moves an admin's own personal set to the head office.
- **`save_set`** takes `group_account_id` and `{group_id}` members.

**RLS (R-GROUP-SETS-RLS):**
- **Read:** a group set is read by every member of the head office (both roles) and by platform admins.
- **Write:** only the head office's admins write it.
- **Personal sets:** a personal set for a group belongs to its owner, who must be a member of that head office.
- **A member school's SMT, View as and a peek** read the group's sets through the server, after the access check, using the service role. They never see anyone's personal sets.

**Tests.** The PGlite suite has 63 checks (up from 47). They cover the app's own reads and writes: a member's read, the server's read for a granted school, Make default's two steps, Add to set…, the ninth group refused, Archive, the cap across kinds, Share for a subset, and Duplicate. They also run the rollback and re-apply.

## 5. Rules

**Added (all active, each with a runner in `scripts/catalogue-rule-tests.ts`):**
- **R-GROUP-LIBRARY:** M3 built the library but never catalogued its rule. Added here, with Add to set…
- **R-GROUP-SET-PICKER**
- **R-GROUP-SET-SIDE-BY-SIDE**
- **R-GROUP-SET-TRENDS**
- **R-GROUP-SET-DEFAULT**
- **R-GROUP-SUBSET-FILTER**
- **R-GROUP-SETS-RLS**
- **R-GROUP-NON-GROUP:** the app's side of M1's partition. Production's own check stays in the ingest's `verify`.
- **R-GROUP-RANK-SAME-TYPE**

**Rewritten (extended, nothing retired):**
- **R-SET-PILL:** applies to the Group pages too, through R-GROUP-SET-PICKER.
- **R-SETS-WAY-BACK:** the Group pages are a way back too ("Back to Harris Federation · Overview").

No existing rule named the Compared-against `PillMenu`, the named-group chips or Mix-matched: they lived only in code and in the group tests. So no rule was retired.

The group method for Against others (`methods-groups.ts`, GRP-O-AGAINST) gained the single-academy trust source and a side-by-side step. `docs/catalogue/*.md` is regenerated.

## 6. Screenshots

The screenshots are in `docs/v0.8/group_sets_screenshots/`: 44 PNGs, each at 1440 and 390 wide, dark and light. They were made with the headless harness (`docs/v0.8/audit_scripts/group_sets_preview/`): the server-side builders, the built CSS and headless Chromium.

**Every figure comes from the Harris (`3320`) and Dukes fixtures.** The fixtures gained more named groups, read from production (read-only). The groups already there were re-read and are identical value for value (OQ5).

The stored sets in the shots are harness data, as a head office would have them:
- "London and the South: big MATs" (5 groups);
- "Ark, United Learning and a foundation trust" (mixed);
- "Nearest five (mine)";
- "Harris secondaries, first 18" (a subset);
- for Dukes, "Independent groups we watch".

| File | What it shows |
|---|---|
| `01-picker-open-harris-*` | The picker open: Default (16 groups, 8,177 schools, …), Group sets (Head office), My sets 3 of 8, the actions |
| `02-side-by-side-harris-*` | Against others side by side: Harris, five MATs with type, size and same-type rank, the median "5 of 5 groups"; the trend panels with median and band |
| `03-side-by-side-mixed-not-published-dukes-*` | Dukes against four companies and a charity: "mixed types", Progress 8 "not published" on every row |
| `04-trends-panel-academic-harris-*` | Academic: Results now with the set side by side and the median; the trend panels |
| `05-trends-large-view-harris-*` | The large view: every line muted, Harris on top, United Learning pinned, the list and the median and band toggle |
| `06-editor-group-mode-harris-*` | The editor in group mode, "Back to Harris Federation · Overview" |
| `07-editor-add-groups-sheet-harris-*` | Add groups: the library as a sheet, groups like us, "3 of 8" |
| `08-manage-sets-harris-*` | `/sets?account=`: Group sets and My sets for both kinds, with Use, Edit, Duplicate, Make default, Share with the group, Archive and Delete |
| `09-showing-subset-schools-harris-*` | Schools with a subset applied: the table, scatter, shapes and Joined and left filtered to 18, the group's tiles whole, "Showing 18 of 59 schools · group figures are for all 59" |
| `10-showing-menu-harris-*` | The Showing menu: All 59 schools, Group subsets, My subsets (a bottom sheet at 390) |
| `11-share-with-the-group-editor-harris-*` | A personal set's ··· menu: Share with the group, Archive, Delete |

**Fixed while shooting:**
- **The page scrolled sideways on a phone.** The dashboard switcher, which since M3 includes "Groups library", made the page wider than 390 and clipped the sheets. The switcher now scrolls on its own, and every Group page and the group sets pages measure 390.
- **A tall set pushed its median below the panel.** The side-by-side table now scrolls inside the panel, with its header and median row held in view.

## 7. Tests and parity

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors (the 3 warnings predate this round) |
| build | passes |
| Group tests (`src/lib/groups/*.test.ts`, fixture switch on) | **79 / 79** (61 at M3) |
| Unit tests (every other `src/**/*.test.ts`, `--test-force-exit`) | 565 pass, 5 fail. **All 5 fail on the base `fa79371` too** (OQ19): SMT Academic's unregistered views (`editor-guarantees` ×4) and the preset doc (`viewspec`). `featured-row` failed on the base and now passes |
| Catalogue unit tests | **77 / 77** |
| Rule tests (production reads) | the twelve this round touches all pass, the new nine included. R-FEATURED-ROW-EVERYWHERE and R-REPORT-COMMANDS-ORDER failed on the base: both pass now. The second was fixed by rewording the M1 report's commands into the seven steps (OQ19). Full run: **PASS 165, FAIL 0, ERROR 0** (MANUAL 15, NONE 19, SUPERSEDED 8) |
| PGlite, every suite (as their headers say; PostGIS ones with PGlite 0.5.5) | all pass, `v08_group_sets` **63 / 63**. `v08_view_as_editing` has 2 fails, identical on the base (SMT Academic's views) |
| SSR parity of the shared sets code (SetSelector in 24 states, the pills, the header line, every way-back rule over 20 addresses), base `fa79371` against the branch | **31 / 32 identical.** The one difference is `RETURN_PREFIXES` gaining `/teacher/group` |
| Teacher parity harness (base `fa79371` against the branch working tree; OQ30) | 7 case sets, **2,682 pairs: 2,661 identical, 1 noise, 20 unexpected.** All 20 are one view: Teacher's Data panel bar chart (Current, dark, 1280), with **words identical** and the chart drawn at a shorter height. It was short on the base in 11 and on the branch in 9: the known first-measurement timing flake, in a panel neither tree changed. Also 7 case runs failed (CDP "Promise was collected", on both trees). **Import graph:** Teacher bundles 3 changed files (`SetSelector.tsx`, `return-to.ts`, `rules.ts`), all covered by the SSR parity above; Data View and the public page bundle none. **Public page SSR** (137625, 117037): identical. A rerun of two case sets to confirm the flake was unusable: 46 walker failures on both trees ("Execution context was destroyed", emulation timeouts), so it adds no evidence either way. The full run stands as the result |
| Admissions and SMT parity harnesses | **Not run** (OQ30). Their pages bundle only `SetSelector.tsx`, `return-to.ts` and `rules.ts` of this round's changes (esbuild metafile). The first two are byte-identical on every school input in the SSR parity; `rules.ts` is drawn only on the Platform catalogue screen |

**What parity is allowed to show:** the Group pages, the library, and `/sets` and the editor in group mode. **School pages, school sets and every figure stay the same.**

**What reaches a school page at all.** Outside the group code, this round changes only:
- `SetSelector.tsx`: additive props; renders byte-identically for every school use;
- `return-to.ts`: one prefix and the group labels; every school address answers the same;
- `/sets` and `/sets/edit`: a branch on `?account=`, otherwise the same component;
- `featured-row-scan.ts`: the rule's list;
- `src/catalogue`: the rules, and the group method.

## 8. For the front door build (Part 2: guided sets, admin, phone)

The group-mode sets code it will restyle:
- **Group-mode components are separate, not modes of the school components.**
  - **`src/components/sets/GroupSetEditor.tsx`** is the editor in group mode, routed from `/sets/edit` when the address has `?account=` and a group kind (`EditorBranch` in `src/app/sets/edit/page.tsx`).
  - **`src/components/sets/GroupSetsLibrary.tsx`** is Manage sets for a head office, routed from `/sets` on `?account=` (`LibraryBranch` in `src/app/sets/page.tsx`).
  - The school `SetEditor`, `SetsLibrary` and `SetView` have no group code in them. A guided editor for schools needn't touch the group pair; restyling both is a matter of their own markup.
- **`SetSelector` gained four optional props**, each absent for every school use:
  - `countText`, on a row and on `current` (counts in words: "16 groups");
  - `blockLabels` (the middle block's name: "Group sets", "Group subsets");
  - `extraActions` (Make default, Duplicate);
  - `hideMine` (a school's SMT and View as on the Group pages).
  - **Restyle the selector once and both kinds follow.** Keep these props, or their equivalent.
- **Creator colours: no new creator kind.** "Head office" is the existing `group` creator (`--set-group-*`) with a label (OQ7). The library's gradient tiles should colour group sets with it.
- **Kind icons: none of their own yet.** Showing reuses the bars icon (OQ25). If the restyle wants an icon for a subset (`group_schools`) or a set of groups (`group_peers`), that's the place to add one.
- **Saving:**
  - group sets save through `src/lib/sets/group-store.ts` (`save_set` with `{group_id}` members; `share_set_with_group`);
  - they read through `src/lib/groups/group-sets-server.ts` and `/api/group/sets`;
  - the round-1 school library (`store.ts`) is unchanged: "build no second engine" holds.
- **The way back:** `/teacher/group` is in `RETURN_PREFIXES`, and the product is `group`. Back labels come from `returnLabel` and `dashboardLabel` (`groupPageWord`).
- **Migrations:** this branch holds `20261121100000`. Part 2 names its own after the latest in `main` and the live history.

## Guy's commands

These follow the template in `docs/FEEDBACK.md`. The branch is `feat/group-sets-academic`. It is local, in the worktree `~/dev/vicdata_public_group`, and shares the repository with `~/dev/vicdata_public`. The live site is **`https://vicdata.co.uk`**. **The migration goes live before the merged code deploys.** The code is safe either way: with no migration, every read answers "not set up" and the pages offer the Default block alone.

**1. Migrations** (it writes). Check the project ref first, then apply and verify from the worktree, with the CLI as installed (3.0: `--remote`, plus `--yes` for a write and `--read-only` for a check).

```
cd ~/dev/vicdata_public_group && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --remote --yes -f supabase/ops/group_sets/apply_group_sets.sql && supabase db query --remote --read-only -f supabase/ops/group_sets/verify_group_sets.sql
```

Verify should return one row: `recorded 1 · group_column 1 · rls_on true · group_member_policies 4 · group_read_policy 1 · share_callable true · anon_locked_out true · school_sets_unchanged_count 6`.

The apply script records `20261121100000` in `schema_migrations` itself, so there's nothing more to record. **If verify returns anything else**, roll back (it deletes only group sets, of which there are none yet) and tell me:

```
cd ~/dev/vicdata_public_group && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --remote --yes -f supabase/ops/group_sets/rollback_group_sets.sql
```

**How this differs from the template.** The template's `--linked` form is deprecated in CLI 3. Writes need `--yes` or `SUPABASE_YES`. The apply file carries its own `schema_migrations` insert inside one transaction (the form sets r1 used and you approved), so no `migration repair` is needed.

**2. Merge and push** (the push starts the Render deploy). Run it from `~/dev/vicdata_public` on a clean `main`:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff feat/group-sets-academic -m "0.8 Group sets (M2-M6): sets of groups and subsets of a group's schools in the one set picker; the groups library; side by side with the set's median; trend panel and large view; the editor and Manage sets in group mode; Showing" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand from the Render dashboard.

**4. Wait until /api/version shows the merge:**

```
until curl -s https://vicdata.co.uk/api/version | grep -q "$(git -C ~/dev/vicdata_public rev-parse --short HEAD)"; do sleep 20; done; echo deployed
```

**5. Republish** — none this round.

**6. Set fixed** — none this round.

**7. Live check**, as head office for Harris.

**No group account exists yet**, so first make one. On **Platform → Group accounts**, create Harris Federation (production id `3320`) and add yourself, or a test login, as **head-office admin** (round 1's flow). View as and peeks are read-only, so writing sets needs a real head-office login. Once the account exists, its id is on that page, and a read-only peek is `/teacher/group?lookAs=<Harris group account id>&as=head_office&peek=1`. Until then, View as Harris by its production id shows the pages read-only, with no sets.

Signed in as Harris's head-office admin:
1. **Groups library** (the switcher's last tab): Groups like us lists the MATs with 41+ schools nearest Harris in size. On three cards (e.g. Oasis, Ark, United Learning), use **Add to set… → New set with this group…**, then add the other two in the editor's **Add groups** sheet. Save as **Group sets**. You return to the library.
2. **Overview**: in **Compared against**, pick the new set. Against others shows Harris, the three groups (type, size, same-type rank) and "Median of the set · 3 of 3 groups". The roll trend says there's no band under 4 groups. Add a fourth group (Edit this set…) and the band appears.
3. **Academic** → Results trend → full screen. Every group's line is muted, with Harris on top. Click a group in the list to pin it, and toggle the median and band.
4. **Compared against → Make default for the group**. Reload Overview with no `?compare=`: it opens on the set. **Make the size band the default** puts it back.
5. **Schools → Showing → New subset…**: tick some schools, save as a Group subset. The table, map and Joined and left show only those. The line reads "Showing n of 59 schools · group figures are for all 59", and the tiles are unchanged.
6. **A member school's SMT.** Grant a Harris school on Access, then sign in as that school's SMT and open the Group pages. Compared against offers the Default block and Harris's group sets, with no My sets and no actions. The group's default applies to them too. Showing offers the group's subsets, read-only. The Groups library isn't there for them.
