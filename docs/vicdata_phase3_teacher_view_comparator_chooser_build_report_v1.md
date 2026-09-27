# Teacher view comparator chooser (v29 wireframe): build report (v1)

Prompt: `vicdata_phase3_teacher_view_comparator_chooser_build_claude_code_prompt_v1.md` (read in full), built to `docs/wireframes/comparator-chooser-v29/` (all ten screens read, and rendered for comparison). Built from `d015664`. **Pushed and live.**

| Commit | What |
|---|---|
| `741467e` | Prep, no behaviour change: `resolveNearestOption` moved to a shared module, the ONS region map exported, and an opt-in `TeacherModal` "chooser" size |
| `0dded32` | §1–§4: the hub, 2a/2b/2c with Save / Save as / Delete, rankings 3a/3b, the `saved_rankings` migration, the new routes and the page wiring |
| `2ec4d01` | §5: Victoria Consultancy Sets (migration, route, chooser row, pill heading, `scripts/vc-sets.ts`) |
| (this commit) | Build report, `OPEN_QUESTIONS.md` entry, screenshots |

**Why §1–§4 are one commit, not four.** The hub and every adjust screen share one orchestrator and one page switch. A §1-only push would have put a hub on the live site whose Next buttons led nowhere, which impinges on the site. So the §1–§4 build landed and went live together, clean, with §5 separate. Each commit passed `tsc` / `eslint` / `next build` before it was pushed; `eslint src` shows the same 7 problems as before this round, none in these files.

**Live:** pushed at 15:30 UTC (§1–§4) and 15:34 (§5), live at 15:36:22.
- A clean-checkout build of `2ec4d01` matches the site byte for byte: teacher chunk `1brvey3xq295g.js` and both CSS files, which carry the chooser's `min(736px,…)` panel size.

## Real file locations (confirmed before writing)

Everything the prompt names exists. Three pointers differed:
- `resolveTargetRegionNation` is in `region-nation-comparator.ts`, not `default-comparator-lists.ts`.
- `list1` / `list2` / `local16Plus` / `boardingBand` / `boardingRecipe` are fields of `buildDefaultComparatorLists(urn)`'s result, not exports.
- `ComparatorSetChooser.tsx` references `CategorySubjectPicker` only in a comment.

## What was built, and what each part reuses

- **The hub** (`Main` / `MainSavedSets` / `MainSchoolSets` / `MainRankings`): 10 nearest, Schools in {LA}, Regional & national rankings, My saved sets, {School} sets, Victoria Consultancy Sets.
  - Each state is as drawn: sublists, ⋯ menus on editable sets, and badges that drop in rankings mode.
  - Footer rule: **Next** for nearest / LA / rankings / my sets; **Done** for the school's sets and VC sets, which are switched on, not edited.
- **2a, 10 nearest:** `default-comparator-lists`' list1, or its boarding-quintile recipe by `resolveNearestOption` (now shared with the Data View so the two can't disagree), through the Data View's own `default-lists` route.
  - **±5:** re-runs the same pipeline via `expand-nearest` (or `boarding-quintile-list`), rather than appending.
  - **Rows:** each school's circle is its `sectorTag()` colour from `TAG_COLOURS`, with a bed glyph if `boarders_name` is set and not "No boarders" (the existing rule).
- **2b, Schools in {LA}:** list2, plus `local16Plus` kept as **its own group** (its 36 schools beyond list2 at The Chase), not folded in.
  - Group by None / Sector / Local authority, with group and school checkboxes (ticked counts, strike-through when unticked).
  - "Add another local authority" uses the Data View's `adjacent-las` + `la-set`.
- **2c, custom set:** adding a school by name (the site's own `search_schools` RPC) forks 2a or 2b into a custom set. The same editor opens a saved set for editing.
  - **Save** updates an editable set it's editing and otherwise creates one. **Save As** always inserts a new row (`saveComparatorSet` with `id: null`). **Delete** appears only for an editable saved set.
  - The personal cap of **8** comes from `PERSONAL_COMPARATOR_CAP`; it's shown ("3 of 8 personal sets used") and checked before saving, with the DB trigger as the backstop.
  - Admins get the wireframe's segmented Just me / Whole school choice.
- **3a/3b, rankings:** a population from `region_nation_set`, counted live as chips change.
  - **Sector:** `sectorTag()`, with the four-way `TAG_COLOURS` chips.
  - **Gender:** `genderTag()` on `schools.gender`.
  - **Boarding:** `boardingRatio()` in the wireframe's % bands.
  - **Qualification:** `KS5_BUCKETS`, chip "BTEC/OCR/VRQ" with aria-label "BTec, OCR, VRQ".
  - **Scope:** England, the school's region, or More (the other eight).
  - **Size:** `sizeBadgeForValue` against the national quintiles for the sixth-form band, drawn in the `PhaseBreakdownCard` square convention.
  - Filters combine as AND across boxes, OR within Sector and Size. Narrowing any of them forks into 3b with Save / Save as / Delete to the new `saved_rankings` table.
- **The dashboard side:** Done on an unsaved list or a ranking is stored as the Comparisons column's choice (one settings write) and resolved by `/api/teacher/chooser-set`.
  - A list goes through `rankFixedSets`, as saved sets do.
  - A ranking is ranked on the headline measure; the column gets the top 15 plus 5 either side, with a note ("The Chase ranks 843rd of 2,545 with a published figure (4,857 in this ranking)…").
  - The pill shows the choice by name.
- **Victoria Consultancy Sets (§5):** see below.

## Victoria Consultancy Sets (§5)

- **Storage:** three new tables, applied live. Nothing in `saved_sets` or its RLS was touched.
- **Access:** SELECT-only policies, so only the service role can write. Guy uses `scripts/vc-sets.ts`: `create "<name>" <urns…>`, then `show <school-urn> <set-id>` to switch it on.
- **Reach:** the saved-sets route returns only the VC sets switched on for the caller's school, so the hub row renders only then. Nothing is switched on anywhere yet; `list` confirms there are no VC sets.
- **RLS proven live** in a rolled-back transaction, impersonating real members:
  - a member of the switched-on school sees 1 set and its 2 members; their insert is refused (42501), and their update and switch-off change 0 rows;
  - a member of another school sees nothing, and so does an anonymous caller.

## Data verified against

**The Chase, URN 137625**, Post-16 (Worcestershire, West Midlands):
- nearest 10: Dyson Perrins CofE Academy 3.6km … Pershore High School 16km;
- Worcestershire: 66 schools (30 in list2, plus 36 more from 16+);
- the West Midlands population: 552; England: 4,857;
- Independent + Girls + 80%+ boarding: 6 in England (Benenden, St Mary's Ascot, Downe House…);
- The Chase's rank: 843rd of 2,545 with a published figure in England, 67th of 290 in the West Midlands.

Also Malvern College (added by name). The GCSE population was checked too: England 6,139.

## Checks

- **Headless: it worked,** so this isn't the §6 fallback. The real components ran in a scratchpad preview on The Chase's real data, captured server-side with the same library calls the routes make, plus stubs for session-only reads (clearly-labelled sample saved sets and rankings). Every state was screenshotted in headless Chrome at the wireframe's 390×760, plus dark mode and desktop at 1280×820, and compared against the wireframe files rendered the same way.
  - **Committed:** `docs/screenshots/comparator_chooser_v1/`, with the nine wireframe-vs-build pairs plus the VC row, dark hub, dark 3b and desktop.
  - **Found and fixed during this check:**
    - inactive chips kept a dark outline after being deselected (a React shorthand/longhand border bug);
    - the Done route's 60-school cap would have dropped part of The Chase's 66-school LA list (now 200).
- **Interaction trace** (read, then exercised in the preview):
  - every chip changes the population and the running count;
  - filters compose as AND across boxes, OR within Sector and Size;
  - adding a school forks 2a→2c and 2b→2c, and any narrowing forks 3a→3b;
  - the cap shown and enforced is 8; Save As always inserts; Delete appears only where `editable`;
  - the VC row appears only when a VC set is switched on for the school.
- **Route smoke check (live):** both new routes answer 401 with no credentials (the site gate), and 502 from their own membership check with a bogus token, the same path every Teacher and Data View route uses. A real signed-in call needs a real session I don't have; the libraries behind them were run directly against live data instead (all numbers above).

## Simplifications made without Guy there to confirm

All are logged in `docs/OPEN_QUESTIONS.md` under **2026-09-27 — Teacher view comparator chooser**:

1. **VC visibility mechanism:** separate tables and a service-role script, rather than an in-app operator role (none exists).
2. **Two "Independent" colours** on one dashboard (§3). Follow-up: move the Comparisons ranking table to the four-way palette?
3. **The Qualification filter's count isn't real yet.** It's wired and saved, and the screen says so.
4. **Saved rankings are their own table.** It mirrors `saved_sets` RLS, including its personal-insert quirk, with its own cap of 8.
5. **Boarding filter:** the wireframe's literal % bands; quintiles still govern "10 nearest". The middle-band dark colours are mine.
6. **Ranking population and consumer:** the "same phase" definitions; ranked on the headline measure (top 15 + 5 either side); the first national load is about 5 seconds, then cached for 6 hours.
7. **Size bands:** a latent null-LA bug in `lookupAgeBandDistributions` worked around, not fixed. At GCSE the XS band is nearly empty (national p20 = 1).
8. **UI calls:**
   - dark-mode token mapping;
   - no Delete on an unsaved fork;
   - two-step Delete in the ⋯ menus;
   - × to remove a school from a custom set;
   - admins see ⋯ on shared sets;
   - the school's-sets row hidden when there are none;
   - KS4 and KS2 variants.
9. **Two nearest lists in the pill:** the chooser's "10 nearest schools" (list1) and the old "Nearest 10 schools" preset (a different algorithm). Retire or rename one?
10. **"Mainstream" copy on 2b** while upstream list2 includes special schools and alternative provision.
11. **Migration history:** three older local migrations show unapplied remotely (untouched); this round's two were applied and recorded individually.

## For Guy's live look (hard-reload first)

The Chase, Post-16 dashboard → Comparisons "Compared against" → **Choose schools…**:

1. **Hub:** six-row layout; 10 nearest (10 schools, radius 16km); Schools in Worcestershire (66, "Includes FE & sixth-form colleges"); your real saved sets under My saved sets; the school's sets row only if The Chase has shared sets.
2. **10 nearest → Next (2a):** ranked rows with sector circles; +5 goes to 15 and −5 back; search "Malvern" and add it → **2c** with the orange "Added by name · Independent" row and the fork banner. Name it, press Save, and the pill should show it.
3. **Schools in Worcestershire → Next (2b):** group by Sector / Local authority / None; the separate "Schools and FE colleges, 16+" group; untick a school (struck through); "Add another local authority" (Herefordshire etc.); Done.
4. **Regional & national rankings:** the sublist counts (England 4,857, West Midlands 552; the first load takes a few seconds) → **3a** with the includes card → tap Independent, Girls, 80%+ → **3b** (6 of 4,857) → name and Save. The pill should show it, and the column should show the note with The Chase's placing.
5. **Dark theme:** the same screens.
6. **Victoria Consultancy:** `npx tsx --env-file=.env scripts/vc-sets.ts create "Test set" <urns…>` then `show 137625 <set-id>`. The row appears on The Chase only; `hide` removes it.
