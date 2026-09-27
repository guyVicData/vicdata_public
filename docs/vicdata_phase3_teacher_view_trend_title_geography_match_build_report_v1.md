# Teacher view: Trend title, Geography match: build report (v1)

Prompt: `vicdata_phase3_teacher_view_trend_title_geography_match_claude_code_prompt_v1.md` (read in full). Built from `0b0ca40`:

| Commit | Section |
|---|---|
| `0407c12` | §1 caption → title |
| (none) | §2 both columns in one round: confirmed, nothing to change |
| `e724e65` | §3 Geography gets the same title |

Checks: `tsc --noEmit` is clean and `npm run build` succeeds. `eslint src` shows the same 7 problems as before, none in these files. Screenshots are in `docs/screenshots/trend_title_geography_v1/`, from the same unauthenticated preview (real components, real data, true-viewport headless Chrome).

## §1: Caption → title (`0407c12`)

- **Styling:** `TrendScaleCaption` is renamed `TrendScaleTitle` and now uses exactly the panel heading's style: `text-[12px] font-semibold text-[var(--muted2)]`, the same as "Entries in {category}" directly above it.
  - The whole line is one weight, so it reads as a second heading line, not a bold lead-in plus footnote.
  - `leading-snug` keeps a wrapped title tight.
- **Wording unchanged:**
  - Indexed: "Change since 2021/22: each line starts at 100 (no change); 110 = 10% more entries, 90 = 10% fewer."
  - Actual: "Entries each year, real numbers: one scale for every subject, so small ones sit low."
- **Legend:** "100 = first year shown" is kept exactly as it was.
- **Scope:** both uses change, Column 1 Candidates (`CandidatesPanels`) and Context (`SubjectPanels`).

**How it reads** (`laptop-trend-title.png`, `phone-trend-title.png`):
- **Laptop:** the two heading lines stack cleanly. At heading weight the indexed title is wider than the old caption and wraps to three lines. The chart is unaffected, but the legend's last entry (the kept "100 = first year shown") is now just below the card's fold and reached by scrolling the card, as panels already do. The Actual title fits in two lines.
- **Phone:** both titles wrap to three lines at heading weight, break at sensible points, and leave the chart fully readable. The legend's tail scrolls, as before.
- **If the laptop scroll is unwelcome:** the fix is wording (the title is the long line), not style. I haven't changed the wording, since it was confirmed as is.

## §2: Both columns in one round

Confirmed. Nothing reverted or staged.

## §3: Geography title (`e724e65`)

- **Behaviour:** `GeographyView`'s chart view shows `TrendScaleTitle` (indexed wording) under its "{subject} against the wider system" heading.
  - Only when the chart is actually indexed (`shouldIndex`, i.e. the Candidates / entries comparison) and has a line to draw.
  - Results' points comparison is drawn at real levels, so it has no title, correctly.
  - The table view has no title, since it shows real figures.
- **Real data check** (`laptop-geo-title.png`, `phone-geo-title.png`): The Chase, A-level Mathematics, points-eligible entries, against Worcestershire, West Midlands and England, fetched through the same KS5 qualification-grain lookup and thresholds the route uses. The title reads "Change since 2021/22: …" and the lines correspond to the real figures:
  - this school 34 → 22, indexed to 65 (22/34);
  - Worcestershire 648 → 725, indexed to 112;
  - England 83,407 → 98,372, indexed to 118.

**Actual toggle for Geography: not built.**
- It isn't free. Geography's chart/table choice isn't its own state: `GeographyView` takes `view` from the % Change panel that hosts it, in two components (`CandidatesPanels` and `SubjectPanels`), whose change-view state is a `"chart" | "table"` pair.
- An Actual option would mean a third state in both of those, plus new rail buttons on both % Change panels.
- The table already gives the real numbers (first and last year, with change), so the need is smaller than on Trend. **Say if you want it**; it's a small round of its own.

## Push and live check

Pushed with this round's commits (see the addendum below for what's live).
