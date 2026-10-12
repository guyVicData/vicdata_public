# VicData 0.7 — Admissions in the editor, stages 1–2: make the editor honest, then make the views draw their options

Claude Code build prompt, written 12 Oct 2026. It builds stages 1 and 2 of `docs/v0.7/admissions_editor_plan_v1.md` (round 3's F6 plan). **Read the plan in full first**, especially §1.3 (the gaps), §2, §3 (the catalogue table) and §5.

## Guy's decisions on the plan's ten questions (12 Oct)

All ten recommendations are accepted. Question 3 has one addition:

1. Look and compare options that don't draw are **hidden** until they do (a).
2. Any view can go in any panel, **with a warning** when a view that needs two columns goes into one (a).
3. Admissions spans: (a), column 1 one unit, columns 2–3 one large view, no full-width span.
   - **Guy adds:** the large 2–3 view's **full-screen** must be a proper focus mode (see S1.5).
4. Column-1 tiles stay fixed. Column 1 may hold a rail (a). Choosable tiles come later.
5. The preview size switch is Admissions only first (a). Teacher follows in its own small round.
6. Admissions views on other dashboards come later (stage 5), and only on SMT and Admissions dashboards (b).
7. On another dashboard, the entry point is pinned per view (a).
8. The flag list becomes its own view (a), in stage 2.
9. The funnel offers no compare chips. Its area follows the lead's blend (a).
10. Only platform admins edit the published Admissions dashboards in 0.7 (a).

Write these into the plan's §5.3 as "Decided (Guy, 12 Oct)".

## Ground rules

- **Branch `v0.7-admissions-editor-s1-2` from `main`.** Commit per stage, with tsc, eslint, build, unit tests, rule tests, the RLS test (111) and the parity harness all clean.
- **Teacher stays byte-identical:**
  - the full harness (2,875 pairs);
  - the Data View and the public page;
  - Teacher's editor tests (`src/lib/editor-ops.test.ts`, `src/lib/view-editor.test.ts`, `scripts/catalogue-unit-tests.ts`), which pass unchanged except Admissions-only tests.
  
  Every change is behind an Admissions host or file, as the plan says.
- **Build an Admissions parity pass first, before any stage 2 change** (plan §5.1, stage 2): every view × 11+ / 16+ × both themes × 1440 / 390, for The Chase 137625, King's Worcester 117037 and Beaudesert Park.
  - The published Admissions config must draw **byte-identically** before and after stage 2, because every look defaults to today's preset.
  - Report the pass count.
- **Never put a server key in client code.** Stage files by name; never `git commit -a`. Leave Guy's untracked or modified files alone. Use timeouts and progress logs.
- **No database changes are expected.** If one is needed, write it and test it, but don't apply it.
- **Log calls** under "2026-10-12 — 0.7 admissions editor s1–2" in `docs/OPEN_QUESTIONS.md`.
- **Merge and push if clean.** **Stop before merging** if any Teacher pair, Teacher editor test or Admissions parity pair changes unexpectedly. If a push fails, give Guy the command (he pushes over HTTPS).

## Stage 1 — Make today's editor honest (plan gaps 6, 7, 8 and 1)

1. **The preview** follows the Entry point pill and draws at the panel's real width, including the 2–3 span (gap 7).
2. **Copy out** from an Admissions dashboard offers **meetings only**, not Teacher dashboards (gap 8).
3. **The page honours `defaultViewByState`** per entry point (gap 6).
4. **Hide look and compare controls that don't draw yet** (gap 1, decision 1). They come back one by one in stage 2 as each is wired, and none may be visible without an effect.
5. **The large view's full screen (Guy, decision 3):**
   - it uses F1's full-screen icon;
   - it opens the large view **with its rail, the entry-point chips, the notes icon and the ⋯ menu**, so the user can switch views and entry points without leaving focus;
   - it fills the window at desktop sizes, with Esc and the icon to close;
   - the same works on every row-2 panel and on column 1;
   - on a phone it's the existing tab layout, full screen;
   - check it in both themes, at 1440 and 1920, and on a 16:9 projector size (1280 × 720).
6. **The move warning (decision 2):** moving a view that needs two columns into a one-unit panel shows "This view needs two columns; at one it crushes its columns", in the move dialog and in Preview.
   - **Until stage 3 fixes gap 3,** moving a view to **another row** is **blocked** for Admissions, with "Move between rows comes in the next editor round". This stops the silent remapping (funnel → Share needed).
   - Moving within a row stays allowed.

## Stage 2 — The renderer reads the instance (plan §2.2, §3; gaps 1, 2 and 9)

1. **`viewBody(instance, …)`:** each Admissions view takes its look options as props, **defaulting to today's preset**. Wire every look in §3's "proposed" column.
2. **The compare chips narrow the drawn sets** (day feeders / boarding feeders / both / rivals / area). **Boarding chips never appear for a day school** (F2's rule). Run R-ADM-BOARDING-ONLY-WHERE-BOARDERS against the editor preview too.
3. **The funnel has no compare chips** (decision 9).
4. **The flag list is its own component** (`DV-ADM-M-FLAGS`, decision 8). It fits a row-2 panel and a one-unit slide cell.
5. **Step 2 shows look boxes for every kind that has options.** Bring back each control hidden in stage 1 as it's wired.
6. **Locked by rule, not editable:** certainty styling, honesty wording, flag thresholds and "shapes not ranked" stay locked (`ADMISSIONS_FIXED` names the rule ids).
   - **Add a rule test:** every Admissions view, under every look combination, still renders its R-ADM wording from `ADMISSIONS_NOTES`. A look option must never switch a note off.

## Report

Write `docs/v0.7/admissions_editor_s1_2_report_v1.md`, with:

- what was built per stage;
- the Admissions parity pass, before and after;
- Teacher parity and the editor tests;
- full-screen screenshots of the large view (both themes, 1440, 1920 and 1280 × 720);
- the look options now live, as a table of view × option;
- logged calls;
- a short click-through for Guy.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.7-admissions-editor-s1-2 -m "0.7 Admissions editor stages 1-2: honest editor, focus full screen, views draw their options" && npm run build && git push
```
