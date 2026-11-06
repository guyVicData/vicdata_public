# VicData 0.8: Admissions feedback round 2 (F-31, F-36) and two feedback-system fixes

A Claude Code prompt for the app repo (`~/dev/vicdata_public`) and the app database (`lnhulykjlxmoneappnsp`). Written 6 Nov 2026 from Guy's decisions the same day. It starts from `main` at `5fe846e`, the feedback deploy gate, which is live.

This is the first round run under the new gate, so its closing steps follow the commands template in `docs/FEEDBACK.md` in full. Read `docs/FEEDBACK.md` first.

## The items

Read them with `select * from feedback_for_triage where number in (31, 32, 36)`. Each one's triage note is part of the brief.

### 1. F-31: "Why did our intake change?" rebuilt (`DV-ADM-P-FUNNEL`, `src/lib/admissions/intake-change.ts`, `intake.ts`, `views/Funnel.tsx`)

**F-31 is mis-filed.** Its record says "Your cohort, girls and boys" at 11+. Its text and page address (`entry=16+`) are about this waterfall at 16+. See item 3. Its triage note holds the design Guy agreed on 6 Nov, with a mock-up. In short:

- **Five columns, two of them steps:**
  1. **Your Year 12** (Year 7 at 11+), base year, as now.
  2. **Cohort size, a step.** The local population at the age a year below entry:
     - 15 at 16+, 10 at 11+, and so on;
     - in the mid-year before entry;
     - over the same LSOAs as now.

     The label is "local 15-year-olds: 6,600 → 8,100 (+23%)", with the real counts.
  3. **Families moving: "of which", not a step.**
     - It's drawn hollow and dashed beside the cohort bar, level with its top. It doesn't move the running total.
     - The label is "moved in since age 8 (net): +700 → +800".
     - It shows how much of bar 2 came from families moving.
  4. **Your share, a step:** "of the local 15-year-olds: 1.2% → 1.1%".
  5. **Your Year 12,** latest year, as now.

  Under the chart: "82 + 17 − 9 = 90". Keep the line saying where the bars start.
- **The maths:**
  - The steps are the existing log-mean (LMDI) split, now of **entry = local cohort × share**: two factors, not three. Keep largest-remainder rounding, so the rounded steps add up to the rounded change exactly. Keep the small-intake 3-year averaging.
  - **"Of which" splits bar 2,** using local cohort = here at the earliest age + moved in (net):
    - bar 2's value is shared between the two in proportion to each one's change from the base year to the latest;
    - round so the two shares add up to bar 2;
    - draw the moved-in part.
  - **When the two changes have opposite signs** (e.g. the year group grew but more families left), still draw both parts, signed, with the net equal to bar 2. Propose how it looks, and log the call.
- **The earliest age:**
  - **At births:** where the LSOA years reach the base cohort's birth year, use age 0. The labels then read "born here" and "moved in since birth".
  - **Where they don't** (16+ today, where the ONS small-area data starts in mid-2011): use `birthsAge`. The labels then read "here since age 8" and "moved in since age 8".
  - The (i) says which applies and why, in one sentence. Keep the current long sentence about mid-2011 only in the (i), not on the chart.
- **"Moved in" is net.** When it's negative, the label reads "moved out since age 8 (net): −…".
- **Rewrite the note under the chart.** It currently explains boarding, not the waterfall. The boarding caveat moves into the (i).
- **Update everything that describes the method:**
  - the method text (`methods-admissions.ts`);
  - R-ADM-VIEW-INTAKE-CHANGE and its tests;
  - the regenerated catalogue docs.
- **Figures change for this view only.** It's an allowed parity difference. List the old and new bars for Leighton Park at 11+ and 16+, and for two other schools: one where families are moving in, one where they're moving out.

### 2. F-36: "You and the rivals" in full screen, a school each, with a key (`DV-ADM-M-VS-LINE`, `views/Lines.tsx`)

Guy: "full screen is NOT doing per school with a key as expected."
- **Do what F-20 did for "Entry age band roll"** (`Lines.tsx`, from line 337, and the labelled gridlines in `charts.tsx`):
  - in the panel: you against the rivals' average, as now;
  - in full screen: you and each rival, each in its own colour, with a key and labelled y gridlines;
  - leave out small rivals by F-20's rule, and name them under the chart.
- **Share the code with F-20's roll,** don't copy it.
- **List every other Admissions line view with rivals** that would benefit from the same full screen. Apply it to those that clearly fit (same data shape), and log the rest in OPEN_QUESTIONS.

### 3. The feedback window files items against the right view (`src/components/feedback/store.ts`, `FeedbackWindow.tsx`)

**What happened (6 Nov).** Guy opened the window on "Your cohort, girls and boys" at 11+, then changed the entry point to 16+ and moved to "Why did our intake change?" in another panel. When he sent F-31:
- the view and the recorded `state` (entry 11+) were the ones from when the window opened;
- `page_query` was the current one (`entry=16%2B`).

So one item contradicts itself. F-32, a "Looks good" sent straight after, may be mis-filed the same way. Find out, and say so in the report.

**The fix:**
- **On Send, the item's state and page come from the moment of sending,** with the view the window is tied to. If they no longer belong to that view (the dashboard, panel or entry point changed), the window must say so before sending.
- **When the view changes, the window offers the move.** `movedView` already offers "Move to …" when the rail changes inside a panel. Extend it to:
  - another panel on the same dashboard;
  - a change of entry point or set that changes what the view shows.

  Also make the window's header always name the view it's tied to, with its entry point (e.g. "Shape and size · 16+").
- **Never record a contradictory item.** The server refuses an insert whose `state` and `page_query` disagree on dashboard or entry. It returns a clear message, and the window shows it.
- **Test, R-FEEDBACK-FOLLOWS-VIEW (extend the existing test):** open on view A at 11+, switch to 16+ and to view B in another panel; the window offers to move to B; on Send, the item is B at 16+, or A at 11+ if Guy declined; never a mix.

### 4. Auto-close also counts a "Looks good" on a view the fix added

**What happened (6 Nov).** F-16 ("add a girls and boys graph") and F-21 ("repeat this graph… share of 11–15") were fixed by **new** views. Guy's "Looks good" went on those new views, so the auto-close (`feedback_items_live_check`), which matches only the item's own view and school, missed both. Claude closed them by hand.

**The fix:**
- **A new column, `resolved_views text[]`,** holding the view keys a fix added or changed, beside the item's own.
  - It's set by `scripts/feedback-set-fixed.sh`, with a new option: `--view <view_key>`, repeatable.
  - The inbox can also set it, in the triage fields.
  - It's a triage field, so it follows the existing update rules.
- **`feedback_items_live_check`:** a platform admin's "Looks good" closes a deployed item when it's on the item's own view **or on any of its `resolved_views`**, at the same school, after `deployed_at`.
- **`feedback_for_triage`** gets `resolved_views`, appended at the end.
- **Docs:** `docs/FEEDBACK.md` "Closing an item" and the reports' set-fixed step say when to pass `--view`.
- **PGlite cases:**
  - a "Looks good" on a resolved view closes the item;
  - one on an unrelated view doesn't;
  - a non-admin can't set `resolved_views`.

### 5. The migration step in the commands template

**What happened (6 Nov).** In the deploy-gate round, step 1 ran `supabase migration repair --status applied <version>`. Its migration file was only on the branch, so on `main` it failed with "file does not exist". The migration had applied, but it wasn't recorded until Claude added the row by hand.

**The fix:**
- **In the template's step 1,** replace the repair with an idempotent insert:

  ```
  supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('<version>', '<name>') on conflict (version) do nothing"
  ```
- **Then show the recorded row.**
- **Update the rule test on report command order** if it checks the wording.

## Ground rules

- **Branch `v0.8-admissions-fb2` from current `main`, fetched over HTTPS.** Commit this prompt first. Work in worktrees for parallel parts if you like, as last round.
- **These must be clean:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; every parity harness.
- **Allowed differences:**
  - F-31's waterfall (labels, bars, the "of which", the note);
  - F-36's full screen and any views it extends to;
  - the feedback window's header and move offers.

  No other figure changes.
- **No database writes.** The migration (for `resolved_views`, the live-check change and the insert check) is written and tested in PGlite, and Guy applies it.
- **No republish unless a published dashboard config changes.** If one does, the republish goes after step 4 (the guard enforces it).
- **Never put a server key in client code.** Stage files by name. Push over HTTPS.
- **Log calls** under "2026-11-06 — Admissions feedback round 2" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/admissions_feedback_round2_report_v1.md`. Include:
- **F-31:** before and after screenshots of the waterfall (Leighton Park at 11+ and 16+, plus the moving-in and moving-out schools), light and dark; the old and new bar values; the (i) text.
- **F-36:** screenshots in the panel and in full screen; which other views got the same treatment, and which were logged.
- **The feedback window:** F-32's attribution; the new move offers; the server check.
- **Auto-close:** `resolved_views` and the PGlite counts.
- **Tests and parity.**
- **Guy's commands, in the template's order,** with:
  - step 1 using the new migration-record insert;
  - step 6 setting fixed **F-31** (with `--view` for the funnel), **F-32** only if it needs a fix, and **F-36** (with `--view` for each view extended);
  - step 7 listing the views to give "Looks good" on, and the entry point for each.

**Merge only after Guy has applied the migration.**
