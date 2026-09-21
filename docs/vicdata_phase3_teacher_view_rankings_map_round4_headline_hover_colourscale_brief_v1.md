# Teacher view — Rankings map, round 4: subject-aware headline, non-cropping hover, colour scale back

Three more small fixes to the same card, from Guy live against round 3 (`a22070a`/`883d034`, plain card map + category colour + no inline list, already shipped). vicdata_public only.

## 1. The "N of M ... on {headline}" line is stale once a subject is ticked

Guy: "Map has a stale subheading that relates to nothing shown — '2 of 7 among the nearest schools with data, on Attainment 8 average score'."

Real bug: `src/app/teacher/[phase]/page.tsx`'s `position`/`headlineLabel` (~line 368, ~line 143/213) come from the whole-school ranking and the whole-school stat name (Attainment 8 at KS4, avg. points per entry at KS5) — computed once, server-side, with no idea a subject chip exists. The Rankings card's own "N of M" sentence (~line 1067-1076) always renders this whole-school figure, even while the map underneath is plotting one ticked subject's dots. Once a chip is active the two disagree — the map is about Biology, the sentence above it is still about Attainment 8.

The good news: the correct, subject-aware number already exists, just not exposed. `src/components/data-view/AcademicMapView.tsx` already computes a real rank against whichever comparison is currently active — `rankedRows`/`rankTotal` (~line 618-625), built from `rowDataByUrn`'s `avgValue`, which is already the ticked subject's own value when `subject` is set (this is exactly what feeds each dot's own tooltip rank, ~line 856-858: `` `#${rank} of ${rankTotal} compared schools` ``). Nothing needs recomputing — it needs surfacing.

**What to build:** a new optional callback prop on `AcademicMapView`, e.g. `onTargetRank?: (info: { rank: number; total: number } | null) => void`, called (in an effect keyed on `rankByUrn`, `rankTotal`, `targetProfile.urn`) with the target school's own rank out of `rankTotal`, or `null` if it isn't in the ranked set. Thread it straight through `RankingsMap`. In `page.tsx`, hold it in state (`const [mapRank, setMapRank] = useState<{ rank: number; total: number } | null>(null)`) and pass `onTargetRank={setMapRank}` to `RankingsMap`.

In the "N of M" block (~line 1067-1076): when `activeMapChip` is set, render `mapRank` instead of `position`, and word the second line around the ticked subject rather than `headlineLabel` — e.g. "among the nearest schools with data, on {activeMapChip.legend} avg. point score" (reuse the same "avg. point score" wording the map's own tooltip already uses for subject mode, ~line 848). When no chip is ticked, this block is completely unchanged — same `position`, same `headlineLabel`, same text, so the whole-school default view never regresses.

## 2. Compact map hover info gets cropped — move it to a fixed spot, not a floating tooltip

Guy: "for small map on dashboard the rollover of each school needs a different way to display (maybe a standard place at top of bottom of map so that it doesn't get cropped by the map edges). also stylistically needs to fit."

Real cause: every dot is a `L.circleMarker(...).bindTooltip(tooltipHtml, { direction: "top", offset: [0, -4] })` (~line 878-886) — a floating Leaflet tooltip anchored above the marker. `RankingsMap`'s own wrapper is `overflow-hidden` (`src/components/teacher/RankingsMap.tsx`) so a tooltip over a dot near the small card's top or side edge gets clipped or pushed off. Fullscreen has room for this and should keep it exactly as-is.

**What to build, dense only:** skip `.bindTooltip(...)` when `dense`. Instead, attach `.on("mouseover", ...)`/`.on("mouseout", ...)` to each circle marker, writing the same already-built `lines`/school name into a small piece of local state (e.g. `const [hoverInfo, setHoverInfo] = useState<{ name: string; isTarget: boolean; lines: string[] } | null>(null)`) rather than into a Leaflet tooltip — the content is identical, only where it's shown changes. Render it as a fixed, non-cropping bar pinned to the **top** of the map (dense mode's top edge is currently empty — the view toggle and view-switcher are both already hidden there, per round 2/3 — so this doesn't compete with anything), styled to match the existing dense caption (same small text, same translucent rounded background, same size, so it reads as part of the same family rather than a bolted-on tooltip). Shown only while a dot is actually hovered; empty/absent otherwise, same show/hide behaviour the floating tooltip already had.

**What NOT to touch:** fullscreen's tooltip (`!dense`) — unchanged, still the floating `bindTooltip`. The tooltip's actual content/wording (subject/family/whole-school branches, rank text) — unchanged, just relocated for `dense`.

## 3. Bring the colour scale back at card size, right-hand side

Guy: "we need the colour scale on the right hand side."

Round 2 (the overlay-declutter round) suppressed `GradeBandColourKey` entirely in dense mode (`src/components/data-view/AcademicMapView.tsx` ~line 1151: `{dense ? null : ...}`), replacing it with a text-only caption ("Colour: grade band"). Guy wants the visual scale back, just not at the old full size — the wireframe's own compact map (`GCSE-Dashboard-Desktop.dc.html`) shows exactly this: a thin vertical gradient strip pinned to the map's right edge (`right: 7px; top: 7px; bottom: 7px; width: 7px`), no title, no boxed numeric labels — just the colour language, worn thin.

**What to build:** in place of that `null`, render a compact colour strip when `dense` — reuse the exact same colour source `GradeBandColourKey` already uses (`familyId ? gradeBandLegendStopsForFamily(familyId) : GRADE_BAND_LEGEND_STOPS`, `minGrade`/`maxGrade`) so the strip, the dots, and the bottom caption can never disagree about what a colour means. Don't reuse `GradeBandColourKey` as-is (it's sized and positioned for the full toggle-relative layout, via `trendKeyBox`) — build a slim standalone version instead: a narrow (~6-8px) vertical gradient bar spanning most of the map's height near the right edge (independent of `trendKeyBox`, which assumes a toggle above it that dense mode doesn't have), with no title text. Room for small min/max end-labels only if it doesn't crowd the strip — the bottom caption already names what the colour means in words, so the strip's own job is just to make the gradient visible, not to repeat the labelling.

Since dense mode has no way to switch to Trends (the toggle is hidden, per round 2), this only ever needs the grade-band gradient — no compact `TrendColourKey` to build.

**What NOT to touch:** fullscreen's own `GradeBandColourKey`/`TrendColourKey` — completely unchanged, still the full boxed version with title and numeric stops.

## Verification

Both phases, both themes, a real school with real neighbours:

1. With a subject chip ticked, the "N of M" sentence above the map names that subject and its own rank among the same neighbours — cross-check the number against `AcademicMapView`'s own per-dot tooltip rank for the same subject. With no chip ticked, the sentence is byte-identical to before this round (whole-school Attainment 8 / avg. points).
2. Card size: hovering a dot — including one near the very top or side edge of the map — shows its info in the fixed top bar, never clipped or missing. Fullscreen still shows the old floating tooltip near each dot.
3. Card size: a thin colour gradient strip is visible on the right edge, using the same hue as the currently active category (or the plain blue ramp with nothing ticked) — no title, unobtrusive.
4. Fullscreen: `GradeBandColourKey` still renders full-size with its title and three numeric stops, exactly as before this round.
5. The Data View's own Academic map — unaffected by all three (never dense, never had this problem).
6. `tsc --noEmit` and `next build` clean.
