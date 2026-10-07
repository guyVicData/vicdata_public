# VicData 0.6.5 — Post-16 matched to GCSE

Claude Code build prompt. Guy approved the 0.6.4 audit's proposal on 7 Oct 2026 ("go"). One continuous pass, committing per stage.

**Read first:** `docs/v0.6/post16_vs_gcse_matrix_v1.md` (B1 matrix, B2 proposal, with file:line change points) and `docs/v0.6/v064_report_v1.md`.

**Already done, outside this repo:** matrix **change 2** (BTEC points 0.00 in 2021/22–2022/23) was fixed in the ingest repo. Production was rebuilt and verified on 7 Oct; for example, Croydon 130432 Business National Diploma is now 31.16 / 20.27. **Don't add an app-side zero guard.** Re-run the matrix's BTEC cells with the real figures, and update any rows that change.

## Ground rules (as 0.6.4)

- **Branch `v0.6.5` from `main`.** Commit per stage, with tsc, eslint, build, unit tests (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`), rule tests (`npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`) and parity (the 0.6.4 harness) all clean.
- **Change both drawing paths:** the config renderer and the legacy hosts.
- **The Data View must stay pixel-identical.** This includes the shared default-lists route: the Data View calls stay on today's path.
- **Never put a server key in client code.** No database change is expected; if one turns out to be needed, write it and leave it for Guy.
- **Pixel-perfect,** existing components and tokens, both themes, 1280 and 390.
- **Log calls** under "2026-10-07 — 0.6.5" in `docs/OPEN_QUESTIONS.md`.
- **Speed must not get worse.** Re-time the 0.6.4 C1 route replay for the routes you touch, and report before/after. Any new fetch runs in parallel with what's already there.
- **GCSE must not change at all:** parity on every GCSE state shows 0 differences.
- **Merge and push if** every Post-16 difference is on the expected list in S7, and GCSE / Data View are identical. **Stop before merging** if anything else moves, or for any RLS change, migration or Data View change.

## S1 — Grade bands opens on a default range at Post-16 (matrix change 1, option a)

- **Today:** GCSE opens Grade bands on 7–9. Post-16 opens with no range: Column 1 shows "Pick a grade range…", and Context and Comparisons fall back to points.
- **Add a default band for each Post-16 scale,** in the same place GCSE's lives (`src/lib/subject-grades.ts` `BAND_PRESETS` ~232–235; the hard-coded `"7-9"` in `src/lib/teacher-view-measures.ts` ~189):

  | Scale | Default band |
  |---|---|
  | A level | A*–A |
  | AS level (no A*) | A–B |
  | IB subject (7–1) | 7–6 |
  | Vocational, single | Distinction*–Distinction |
  | Vocational, double | D*D*–DD |
  | Vocational, triple | D*D*D*–DDD |
  | T Level | Distinction*–Merit |
  | Core Maths (A–E) | A–B |
  | EPQ | A*–A |

- **Use the scale-detection code that already exists** (the 0.6.3 "scale from the qualification type" safeguard). Don't add a second detector.
- **The default applies only when no band is saved** (`band:range`). A saved range wins, as at GCSE.
- **When the focus changes to a qualification on a different scale**, a saved range that doesn't exist on the new scale falls back to that scale's default, with no stale range and no blank panel. Say what happens today, and make it this.
- **The single-grade choice and the 0.6.3 Grade counts click** are unchanged.
- **Update the catalogue:** `src/catalogue/measures.ts` ~103 ("No presets" text) and its rule test. Regenerate `docs/catalogue/*.md`.

## S2 — A*–E only where it means something (matrix changes 3 and 4)

- **Change 3:** for a focus on a non-A-level scale (BTEC / OCR, IB, T Level, Pre-U), **grey the "A*–E" option in the top bar's Results switch** with a short reason on hover, in the existing greyed-option style: *"A*–E applies to A level, AS, Core Maths and EPQ grades."*
  - If A*–E is the saved measure when the focus moves to such a qualification, show Average points for that focus. **Don't overwrite the saved choice**: moving back to an A level brings A*–E back.
  - Keep the existing 0.6.3 note in the panels as the fallback.
- **Change 4:** **keep** A*–E for Core Maths and EPQ (they use A–E letters; for them A*–E is the pass rate). Log it.

## S3 — Comparisons and maps use the exact qualification (matrix change 5)

- **Today:** Column 1 uses the exact qualification, but Comparisons and the maps use the qualification **bucket**:
  - A level with AS;
  - every BTEC size together;
  - IB HL with SL.

  So they disagree: Croydon Maths 2024 shows 21.45 in Comparisons against A level 24.00; Sevenoaks Maths shows IB 46.76 against HL 49.07 / SL 41.17.
- **Change:** at Post-16, read comparator schools' figures for the **exact qualification** in focus. Use `fetchSubjectQualificationHeadlineForSchools` for the set, as rates already do, and apply it to:
  - points, entries and share, in Column 3 Current and Trends (map, bar, ranking, chart, trend table, trend map, change map, change table);
  - Column 1's Trend map (`TeacherDashboard.tsx` `column1MapSeries` ~1673–1717);
  - the comparator series (~1121–1137, ~1571–1583).
- **Then** Column 1, Comparisons and the maps show the same figure for the school, and the rank N of M agrees.
- **The AS / AEA note goes** wherever exact figures now exist. A note stays only where the set genuinely has no school with that exact qualification ("No school in this set has GCE AS level Law entries"), in the existing note style.
- **Labels name the exact qualification:** "AS level", "BTEC Extended Diploma", "IB Higher level", not the bucket label (`TeacherDashboard.tsx` ~1137 and ~2285; `qualificationShortLabel`, `teacher-view-theme.ts` ~99–100). This also fixes the matrix's AS label accident.
- **Context (Column 2) is not changed by this stage.** Its family gating stays as it is.
- **Catalogue:**
  - update R-POINTS-SAME-QUAL so its statement and test cover Comparisons and maps at Post-16;
  - remove the "bucket figures at Post-16" wording if 0.6.4 added any (DV-C3-CUR-MAP note ~914, DV-C1-RES-TR-MAP `rules` ~459);
  - remove the stale knownGap at `measures.ts` ~349.
- **Speed:** this adds one fetch per set. Run it in parallel, and cache it under the existing 5-minute fetch cache keyed by school set + subject + qualification. Report the timing.

## S4 — Post-16 default comparison set (matrix change 6)

- **Today:** the default "nearest 10" at Post-16 is the GCSE nearest 10, so few comparators share a Post-16 qualification (3 for King's A level Maths, 1 for Sevenoaks IB, 0 for Croydon AS Law).
- **Change:** on the Post-16 phase, the default set is **the 10 nearest schools and colleges with Post-16 provision**. Use `hasPost16Provision`, or the source behind the existing "Schools and FE colleges, 16+, in [LA]" list (`chooser-sets.ts` ~70–75; `default-comparator-lists.ts` ~728–744).
  - Use the same distance rule as GCSE's nearest 10, and the same 0.6.4 `only: "nearest"` fast path.
  - **The Data View's default-lists call must be unchanged.**
- **GCSE keeps its own nearest 10.** A member's **saved** sets are never altered.
- **The chooser's name for it:** "10 nearest with a sixth form or 16+ provision". Keep it short if a word budget exists; log the wording.
- **The 0.6.4 prefetch** of the other phase must fetch the Post-16 set, not the GCSE one.
- **Report the comparator counts** that share the focus qualification, before/after, for King's 117037 A level Maths, Sevenoaks 118952 IB Maths HL, Croydon 130432 Business (BTEC Extended Diploma) and Croydon AS Law.

## S5 — Headline ranking note for schools with no A levels (matrix change 7)

- **Today:** the Post-16 ranking headline is A-level points per entry, so IB-only schools and FE colleges without A levels get an empty or hollow figure.
- **Change:** where the school has no A-level entries, the ranking tile and its rank chip show a note in the existing empty-state style instead of a figure: *"[School] has no A-level entries. Post-16 rankings use A-level points per entry."*
- **A per-family headline is out of scope.** Log it as a later option.

## S6 — Per-family notes and small fixes (from the matrix)

- **T Level with grades published only for all pathways together** (Croydon 130432): where a T Level focus has no per-pathway grade or points rows but the school has T Level entries, the panels show *"DfE publishes this college's T Level results only for all pathways together."* Don't show an empty chart.
- **AS in Context:** the AS group is "Other", so on points AS has only itself. Add the existing small-group note if one exists; otherwise log it and leave it.
- **IB Diploma total:** it stays out (R-IB-NONSUBJECT). No change.
- **Re-check every ✗ and ~ cell in the matrix after S1–S5,** and update `docs/v0.6/post16_vs_gcse_matrix_v1.md` to v2 (`post16_vs_gcse_matrix_v2.md`, with v1 kept), showing what's now ✓ and what remains and why.

## S7 — Parity and expected changes

Run the 0.6.4 parity harness on main against the branch:
- schools: 5 schools plus 117037, 118952, 130432 and 130416 on Post-16;
- every Results measure and the Candidates measure;
- 1280 and 390, both themes.

**Expected Post-16 differences only:**

1. Grade bands opens on the scale's default range. Context and Comparisons on bands now draw bands instead of falling back to points.
2. "A*–E" greyed for non-A-level foci, and Average points shown in its place.
3. Comparisons and maps show exact-qualification figures, ranks and labels; AS / bucket notes are removed where exact data exists.
4. The default Post-16 comparison set changes to schools with Post-16 provision, so every Comparisons figure and map on the default set changes.
5. The no-A-level headline note.
6. The T Level note.
7. BTEC 2021/22–2022/23 points now real. This comes from the ingest rebuild, not this branch: make sure main's baseline is taken **after** the rebuild, so it doesn't count as a branch difference.

**Must be identical:**
- every GCSE state;
- the Data View;
- every Post-16 Candidates figure in Column 1;
- every Column 1 Post-16 points figure.

## Report

Write `docs/v0.6/v065_report_v1.md`, with:

- what changed, stage by stage;
- before/after screenshots for:
  - King's Worcester A level Maths (Grade bands default; Comparisons map);
  - Croydon Business BTEC (A*–E greyed; exact figures in Comparisons; points trend 2021/22 onward);
  - Croydon AS Law (labels; note);
  - Sevenoaks IB Maths HL (exact HL in Comparisons; ranking note);
  - Christ The King 130416 T Level Health;
- comparator counts before/after (S4);
- speed before/after;
- parity;
- logged calls;
- a click-through for Guy.

**Merge if clean, and push:**

```
git checkout main && git pull && git merge --no-ff v0.6.5 -m "0.6.5 Post-16 matched to GCSE" && npm run build && git push
```

Tell Guy to wait for Render's "Deploy live", then hard-refresh.
