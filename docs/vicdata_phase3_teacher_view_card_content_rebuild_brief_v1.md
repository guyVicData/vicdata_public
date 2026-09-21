# Teacher view dashboard — card content rebuild (brief v1)

Read `docs/vicdata_phase3_teacher_view_design_reference_v1.md` first — it's the literal palette/icon/anatomy spec this brief builds against. This brief is the precise, code-grounded fix list: where each gap actually is in `src/app/teacher/[phase]/page.tsx` and the `src/components/teacher/` components, confirmed by reading the real code on 2026-09-21, not inferred from behaviour.

## What's actually true about the current build (read this before changing anything)

`ViewChart.tsx` (bar-row renderer), `ColumnBuilder.tsx` (the tick-to-pin view builder), `CardBox.tsx` (fullscreen box shell), and `RankingsMap.tsx` (the real map) all exist and are correctly wired for **pinned extra views** — tick something in "Expand" and you get a real `ViewChart` bar row or the real map, correctly. The gap is specifically that **each card's own default view** (the one shown before you pin anything) was hand-coded separately in `page.tsx`, bypassing `ViewChart` entirely, as a bare number or a plain sentence — not built to the mockup, and not even reusing the bar/chart machinery the rest of the file already has. Fix the default views to use what already exists; don't build a second charting mechanism.

The "Edit this view" mechanism is real and working, just named "Expand"/"Add a view (N pinned)" as an inline accordion instead of the mockup's separate page — leave this alone unless Guy asks for the literal wording.

## 1. Candidates default (page.tsx, the `CardBox title={defaultBoxTitle("candidates", phase)}` block)

Currently: one big number (`liveCount.toLocaleString()`) plus a caption. Per the design reference, this should be one `ViewChart`-style bar row per ticked subject/qualification (name + qualification, proportional bar in that subject's chip colour, raw count) — the same visual language as the pinned axis views already get from `ViewChart`, applied here to raw entry counts instead of a computed axis. If `ViewChart` needs a raw-entries mode to do this (it currently takes a `computed: ComputedView`), extend it rather than writing new bar markup — that's exactly the "two separate blocks of markup that looked alike" problem `TickList.tsx`'s own comment warns about.

## 2. Results default (page.tsx, `resultsFor(i)` / `schoolAnchor` in the Results `CardBox` block)

Currently: a plain `<ul>`, each row's comparison labelled "school avg {schoolAnchor.toFixed(1)}". Every design doc — including this build's own round-5 prompt — specifies the England average for that qualification as the anchor, not the school's own average. Find where `schoolAnchor` is computed and replace it with the real England-average figure for each subject's qualification (the same comparison the advanced dashboard's Academic Results already uses — reuse that, don't recompute a new average). Once the anchor is right, style each row as label + score + coloured delta (green if above, red if below), matching the mockup.

## 3. School Context default (page.tsx, the Context `CardBox` block)

Currently: `phase === "ks2"` branch is a list (fine, matches KS2's own design), but the GCSE/Post-16 branch is one `<p>` sentence and nothing else — no pie at all. Build the real donut: ticked subjects' share of `schoolTotal` as conic-gradient slices in their chip colours, "every other subject" as the remainder, plus the small colour-swatch legend listing each slice's label and %. The existing sentence becomes the caption underneath the chart, not a replacement for it.

## 4. Icons, accent colour, box anatomy (page.tsx section headers + `CardBox.tsx`)

Every `<h2 className="text-sm font-semibold">{q.howMany}</h2>` (and the three siblings) needs the mockup's icon treatment: a 39×39px rounded-square, `background: rgba(<accent-rgb>,0.14)`, containing that card's SVG (paths are in the design reference doc), next to the heading text. `CardBox.tsx`'s outer wrapper needs the phase-accent 3px top bar. Neither the icon boxes nor the accent bar exist anywhere in the current markup — this needs a real phase-accent value threaded through (GCSE `#34d399`, Post-16 `#a78bfa`), not hardcoded per-file, since both phases share these components.

## 5. Subject-chip header (page.tsx, near `{schoolName && ...}`)

Add the wrapped pill row from the design reference — one chip per ticked subject/qualification, cycling the subject palette, plus the small `±` "change subjects" control. Currently only the school name renders here.

## What to leave alone

`ViewChart` for pinned axis views, `ColumnBuilder`'s tick-list/pin/reset mechanism, `CardBox`'s fullscreen modal, `RankingsMap`/the real map and its legend, the theme toggle mechanism (its button styling — icon-only sun/moon vs. the current text label — is a low-priority cosmetic follow-up, not part of this round), and the `shortTitle` box-title text. All of these are correct and tested working live.

## Verification

Typecheck/lint/build passing is necessary but was never sufficient for this work and won't be checked as sufficient this time either — screenshot the live GCSE and Post-16 dashboards, light and dark, and check each card against the corresponding mockup board and the design reference doc before calling this done. Name the real school(s) checked, same as usual. Commit and push under the same standing authorisation as the round-5 gaps-and-ship round once it's actually built and it actually looks right, not once it builds cleanly.

## Scope

The four cards' default-view content, the icon/accent-bar/box anatomy, and the subject-chip header — nothing else. Don't touch KS2 (already matches its own, different design), don't touch the map, fullscreen, or theme mechanisms, don't rename "Expand" to "Edit this view" unless asked. If something else looks wrong while in these files, log it in `docs/OPEN_QUESTIONS.md` rather than fixing it unasked.
