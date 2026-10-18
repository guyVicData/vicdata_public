# VicData 0.8 — SMT feedback round 1 (F-1 to F-8, Leighton Park)

Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 18 Oct 2026 from Guy's first feedback items, read from `feedback_for_triage` in the app database (`lnhulykjlxmoneappnsp`) and triaged with him: all **planned, "0.8 SMT fb1"**. **To land before the Leighton Park demo (27 Nov).**

**Read first:**
- `docs/FEEDBACK.md`;
- each item in full: `select * from feedback_for_triage where number between 1 and 8` (read-only). Each `triage_note` is the agreed action;
- the items' `state` and `page_query`, to open the exact view.

Guy viewed as SMT at Leighton Park (110110), set "10 nearest with a sixth form or 16+ provision", level whole school. F-1 was on Admissions Pipelines at 16+.

## The work

### F-3 + F-4: SMT Overview, Scorecard (high)

1. **Rows by school type:**
   - an IGCSE school doesn't see the GCSE rows it isn't ranked on;
   - the boarders row shows only for boarding schools;
   - boarding schools get **South East and England ranks** in the table: their own region and England, by name.
2. **The set's column header** reads **"10 nearest"** (or the set's short name), so the table doesn't scroll at 1440 or on Leighton Park's real data. The full set name goes in the (i).
   - Give every set a short name, and use it wherever a header is tight.
3. **"Since 2022/23" becomes "Trends".** Each cell states its own period:
   - results: "since 2022/23";
   - sixth-form value added: "2023/24 → 2024/25" (only those two years exist nationally);
   - Progress 8: its actual years (it ends at 2023/24);
   - roll rows: their own period.

   This also closes the to-do snag "Scorecard's 'Since 2022/23' heading over rows measured since 2019/20".
4. **One (i) note on why the trend years differ:**
   - results are measured from 2022/23 (2021/22's generous grading);
   - sixth-form value added wasn't published for 2021/22–2022/23, because those students' GCSEs were teacher-assessed;
   - Progress 8 stops at 2023/24, because there were no Key Stage 2 tests in 2020–21;
   - rolls run from the 2019/20 census.

   All dates come from `years.ts`. The 2025/26 sixth-form release (mid-November) should then extend value added to three years with no code change. Test that.

### F-8: SMT Overview, The school now (high)

For **independent schools**, replace the "No comparable GCSE results" and "Not published for independent schools" tiles with:
- **"Joining at 11"** when the school's first year is Year 7: every Year 7 pupil is a joiner. Otherwise **"Net change at 11"**: Year 7 this year minus Year 6 last year.
- **"Net change at 16":** Year 12 this year minus Year 11 last year. A plus means the sixth form gained on what came up from Year 11.

Each tile stays **very simple** (Guy): the label, this year's number, and one change since 2019/20, e.g. **"Net change at 16  +14,  +40% since 2019/20"**. The arithmetic and its caveats go in the (i).
- **What "+40% since 2019/20" is measured on:** propose the clearest definition. My suggestion: the % change in the Year 12 roll, and in the Year 7 roll at 11, since 2019/20. Log it as a call for Guy, with the alternatives.
- **Use the same calculation and census rules as SMT Pupils' "Leaving at 16"** (day and boarding, census day, filters), so the two dashboards never disagree. Add a test that pins them together.
- State schools keep today's tiles.
- Leighton Park's figures go in the report.

### F-2: SMT Overview, Map

- Dots sized by roll, the focus school included.
- Labels show the whole-school roll and the roll trend.
- Dots and labels coloured red, amber or green on the roll trend, using the shared 3-year roll rule (`ROLL_DIRECTION_SPAN`) and the flat band (`flatBand`). No new thresholds.
- A size key, and the colour key, sit in the view.

### F-6 (+ F-5, a duplicate): hide empty views from the rail

- A view with nothing to show (Flags with no flags first) has **no rail icon**. If the panel opens on it, it opens on the next view instead.
- Make this a general rule, `hasContent` per view, and apply it to every product's rails. List the views it now hides for Leighton Park, The Chase and King's Worcester.

### F-7: SMT Overview, From Admissions → Market share

- Rivals default to the **10 nearest** when Admissions hasn't chosen a core set. Say so in the panel's tag and the (i).

### F-1: Admissions Pipelines, Entry point now

- Box each figure with its label, so the label clearly belongs to its number: Day · boarding, Girls · boys.
- The boarding box says "in whole school".
- Keep "in Year 12".
- Apply the same boxing to similar entry tiles (list them).

### Two fixes to the feedback system itself (found in this triage)

- **F-5 was written about Flags, but recorded on Map.** If the rail's view changes while the feedback window is open, the window offers **"Move to <view>"**. It never silently keeps the old view.
- **F-1's `app_version` is "dev".** Check that Render exposes the deployed commit at build time; F-2 to F-8 have it. Make a missing version show as "unknown" rather than "dev", outside local dev.

## Closing the loop

When the round merges and is deployed, set each item to `done` with `resolved_commit` and `resolved_at`, via the inbox or one SQL statement for Guy to run. Then Guy checks each item on the live site, using its Open link.

## Ground rules

- **Branch `v0.8-smt-fb1` from current `main`, fetched over HTTPS.** Commit this prompt first. Use a worktree if the checkout is in use.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness.

  The only differences allowed are the ones above, listed by F-number.
- **Rule tests:**
  - **R-SCORECARD-ROWS-BY-TYPE;**
  - **R-TREND-PERIOD-PER-CELL;**
  - **R-INDEP-ENTRY-TILES** (Leighton Park, plus a through-school with Year 6, plus a state school unchanged);
  - **R-RAIL-HIDES-EMPTY;**
  - **R-MARKET-DEFAULT-RIVALS;**
  - **R-FEEDBACK-FOLLOWS-VIEW.**

  Regenerate `docs/catalogue/*.md`.
- **No database writes,** except that the session may **read** `feedback_for_triage`.
- **Never put a server key in client code.** Stage files by name. Push over HTTPS.
- **Log calls** under "2026-10-xx — SMT feedback round 1" in `docs/OPEN_QUESTIONS.md`, each tagged with its F-number.

## Report

Write `docs/v0.8/smt_fb1_report_v1.md`, by F-number. Include:
- what changed;
- before and after screenshots, Leighton Park SMT Overview, desktop and phone;
- Leighton Park's new tile figures;
- the calls;
- **the SQL to mark F-1 to F-8 done,** with the merge commit.

**Merge if clean:**

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-smt-fb1 -m "0.8 SMT feedback round 1: Scorecard rows and trends, independent entry tiles, map, empty views hidden, default rivals, entry tiles boxed" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

If the push is refused, give Guy the command. It goes live with a Render deploy.
