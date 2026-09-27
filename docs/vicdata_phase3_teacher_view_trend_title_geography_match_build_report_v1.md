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

**Pushed `53c02da..bf3a61d` at 10:26:04 UTC.** That's eight commits: this round, the still-local qualification-match / Indexed-Actual round (`45fbc35`, `04d4f9b`, `1013c2a`, `0b0ca40`), and the earlier screenshots addendum (`2fcd523`).

**Live at 10:27:51 UTC**, about 2 minutes later, by Render auto-deploy. What's deployed is **exactly a clean build of `bf3a61d`**, checked the same way as last round:
- I built a clean `git worktree` of `bf3a61d`, as Render does.
- Its teacher chunk `1o3hy3rgco31x.js` (which contains the new title wording) is served byte-identical.
- Both of its CSS files, `04a9-503yxk6p.css` and `0u400317i9w44.css`, are served byte-identical.
- The previous teacher chunk now returns 404, so a hard-reloaded page can only run this code.
- The CSS filename is unchanged from the previous deploy because this round added no new classes: the title reuses the heading's existing ones.

The page itself is gated. **Hard-reload (⇧⌘R)**, then check:
1. The Chase, Column 1, focused on A-level Maths: five Candidates bars, no "Math Stud".
2. Trend: two heading lines, "Entries in Sciences & Maths" then the Indexed title, in the same style. The rail reads Indexed / Actual / Table, and Actual shows Maths at 38 → 22.
3. Context, with the shared toggle on Candidates: the same on its Trend.
4. % Change geography (Column 1, Candidates): the chart has the "Change since …" title under "Mathematics against the wider system".
