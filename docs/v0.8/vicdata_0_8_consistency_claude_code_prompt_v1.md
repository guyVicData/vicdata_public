# VicData 0.8 — Consistency: roll words, set change, minus sign, flat band

Claude Code prompt for the app repo (`~/dev/vicdata_public`), written 17 Oct 2026. It settles the four calls left by the year-rules leftovers round (merged at 1d55bc6).

**Read first:**
- `docs/v0.8/year_rules_leftovers_report_v1.md`;
- its calls 6–11 under "2026-10-16 — year rules leftovers" in `docs/OPEN_QUESTIONS.md`;
- `src/catalogue/years.ts`;
- `src/lib/signed-delta.ts`.

## Decided (Guy, 17 Oct)

1. **Roll direction words use 3 years, everywhere.** "Growing", "shrinking" and "steady", and any arrow or word that describes a roll or headcount direction, compare the latest census year with 3 years earlier.
   - **Where it applies:**
     - SMT's direction words (`Lines.tsx` `direction`, which now uses the results rule);
     - Admissions' Momentum and its entry tile;
     - the group home;
     - groups r3's Growing/Shrinking;
     - anything else that words a roll direction. Find them all and list them.
   - **One shared constant and one helper,** in `years.ts` (rename `GROWING_SPAN` if needed). Groups already use 3 years, so they shouldn't change.
   - **If a school has fewer than 4 census years,** use the longest span it has, and say so in the (i).
   - **The "since" figures don't change:** they already agree, from the first census year (2019/20).
   - **The (i) states the rule:** "Growing or shrinking compares this year's roll with three years ago."
   - **The groups' "improved / steady / fell" thresholds** (1 point or 2 percentage points) are results thresholds, not roll words. Leave them.
2. **A set's "Candidates, % change" is the change in the set's yearly average,** in both modes. This matches Guy's audit-fix call ("change in the yearly average").
   - Subject mode currently averages each comparator's own change (last round's fix). Change it to the change in the set's yearly average entries.
   - Category mode currently uses the change in the set's summed entries. Change it to the change in the yearly average too.
   - Both start at the first year with entries (`changeStartFor`).
   - Check every other set "% change" in the app (results as well as candidates; Teacher, Data View, SMT, Admissions, groups). List each one and how it's calculated. Align any that differ only where the change is small and plainly the same measure. **Report the rest and don't change them.**
3. **The minus sign "−" everywhere.** The Data View and the SMT, Admissions and group tooltips that print a hyphen ("-3%") move to "−", through `signedDelta`'s style. After this, no figure in the app prints a hyphen-minus as a sign. A rule test checks it.
4. **A flat band for arrows: under 0.5% reads as steady.** A change whose absolute value rounds to 0 at the precision shown (e.g. under 0.5% for whole percents, under 0.05 for one decimal place) shows no ▲ or ▼, and prints "–" with the zero in that view's own zero style.
   - **Where it applies:** SMT's Now and Pupils tiles, SchoolTile, Context, GroupHome, Admissions' entry and market tiles, and any other arrow form. Find them all.
   - **One shared helper,** beside `signedDelta`, and every arrow uses it. The steady colour is neutral, not red or green.
   - **Roll direction words follow the same band** (a 3-year change that rounds to 0 is "steady").

## Also, small

- **Teacher's "Grade counts % change" table** (`grade-spread.ts`) measures from 2022/23, as grades should, but it sits beside Candidates, which runs from 2020/21. Keep the rule, but make the table's heading say "since 2022/23", and add one line to its (i) explaining why it starts later than entries.

## Ground rules

- **Branch `v0.8-consistency` from current `main`** (1d55bc6 or later, fetched over HTTPS). Commit this prompt as the first commit. If another session is using the checkout, work in a worktree: copy `.env` with `cp` without reading it, and use free ports.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness (Teacher, public page, Admissions, SMT, groups, Data View), with both trees' fixtures captured from the same data at the same time.
- **Allowed differences, listed with the reason for each:**
  - roll words on 3 years;
  - set candidates change on the yearly average;
  - "-" becomes "−";
  - steady in place of ▲/▼ 0;
  - the grade counts heading and (i).

  Anything else stops the merge.
- **Rule tests:**
  - **R-ROLL-WORDS-3YR**, with one school growing, one shrinking, one steady, and one with only 3 census years;
  - **R-SET-CHANGE-AVERAGE**, both modes;
  - **R-MINUS-SIGN**;
  - **R-FLAT-BAND**.

  Regenerate `docs/catalogue/*.md`.
- **Never put a server key in client code.** Stage files by name, and leave Guy's untracked files alone. No database writes. Push over HTTPS.
- **Log calls** under "2026-10-xx — consistency" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/consistency_report_v1.md`. Include:
- every roll-word place and its old span;
- every set "% change" found, how it was calculated, and what changed;
- every arrow form;
- before and after screenshots:
  - SMT Overview and Pupils (Leighton Park);
  - Admissions' Momentum;
  - a group home;
  - a Data View page with negative changes;
  - a tile with a sub-0.5% fall;
- the parity summary;
- logged calls.

**Merge if clean:**

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-consistency -m "0.8 Consistency: roll words on 3 years, set change on the yearly average, minus sign, flat band" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

Then remind Guy that the change goes live with a Render deploy.
