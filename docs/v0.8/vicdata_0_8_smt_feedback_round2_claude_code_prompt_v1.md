# VicData 0.8 — SMT feedback round 2: the selected set drives SMT Overview (F-9 to F-11)

Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 18 Oct 2026 from Guy's feedback items F-9 to F-11. Read them in full with `select * from feedback_for_triage where number between 9 and 11` (read-only). They follow round 1 (merged at 41c4d26 / d443414). **This finishes SMT Overview for now.**

## The principle (Guy, 18 Oct)

**The comparison set chosen in the bar drives the whole SMT Overview dashboard.** Guy viewed Leighton Park with "10 nearest with a sixth form or 16+ provision". Every comparison on the dashboard should be with that set, and the set's name should say so, not the LA, Reading, England or another set.

**The one exception:** the Scorecard's **ranks** in the South East and England (round 1, F-3) stay. Guy asked for those explicitly. They are ranks, not comparison lines.

## The work

1. **F-9, From Admissions → Market share.** The rivals are the **selected comparison set**, the same set the map and tables use. This replaces round 1's F-7 default (Admissions' 10 nearest teaching Year 7).
   - If the school's Admissions team has chosen its own core set, the SMT view still uses the dashboard's selected set.
   - The view's tag and (i) name the set.
   - Log this as a call ("SMT market share follows the selected set, not Admissions' chosen set").
2. **F-10, Current → The school now, size by phase (XS to XL).** Compare each phase with the **selected set**, not "schools of that phase in Reading and nationally (the school page's Roll by phase)".
   - Say how the size bands are formed within a small set (e.g. 10 schools), or switch to a clearer form (rank in set, or larger or smaller than the set's median), and log the choice.
   - The (i) explains it.
3. **F-11, Trends → Roll, indexed.** Compare with the **selected set**:
   - the school's line;
   - **the set's average day trend;**
   - **the set's average boarding trend, as a grey dotted line,** when the school or the set has boarders.

   **Remove the England and Reading lines.** Indexed from the same base year as now, using the same filters (sex, boarding).
4. **Audit every other view on SMT Overview** (Scorecard, Map, Flags, Results trend and table, Roll table, Market table, The school now). Any comparison not with the selected set changes to it, except the Scorecard ranks. List each view, what it compared with before, and what it compares with now.
5. **Tidy-ups from round 1's checks:**
   - **The entry tiles' %** says what it's about: "Net change at 16: +3 · Year 12 +10% since 2019/20" and "Joining at 11: 57 · Year 7 +21% since 2019/20" (likewise "Net change at 11"). Keep the tile simple; the detail goes in the (i).
   - **SMT Pupils' "Leaving at 16" (−3) against Overview's "Net change at 16" (+3)** for the same fact. Make the Pupils view's (i) and Overview's (i) each say how the figure relates to the other, so the opposite signs aren't puzzling. Leave the Pupils view's design for its own review.
   - **The map's labels** stay on hover (Guy hasn't asked otherwise).

## Tests

- **R-SMT-SET-DRIVES-OVERVIEW:** with the set changed (10 nearest → Local rivals → a saved set), every SMT Overview view's comparison follows it; the Scorecard ranks don't.
- **R-ROLL-INDEXED-SET:** the set's day and boarding averages are drawn (boarding grey dotted) for Leighton Park, and there are no England or Reading lines. A non-boarding school with no boarders in its set has no boarding line.
- **R-MARKET-FOLLOWS-SET.**

Update R-MARKET-DEFAULT-RIVALS from round 1.

## Ground rules

- **Branch `v0.8-smt-fb2` from current `main`** (d443414 or later, fetched over HTTPS). Commit this prompt first. Use a worktree if the checkout is in use.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness.

  The only differences allowed are on SMT Overview's views above, plus the (i) texts named in item 5. Teacher, Admissions, groups, the Data View and the public page stay unchanged.
- **No database writes.** You may read `feedback_for_triage`.
- **Stage files by name. Push over HTTPS.**
- **Log calls** under "2026-10-xx — SMT feedback round 2" in `docs/OPEN_QUESTIONS.md`, tagged by F-number.

## Report

Write `docs/v0.8/smt_fb2_report_v1.md`. Include:
- the audit table (item 4);
- before and after screenshots of Leighton Park SMT Overview, with the set changed twice;
- the calls;
- **the SQL to mark F-1 to F-11 done.** F-1 to F-8 use 41c4d26; F-9 to F-11 use this merge commit.

**Merge if clean:**

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-smt-fb2 -m "0.8 SMT feedback round 2: the selected comparison set drives SMT Overview" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

If the push is refused, give Guy the command. It goes live with a Render deploy.
