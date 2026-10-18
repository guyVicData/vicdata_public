# VicData 0.8: SMT feedback round 2 (the selected set drives SMT Overview; feedback on a whole page)

The round for `docs/v0.8/vicdata_0_8_smt_feedback_round2_claude_code_prompt_v2.md` (F-9 to F-11, and section 6), on branch `v0.8-smt-fb2`, from `main` at `d443414`.

- **Every call** is in `docs/OPEN_QUESTIONS.md`, under "2026-10-18 — SMT feedback round 2", items 1 to 19, each tagged.
- **Nothing was written to any database.** The session read `feedback_for_triage` (F-9 to F-11) once.
- **Section 6 has a migration**, `20261118090000_v08_feedback_page`. It was written and tested in PGlite and is **not applied**. The branch is pushed, not merged; the migration command comes first, then the merge.

**Screenshots** are in `docs/v0.8/smt_fb2_screenshots/`, each `*_before.png` (main) and `*_after.png`:
- Leighton Park's SMT Overview under three sets, desktop and phone (`smt_overview_{nearest,local,saved}_{desktop,phone}_*`):
  - the default 10 nearest;
  - "Local rivals": its 5 nearest;
  - a saved-style set: its 6th to 10th nearest and the next 5 nearby.
- The page window: `page_feedback_window_after.png`.
- The inbox's page item: `inbox_page_item_after.png`.

## The principle

The comparison set chosen in the bar drives every comparison on SMT Overview, and the set's name says so. The one exception is the Scorecard's South East and England ranks. They are ranks, and Guy asked for them.

## The audit (item 4)

| View | Compared with before | Compares with now |
|---|---|---|
| **Scorecard**, the set column | the set | the set (unchanged) |
| **Scorecard**, South East and England | ranks in the region and England | the same (**the exception**) |
| **Scorecard**, Market share at 11+ | Admissions' default rivals (round 1's F-7) | **the set** (F-9) |
| **Scorecard**, Flags line | the set's middle change; the school's own roll; the national entry threshold | unchanged (OPEN_QUESTIONS 11) |
| **The school now**, results tiles | "national rank 424th of 2,536" | **"7th of 10 in 10 nearest"** |
| **The school now**, size by phase | XS to XL against Reading and England ("the school page's Roll by phase") | **the place by size in the set and the set's median** (F-10) |
| **The school now**, roll, day and boarding, entry tiles | the school's own figures | unchanged |
| **Map** | the set | the set (unchanged) |
| **Flags** | as the Scorecard's flags line | unchanged |
| **Results trend and table** | the set's middle half | unchanged |
| **Roll, indexed** and **Roll table** | Reading and England (pupils aged 5 to 15) | **the set's average day roll, and its average boarding roll (grey, dotted)** (F-11) |
| **Market share** and **Market table** | Admissions' default rivals | **the set** (F-9) |
| The Trends row's line | "indexed to 100, against Reading and England" | "against 10 nearest schools" |

## F-9: market share follows the set

**What changed** (`marketAt11(…, set)`):
- On Overview the rivals are the set's schools, even where Admissions has chosen its own.
- The tag reads "read-only · against 10 nearest schools", and the title "Market share at 11+, against 10 nearest schools". The (i) says it is a share of the set (`SMT_NOTES.marketSet`).
- Pupils keeps round 1's rule.

**Leighton Park:**
- Against the 10 nearest: **13.3%**, 3rd of 11; the largest rival is Reading Blue Coat School. Against Admissions' default it was 4.9%.
- Local rivals: 18.2%.
- The saved set: 19.7%.

R-MARKET-FOLLOWS-SET recomputes the share from the census. R-MARKET-DEFAULT-RIVALS is updated to cover Pupils only.

## F-10: size by phase against the set

Each phase reads, for example:

> Senior 386 · 5th largest of 11 · median 321

This is the school's place by size among the set's schools with that phase, and the set's median. A set school has a sixth form only where GIAS's top age is 17 or more.

Why not XS to XL: fifths of a 10-school set are two schools each, which reads as more precise than it is (OPEN_QUESTIONS 5). The (i) explains the form (`SMT_NOTES.setSize`). Pupils keeps XS to XL.

| Leighton Park | Senior | 16+ |
|---|---|---|
| 10 nearest | 386: 5th of 11, median 321 | 195: 5th of 11, median 144 |
| Local rivals | 3rd of 6, median 312 | 2nd of 6, median 131 |
| Saved set | 4th of 8, median 330 | 4th of 8, median 131 |

## F-11: roll, indexed against the set

The chart draws:
- the school's lines (Day and Boarding at Leighton Park);
- the set's average day roll;
- the set's average boarding roll, grey and dotted, where the set has boarders.

There is no England or Reading line. Each average is over the set's schools with a census in every year shown, indexed from the same base year (2019/20), under the same filters (`setAverage`).

- **Leighton Park:** Day, Boarding, "10 nearest average, day" and "10 nearest average, boarding". The boarding average is over the 7 set schools with boarders in every year.
- **The Chase:** a day school whose 10 nearest have no boarders. It draws its line and "10 nearest average", and no boarding line (R-ROLL-INDEXED-SET).

## Item 5: tidy-ups

- **Entry tiles:** "Joining at 11 · 57 · Year 7 +21% since 2019/20" and "Net change at 16 · +3 · Year 12 +10% since 2019/20".
- **Leaving at 16 and Net change at 16:**
  - Overview's (i) says Pupils' Leaving at 16 counts the same pupils as leavers, "for this year it shows −3, so a gain here is a minus there".
  - Pupils' (i), at an independent school, says "this year's Leaving at 16 of −3 is a Net change at 16 of +3 there".
  - The Pupils view's design is untouched.
- **The map's labels** stay on hover.

## Section 6: feedback on a whole page

**What changed:**
- **The button:** "Feedback on this page", in the site footer next to Edit, for those the feedback setting lets in (admins now). It is on every page with views, and on the Data View, the role homes and the group home.
- **Its colour** follows the view rules: yellow with open page feedback, green once marked "Looks good", monochrome otherwise.
- **The window:** the same one. Its header reads "This page: SMT Overview · Leighton Park School".
  - A new **Area** chip (tick any): navigation and menus · comparison-set bar · level chips and pills · layout · banner · home page · account · other.
  - "Applies to" reads "this page only" or "every dashboard of this kind".
  - There is no "where in the view".
- **What it records:** the same context as a view item (product, dashboard or page id and name, version, address, state, school or group, role, View as, app version, device, theme), with no panel or view. Its `view_key` is `page:<id>`.
- **The inbox:** page items read "Page", with an Items filter for pages or views. Open goes to the page with its state; the Coverage tab has a Page row per dashboard, counted apart from its views.
- **The migration** (`20261118090000_v08_feedback_page`):
  - `area text[]`, with a check on its values;
  - the product check widened with `home` and `dataview`;
  - a shape check: a page item has no panel and a `page:` key, and only page items carry areas;
  - `feedback_for_triage` gains `area` and `is_page`;
  - `feedback_coverage` gains `kind`.
  - It adds only: no row is changed, and every live item already fits the checks.
- **Docs:** `docs/FEEDBACK.md` has a new "Page items" section.

**Before the migration is applied:** view feedback works as now, because view items send no `area`. A page item is refused with "Page feedback needs the database update".

## Checks

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors (the 2 old warnings) |
| `next build` | clean |
| Unit (`src/**/*.test.ts`, `--env-file=.env`) | **518 / 518**: 514 plus 4 new in `src/lib/smt-fb2.test.ts` (`setSizeOf`, `setAverage`, the page item's payload and server checks, the footer button's colours) |
| Catalogue unit tests | **77 / 77** |
| Rule tests (real data, read-only) | **117 PASS, 0 FAIL**: 113 plus R-SMT-SET-DRIVES-OVERVIEW, R-ROLL-INDEXED-SET, R-MARKET-FOLLOWS-SET and R-FEEDBACK-PAGE. R-MARKET-DEFAULT-RIVALS now checks Pupils. MANUAL 15, NONE 19, SUPERSEDED 4. |
| PGlite, all 22 suites (RLS, usage log) | all pass. The new `v08_feedback_page_pglite.mjs` passes 17/17: the migration twice over live-shaped items, a page item with areas, the shape and area checks, the new products, `is_page` and `area` in `feedback_for_triage`, the page row in `feedback_coverage`, RLS. |
| Browser (`docs/v0.8/audit_scripts/smt_fb2/screens.mjs`) | **13 / 13**: under each of the three sets, size by phase, the market title and the roll lines name the set, and there is no England or Reading line; the entry tiles' wording; the page window, its header and Area chips; the item's context with no panel or view; the button turning yellow; the inbox's "Page"; no page errors; no writes |

**Rules:**
- **New:** R-SMT-SET-DRIVES-OVERVIEW (the set changed twice, region and England ranks unchanged), R-ROLL-INDEXED-SET, R-MARKET-FOLLOWS-SET, R-FEEDBACK-PAGE.
- **Updated:** R-MARKET-DEFAULT-RIVALS (Pupils only).
- **Reworded:** R-SMT-VIEW-NOW, R-SMT-VIEW-SCORECARD, R-SMT-VIEW-TRENDS.
- `docs/catalogue/*.md` is regenerated.

**One test change from last round:** `notes-feedback.test.ts` sent view items without a panel. A view item now needs one, as the database's new shape check does, so those test items name a panel.

## Parity

PARITY_PENDING

## Guy's commands, in order

GUY_PENDING
