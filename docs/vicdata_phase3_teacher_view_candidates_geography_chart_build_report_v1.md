# Teacher view Candidates % Change, LA/region/national view: build report (v1)

Two parts, one commit each, pushed. `tsc`, `eslint` (touched files) and `next build` are clean.

| Part | What | Commit |
|---|---|---|
| 1 | % change leads the Change column | `02fb020` |
| 2 | Geography chart as indexed lines | `26deb08` |

## Part 1: % change leads the Change column

`YearTable` gains `changeEmphasis?: "value" | "percent"`, defaulting to `"value"`, so every existing table is unchanged. Only the geography table passes `"percent"`:
- the % is the bold, direction-coloured line;
- the count sits beneath it at 9.5px in `--fg` at 85% opacity: a light, legible tone rather than the old `--muted2`.

`opacity-85` is confirmed in the compiled CSS.

## Part 2: the % Change chart is the geography comparison, as indexed lines

- **One shared step:** `geographyState()` now holds what `geographyTable()` used to hold inline. That's the not-applicable, loading and no-data messages, or the four series over the geography years.
  - `geographyTable()` and the new `geographyChart()` both read it, so the three states are literally the same code in both views, with the same wording.
  - The geography fetch now runs whenever the comparison applies, not only when the table is open.
- **`geographyChart(fullscreen)`:** renders `<MultiTrend … focusKey="own">`. For entries it indexes each line to its own first year = 100, with the dashed 100 line. Below four years it falls back to Option B's list, as Trends does.
  - Wired as `changeView === "chart" && geography`, beside the table branch.
  - The chart-view icon becomes the line icon when geography applies.
  - The fullscreen question now reads "How has {subject} moved, against its LA, region and England?".
- **Colours:** the school is `FOCUS_COLOUR`. LA, region and England are **one neutral slate hue in three shades, lightest for LA to darkest for England** ("zooming out"): `#cbd5e1` / `#94a3b8` / `#64748b` in dark, and a darker trio in light so the lightest still shows on white. The table keeps its single grey for area rows, since they're labelled.
- **Checked** in headless Chrome, in a 384px card replica with The Chase's real Maths (General) figures:
  - four lines, a 276×143px plot and no scroll;
  - the school indexed to about 130 (178 → 231), region and England to about 106, Worcestershire to about 102.

## Which subjects this renders for (The Chase, 2024/25)

Same rule as the table: GCSE only, and only when the focused item is the points-bearing GCSE qualification and area rows come back.

- **Renders (all three areas):** every subject with points-eligible entries.
  - **Sciences & Maths:** Maths (General), Biology, Chemistry (General), Physics (General), Electronics (Physics).
  - **Other categories:** English Language, English Literature, Geography, History, Religious Studies, Spanish, French Language, Computer Science, D & T, Art & Design, Photography, Music Studies (General), Speech & Drama, Sports Studies, Food Technology.
- **Shows the "not available" note instead,** in both chart and table view (zero points-eligible entries at the school): Science Double Award, Additional Maths (FSMQ), Multimedia, Dance: General, Russian, Italian, Turkish.

## Not changed (§D1)

The % Change panel's caption sentence behind the caption button still describes the category's biggest and smallest movers. Neither view on the card shows those at GCSE any more (both are the geography comparison). Rewriting it around "{subject} +30% against England +6%" is a small follow-up if wanted.
