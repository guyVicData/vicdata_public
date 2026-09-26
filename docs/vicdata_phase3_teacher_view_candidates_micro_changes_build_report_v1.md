# Teacher view Candidates column: live-review micro-changes, build report (v1)

Five parts from the live review of GCSE, The Chase, Maths (General). One commit each, all pushed:

| Part | What | Commit |
|---|---|---|
| 1 | Focused row's label coloured | `8fb125c` |
| 2 | "Entries in {category}" title | `37a167c` |
| 3 | Trend lines in real colours | `b518e1e` |
| 4 | Rank hidden on the card | `8befde7` |
| 5 | % Change table against LA / region / England | `f8b3136` |

`tsc`, `eslint` (on touched files) and `next build` are clean.

## 1. Focused row's label coloured

In `ChangeList`, the focused row's label now takes `r.colour` inline, the same accent as its dot, and stays bold.

## 2. "Entries in {category}" title

The title sits above all three panels' views, whichever view is active. It's added by one wrapper in `CandidatesPanels`, not in each view.

- **Where the name comes from:** `groupLabel` is "{category} average", so the category name itself comes from a new `categoryLabel` prop. The page passes the same `focusFamilyLabel` it builds `groupLabel` from, so there's no new text.
- **When it shows:** only when the category average exists (`groupLabel` is set and there's more than one subject).
- **Exception:** Part 5's geography table has its own heading ("{subject} against the wider system"), because it isn't about the category.

## 3. Trend lines in real colours

- `colourOf` / `tintInOrder` are unchanged: Current's bars and % Change's list and table keep the grey ramp and accent focus.
- Trend alone builds `trendSubjectSeries` from a new `paletteInOrder()`. It uses `school-series-colours.ts`'s `PALETTE_LIGHT` / `PALETTE_DARK` (now exported), in Current's order, with the focus in `FOCUS_COLOUR`.
- `trendFull` reads the new series; `changeFull` still reads the grey `subjectSeries`.
- The legend and the Trend table's dots read the same series, so they always match the lines.
- CandidatesPanels now takes `theme` from the page, to pick the light or dark palette.
- **Judgement call:** palette hues within 40° of the phase accent are skipped, because the focused line *is* the accent and a peer in nearly the same colour would read as a second focus.
  - At GCSE (accent #34d399) that drops #1baf7a and #008300.
  - At Post-16 (#a78bfa) it drops #4a3aa7.
  - That leaves 5 hues at GCSE and 6 at Post-16, cycling beyond that. The Chase's Sciences & Maths has 6 peer subjects, so one hue repeats once there.

## 4. Rank hidden on the card

`YearTable`'s Rank header, cells and the rest-row cell now render in fullscreen only. The ranking still drives the default sort.

Because YearTable is shared, Context's Trend and % Change tables lose Rank on the card too. They keep it in fullscreen.

## 5. % Change table: the focused subject against LA, region and England

This is the table view only; the ranked list is untouched.

- **Route:** a new `/api/teacher/subject-geography`, gated to the school's approved staff. It reads `lookupAcademicSubjectGeography` (GCSE, `avg_point_score` rows) for:
  - the school's `la_name`;
  - its region, via `resolveTargetRegionNation()`;
  - England (`NATIONAL_GROUPING_KEY`).
- **Rows:** This school, LA, region, England, in `YearTable` with Rank off and the rows kept in that order until a header is clicked.
- **Years:** only the years the area figures exist, within the From range, so every row's change runs over the same span. The geography table has **2021/22–2024/25 only** (checked in the database; DfE published no GCSE points for 2020/21).
- **Figures:** all four rows are **points-eligible entries**, labelled under the table. The school's own row is `entriesTotal × pointsCoveragePercent` from its headline rows, so it counts the same thing as the areas. For The Chase's Maths this reproduces the rollup's own points-eligible column exactly (178, 165, 209, 231).
- **When it applies (§D1):** only when the focused item is the points-bearing GCSE qualification (`POINTS_BEARING_QUALIFICATION.ks4`), and then only if area rows actually come back.
  - Otherwise it says so plainly: "…aren't available for {subject}: they count GCSE (points-eligible) entries only…", or "No LA, regional or national entries figures are published for {subject}."
  - At Post-16 the table is unchanged (category subjects), since the source is GCSE-only.
- **Why the qualification check as well as returned data:** a returned area row isn't enough evidence on its own. The Chase's Dance, Russian and Italian have England/LA rows, but the school's own entries in those subjects are all outside GCSE points, so the rows would compare two different things.

### The Chase (URN 137625, Worcestershire, West Midlands), 2024/25 — what to check live

**Maths (General), expected table** (2021/22 → 2024/25):

| Row | 2021/22 | 2024/25 | Change |
|---|---|---|---|
| This school | 178 | 231 | +53 (+30%) |
| Worcestershire (LA) | 5,727 | 5,863 | +136 (+2%) |
| West Midlands (region) | 65,245 | 69,165 | +3,920 (+6%) |
| England | 580,970 | 614,241 | +33,271 (+6%) |

**Subjects that get the "not available" note instead**, because the school has zero points-eligible entries in them:

| Subject | Entries | Area rows? |
|---|---|---|
| Science Double Award | 170 | none |
| Additional Maths (FSMQ) | 18 | none |
| Multimedia | 36 | none |
| Dance: General | 20 | exist, but the school's entries aren't GCSE |
| Russian | 1 | exist, but the school's entries aren't GCSE |
| Italian | 1 | exist, but the school's entries aren't GCSE |
| Turkish | 1 | England only |

Every other subject has all three area rows.

**Caveat:** the "applies" check runs on the focused item's qualification type (GCSE full course). If one of these subjects is ticked under a GCSE qualification type while the school's entries are actually non-GCSE, the table would show a school row of 0 against the areas. The list above is the one to check that against.

## Open decisions

- **§D1:** the "applies" rule (GCSE qualification check plus rows returned), rather than "rows returned" alone. The reason is above.
- **§D2:** the school's own row uses its points-eligible entries, so its % can differ from the Candidates list's all-entries % (e.g. a 2020/21 start doesn't exist in this table).
- **§D3:** the 40° hue cutoff for the Trend palette.
