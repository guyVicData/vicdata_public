# VicData 0.7 — Admissions round 3 report: Teacher parity, boarding only where it applies, one edit bar, the funnel like with like

Branch `v0.7-admissions-r3`, from `main` (`b1fa35f`). Prompt: `docs/v0.7/vicdata_0_7_admissions_round3_teacher_parity_claude_code_prompt_v1.md`. **No database change** (nothing to apply). Calls are logged under "2026-10-12 — 0.7 admissions r3" in `docs/OPEN_QUESTIONS.md`. F6 is a plan only: `docs/v0.7/admissions_editor_plan_v1.md`.

**Parity:** Teacher differs in **F1's icon row only**. The Data View is untouched, and the public page is byte-identical.

- **Unmasked:** every Teacher pair changes (0 of 2,875 identical), because every panel's icon row changed.
- **Masked** (the icon row hidden on both trees): **2,868 of 2,875 are identical**.
- **The other 7** differ in pixels only. Their words are identical, and every element in the panel has the same position and size on both trees apart from the icon row's own elements. That is text and marker antialiasing inside panels whose icon row changed, not a layout change (details below).

| Stage | Commit | What |
|---|---|---|
| F1 | `2febe2e`, `2e8e9ef` | One panel icon row (`PanelIconRow`) for every Teacher and Admissions panel. Teacher's Export moves into the ⋯ menu. Admissions panels are Teacher's `CardBox`. |
| F2, F3, F7 | `98abbd7` | Boarding only for boarding schools, with a rule and a real-data test; shapes without age 18; the funnel on one area, with a rule and a test. |
| F4, F5 | `95de412` | Teacher's nav, control bar and edit bar on Admissions (`Chrome.tsx` removed); the View as pill only while viewing as someone; the platform admin's empty state. |
| F6 | (this commit) | The editor plan, for review. |
| report | (this commit) | This report, the screenshots, the logged calls. |

Screenshots are in `docs/v0.7/admissions_r3_screenshots/`. Admissions ones are drawn by the built components in headless Chrome, on real data from the routes' own functions, with the real Tailwind CSS. "Before" is `main` with round 2's fixtures; "after" is the branch with fixtures captured today. Teacher ones are from the parity harness (`main` against the branch).

---

## F1 — One panel chrome for Teacher and Admissions

**The component:** `src/components/teacher/PanelIconRow.tsx`. The order is written in the component (`PANEL_ICON_ORDER`) and is the same in both products. Right-aligned, left to right:

| Slot | Icon | What it does |
|---|---|---|
| 1. menu | ⋯ | The panel menu (`PanelExport`): **Print this graph**, then **Copy this view…** (or Teacher's two Coming soon rows off the config renderer), then any panel extras after a divider |
| 2. fullscreen | ⤢ | Full screen; in the modal, exit full screen |
| 3. collapse | ⌃ | Close the panel (Teacher's accordion) |

- **Reserved slots.** A slot that doesn't apply keeps its width, so the others never move. Admissions panels have no collapse (rows collapse there), so their third slot is empty. A slot reserves width only, not height, so no header gets taller (this was a real difference in the first parity run; fixed in `2e8e9ef`).
- **(a) Full screen on every panel,** Admissions included. It is Teacher's own full screen: the `CardBox` modal, its rail, the caption and the source printed in full.
- **(b) Notes and flags exactly as Teacher.** Guy's note was cut off ("notes, flags as …"); I read it as "exactly as Teacher" and logged it.
  - The honesty lines moved behind Teacher's caption button, beside the source "i". They use the same popover and print in full screen.
  - What a panel must show without a click (column 1's LA context, the Academic panel's subject-explorer link) is `CardBox`'s visible caption.
  - The Admissions-only note style (`--adm-note-*`, the bottom-row text line, the placeholder "i") is gone.
- **(c) Export.** Teacher moved from the footer's export icon to the same ⋯ menu, with the same items in the same order. Nothing is lost.
  - Admissions' copy, which was "Copy to meeting slides…", now reads **Copy this view…**. It opens the same dialog, meeting slides only.
  - The prompt names "export image, export data". Teacher has neither today, so none were invented.
  - Admissions keeps its "Edit the feeder lists" / "Edit the rivals" rows, after a divider.
- **(d) Fixed order:** as in the table, in both products.
- **How:** Admissions' `Panel` (`src/components/admissions/ui.tsx`) is now a thin wrapper round Teacher's `CardBox`. The header, rail (Teacher's `IconButton`), footer and modal are all Teacher's. `CardBox` gained three optional props, each absent everywhere on Teacher:
  - `menu`, the first slot;
  - `height`, for Admissions' rows;
  - `headerExtra`, Admissions' header chips.
- **Admissions rows:** 470 / 330 px became **530 / 340**. `CardBox`'s header line is a little taller, and the LA context now sits in the body. At 470, King's column 1 scrolled by 34 px.
- **Phone:** each Admissions block at 390 is the same `CardBox`, with its views as tabs under the header.

**Screenshots** (`f1/`):
- Admissions large view: `adm_large_{before,after}_{dark,light}_1440.png`, the whole page `adm_page_*`, and the phone `adm_phone_{before,after}_{dark,light}_390.png`.
- Teacher: `teacher_c1_{before,after}_{dark,light}_{1440,390}.png` (The Chase, GCSE, column 1's open panel).

### Teacher parity: only the icon row

Two full runs against `main` (`b1fa35f`), the branch at `95de412`.

**Unmasked:** `pairs=2875 identical=0 noise=2869 unexpected=6`.
- Every pair differs: the panel's top-right icons changed, and the footer's export icon left.
- The words are equal in all 2,875; the panel's text and both popovers are unchanged.
- 2,869 differ by under 0.1% of their pixels (the icons). The 6 larger ones are below.

**Masked:** with `PARITY_MASK=1`, the icon row is hidden on both trees and its labels are dropped from the digest:

| Case set | Pairs | Identical | Differ |
|---|---|---|---|
| 0.6.5 matrix (`c5_0`–`c5_3`) | 2,306 | 2,300 | 6 |
| Ranking cases (`rka`, `rkb`) | 497 | 497 | 0 |
| Saved-set cases (`sv`) | 72 | 71 | 1 |
| **Total** | **2,875** | **2,868** | **7** |

**The 7, and why they differ.** Each is repeatable (re-walked twice), with equal words.

| Pair | View |
|---|---|
| `130432-ks5-bands-dark-1280__c2.current` | Sortable table |
| `130432_btec-ks5-bands-dark-1280__c2.current` | Sortable table |
| `sv-137625-ks4-points-dark-1280__c2.current` | Bar chart |
| `117037-ks5-counts2-light-390__tab2__c3.current` | Map |
| `117037-ks5-threshold-light-390__tab2__c3.current` | Map |
| `117037-ks5-cand-light-390__tab2__c3.trends` | Change map |
| `100053-ks4-counts2-light-390__tab2__c3.trends` | Trend map |

- **The geometry check.** For each of the 7, I recorded every element's position and size inside the panel on both trees, with the icon row skipped (`docs/v0.7/audit_scripts/admissions_preview/geo.js.txt`).
  - They match to 0.01 px, including the map markers and every table cell.
  - The only lines that differ are main's two icon-row elements: the old header icon wrapper and the footer's export span.
- **What differs** is text and marker antialiasing. Glyph edges change across the panel, but nothing moves.
- I read this as F1's own change (the icon row), not a difference beyond it. **I haven't found the exact rendering cause**, so it is listed here rather than called noise.

**One real difference was found and fixed.** The first masked run of `2febe2e` found that an empty collapse slot made a header 2 px taller where a panel has no collapse button. `2e8e9ef` reserves width only. That run, and the earlier one, are in the harness's `out/`.

---

## F2 — Boarding only for boarding schools

**The rule:** a boarding school is one GIAS lists with boarding provision: `schools.boarders_name = "Boarding school"` (`src/lib/admissions/boarding.ts`, `isBoardingSchool`). "No boarders" and "Not applicable" are day schools. The rule is logged.

Two things the check found:
- **Round 2's test was looser.** It counted anything but null and "No boarders" as boarding, so the **393 open state schools marked "Not applicable"** counted as having boarders. That affected Admissions' "with boarding" rival counts and the *Rivals with boarders* filter. Both now use the one test. Teacher's own boarding default list is untouched.
- **King's Worcester (117037) has no boarders in GIAS.** So the boarding case is **Beaudesert Park (115786)**, a 3–13 independent prep marked "Boarding school", as the prompt allows.

**What changed:**
- **Setup:**
  - for a day school, step 1 doesn't ask "Who do you take?";
  - step 3 (Boarding feeders) is skipped, and the steps read **1 of 3 … 3 of 3**. A `?setup=boarding` link lands on the day step;
  - the rivals step has no "Boarding only" choice.
  - A boarding school keeps all of this, and starts on *Day and boarding* unless day feeders are saved and boarding ones aren't. Its rivals step now reads 3 of 3 when it takes day pupils only (round 2 said 4 of 4).
- **The filters stay where they were.** *Day + boarding* (and Market share's *Rivals with boarders*) is drawn for a boarding school only. For a day school the other filters close up.
- **Column 1:** one tile, in the same place.
  - Boarding school: **Day · boarding**, as before.
  - Day school: **Day** — the day count and "whole school", with no boarding half and no "0".
- **The server:** for a day school, its saved boarding lists are kept but not used, and a boarding filter is ignored. So the page and an old link can't bring them back.
- **The editor:** previewing a day school, *Boarding feeders* and *Both* aren't offered (`editor/step1_data.png`, The Chase). They stay in the catalogue.
- **A day school's wording:**
  - "Your feeders", "Feeders: your list", "Next: feeders";
  - no "day" where it only made sense beside boarding.

### The boarding audit

Every mention in the Admissions code, routes, `ADMISSIONS_NOTES`, the catalogue, the seed and setup, from a grep for `boarding|boarder|day_only|Day +|boarding_feeders|ISC`:

| Surface | A day school sees | A boarding school sees |
|---|---|---|
| Top bar filter *Day + boarding / Day only / Boarding only* (Pipelines) | Nothing | The filter, working (Boarding only with no list gives its empty state) |
| Top bar filter *Day + boarding / Rivals with boarders* (Market share) | Nothing | The filter |
| Column 1 day/boarding tile (`EntryNow`) | **Day** 1,449 · whole school | **Day · boarding** 330 · 14 |
| Pipeline header chip "Feeders: Day list (n) + Boarding list (n)" | "Feeders: your list (n)" or "nearby schools" | Both lists named |
| Funnel's ISC note (`boardingCensus`) | Nothing | The note under the funnel |
| Empty state "No boarding feeder list yet" | Unreachable (no filter) | Shown for Boarding only with no list |
| Feeder table / map ("on the day and boarding list" hover) | "on the day list" only (boarding lists dropped on the server) | Both |
| Feeder kinds (`boarding_feeders` lists) | Kept in the database, not used | Used |
| Setup step 1 "Who do you take? Day and boarding / Day only" | Not asked | Asked |
| Setup step 3 Boarding feeders (the boarding search, "With boarders", the fuzzy set, the ISC note) | Skipped; steps 1–3 | Runs; steps 1–4 |
| Setup step 4 rivals "Boarding only" | Not offered | Offered |
| Setup CTA "Save day feeders · Next: boarding" | "Save feeders · Next: rivals" | As before (or "Next: rivals" when day only) |
| Editor Step 1 compare *Boarding feeders*, *Both* | Not offered (in preview) | Offered |
| Market share column 1 "n with boarding" | The rivals' own figure (allowed: rivals may board) | Same |
| Ranked bars' rival traits "boarding" | The rival's own trait (allowed) | Same |
| Funnel / ladder captions | No boarding wording | ISC note only |
| The boarding entry-point fuzzy set (`candidates?kind=boarding`) | Never called | Returns preps with boarders |
| Phone tabs | No boarding tab or text | Same views |
| Export / meeting-slide text | No boarding text (slides draw the same views) | Same views |
| "Lead hasn't set up yet" defaults | Nearby schools; no boarding wording | Same |
| Shared lists / People history list names "Boarding feeders" | Only if a boarding list exists (kept from before; none at a day school unless saved earlier) | Named |
| `ADMISSIONS_NOTES.boardingCensus`, catalogue `knownGaps` "No boarders by age" | Not drawn | Drawn with the tile and funnel |

**Rule R-ADM-BOARDING-ONLY-WHERE-BOARDERS** (`scripts/catalogue-rule-tests.ts`, `admBoardingOnly`), on real data:
- **What it renders:** every view of both dashboards, as each panel draws it, with the notes and sources printed (`AdmissionsEveryView` under `OpenInFullscreen`); the top bar's filters for both dashboards; and all four setup steps. That is 34 surfaces and 4 steps per case.
- **Day schools:** The Chase 11+ and 16+, and Nunnery Wood 137051 (11–16) 11+.
  - It finds no boarding word (`boarding|boarders|boards|ISC|day only|day and boarding|day + boarding`) on any Pipelines view, filter or setup step.
  - Market share has no boarding control.
  - The tile reads Day.
  - The server ignores a boarding filter.
  - The steps read 1–3.
- **Boarding school:** Beaudesert Park 4+ and 11+.
  - It finds the filter, the day/boarding tile, the ISC note at 11+, setup's question and steps 1–4, and "Boarding only" in rivals.
  - The boarding feeder search returns 5 preps, all independent with boarders, and a boarding-only pipeline built from them uses them.
- **Negative control:** forcing the boarding UI on The Chase fails it (6 boarding words, steps 1–4).

**Screenshots** (`f2/`), dark and light:
- `day_chase_page_*` and `boarding_beaudesert_page_*` show column 1 (the tile), the top bar (the filter) and the Pipeline header.
- `*_market_*` show Market share.
- `*_setup_{entry,day,boarding,rivals}_*` show the setup steps. A day school's `setup_boarding` shows the day step.

---

## F3 — School shape leaves out age 18

- **What changed:** Admissions' profiles stop at 17 (`profileOf`, `src/lib/admissions/screens.ts`). That covers column 1's mini profile ("age 11 … age 17"), Shape and size, the rivals' shapes and the local shape.
- **The classifier check:** no school's shape changes.
  - The shared classifier already reads ages 5–17 only (`classificationAgeSpan`, `SHAPE_CLASSIFICATION_MAX_AGE = 17`), so leaving out 18 changes only the drawing. The public page is untouched (its SSR is byte-identical, below).
  - R-ADM-VIEW-SHAPES now also checks it on real data: all 26 schools in The Chase's 11+ views (own, rivals, feeders) have age-18 pupils, and **0** change shape without them. The profiles' highest age is 17.
- **The Roll by phase badges** (size, not shape) still count the sixth form as the school page does.

---

## F4 — One edit bar

- **Nav:** Admissions draws **TeacherNav** (the same component as Home, Recruitment and Meetings), with the school's onboarded phases and the shared label setting.
- **Control bar:** Teacher's **ControlBar**, with Admissions' pieces in Teacher's slots:
  - the Pipelines | Market share switch is Teacher's linked-dashboard switcher (`GroupSwitcher`), where Teacher keeps Candidates | Results;
  - the entry-point chips sit in the subject chips' slot, in the Admissions accent, with the ± (read-only, with the reason, for anyone but the lead);
  - the filters sit after the ±, where they were;
  - the badge is the "A".
  - `ControlBar` gained three optional props (`badge`, `subjectsLabel`, `editSubjects`), absent on Teacher.
- **Edit:**
  - The page registers the Admissions dashboard in view (`useInPlaceEdit`), so the platform admin's Edit appears exactly as on Teacher, in the footer and in the View as banner, platform admins only.
  - Edit draws the existing editor in place on that dashboard, with the school as the live preview. The page waits hidden underneath and re-reads the published config when Edit goes off.
- **`src/components/admissions/Chrome.tsx` is removed.** What was Admissions' own content (the filter chips, the row heads, the phone's switch and chips) is in `controls.tsx`. My team and the shared-lists page use TeacherNav too.
- **What went:** the "Admissions" nav tab and the "Entry point" label; the A badge and title say where you are. On a phone, TeacherNav wraps above the switch and the chips.

**Screenshots** (`f4/`): `top_{before,after}_{dark,light}_{1440,390}.png`.

---

## F5 — The "Viewing as" pill, and the admin's empty state

- **The pill** is the platform admin's View as control. Members never see it:
  - `ViewAsPill` renders nothing until `is_platform_admin` comes back true;
  - the member screenshots show no pill: `f5/member_admissions_{dark,light}.png` (Admissions) and `f1/teacher_c1_after_*` / the parity harness (Teacher, `admin=0`).
- **The change:**
  - The pill shows **only while viewing as someone**.
  - At rest it draws nothing, but keeps its popover in the nav, so Platform's "Look at it as…" still opens it.
  - The edit bar gets **"View as…"** in the footer (platform admins only, not while viewing as someone), and the account page card says so.
- **The empty state:** a platform admin with no Admissions here sees *"To see a school's Admissions, use View as."* with a **View as…** button (`f5/padmin_empty_*`). That covers both no Admissions role at their own school and no school at all. Members keep the existing text.
- **Tier:** no Admissions route or page reads `school_accounts.tier` (grep of `src/lib/admissions`, `src/app/api/admissions`, `src/app/teacher/admissions`, `src/components/admissions`: none). Access is by role only (`src/lib/admissions/auth.ts`).
- **View as The Chase (Admissions):** the page opens read-only, with the banner (`f5/viewas_chase_*`, in the preview harness). The live check with the preview-agent membership is in the click-through below. I can't sign in to the gated site.

---

## F6 — The editor plan

`docs/v0.7/admissions_editor_plan_v1.md`, for Guy to review. Nothing in it is built. Step screenshots on the Admissions Pipeline panel, drawn by the real editor: `editor/step1_data.png`, `step2_view.png`, `step3_preview.png`.

**The main finding:** the editor already handles the large view and its rail. The large view is an ordinary panel spanning two columns, and the rail can already reorder, add, remove, set the default, set Shows for and move or copy views. The work is in making the Admissions page draw what the config says, and making the editor honest about Admissions.

**Gaps it found:**
- look and compare options are saved but never drawn;
- moving the funnel to row 2 and editing it turns it into *Share needed*;
- the preview is fixed at 11+ and one unit wide;
- the page ignores the per-entry-point default;
- the phone shows only each row-2 panel's default view;
- (done in F7) the funnel could be ticked for 4+.

**Stages, small first:**
1. Make today's editor honest.
2. The page draws each view's options.
3. Views move freely and the page follows the config (medium Teacher risk: two shared editor files).
4. Preview sizes: panel, phone, slide.
5. (Optional) Admissions views on SMT dashboards (highest Teacher risk).

There are ten questions for Guy in one block (§5.3).

---

## F7 — The funnel: like with like, labelled clearly

**Now** (`src/lib/admissions/screens.ts`, `funnel`, `funnelArea`; `src/components/admissions/views/Funnel.tsx`):

- **One area:** births and the Year 6 / Year 11 bar use the school's own LA, or the lead's blend (same LAs, same weights) when one is set. The pipeline's automatic feeder blend is no longer the funnel's.
- **The pool bar** is every pupil a year below the entry age in every mainstream school in that area: academies, LA-maintained, free and independent (`age_profile_aggregates`, scope `la`).
  - Age mapping: Year 6 = age 10 at 31 August, in the census a year before entry (2024/25), the ladder's own `aged_N` mapping. The test checks the pool's age is a rung the ladder counts.
  - One small difference: the aggregates count part-time pupils too, a handful at 5–15.
- **The feeder-set pool left the funnel.** It stays in the Pipeline.
- **Labels,** a bold lead word then plain words, from `ADMISSIONS_NOTES` (`funnelBirths`, `funnelPoolOne`, `funnelPoolBlend`, `funnelEntry`). For The Chase at 11+:
  - **Births** in Worcestershire · born Sept 2013 – Aug 2014 · worked out from calendar-year births — **5,951**
  - **Year 6** in all Worcestershire schools, state and independent · 2024/25 — **6,616**
  - **Your Year 7** entry cohort · 2025/26 — **236**
  
  With a blend: "Worcestershire 70% · Herefordshire, County of 30%".
- **Wording:**
  - "an estimate for the area" is gone;
  - the hover keeps the method (the 8/12 + 4/12 split; the aggregates' scope, the school count and the undercount note, since 2024/25 is a backfilled year);
  - "not a flow of the same children" is the panel's note (F1's caption button).
- **The chip** on the funnel names its area ("Area: Worcestershire", "· Adjust" for the lead).
- **16+:** **Births** 6,094 (born Sept 2008 – Aug 2009) → **Year 11** in all Worcestershire schools 6,844 → **Your Year 12** 136.
- **4+ has no funnel:** `DV-ADM-P-FUNNEL` carries `entryPoints: ["11+", "16+", "custom"]` and leaves the 4+ rail. A girls' or boys' funnel shows the pool as "not held"; it is never estimated.

**Rule R-ADM-FUNNEL-SAME-AREA** (`admFunnelSameArea`, PASS). The births and pool bars carry the same LA set and weights, recomputed from raw ONS births and raw `age_profile_aggregates` rows:

| Case | Area | Births | Year 6 / 11 |
|---|---|---|---|
| The Chase 11+ | Worcestershire | 5,951 | 6,616 |
| The Chase 16+ | Worcestershire | 6,094 | 6,844 |
| King's Worcester 11+ | Worcestershire | 5,951 | 6,616 |
| The Chase 11+ with a 70/30 blend | Worcestershire 70%, Herefordshire 30% | 4,695 | 5,254 |

R-ADM-VIEW-FUNNEL is updated to match (three bars, the labels, nothing at 4+).

**Screenshots** (`f7/`): `chase_{11p,16p}_{before,after}_{dark,light}.png`. Before: 5,424 births in the 87/13 blend → 401 in the 15 feeder primaries → 236.

---

## Checks

- **tsc:** clean.
- **eslint:** 0 errors; the same 2 warnings as on main.
- **build:** clean.
- **Unit tests:** **390 pass, 0 fail**. The views preset table doc was regenerated (the funnel's entry points).
- **Rule tests:** **PASS 51, FAIL 0, ERROR 0** (round 2's 49, plus R-ADM-BOARDING-ONLY-WHERE-BOARDERS and R-ADM-FUNNEL-SAME-AREA).
  - Updated: R-ADM-VIEW-FUNNEL, R-ADM-FILTERS (boarding-only empty state now on Beaudesert; ignored for The Chase), R-ADM-VIEW-SHAPES (the age-18 check), R-ADM-VIEW-NOW (wording).
- **RLS test (111):** unchanged; no database change this round. Re-run on this branch: **111 / 111 pass**.
- **Parity:** below.

### Parity in full

- **Teacher:** as in F1 above. The icon row changes every pair; masked, 2,868 / 2,875 are identical, and the 7 others differ in antialiasing only, with identical geometry and words.
- **Teacher pages that change on purpose:**
  - every panel's icon row (F1);
  - the View as pill at rest, and the footer's "View as…" (F5, platform admins only; members see nothing new).
  - `ControlBar` and `CardBox` gained optional props, absent on Teacher.
- **The Data View (pages and API routes):** 0 changed files in their import graphs.
- **The public school page:**
  - 0 changed files in its graph;
  - its whole server render is **byte-identical** for 137625 (64,747 bytes) and 117037 (73,399 bytes), with 62 replay hits and 0 misses.
- **Fixtures:** 10 / 10 byte-identical between the trees.
- **Negative control:** a planted label change was caught.
- **Harness errors:** a few "parameter 1 is not of type 'Element'" files on 130416 / 130432 phone cases, on both sides, varying from run to run. This is the known headless flake.
- **The harness** is updated in `docs/v0.7/audit_scripts/parity_harness/` (`walk.mjs`: `PARITY_MASK`; README).

---

## Logged calls

In full in `docs/OPEN_QUESTIONS.md` ("2026-10-12 — 0.7 admissions r3"). In short:

- **F1:**
  - the icon order (menu first, so Teacher's two buttons don't move); slots reserve width only;
  - Teacher's menu items unchanged, and Admissions' copy renamed to match;
  - Guy's cut-off note read as "exactly as Teacher";
  - Admissions panels are `CardBox`, and the rows are 530 / 340;
  - the editor canvas is left as it is;
  - the menu reads the path when it opens.
- **F2:**
  - "Boarding school" only (round 2 counted "Not applicable");
  - Beaudesert Park stands in for King's;
  - a day school's boarding lists are kept but ignored;
  - setup's default; a day school's wording; rivals may still say they board.
- **F3:** no shape changes.
- **F4:** the Admissions tab and the "Entry point" label went; the editor opens on the dashboard in view.
- **F5:** the popover stays in the nav at rest; no tier gate.
- **F7:**
  - the area: the school's LA, or the lead's blend;
  - the pool's age and year, and the part-time difference;
  - girls and boys "not held";
  - the funnel's chip; the undercount note.

## Click-through for Guy

After Render's "Deploy live", hard-refresh. Nothing to apply.

1. **The Chase, Admissions** (your preview membership has Admissions and lead):
   - TeacherNav at the top, then Teacher's bar: the A badge, **Pipelines | Market share**, 11+ 16+ ±, then *All pupils* and *State + independent*. There is **no Day + boarding**.
   - Column 1's fourth tile reads **Day 1,449 · whole school**, and the mini profile ends at age 17.
2. **Any panel:**
   - the ⋯ · ⤢ icons at the top right open **Print this graph** and **Copy this view…** (meeting slides), and full screen;
   - the footer's "i" and caption button hold the source and the honesty note.
   - Do the same on a Teacher GCSE panel: ⋯ · ⤢ · ⌃, the same menu; there is no export icon in the footer any more.
3. **Pipeline → Funnel:**
   - **Births** in Worcestershire 5,951 → **Year 6** in all Worcestershire schools 6,616 → **Your Year 7** 236;
   - hover a bar for its method;
   - at 16+: 6,094 → 6,844 → 136;
   - the 4+ rail has no Funnel (at a school with 4+).
4. **Setup (±):** no "Who do you take?", steps 1 of 3 to 3 of 3, and no "Boarding only" on rivals.
5. **View as Admissions at Beaudesert Park** (or any boarding school):
   - *Day + boarding* is in the bar, and the tile reads **Day · boarding**;
   - setup asks "Who do you take?" and runs step 3, Boarding feeders.
6. **As yourself (platform admin):**
   - no "Viewing as: you" pill in the nav;
   - the footer reads **Edit · View as…**; View as… opens the popover in the nav;
   - on Admissions, **Edit** opens the editor on Pipelines, then Exit.
7. **As yourself, at a school where you have no Admissions role:** "To see a school's Admissions, use View as." with the button.
8. **View as your preview membership at The Chase (Admissions):** The Chase's Admissions opens read-only, with the banner and its Edit.
9. **A member account (not a platform admin):** no View as pill or footer link anywhere.
10. **The editor** (Edit on Admissions → the Pipeline view → Edit view…): Step 1's compare options for The Chase have no Boarding feeders or Both.
