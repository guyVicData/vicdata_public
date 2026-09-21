# Teacher view — Rankings card: stop the compact map's overlays covering it — build report

Covers `vicdata_phase3_teacher_view_rankings_map_compact_overlay_declutter_brief_v1.md`. Three files changed: `AcademicMapView.tsx`, `RankingsMap.tsx`, `[phase]/page.tsx`.

Untouched, as required: the compact/fullscreen sizing (`h-72` / `h-[70vh] min-h-[22rem]`), the "N of M" figure and ranked list, the subject-chip logic (`mapChips` / `activeMapChip`), and every Data View call site.

## 1. `AcademicMapView` — `dense` prop (default `false`)

When `dense` is true:
- **Grade band / Trends toggle:** not rendered. `colourMode` stays at its default, `"grade_band"`.
- **Colour key** (`GradeBandColourKey` / `TrendColourKey`) and **`SizeLegend`:** not rendered. In their place, the wireframe's compact treatment: a single caption line in the bottom-left corner, for example "Dot size: entries in Biology · Colour: grade band". It names the subject (or category) when one is plotted, and otherwise uses the existing size caption ("pupils entered for GCSEs"). It is understated small text on a translucent background, not a bordered card. It sits just above Leaflet's attribution line and clear of the zoom control. It is one line only: on a narrow card it truncates, and the full caption is its hover title.
- **Exclusion note, option (a):** instead of the amber paragraph, a small "ⓘ N not shown" badge beside the caption. Its hover title (and `aria-label`) is the existing sentence, verbatim, from `ks4ExclusionWholeGroupSentence` / `ks4ExclusionGroupNote` / `ks5BucketWholeGroupSentence` / `ks5BucketExclusionNote`. No new copy.
- `ViewSwitcher` / `PdfExportButton`: already absent (RankingsMap passes neither `activeView` nor `onChangeView`). Unchanged.
- The `viewByArea` choropleth branch: never active for the card. Unchanged.

No new component was built. The four overlays are gated at their existing call sites; the compact caption is an inline block beside them.

**The Data View map is unaffected.** It never passes `dense`, and the diff removes exactly two lines, each replaced by the same expression with a `dense` guard in front (`!dense && …`, `dense ? null : …`). Every other change is an addition inside a `dense ? … :` branch whose other side is the original markup, untouched. With `dense` omitted, the rendered output is the same as before.

## 2. `RankingsMap`

A new `dense?: boolean` prop (default `false`), passed straight to `AcademicMapView`.

## 3. `page.tsx`

The Rankings card's `<RankingsMap>` now passes `dense={!fullscreen}`: compact in the card, full chrome in the fullscreen modal.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on all three files; `next build` passes.

**Real map, real data, measured.** A temporary local harness (deleted, not committed) rendered the real `RankingsMap` at card size (`h-72`). It used Acland Burghley's real Nearest 10 profiles, fetched server-side through `fetchAcademicProfiles` with subjects, with `dense` true and false side by side. Headless Chrome was driven over the DevTools protocol, and the share of the map's area covered by overlays was measured from the DOM:

| Case | Overlay share, full chrome | Overlay share, dense | Dense caption |
|---|---|---|---|
| GCSE, whole school, dark | 77% | 5% | "Dot size: pupils entered for GCSEs · Colour: grade band" |
| GCSE, Biology, dark | 77% | 5% | "Dot size: entries in Biology · Colour: grade band" |
| GCSE, Maths (General), dark | 77% | 5% | "Dot size: entries in Maths (General) · Colour: grade band" |
| GCSE, Biology, light | 77% | 5% | as above |
| Post-16, Art and Design (A-level), dark | 38% | 5% | names the subject |
| Post-16, Art and Design (BTec), light | 37% | 5% | names the subject |

Other results:
- **Exclusions:** at GCSE the dense map shows "ⓘ 1 not shown". Its title is the existing sentence about Channing School (the IGCSE exclusion). The full map shows the same sentence as its amber note, unchanged.
- **Chips:** switching Biology → Maths still changes dot sizes and colours on the dense map (the same 10 dots, differently sized and coloured), and the caption's subject changes with it.
- **Non-dense:** still has the toggle, the colour key, the dot-size legend and the exclusion note.

(The harness passed raw bucket IDs as labels, "alevel"/"btec_ocr". The real page passes the chip's own label, e.g. "Art and Design (A-level)". The tile watermark in local screenshots is only a missing CARTO key on the local server.)

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, `/teacher/ks4` and `/teacher/ks5`, both themes:
1. the card map is clear, with only the caption and, where schools are excluded, the badge;
2. fullscreen looks as before;
3. switching chips still changes dots and caption;
4. the Data View's Academic map is unchanged.
