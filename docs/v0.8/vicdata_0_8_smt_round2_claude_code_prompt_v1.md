# VicData 0.8 — SMT round 2: Pupils, Context, and round 1's snags

Claude Code build prompt, written 13 Oct 2026, for the app repo (`~/dev/vicdata_public`). **Run it before Thursday's GCSE 2025/26 ingest** (that ingest is in the ingest repo; nothing here depends on it, and everything here reads years from `src/catalogue/years.ts`, so 2025/26 lands on its own).

## Read first

- `docs/v0.8/shell_smt_r1_report_v1.md` (what round 1 built, its audit table, its logged calls) and `src/components/shell/README.md`.
- The spec, `docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md`, §2.3 (Pupils, Context) and §2.4.
- The wireframes: `docs/wireframes/smt/Pupils.dc.html` and `Context.dc.html`. **Pixel-perfect, both themes, real tokens**, with round 1's adjustments (the data's subject families; the shared Leaflet map; no labels before chips).

## Ground rules

As round 1: branch `v0.8-smt-r2` from `main`; commit per stage; tsc, eslint, build, unit, rule, RLS (111), usage-log test, Teacher parity (2,875) and Admissions parity (328) clean; no server key in client code; stage by name; leave Guy's untracked files alone; database changes written and tested, never applied (commands as `&&` chains with the project-ref check, no `exit`); log calls under "2026-10-xx — 0.8 SMT r2" in `docs/OPEN_QUESTIONS.md`.

**Deliberate parity differences allowed in this round: only S1's fix**, if it changes Teacher. List every differing pair with the reason; anything else stops the merge.

## S — Round 1's snags (do these first)

1. **Science Double Award isn't ranked and has no average grade** (The Chase: 170 entries, Academic → GCSE → Sciences & Maths shows "—" and "not ranked"). Find why: almost certainly the double award's grades (9-9 … 1-1) or its two-entry counting don't map to points in the subject-ranking path.
   - Check whether **Teacher's subject explorer has the same gap** for Combined science at The Chase and two other schools.
   - **Fix it at the source** (the shared grade-to-points or ranking function), using DfE's convention: a double award counts as two entries, each worth the average of its two grades (9-8 → 8.5). Average grade and rank then follow.
   - If the fix changes Teacher, those pairs are the only allowed Teacher differences; list them.
   - Same check for any other double-graded or non-9–1 qualification that shows "—" (e.g. Additional Maths FSMQ is a different scale: say "different grading scale, not ranked" rather than "—").
2. **The "Results by band" placeholder says "of pupils".** The bands are of **entries**, not pupils. New caption: "Arrives with the results-by-band round: the top 25%, middle 50% and bottom 25% of entries." Lock it in `SMT_NOTES` with a rule.
3. **Entries mix shows only 2023/24 and 2024/25**, while the trend beside it runs from 2021/22. The year rules say change in entries counts from the first year with data. Show every year the data has (2021/22 onward), and add a rule test.
4. **The GCSE column-1 tile grid** has three tiles and a gap (the wireframe has four). Either add "Rank in the set" as its own tile (moving it out of the average-grade tile's caption) or let the last tile span both columns. Pick the one that matches the wireframe; check Post-16 and Whole school the same way.

## P — Pupils (the `Pupils` board)

- **Route** `/teacher/smt/pupils`; the switch now shows Overview · Academic · Pupils.
- **Column 1, "Your pupils now":** roll; change since 2019/20; girls · boys (mixed schools); day · boarding (boarding schools only); staying on at 16 (Year 11 → Year 12, where the school has both); size by phase XS–XL; the line "Context: {size} for {LA}".
- **Large view rail** (all reused, read-only where they come from Admissions):
  - **Shape and size** (default): pupils by year group, the shape label, and "Shapes around you" (the LA's schools of the same type, the comparison set's shapes, staying-on in the set). **Described, never ranked.** Reuse the public page's Shape card and Admissions' Shape and size view.
  - **Entry points at a glance:** each of the school's entry points with its cohort and pool, from Admissions, with "Open in Admissions". Empty state with the reason where Admissions has no entry points set.
  - **Leaving at 16:** Admissions' 16+ leaving view.
  - **Market share:** Admissions' market share, read-only; the round 1 empty state where no rivals are set.
- **Row 2:** roll by phase indexed (2019/20 = 100) against England; the pool for the main entry point (Admissions' pool trend, counted then from births); the area's school-age population (ONS ages 5–15, LA). Captions say what each line counts.
- **Filters:** the day/boarding and gender pills apply to roll figures, as in round 1.
- **Level chips:** Pupils follows them (GCSE → ages 11–16 rows highlighted; Post-16 → 16–18; Primary → 4–11). Say so in a rule.

## C — Context (the `Context` board)

- **Route** `/teacher/smt/context`; the switch now shows all four.
- **Column 1, "The area now":** children of the school's main ages around the school; births last year and since 2012; the ONS projection for those ages; the number of schools nearby (all sectors); the place line (district · LA · region).
- **The data gap, shown honestly:** a dashed block "Deprivation and free school meals: not yet in VicData" with the planned sources (Indices of Deprivation by LSOA; DfE school-level free-school-meals data). From `SMT_NOTES`.
- **Large view rail:**
  - **Map** (default): the area shaded by children of the school's ages. **Audit the geography first:** use LSOA if population by single year of age exists at LSOA in production; otherwise MSOA; otherwise say "shading by district" and use LA/district. Log which. The school in the SMT accent, other schools in grey (the shared Leaflet map). The "Shade by" pill lists only what exists (deprivation appears there later).
  - **Population by age:** single years, the school's ages highlighted.
  - **Births and projections.**
- **Row 2:** births indexed (LA against England; "births are by local authority"); the secondary- (or primary-) age projection to 2036 ("a projection, not a forecast for the school"); population by single year of age.
- **Area pill:** "Area: around the school" · district · LA, as a filter pill (the wireframe). "Around the school" uses the existing radius the public page and Admissions use; log the radius.

## Both

- **Every view is a catalogue entry plus a component in the shell**, with R-* rules (years from `years.ts`; boarding-only and mixed-only pills; Admissions-sourced views read-only with their empty states; the data-gap block present).
- **Panel chrome, notes, flags, Edit, Copy this view…, the usage log scope** as round 1.
- **The SMT home card:** Pupils and Context become live chips.
- **The seed:** extend `scripts/dashboards-seed-sql.ts` for the two new dashboards, and give Guy the re-seed command.

## Report

`docs/v0.8/smt_r2_report_v1.md`: the snags (with S1's cause, fix and any Teacher pairs that changed), the Pupils and Context audit (each panel's table/route, years, coverage), the map geography chosen, differences from the wireframes, screenshots (`docs/v0.8/smt_r2_screenshots/`: The Chase and Leighton Park, Pupils and Context, both themes, 1440 and 390; the fixed Sciences table), logged calls, the re-seed command.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-smt-r2 -m "0.8 SMT round 2: Pupils, Context, round 1 snags" && npm run build && git push
```

Stop before merging if Teacher differs beyond S1, if Admissions or the public page differ, or if anything needs RLS.
