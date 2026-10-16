# VicData 0.8 — IGCSE schools: subject rankings for subjects taken as GCSE

Claude Code build prompt, written 16 Oct 2026, for the app repo (`~/dev/vicdata_public`), and for the ingest repo (`~/dev/vicdata`) only if its group aggregates use the same rule.

**Run it after the audit fixes and group rounds 2 and 3 are merged.** It refines the audit fixes' item 1. Every rank this round changes must be listed.

## The decision (Guy, 16 Oct)

The audit fixes left IGCSE schools out of **every** GCSE ranking. That was too broad. The problem is only with measures that are missing the subjects a school takes as IGCSE. From now on:

| Measure | IGCSE school |
|---|---|
| Whole-school GCSE measures (Attainment 8, English and maths 4+/5+/7+, EBacc, Progress 8, average points across all GCSEs) | **Left out of rankings**, as now ("not ranked at GCSE (IGCSE)") |
| A subject group (family or subject area) where the school took **any** of that group's subjects as IGCSE (e.g. Sciences & Maths without GCSE maths; English without GCSE English) | **Left out of that group's ranking**, and labelled in the school's own view: "Sciences & Maths (sciences only: maths taken as IGCSE)" |
| A single subject the school entered as GCSE 9–1 (e.g. Biology, Art & Design, Combined Science) | **Ranked like any other school** in that subject's rankings, sets, "10 nearest", maps and Comparisons |

## How "took a subject as IGCSE" is decided

There's no IGCSE data, so it has to be inferred. Use one shared function, beside the existing IGCSE flag:
- **English or maths:** an IGCSE-flagged school with no GCSE English language or maths entries in a year is taken to have sat them as IGCSE that year.
- **Any other subject in a group:** the group counts as complete only if the school has GCSE entries in every subject the group requires.
  - If the group's definition has no "required" subjects (most don't), it is incomplete only where English or maths is missing, as above.
  - Log which groups have required subjects.
- **Never infer** an IGCSE for a subject a school simply doesn't offer. Only English and maths, which every school teaches, are inferred from absence.

## Where it applies

Every GCSE ranking path: Teacher (Column 1, Comparisons, subject rankings, maps, "10 nearest", sets), SMT Academic, Admissions rivals' results, the public page, group Academic (school ranks within the group and nationally), and the group as a comparison set.
- **Population counts** say what's included, e.g. "of 3,412 schools with GCSE Biology entries".
- **"10 nearest" for a subject** counts schools with that subject as GCSE, so IGCSE schools come back in for their GCSE subjects.
- **The ingest's group aggregates:** if their subject areas apply the IGCSE rule school-wide (overnight call #8), apply the same rule there. Run a dry run, and give Guy the re-promote command. If the group figures change, list them.

## Follow-ups from the audit fixes (Guy, 16 Oct), in the same round

1. **A shorter IGCSE label.** The rank tile's label currently wraps to seven lines.
   - Use a short form everywhere a category name appears for that school: tiles, tables, chips, "…subjects" lists. For example "Sciences & Maths · no maths (IGCSE)" and "Languages & Literature · no English (IGCSE)".
   - Put the full sentence ("sciences only: maths taken as IGCSE") in the view's method/(i).
   - The tile must not grow beyond two lines.
2. **Ties everywhere:** shared places ("=") on rankings within a category too, not only the headline rankings. One shared ranking function, standard competition ranking.
3. **Births notes:** keep the two notes, each true for its entry point. Confirmed; no change.
4. **The rule test that failed once under load:** find out why it's flaky (timeout, ordering or shared state), fix the cause, and say what it was. Don't raise a timeout to hide it.

5. **Group legend overflow (from group round 2, on `main`).** With a long set name, such as the mix-matched label, the Trends legend pushes its footnote off the panel, and the Results-by-phase legend drops the comparison set's entry.
   - Legends wrap within the panel, and every series keeps its entry.
   - Long set names truncate with the full name in a tooltip, and in the (i).
   - Add a test with the longest real set label.

## Tests and parity

- **R-IGCSE-SUBJECT:**
  - Leighton Park (110110) is ranked in GCSE Biology, Chemistry, Physics, Art & Design and Combined Science;
  - it is not ranked in Attainment 8, English and maths, Sciences & Maths, or English;
  - its Sciences & Maths label says "sciences only: maths taken as IGCSE".
  - Check the same for The King's School Worcester.
- **R-IGCSE-EVERYWHERE** (from the audit fixes) narrows to whole-school measures and incomplete groups. Update its wording.
- **Parity:** the only allowed differences are subject-level ranks and counts that now include IGCSE schools for their GCSE subjects. List them by product, with counts and three examples, including Leighton Park's Biology rank before and after.

## Ground rules

As usual:
- branch `v0.8-igcse-subjects` from `main`;
- tsc, eslint, build, unit, rule, RLS, usage log, and every parity harness clean except the listed differences;
- no server key in client code;
- stage by name;
- no database writes (an ingest change is a dry run plus Guy's command);
- log calls under "2026-10-xx — 0.8 IGCSE subjects" in `docs/OPEN_QUESTIONS.md`.

## Report

`docs/v0.8/igcse_subjects_report_v1.md`:
- the inference function and the groups with required subjects;
- the parity differences;
- Leighton Park and King's Worcester before and after;
- any ingest change and its command.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-igcse-subjects -m "0.8 IGCSE schools: subject rankings for subjects taken as GCSE" && npm run build && git push
```
