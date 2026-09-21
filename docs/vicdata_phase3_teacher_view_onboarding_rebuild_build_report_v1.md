# Teacher view — onboarding rebuild + shared list styling (Round B) — build report

Covers `vicdata_phase3_teacher_view_onboarding_rebuild_brief_v1.md`. Built against the step mockups themselves (`GCSE-Step1..4.dc.html`, `Post16-Step1..3.dc.html`, read from the Design artifact) and wired to the platform's real taxonomy, not the mockups' demo arrays.

Untouched, as the brief requires: Round A (home page, dashboard grid), card content, `CardBox`, `ColumnBuilder`'s pinning logic (its diff is one colour prop on the list items), the delta colours and the GCSE results anchor. **KS2 onboarding is also unchanged.** Every pupil sits the same tests, so KS2 has no qualifications or subjects to pick, and its existing four-step walkthrough is kept as-is.

## The four steps (GCSE and Post-16, `!onboarded` in `[phase]/page.tsx`)

The onboarding `<main>` now carries `#teacher-root`, the stored theme and the phase accent, so it uses the same tokens as the dashboard. Every step has the mockup's "← Back" link, the accent "GCSE · Step N of 4" label, a 20px heading, a muted intro and the full-width accent button ("Next — choose your subjects" … "Done — take me to GCSE").

**Step 1 — qualification families** (`QualificationFamilyTiles.tsx`). The tiles are real data:
- **Post-16** uses `bucketFor` over the existing `KS5_BUCKETS`, with labels taken from `KS5_BUCKET_LABEL` itself.
- **GCSE** uses the new `ks4QualificationFamily()` in `teacher-view-theme.ts`. It shares named predicates with `qualificationShortLabel` (`KS4_GCSE`, `isBtec`, `isCambridgeNational`), so the two can't disagree.

Only families with real entries are shown, and all of those are pre-ticked. Icons, colours, one-line descriptions and the selected/unselected styling are literal from the mockups. Next is disabled with nothing ticked.

**Step 2 — subjects** (`CategorySubjectPicker.tsx`, a new component, not a TickList mode):
- tabs for the families ticked in Step 1 that have subjects, each with a ticked count;
- a "Selected so far" panel of removable chips for every family;
- collapsible category sections with a dot, "N of M ticked" and a chevron;
- checked rows take their category's colour as border and 8% tint.

Categories are the real subject-family taxonomy (the headline rows' `familyId`/`familyLabel` via a new `familyFor()`, which `familyLabelFor()` now delegates to). Colours come from `SUBJECT_FAMILY_COLOURS`, in the current theme. Coverage was checked against live data: every real subject at three schools resolves to a category, both phases. The only miss was DfE's "All subjects" pseudo-row, which the parser already drops. The live entries count stays at the top of this step (§6/§14).

**Step 3 — results preview.** One row per ticked subject: icon, subject, qualification, score, bar with an England-average tick, and one line of delta text, under a legend of the ticked families plus "England average". The scores and anchors come from the dashboard's own `resultsFor`/`englandFor`, the very same functions in the same component. There is no second computation. **This step will need revisiting once the GCSE results-anchor fix lands.** Until then, GCSE compares against the England GCSE average for the subject's family, and the intro and delta text say so ("…the England GCSE average for its subject family").

**Step 4 — views summary.** Four rows (Candidates, Results, School Context, Rankings) with the dashboard's own column icons, exported from `DashboardColumn.tsx` as `COLUMN_ICON_PATHS` rather than redrawn. Each row carries the `PHASE_QUESTIONS` line, per the brief (the mockup's own copy differs slightly).

## TickList — checked rows

A checked row now has a 3px coloured left edge and a 10% tint of the same colour, and its checkbox takes that colour. Unchecked rows keep a transparent edge, so ticking never shifts text. The change is additive: an optional `color` per item and an optional `accent` on the list (default: the phase accent, or the site link blue where there is none). Existing props and all three call sites keep working. `ColumnBuilder` colours each view by its subject's qualification group (`colourByGroup`); views not about one subject take the accent. The meetings slide picker and the dashboard's foot-of-page subject list use the default.

**A real mobile bug found and fixed along the way.** TickList rows truncate their labels (`white-space: nowrap`). The app's `<body>` is a flex column, where a centred `<main>` sizes to its content, so a long row forced the whole page wider than a phone: measured at 472px on a 420px screen. That happens in the dashboard's "Expand" builder too, not just onboarding. TickList now sets `contain: inline-size`; re-measured at 420px after the fix. The onboarding `<main>` is also pinned with `w-full`.

## Judgement calls, flagged

- **Unticking a family also unticks its subjects** (and saves that). Otherwise they would stay saved, hidden from Step 2, and quietly reappear on the dashboard's chips.
- **A subject under two qualifications in one tab is labelled with its qualification.** At Acland Burghley Post-16, "Art and Design" and "Speech and Drama" each sit under both a BTEC National Diploma and an Extended Certificate. Subject-only labels would read as duplicate rows, so those show "Art and Design (BTEC National Diploma L3)", using the Data View's existing band-suffix trim.
- **Two small §14 additions to the mockup:** Step 1 tiles add "· N subjects here", and Step 2 rows show each subject's entry count. The principle is that a thing you are about to pick should say how big it is.
- **Health & Care is green**, from the real `SUBJECT_FAMILY_COLOURS`, where the mockup had red. This is the "bar one" mismatch the brief anticipated.
- **Step 3's bar scale** is the DfE points scale per phase: 0–9 at GCSE, 0–60 at Post-16 (A* = 60).
- **Post-16 "Other" has no points figure** by design (`KS5_OTHER_NO_FIGURE_NOTE`), so its rows in Step 3 say "No published points score for this qualification".
- **Colour mismatch between onboarding and dashboard.** Onboarding colours qualification families with the mockup's fixed colours. The dashboard's chips (previous round) colour groups in order of first appearance. They agree in the usual case (GCSE green then BTEC blue; A-level pink then BTec teal), but could differ, e.g. for a Post-16 teacher whose first ticked subject is a BTEC. Not changed here because card content is out of scope. Worth one shared rule later.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on all changed files; `next build` passes.

**Live walkthrough: NOT done.** vicdata.co.uk still presents its Basic Auth gate to this session's browser, the production preview link isn't available here, and the Chrome extension still cannot take screenshots of any page. The live walkthrough (both phases, light and dark, landing on the dashboard with the ticked subjects in the header chips) is outstanding.

**Verified instead:** a temporary local harness (deleted, not committed) rendered the real `QualificationFamilyTiles`, `CategorySubjectPicker` and `TickList` with Acland Burghley's real subject list and categories. Headless Chrome was driven over the DevTools protocol, and values were read from the DOM:

| Check | Result |
|---|---|
| GCSE, Step 1 | Tiles GCSE (9 subjects) and BTEC & OCR (1, the OCR Cambridge National Sports Studies), both pre-ticked; Other vocational not shown (no entries) |
| Post-16, Step 1 | A-level, BTec OCR VRQ, Other pre-ticked; IB and T Level not shown |
| Step 2 tabs | GCSE · 2 / BTEC & OCR · 0; A-level · 1 / BTec, OCR, VRQ · 1 / Other · 0 |
| Checked row colour | Humanities: border `#fcd34d` dark / `#b45309` light, with 8% tint |
| Duplicate subjects | BTec tab, Arts: "Art and Design (BTEC National Diploma L3)", "Art and Design (BTEC National Extended Certificate L3)", "Multimedia" |
| Untick Other tile | Its tab disappears |
| TickList | Checked rows: 3px edge in the item colour, 10% tint; unchecked unchanged |
| 420px width | Page 420px wide (was 472 before the containment fix) |

Steps 3 and 4 are inline in the page and depend on signed-in data, so the harness could not exercise them. They are only verifiable live.
