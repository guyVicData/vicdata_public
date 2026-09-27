# Teacher view — Comparisons' map moved to Trend/% change, one red-orange-green colour scale everywhere (build brief v1)

## What Guy asked for, and what's real

Column 3 (Comparisons, `ComparisonsPanels.tsx`) has three panels — Current, Trend, % change, exactly `PanelId = "current" | "trend" | "change"`. Current already has a map (`RankingsMap`, real, shipped, one of its three views alongside Graph and Ranking). That map, in fullscreen, carries a top-right "Grade band / Trends" toggle (`AcademicMapView.tsx` ~L1220-1231) — "Trends" is the real orange-to-green diverging scale (`trendColour()`, `src/lib/trend-colours.ts`), colouring by % change since a baseline year. Guy's read: that trend-coloured view is in the wrong panel (Current is about current standing, not change) and belongs on Trend (absolute change) and % change (percentage change) instead, one map each, neither becoming the new default view.

He then asked for the same red-orange-green language to replace the app's existing change colouring everywhere else — tables, sentences, tiles — which today is a completely different, unrelated teal/amber two-tone (`DIRECTION_TEXT`/`DIRECTION_FILL`/local `DIRECTION_COLOUR` consts). And a colour-semantics correction: the neutral/flat colour should read as **orange**, not the amber/gold the scale currently uses — "declines are red, growth is green, broadly stable is orange" is literally `DIRECTION_WORD.flat = "Broadly stable"` (`teacher-view-panels.ts` L346), so this is asking to recolour the exact three states the app already names, not inventing a fourth state.

"Later we can enable users to adjust site-wide" — noted as future work, not this round, but it's the reason to land this as one shared source rather than patch each of the current four+ duplicated colour constants separately.

## The one colour scale

`src/lib/trend-colours.ts`'s `TREND_STOPS` is already a real, five-stop, diverging red→orange→amber→green ramp, used today only for the map's %-change "Trends" mode. It's already commented as provisional ("expect a live-review pass to retune"), so retuning it is in scope, not a detour:

```
{ pct: -30, hex: "#c0392b" }, // strong decline -- red
{ pct: -10, hex: "#e67e22" }, // moderate decline -- orange   <- currently labelled orange
{ pct: 0,   hex: "#f1c40f" }, // neutral -- amber/gold          <- Guy wants THIS to be orange
{ pct: 10,  hex: "#7cb342" }, // moderate growth -- mid green
{ pct: 30,  hex: "#15803d" }, // strong growth -- green
```

Proposed retune — reassigns the already-orange `#e67e22` to the neutral (0) stop, where Guy placed "broadly stable... orange", and gives -10 a redder orange so it still reads as decline, not neutral:

```
{ pct: -30, hex: "#c0392b" }, // strong decline -- red (unchanged)
{ pct: -10, hex: "#d35400" }, // moderate decline -- red-orange
{ pct: 0,   hex: "#e67e22" }, // broadly stable -- orange
{ pct: 10,  hex: "#7cb342" }, // moderate growth -- mid green (unchanged)
{ pct: 30,  hex: "#15803d" }, // strong growth -- green (unchanged)
```

This single module is now the one scale everywhere: the map's continuous %-change gradient, a new continuous absolute-change gradient for the Trend map, and three flat swatches (down/flat/up) for every place in the app that only ever knows a direction, not a magnitude (most existing call sites — a table's Change column, a tile's "+8%", a trend sentence — compute `directionOf(delta)` and stop there; they were never built to carry the real delta through to a colour function, and rebuilding all of them to do so is a much bigger and riskier change than Guy asked for). So: one new export, `DIRECTION_HEX: Record<Direction, {light: string; dark: string}>` in `trend-colours.ts`, built from the same three anchor stops (-30/0/30) with a legible dark-mode pairing for each (light theme uses the stop's own hex; dark theme uses a lighter Tailwind-family shade of the same hue, since none of the existing map hexes were chosen for on-screen text contrast):

```
up:   { light: "#15803d", dark: "#4ade80" }  // green-700 / green-400
down: { light: "#c0392b", dark: "#f87171" }  // this scale's own red / red-400
flat: { light: "#e67e22", dark: "#fb923c" }  // this scale's own orange / orange-400
```

`teacher-view-trend-styles.ts`'s `DIRECTION_TEXT`/`DIRECTION_FILL` become thin wrappers over this (`text-[${DIRECTION_HEX[d].light}] dark:text-[${DIRECTION_HEX[d].dark}]`), so every existing consumer picks up the new palette automatically. The three duplicated local `DIRECTION_COLOUR` consts (`CandidatesPanels.tsx` L56, `SubjectPanels.tsx` L51, `ComparisonsPanels.tsx` L58 — all three byte-for-byte `{ up: "#0d9488", down: "#b45309", flat: "var(--muted)" }`) are deleted and repointed at the same source, as is `SortTable.tsx`'s own inline `tone()` (L125-126). One scale, one place, matching the "later, site-wide" ask.

## The map moves

`AcademicMapView.tsx`'s Grade-band/Trends toggle is shared well beyond Column 3 — Column 1's own Trend map (`SubjectPanels.tsx`'s `trendMap` prop) and the standalone Data View app both render the same component, and `gradeBandAvailable` is hard-coded `true` (L525), so the toggle shows in every fullscreen map today. Removing it outright would silently strip trend-colouring from Column 1's map and the main app too, neither of which Guy asked to touch. So: a new prop lets each caller force a single mode and hide the toggle, rather than a global removal — Column 3's Current map forces `"accent"`/value-colour (today's default, just no longer switchable to Trends); the two new Trend/% change maps each force their own single mode and never show the toggle either, since there's nothing else on either of those panels worth switching to.

Trend's new map needs an **absolute-change** colour mode that doesn't exist yet — `trendColour()` only takes a percentage. A fixed absolute domain (say ±1.0 point, or ±20 entries) would flatten a small school's real change to nothing and blow out a large one's, the same distortion `gradeBandColour()`'s own header comment already rejects for exactly this reason (Guy's own prior instruction, quoted there: "if it is value based we need to see how much variation there is... real min-max normalisation is what keeps... a widely-spread one us[ing] the full range"). Proposed: reuse that real precedent, but diverging around the set's own true zero rather than its midpoint — a school with no change is always the neutral orange, whatever the rest of the set did; the red and green ends stretch to the set's real minimum and maximum change. This needs no new data, only a new colour function in `trend-colours.ts` alongside `trendColour`/`gradeBandColour`.

## What ComparisonsPanels.tsx actually changes

- Current panel (~L347-357): the `RankingsMap` call keeps its `accentHex` (today's value colouring) and gains the new "force accent, no toggle" prop — nothing else about Current changes.
- Trend panel (~L519-583): gains a Map action/view alongside its existing chart, `RankingsMap` fed each comparator's absolute change since the panel's own baseline year (the same figures the Trend table already computes via `changeOver`), forced into the new absolute-change colour mode.
- % change panel: gains a Map action/view the same way, fed `changeOver(...).percent`, forced into the existing (retuned) `"trend"` mode — this is the same real computation and mode the old Current map used, just relocated to the panel it actually describes.
- Both new maps: additional view, not the default (`view` state's initial value is untouched) — same non-default pattern the existing Map already uses today on Current before Round Part 1 made it default there.
- Works for both Candidates and Results (the same `showingResults` toggle every other Column 3 figure already follows) — nothing subject-specific needed since Column 3 plots schools, not subjects.

## Real open call, not blocking

The absolute-change domain (points vs headcount) is a first pass, same discipline `trend-colours.ts`'s own header comment already applies to itself — worth a live look once real schools are on the map before treating it as settled.
