# Teacher view dashboard — literal design reference (v1)

This replaces prose description as the spec for the four dashboard cards. Every value below is copied directly out of the approved mockup files (Design artifact, Version 34: `GCSE/Post16-Dashboard[-Desktop].dc.html`, `GCSE/Post16-Edit-Candidates/Results/Context/Rankings.dc.html`), not paraphrased. Where the real build already matches, it's marked done — don't rework it. Where it doesn't, this is the literal target, not a starting point for a new interpretation.

## Why this doc exists

Five build rounds shipped real, working mechanism (title text, fullscreen open/close, theme toggle, the live map, and the view-builder tick-list behind "Expand") without shipping the mockup's actual visual and content layer, because every brief up to now described behaviour in prose and never handed over literal values. Screenshotting the live GCSE dashboard against `GCSE-Dashboard-Desktop.dc.html` on 2026-09-21, then reading the real components, showed the gap: accent colour, icons, per-subject breakdown rows, the pie chart, and the subject chip header are genuinely missing from the real build; the comparison anchor on Results is genuinely wrong (school average instead of England average); but the view-builder mechanism itself is built and working, just as an inline "Expand" accordion rather than the mockup's separate "Edit this view →" page — a legitimate pattern difference, not a missing feature. This doc exists so nothing gets lost in paraphrase again, in either direction.

## Palette

**Phase accent** (used for column icon backgrounds, the 3px top bar on every box, the "Edit this view"/"Expand" link colour, active fullscreen-icon background):
- GCSE: `#34d399` (green)
- Post-16: `#a78bfa` (purple)

**Subject-chip colours** (header row, one per ticked subject/qualification — cycle through these, not just the phase accent):
- `#34d399` green, `#60a5fa` blue, `#a78bfa` purple, `#f472b6` pink, `#2dd4bf` teal, `#f87171` red

**Theme tokens** (dark is default; both already exist as CSS custom properties per the phases-3-10 build — confirm these exact values, don't invent new ones):
| token | dark | light |
|---|---|---|
| `--bg` | `#0a0a0b` | `#f7f7f8` |
| `--fg` | `#f2f2f3` | `#17171b` |
| `--muted` | `#8a8a90` | `#6b6b72` |
| `--muted2` | `#9a9aa0` | `#55555c` |
| `--muted3` | `#6a6a70` | `#9a9aa2` |
| `--border` | `#1c1c1f` | `#e6e6ea` |
| `--panel-bg` | `#131315` | `#ffffff` |
| `--panel-border` | `#1e1e22` | `#e2e2e7` |
| `--box-bg` | `#0e0e10` | `#f7f7f9` |
| `--source` | `#5c5c62` | `#8d8d95` |

Positive/negative deltas: green `#34d399` for a positive change, red `#f87171` for negative, regardless of phase accent.

## Page header (currently missing entirely)

Below the "Your dashboard" title, a wrapped row of pill chips — one per ticked subject/qualification, each `background: <colour>1F; color: <colour>; border: 1px solid <colour>59; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 600;`, reading "Geography · GCSE", "Sports Studies · BTEC & OCR", etc. — followed by a small circular `±` button (`border: 1.5px solid <phase accent>`) that opens subject selection. This is how a teacher sees and changes which subjects they're looking at from the dashboard itself, not just during onboarding.

## Box anatomy (the pattern every one of the four boxes follows)

1. **Column header**, above the box: a 39×39px rounded-square icon (`background: rgba(<accent-rgb>,0.14)`, `color: <phase accent>`) containing a stroke-width-2 SVG icon specific to that card (see below), next to the bold natural-language question heading. Currently missing — the real build shows the heading text with no icon and no coloured background at all.
2. **The box** itself: `border-radius: 14px; border: 1px solid var(--panel-border); background: var(--panel-bg); overflow: hidden;`, topped with a **3px solid accent-colour bar** (`background: <phase accent>`) — this is what visually ties every box on a dashboard to its phase. Currently missing.
3. Inside the box, a header row: small-caps-style box title (`font-size: 11.5px; font-weight: 700; color: var(--muted2);` — this is the `shortTitle` text, already correctly wired) with the fullscreen icon and share icon at the right (already correctly built — do not rework fullscreen or share).
4. The content itself — see per-card spec below.
5. A one-line explanatory caption (`font-size: 11.5px; color: var(--muted2);`) — currently missing on most cards; live shows this line but not the content above it.
6. A source line (`font-size: 9.5px; color: var(--source);` e.g. "Source: DfE Key stage 4 performance, 2024/25 · Sources") — check whether this exists live; wasn't visible in the screenshot check.
7. Below the box: the mockup shows an **"Edit this view →"** link opening a separate screen; the real build instead has an inline **"Expand" / "Add a view (N pinned)"** accordion (`ColumnBuilder.tsx`) that opens the same tick-list in place, without navigating away, and already correctly accumulates pinned boxes and supports Reset. This is a real, working implementation of design brief §7's "scrollable, tick-to-add/remove list" requirement — it just doesn't read "Edit this view →". Leave the mechanism as-is; only rename the trigger if Guy wants the exact mockup wording (low priority, cosmetic).

## Card 1 — Candidates ("How many pupils are taking your subject?")

Icon: two-person/group SVG (`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`).

Default view ("Entries this year"): **one horizontal bar row per ticked subject/qualification**, not a single aggregate number. Each row: subject name + qualification type on one line (`Geography` / `GCSE`), then a thin progress bar (`height: 8px; border-radius: 4px; background: var(--panel-border)`, filled proportionally in that subject's chip colour) with the raw entry count at the end. GCSE and its vocational equivalent (BTEC/OCR/VRQ) are always separate rows, never summed — this is explicitly what the caption underneath says ("Kept separate on purpose — almost as many pupils take Sports Studies as a BTEC as take it as a GCSE"). Live currently shows one bare number ("61") with no bar, no per-subject breakdown, even when only one subject is ticked it should still render as a labelled bar row, not a standalone figure.

## Card 2 — Results ("How well are your pupils doing?")

Icon: bar-chart SVG (three vertical lines, `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`).

Default view ("Average point score"): one row per ticked subject/qualification — name + qualification on the left, **score plus a coloured delta against the England average for that same qualification** on the right (`+0.6` in green if above, `-0.2` in red if below). The caption underneath must read "Average point score per entry, vs. the England average for that same qualification" — **live currently compares against the school's own average ("school avg"), not the England average, which is the wrong comparison, not just a missing visual.** Fix the comparison base first; the delta styling is secondary to that.

## Card 3 — School Context ("How does your subject fit in your school?")

Icon: pie-slice SVG (`<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>`).

Default view ("Share of entries") is a **real donut chart**, always shown — not a text sentence. `conic-gradient` built from each ticked subject's share (in its chip colour) plus "every other subject" in `var(--panel-border)`, 70px circle, with a coloured-swatch legend listing each slice's label and percentage next to it. The one-line caption ("Share of every entry in the school, not just how many take it") goes below the chart, not instead of it. **Live currently shows only the caption sentence with no chart at all** — this is the single biggest content gap on the dashboard.

## Card 4 — Rankings ("Where do you sit against other schools?")

Icon: shield/ranking SVG (`<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`).

Above the map: a row of **subject-filter chips**, one per ticked subject/qualification, styled as pill toggles in that subject's colour (filled when active, outlined when not) — switches which subject's data the map/ranking is plotting. This doesn't need to be built if the mockup's assumption (multiple ticked subjects) doesn't match how the real Rankings card is scoped — confirm against the real component (`RankingsMap.tsx`/`RankedSet.tsx`) whether it's already subject-scoped some other way before adding a redundant control.

The map itself, its dot-size/colour legend, the dashed distance ring, and the real interactive `MapView`/`AcademicMapView` component are **already correctly built and already exceed the mockup** (real pan/zoom instead of the mockup's static CSS texture, plus the IGCSE-not-comparable handling). Don't rework any of this.

## What NOT to touch

The fullscreen modal (backdrop, floating panel, Esc/backdrop-click/icon close) is correctly built and matches the mockup's target UX — confirmed working live on 2026-09-21. The real map component is correctly built and better than the mockup. The `shortTitle` box-title mechanism is correctly wired. The theme toggle works correctly, though its button is currently a text label ("Light"/"Dark") rather than the mockup's icon-only sun/moon button (`width:30px; height:30px; border-radius:8px`, sun/moon SVG swap) — low-priority cosmetic fix, not urgent relative to the content gaps above.

## Verification

Before calling this done: screenshot the live GCSE and Post-16 dashboards (light and dark) against the corresponding mockup board and check, box by box — icon present and coloured correctly, accent bar present, bar/delta/pie content present and correct, subject chips present in the header. Don't rely on typecheck/lint/click-through alone — none of those would have caught this round's gap, and won't catch this one either.
