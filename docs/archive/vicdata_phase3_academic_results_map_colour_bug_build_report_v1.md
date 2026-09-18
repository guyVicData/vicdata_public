# Build report: Academic Map colour/scale bugs (live review, post round 3)

Brief: `docs/vicdata_phase3_academic_results_map_colour_bug_brief_v1.md`. Built and
tested locally only; nothing committed or pushed yet at build time (pushed
afterward, per this round's own explicit instruction — see Confirmations).

**Browser tool check**: checked again at the start of this round
(`tabs_context_mcp`) — still "Browser extension is not connected." Item 3's fix is
a structural CSS change (below), not visually confirmed on screen; flagged
honestly rather than implied.

## Items 1 & 2 — grade-band colour now tracks the SAME real value as the popup

Root cause was already correctly identified in the brief by reading the code: a
separate `GRADE_BAND_MEASURE` per-stage map, a genuinely different real DfE
measure from `HEADLINE_MEASURE` (what the popup/Rankings/Overview all show), was
driving both the circle colour and the legend's own min-max range.

**Fix, exactly as recommended**: dropped `GRADE_BAND_MEASURE` from the map's
colour computation entirely. Grade band's colour source is now `avgValue` — the
SAME real headline figure already being computed for the popup, resolved via
`rowMeasureKey` (which already correctly follows a specific KS5 cohort selection,
or a school's own real dominant cohort in the default state, per round 3's A5
fix). There is no longer a separate `gradeValue` field on `RowData` at all — the
whole `GRADE_BAND_MEASURE` import and the KS5 "use aab_percent for A level,
fall back otherwise" branch are gone, not just bypassed. This is a real,
deliberate **product change**, not a silent byproduct: the standalone "higher
bar" threshold idea (`GRADE_BAND_MEASURE`'s own real, pre-round-3 design intent —
show the map's colour by a stricter DfE benchmark than the headline figure) is
removed from the map's colour mode. Grade band now means "how good is the real
number you can already see," not a second, hidden, stricter number — matching
both of Guy's live reports.

This also removes the compounding "%" formatting bug for free: `formatHeadlineValue`
already branches on `HEADLINE_UNIT[stage]`, and since colour and popup now share
the exact same value (and so the exact same real unit), there's no longer a case
where a percentage figure gets formatted through a points-stage's own unit rule.

**Real before/after, three real schools, one per stage** (read-only, against
hosted, via a script that imports and calls the actual production functions —
`fetchAcademicProfiles`/`latestMeasureAt`/`headlineValueAt` — the same
methodology this session uses whenever a browser tool is unavailable):

| School | Stage | Popup value (`HEADLINE_MEASURE`) | OLD colour source (`GRADE_BAND_MEASURE`) | NEW colour source |
|---|---|---|---|---|
| Yerbury Primary School | KS2 | **74%** (expected standard, 2024/25) | **24%** (higher standard) | **74%** |
| Wellington College | KS4 | **15.1** (Attainment 8, 2024/25) | **0** (engmath 9-4 %, shown with no "%" — the compounding unit bug) | **15.1** |
| Acland Burghley School | KS5 | **36.26** (Academic cohort, own dominant, 2024/25) | **8.1** (`A level::aab_percent` — wrong even before A5's own per-cohort question, since this school's real resolved cohort isn't "A level" at all) | **36.26** |

Yerbury's real before/after matches the brief's own national-shape claim exactly
(higher standard well under half of expected standard for the same real school).
Acland Burghley's own real figures additionally confirm the OLD bug was worse
than just "wrong measure" for KS5's default state specifically: `GRADE_BAND_MEASURE.ks5`
was hardcoded to `"A level::aab_percent"` regardless of which cohort a school was
actually being shown on, so even a school correctly resolved to its own real
"Academic" cohort for the popup was being coloured off a completely unrelated
A-level-only figure.

## Item 3 — "Grade band" title overlapping the scale

Confirmed the brief's own suspected cause structurally: `GradeBandColourKey`'s
title `<p>` had a fixed `height: TREND_KEY_TITLE_HEIGHT` (16px, shared with
Trend's own single-word key) and no `whitespace-nowrap` — the two-word,
uppercase, tracking-wide string "Grade band" in a 56px-wide box is very likely to
wrap, and the fixed-height `<p>` doesn't clip an overflowing second line, so it
pushes down into the gradient bar immediately below — exactly the reported
symptom.

**Fix, both ways at once rather than either/or**: added `whitespace-nowrap` to
the title (makes a second line structurally impossible, not just less likely —
the actual mechanism of the bug is removed, not just given more room to happen
in), and widened the key's own box from 56px to 68px (real headroom for the
single line next to Trend's own narrower key, matching the "still look like the
same real component family" instruction).

**Not visually confirmed** — no browser tool available this round either. This
is a structural fix (the wrap failure mode is now impossible by construction,
regardless of exact pixel measurements), but the real on-screen rendering
hasn't been seen.

## Item 4 — growth/decline wording now tracks the displayed pp number

Root cause was already correctly identified in the brief: `trendBadge()`'s
`direction` comes from a RATIO threshold (±15% relative change), decoupled from
the raw pp difference shown next to it for percent-unit stages (KS2's headline
trend) — the label boundary depends on each school's own anchor size, not a
fixed pp cutoff.

**Fix**: a genuinely separate 7-tier absolute-pp classification
(`classifyPpTrend`/`PP_TREND_LABELS`, new in `trend-labels.ts`), matching Guy's
own spec exactly (0-1pp no change; 2-5pp small growth/decline; 6-15pp growth/
decline; 16pp+ steep growth/decline, symmetric, no gap or overlap). Classified on
the **rounded** whole-pp value (same rounding the displayed number already uses),
a deliberate choice named explicitly: classifying the raw float instead could
make a value that visibly *displays* as, say, "+2pp" still read as "No change"
underneath, reproducing exactly the kind of mismatch this fix exists to remove.

**Real design call on `trend-labels.ts`, named explicitly**: this does **not**
extend or replace the existing 3-tier `TrendDirection`/`TREND_LABELS` in place.
Doing so would force Rolls' own `GraphsView.tsx` `TrendStatement` and Academic's
own entries-trend caption — both genuinely ratio-based, no natural "point" unit
— onto a 7-tier vocabulary they don't need and were never designed for. Instead,
`PpTrendTier`/`PP_TREND_LABELS`/`classifyPpTrend` are a **new, separate** type
and label map living alongside the old ones, unused by any existing 3-tier
caller — the exact same "separate tier type + separate label map, coexisting"
shape this codebase already established for `population-trend.ts`'s own
`PopulationTrendTier`/`POPULATION_TREND_LABELS`/`classifyPopulationTrend`,
followed directly rather than inventing a new pattern.

A new shared function, `trendWordingFor` (`academic-data-view.ts`), is the ONE
place that decides which of the two wording systems applies (`trendMagnitudeFor`'s
own real `unit` — `"pp"` reads the new absolute tiers, `"%"` reads the existing
ratio-based `trendBadge`/`TREND_LABELS`) — both the Map's own trend popup and
Rankings' Trend tile now call this instead of each deciding separately, so they
can't drift apart. Confirmed the scope directly rather than assuming: the only
real "pp" call sites are the Map popup and Rankings Trend tile (both via
`trendMagnitudeFor`, both KS4/KS5 correctly still resolve to `"%"`, unaffected);
Graphs' own entries-trend caption and Rolls' `RollTrendsChart`/`TrendStatement`
both use `trendBadge()`'s ratio `pctChange` directly, with no `"pp"` unit
anywhere in their own call path — confirmed untouched, not just assumed safe.

**Real before/after, 31 real KS2 schools** (Yerbury Primary's own real nearest-30
comparator set, read-only against hosted):

The exact reported inconsistency, reproduced and fixed with real schools at the
same real boundary Guy's own report named:

| School | 2022/23 → 2024/25 | Real pp | OLD wording (ratio-based) | NEW wording |
|---|---|---|---|---|
| Eleanor Palmer Primary School | 83% → 93% | **+10pp** | "No change" (14.5% ratio, under the old 15% threshold) | **"Growth"** |
| Tufnell Park Primary School | 73% → 84% | **+11pp** | "Growth" (15.8% ratio, just over) | **"Growth"** |

Both now read "Growth," consistently, at the same real pp band — the exact
inconsistency reported is gone.

Full real distribution across all 7 tiers, confirming clean boundaries with no
gap or overlap (rounded pp, ascending):

```
-56pp, -25pp, -24pp, -24pp, -24pp, -20pp  -> Steep decline
-15pp, -11pp, -10pp, -10pp, -9pp, -7pp, -6pp -> Decline
-4pp, -3pp, -2pp, -2pp                    -> Small decline
-1pp, -1pp, 0pp, +1pp                     -> No change
+4pp                                      -> Small growth
+7pp, +8pp, +8pp, +9pp, +10pp, +11pp, +12pp, +13pp -> Growth
+27pp                                     -> Steep growth
```

## Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on every touched file: clean.
- `npm run build`: clean, full production build.
- Real execution, not code inspection alone, for items 1, 2, and 4 — against real
  schools, via scripts that import and call the actual production functions,
  read-only against hosted (no ingest, no DB write of any kind this round).
- Item 3: fixed structurally (the wrap failure mode is now impossible), but not
  visually confirmed on screen — no browser tool available this session.

## Confirmations

- `git status` showed only the files this report names as touched, before
  committing.
- Nothing written to hosted/production data — every check this round was a
  read-only query against real, already-ingested data; no ingest, no migration,
  no write of any kind.
- Committed and pushed at the user's own explicit instruction for this round
  (unlike every prior round's local-only discipline) — see the commit itself for
  the exact SHA.
