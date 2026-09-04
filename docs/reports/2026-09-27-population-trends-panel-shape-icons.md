# Population trends panel + shape icon column

2026-09-27. State of the School page: `src/app/schools/[urn]/page.tsx`,
`src/components/dashboard/ShapeCard.tsx`, `src/components/dashboard/PopulationTrendSection.tsx`,
`src/components/BirthsChart.tsx`, `src/lib/population-trend.ts`,
`src/lib/population-trend-lookup.ts`, `src/lib/shire-county-districts.ts`.

## PART 1 — Population trends panel

### Investigation findings (source_id / join)

- `ons_births` (source_id `"ons_births"`, entity_id = ONS GSS code, `breakdown="total"`)
  is real and confirmed — same source `market-share.ts` already uses.
- **Confirmed gotcha, worse than expected**: `ons_births` publishes at district/unitary/
  borough level only (E06/E07/E08/E09) — zero E10 (county) rows exist anywhere. Surrey's
  own `la_gss_crosswalk` code (E10000030) has zero rows; its 11 real districts do.
- **No district→county crosswalk existed anywhere in this database** — not even via the
  school-level `lsoa_code`/`msoa_code` fields (real geolocation, but no LSOA/MSOA→LAD
  lookup table; that would need importing a ~35,000-row standard ONS file). Per Guy's
  steer, built the shire crosswalk instead.
- Systematically checked (with proper pagination — a first pass had a bug where
  Supabase's 1000-row default cap silently dropped Surrey from the analysis) every one
  of 183 real distinct LA codes among this database's 27,165 real open schools: 132
  resolve directly, **21 are genuine still-two-tier English shire counties** needing
  district aggregation (Essex, Kent, Surrey, Hampshire, Lancashire, and 16 others).
  Wales has **zero** `ons_births` coverage at any period, at any geography level — a
  separate, real "no data source" gap, not a crosswalk problem (see Wales confirmation
  below).
- Sourced all 164 real district GSS codes for the 21 counties via a research fork
  against ONS's own official geography lookup, then independently verified every single
  one against live `ons_births` data — 0 problems, real data back to 1992 for all of
  them.
- **Tier bands, decision confirmed**: checked the real distribution (153 LAs,
  2021→2025) — the existing `classifyPopulationTrend` bands (0%/2%/15%/25%) put 114 of
  153 LAs (75%) into a single "Decline" tier. Flagged this to Guy directly (real UK
  birth rates have declined sharply and near-uniformly across nearly all LAs in just 4
  years, so the census-calibrated bands don't discriminate well for this metric).
  **Guy's decision: keep the existing 0/2/15/25 bands as-is for births, unchanged —
  not adjusted.** The births metric is fed into the exact same `classifyPopulationTrend()`
  function as the age5-vs-age15 census metric, so "Decline" means the same numeric
  thing everywhere on the page, even though it will read "Decline" for the large
  majority of LAs' births specifically — a real, true reflection of the underlying
  data for this window, not a labelling bug.
- **Reliability floor**: `RELIABILITY_FLOOR_BIRTHS = 100` (real gap in the data: Isles
  of Scilly=23, City of London=60, then a clean jump to Rutland=274 — 100 falls in that
  gap, excluding only the two genuinely extreme outliers).
- **Window**: 2021–2025 confirmed as 5 real, complete years for every real LA before
  committing to it.

### Spot-check figures (live, verified)

- Camden (URN 100053, direct/unitary): 2021=2,317 → 2025=1,991, **−14.1%, Decline**
- Surrey (URN 144938, shire crosswalk, 11 districts summed): 2021=12,451 → 2025=11,362,
  **−8.7%, Decline**

### Wales confirmation (checked live, not asserted)

Fetched a real Welsh school's page directly: Millbank Primary School, URN 401558
(Cardiff). Result: neither the Shape card, nor the population-trends panel, nor the
births column render at all — the page falls to `NoCensusDataCard`.

Checked why: 0 of the first 20 real open Cardiff schools queried have **any**
`dfe_school_census` rows at all — `roll` is null for every one of them. This is a
pre-existing, structural, England-only limitation of the census source itself (DfE
census doesn't cover Wales; Wales runs its own separate schools census, not ingested
into this platform), unrelated to this round's births work. Since
`PopulationTrendSection` is nested inside the `roll &&` block in `page.tsx`, no Welsh
school's page ever reaches the point where the births lookup's own result would be
rendered, regardless of what that result is.

To answer the actual question — does the births lookup itself degrade gracefully, in
isolation — called `lookupBirthsTrend("681")` (Cardiff's real `dfe_code`) directly,
bypassing the `roll` gate: returned `{ laBirthsTrend: null, laBirthsSeries: null }`
cleanly, no throw, no partial/broken state. `PopulationTrendSection`'s own null-guard
(`if (!laSeries && !regionSeries && !laBirthsSeries) return null`) would correctly
render nothing if births were ever the only source reachable for a real page. Same
honest "no data" degrade as every other missing-source case on this page — confirmed
at both the practical (real page fetch) and code (isolated function call) level.

### Changes made

- `PopulationTrendSection` extracted from `ShapeCard` into its own full-width
  `Card`+`CardHeading` panel, retitled "Population trends in the area," rendered
  directly after `ShapeCard` in `page.tsx`.
- Both existing columns retitled to fixed generic headers ("Local Authority school
  population" / "Region school population") with the real area name demoted to a
  subline underneath.
- New `BirthsChart.tsx` (bars + overlaid trend line, own `--series-births`/
  `--series-births-line` CSS custom properties, light/dark).
- New `src/lib/shire-county-districts.ts` (the 21-county/164-district crosswalk, every
  code independently verified).
- New `computeBirthsTrend`/`BirthsTrend` in `src/lib/population-trend.ts`, new
  `lookupBirthsTrend` in `src/lib/population-trend-lookup.ts`.
- `RegionalNationalCard` block removed entirely from `page.tsx`. `context.national`
  confirmed genuinely unused afterward and removed from `getContextAggregates`;
  `context.regional` untouched (still feeds `LaBoardersCard` and `RollCard`).

### Verified live

- Panel renders with all 3 charts and correct titles on both spot-check schools.
- `LaBoardersCard` unaffected (Leighton Park, URN 110110: 39.5% of Reading's 344
  boarders, real figures, rendered correctly after the `RegionalNationalCard` removal).
- The three `ComingSoonCard`s ("Academic snapshot", "Social context", "Destinations")
  are the only content left at the bottom of the page.
- Wales: confirmed as above.

## PART 2 — Shape icon column

Confirmed `irregular` is genuinely dead (not just trusted the prompt) —
`shape-classifier.ts`'s own type comment says "never returned by classifyShape any
more," and a direct grep found no `return "irregular"` anywhere in the real
classification logic, only that comment.

Column of the 6 live shapes (Tube/Pyramid/Top Step/Funnel/Mushroom/Wineglass) at 72px
(150% of the old 48px), each labelled, replacing the old single icon in
`ShapeCard.tsx`'s right column. Highlighting via `ShapeIcon`'s own existing gold-circle
theming for the active shape (unchanged) and a plain `opacity: 0.3` wrapper for the
other five — no second colour system introduced.

### Verified live on two real schools with different shapes

- Acland Burghley (URN 100053): **Top Step** highlighted, other 5 muted at 0.3 opacity
  — matches its known real narrative ("Top step shape").
- Sandcross Primary School (URN 144938): **Funnel** highlighted, other 5 muted —
  genuinely different from Acland Burghley, confirming the highlight logic tracks each
  school's own real `shape` value correctly, not a fixed/stuck state.

## Checks

`tsc --noEmit` and `eslint` clean across every touched and new file.
