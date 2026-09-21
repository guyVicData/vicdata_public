# Teacher view — Rankings card: stop the compact map's overlays covering it

## Why this brief exists

Guy, live, on the card size (not fullscreen): "the small map on the dashboard is showing the background map, and the dot size key large plus a message about schools not being shown - all of which cover the map."

Confirmed live on `/teacher/ks4`, both themes: in the card's `h-72` (~288px-tall) map, the Grade band/Trends toggle (top right), the GRADE BAND colour-scale bar (right edge), the DOT SIZE legend card, and the amber exclusion note (bottom left, e.g. "3 schools aren't shown in this GCSE comparison…") all render at the same fixed size they use in the full-viewport advanced Data View map. Stacked together in a ~288px box they cover almost the whole thing — at times there's more overlay than map.

This is a pre-existing gap, not something the subject-chip round (just shipped, `244fdfd`) introduced or touched. `AcademicMapView` is shared between two very different containers — Teacher view's small dashboard card and the Data View's large full-page map — and has never had any awareness of which one it's in. Every overlay in it is unconditional (gated on `viewByArea`/`gradeBandAvailable`/`ks4WholeGroupExcluded` and so on, never on container size) and sized for the large map.

The wireframe (`GCSE-Dashboard-Desktop.dc.html`) confirms the compact version was never meant to carry this chrome: its own compact map shows a thin ~7px colour-gradient strip plus a single caption line below the map, nothing overlaid on top of it at all. The full toggle/legend/exclusion-note stack is a fullscreen-only affordance there.

## What to build

One new prop, default off, so nothing about the advanced Data View map changes.

### 1. `AcademicMapView` — new `dense` prop

`src/components/data-view/AcademicMapView.tsx`. Add `dense?: boolean` (default `false`) to the component's props.

When `dense` is true:

- **Grade band/Trends toggle** (the `!viewByArea && gradeBandAvailable` block, ~line 1113): don't render it. The card has no room for it, and it isn't needed to see the map's current colour meaning — `colourMode` can stay at its default (`"grade_band"`) in dense mode; there's no need to add a compact version of the switcher.
- **`GradeBandColourKey`** (~line 1139/1143) and **`SizeLegend`** (~line 1185): don't render the boxes. Replace them with the wireframe's own compact treatment — a single small caption line, e.g. "Dot size: entries · Colour: grade band" (or, when a subject/family is selected, name it: "Dot size: entries in {subject}"), styled as understated small text below or over the map corner, not a bordered card. Keep this caption short — one line, no wrapping.
- **Exclusion note** (the amber `ks4ExclusionWholeGroupSentence`/`ks4ExclusionGroupNote`/`ks5BucketWholeGroupSentence`/`ks5BucketExclusionNote` paragraphs, ~line 1191-1211): don't render inline on the map. The information matters (a teacher needs to know some schools aren't shown) but shouldn't cost a quarter of a 288px card. Two acceptable options — pick whichever is the smaller change:
  - (a) collapse it to a small "ⓘ" or "N schools excluded" inline badge near the caption, that the existing tooltip/title attribute expands on hover, or
  - (b) suppress it entirely in dense mode and rely on the fullscreen map (where there's room) to show it in full.
  Don't invent new exclusion copy — reuse the existing sentence functions if you go with (a).
- **`ViewSwitcher`/`PdfExportButton`** (~line 1093-1099): already conditional on `activeView && onChangeView`, which `RankingsMap` never passes — already correctly absent from the card. No change needed here, just confirming it stays that way.
- **`viewByArea` / choropleth branch** (~line 1145-1176): Teacher view's `RankingsMap` never enables area view, so this path is already dead for the card. No change needed.

When `dense` is false (or omitted), every path must render exactly as it does today — this is the advanced Data View's map and it must be byte-identical in behaviour.

### 2. `RankingsMap` — thread `dense` through

`src/components/teacher/RankingsMap.tsx`. Add `dense?: boolean` to its own props and pass it straight to `AcademicMapView`.

### 3. `page.tsx` — pass `dense={!fullscreen}`

`src/app/teacher/[phase]/page.tsx`, the `RankingsMap` call inside the Rankings card's `renderSpecial`/`ViewDef` render prop (~line 1106-1113, the same block the subject-chip round just edited). Add `dense={!fullscreen}` alongside the existing props, so the card is dense and the fullscreen modal keeps the full chrome (toggle, legend, exclusion note) exactly as it has it now.

## What NOT to touch

- The compact/fullscreen **sizing** (`h-72` / `h-[70vh] min-h-[22rem]`) — already correct, don't change it.
- The "N of M" position figure and the ranked list below the map — unrelated, whole-school, leave alone.
- The subject chips just shipped (`activeMapChip`, `mapChips`) — leave their logic untouched; `dense` is orthogonal to which subject is plotted.
- The Data View's own Academic map (`AcademicDataView` / the advanced dashboard) — it never passes `dense`, so it must look and behave exactly as before. Don't change any of its call sites.
- Don't build a second, parallel "compact legend" component from scratch if a small conditional inside the existing `SizeLegend`/`GradeBandColourKey` functions (or right at their call sites) gets there with less code — your call, whichever keeps the diff smallest and clearest.

## Verification

Both phases (`/teacher/ks4`, `/teacher/ks5`), both themes, on a real school with real neighbours:

1. Card size: the map itself is now clearly visible — dots readable, not covered by any box. A short caption (and, if you went with option (a), a small exclusion indicator) is the only overlay text.
2. Fullscreen: toggle, grade-band/dot-size legend, and exclusion note (where applicable) all still appear exactly as before this change — a straight visual diff against the currently-live fullscreen map.
3. Switching subject chips (KS4 and KS5) still changes dot size/colour and the compact caption's subject name, same as the just-shipped round.
4. The Data View's own Academic map (a separate page/route) is visually unchanged — same overlays, same sizes, same everything.
5. `tsc --noEmit` and `next build` clean.
