# Teacher view — Comparisons' map moved to Trend/% change, one red-orange-green colour scale everywhere (Claude Code prompt v1)

Two things, tied together because they share one colour module.

## Part 1 — One colour scale, retuned, used everywhere

`src/lib/trend-colours.ts`'s `TREND_STOPS` is the real diverging map scale (red→orange→amber→green, colouring by % change). Retune it so the neutral stop reads as orange, not amber/gold, and add a light/dark text-colour export built from the same three anchor hues:

```ts
const TREND_STOPS: { pct: number; hex: string }[] = [
  { pct: -30, hex: "#c0392b" }, // strong decline -- red
  { pct: -10, hex: "#d35400" }, // moderate decline -- red-orange
  { pct: 0, hex: "#e67e22" }, // broadly stable -- orange
  { pct: 10, hex: "#7cb342" }, // moderate growth -- mid green
  { pct: 30, hex: "#15803d" }, // strong growth -- green
];

// One direction-only palette (up/down/flat, no magnitude), for every existing call site
// that computes directionOf(delta) and stops there -- built from this scale's own three
// anchor stops so table/tile/sentence colouring and the map's own gradient are one
// language, not two. Dark-mode pairs are a lighter shade of the same hue (the stops above
// were chosen for map dots, not on-page text contrast).
export const DIRECTION_HEX: Record<Direction, { light: string; dark: string }> = {
  up: { light: "#15803d", dark: "#4ade80" },
  down: { light: "#c0392b", dark: "#f87171" },
  flat: { light: "#e67e22", dark: "#fb923c" },
};
```

(`Direction` is already imported/exported from `teacher-view-trend-styles.ts` — import it into `trend-colours.ts` rather than redefining it.)

In `src/lib/teacher-view-trend-styles.ts`, make `DIRECTION_TEXT`/`DIRECTION_FILL` read from that new export instead of their own hard-coded hexes:

```ts
import { DIRECTION_HEX } from "@/lib/trend-colours";

export const DIRECTION_TEXT: Record<Direction, string> = {
  up: `text-[${DIRECTION_HEX.up.light}] dark:text-[${DIRECTION_HEX.up.dark}]`,
  down: `text-[${DIRECTION_HEX.down.light}] dark:text-[${DIRECTION_HEX.down.dark}]`,
  flat: "text-[var(--muted2)]", // unchanged -- "flat" here already means literally zero delta, not "broadly stable"; see note below
};
export const DIRECTION_FILL: Record<Direction, string> = { up: DIRECTION_HEX.up.light, down: DIRECTION_HEX.down.light, flat: "var(--muted3)" };
```

Careful with `flat`: `directionOf()` (`teacher-view-panels.ts`) returns `"flat"` only when `delta === null || delta === 0` — an exact-zero case, distinct from `trend-colours.ts`'s "broadly stable" ORANGE MIDPOINT which is about a range of small changes on the map's continuous gradient. Don't repoint every `flat` text colour at orange — keep `DIRECTION_TEXT.flat`/`DIRECTION_FILL.flat` as the existing muted grey (a genuinely-zero change reads as "nothing happened", which is different from "small change, near the map's neutral band"); only `up`/`down` pick up the new red/green. Flag this back if it reads wrong once it's live — it's a judgement call, not settled by the code alone.

Delete the three byte-identical local `DIRECTION_COLOUR` consts (`{ up: "#0d9488", down: "#b45309", flat: "var(--muted)" }`) and repoint their call sites at the shared source instead:
- `src/components/teacher/CandidatesPanels.tsx` L56 + call sites L287-336
- `src/components/teacher/SubjectPanels.tsx` L51 + call sites L594-690
- `src/components/teacher/ComparisonsPanels.tsx` L58 + call sites L549-588

Each currently does `style={{ color: DIRECTION_COLOUR[trendSaid.direction] }}` — replace with `DIRECTION_HEX[trendSaid.direction].light` (these are inline `style`, not Tailwind classes, so they need the light-mode hex directly; if these sentences need to work in dark mode too — check whether the surrounding card already handles dark mode elsewhere before deciding whether this needs a `prefers-color-scheme` read or can stay light-hex-only, since inline `style` can't express a `dark:` variant the way a class can).

`src/components/teacher/SortTable.tsx`'s own inline `tone()` (L125-126) duplicates the same up/down two-tone locally — replace with `DIRECTION_TEXT[toneToDirection(t)]` (map `"positive"→"up"`, `"negative"→"down"`, `"neutral"→"flat"`) so this table picks up the same palette rather than a fourth copy.

## Part 2 — Move the map from Current to Trend and % change

### 2a. Scope the Grade-band/Trends toggle per caller

`AcademicMapView.tsx`'s toggle (~L1220-1237) is unconditional wherever the map isn't `dense` — shown in Column 1's own Trend map and the standalone Data View app too, not just Column 3. Add a prop to force one mode and hide the toggle, defaulting to today's behaviour so nothing else changes:

```ts
// New prop, default undefined = today's behaviour (toggle shown, user can switch).
forcedColourMode?: ColourMode;
```

Where the toggle renders (`{!dense && !viewByArea && gradeBandAvailable && ( ... )}`), also require `!forcedColourMode`. Where `colourMode` state initialises and where `effectiveColourMode` is read, use `forcedColourMode ?? colourMode` throughout.

Add the new absolute-change mode to the `ColourMode` union (~L335): `type ColourMode = "trend" | "grade_band" | "accent" | "trend_absolute";`

### 2b. New absolute-change colour function

In `trend-colours.ts`, alongside `trendColour`/`gradeBandColour`, add a diverging-around-real-zero version for absolute values:

```ts
// Like gradeBandColour's real min-max normalisation (never a fixed universal scale --
// Guy's own instruction there), but diverging around the set's TRUE zero rather than its
// midpoint: a school with no change is always this scale's neutral orange stop, whatever
// the rest of the set did: the red/green ends stretch to the set's own real min/max change.
export function trendColourAbsolute(value: number, min: number, max: number): string {
  if (value === 0 || (min === 0 && max === 0)) return TREND_STOPS[2].hex; // the orange midpoint
  if (value > 0) {
    const t = max > 0 ? Math.min(1, value / max) : 0;
    return interpolate(TREND_STOPS[2], TREND_STOPS[4], t); // orange -> strong green
  }
  const t = min < 0 ? Math.min(1, value / min) : 0;
  return interpolate(TREND_STOPS[2], TREND_STOPS[0], t); // orange -> strong red
}
```

(Factor the existing lerp body inside `trendColour` out into a shared `interpolate(a, b, t)` helper both functions call, rather than duplicating it.)

Wire this into `AcademicMapView.tsx` wherever `effectiveColourMode === "trend"` currently reads `trendColour(badge.pctChange)` (~L899-901) — add the `"trend_absolute"` branch alongside it reading an absolute-change figure instead (passed through the same badge/profile shape `pctChange` already travels on — add a sibling field rather than repurposing `pctChange` for two different units) and colouring via `trendColourAbsolute(value, setMin, setMax)`, where `setMin`/`setMax` are the real min/max of that figure across the current comparator set (computed the same place `pctChange`'s own set is assembled). Give it its own legend title next to the existing `<TrendColourKey title="Growth">` (~L1258) — something like `<TrendColourKey title="Change" />` when `effectiveColourMode === "trend_absolute"`.

### 2c. ComparisonsPanels.tsx — relocate the map

Current panel (~L347-357): add `forcedColourMode="accent"` to the `RankingsMap` call. No other change here — same default view, same everything else.

Trend panel (~L519-583) and % change panel: each panel already computes `rows = series.map(s => ({ s, change: changeOver(s.values), ... }))` for its table. Add a `"map"` option to each panel's own `view` state and an `IconButton` (`MapPinIcon`, same icon Current's own map button used) alongside the existing chart/table toggles, and a `RankingsMap` call in the `body`:

- Trend panel's map: `forcedColourMode="trend_absolute"`, fed each comparator's `change.delta` (already computed, no new plumbing) as the new absolute-change field.
- % change panel's map: `forcedColourMode="trend"`, fed `change.percent` (already computed) as `pctChange` — this is the exact computation the old Current map's Trends mode used; it just needed to live here instead.
- Neither panel's default `view` changes — map is an added option, same "additional, not default" pattern Current's Graph/Ranking views already follow relative to each other.
- Both read whichever measure `showingResults` currently has Column 3 on, same as every other figure in this file — no new subject/measure plumbing needed.

## Verify

- Current panel's fullscreen map no longer shows a Grade-band/Trends toggle; Column 1's own Trend map and (if reachable in dev) the standalone Data View app's map still do, unchanged.
- Trend panel: new Map view, additional to the existing chart, defaulting off; colours read red for schools that fell, orange near flat, green for schools that grew, scaled to this comparator set's own real range.
- % change panel: same, on percentage change, and its colours match the retuned scale (orange neutral, not amber/gold).
- Every existing red/green/orange-adjacent colouring elsewhere in Teacher view (Column 1 and Column 3's own "Growing/Declining/Broadly stable" sentences, tile deltas, table Change columns) now reads from the same three hues, dark mode included, with no visual regression to "flat" (still muted grey, not orange) at genuinely-zero deltas.
- `tsc`, `eslint`, `next build` clean.
