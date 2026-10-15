# VicData — Children in an area, projected forward: the method

Method note, 15 Oct 2026. This note is the single description of the method, and both repos follow it. The ingest computes the rates and the area functions; the app draws the results and writes each chart's (i) from the settings stored with the results. If the method changes, this note changes first.

## Why this replaces ONS's projection on school-age views

ONS's 2022-based subnational projection (`ons_snpp`) has already drifted from ONS's own estimates by 2025. In inner London it is far too high: ages 11–15 run +19% in Kensington & Chelsea, +17% in Camden and Westminster, and +14% in Tower Hamlets. In growth districts and Midlands cities it is too low: −7% in Tewkesbury, −5% in Stoke and Hartlepool. By 2035 it has Camden with more 10-year-olds than babies born in 2025, although Camden has kept only 61–71% of each group of babies to age 10 in every year since 2012.

Almost every child of school age in the next ten years has already been born, so a forward line can be built from children already counted and from each area's own record of families moving in and out. ONS's projection stays available as a faint comparison line.

## Definitions

- **Count:** ONS mid-year estimate of residents by single year of age. Local authorities (districts and unitaries, 296) come from `ons_population_age` (2012 to the latest year). Neighbourhoods (LSOA 2021) come from `lsoa_population` (2011 to the latest year).
- **Ageing rate** for authority *L*, age *a* (0–17), year *t*: the number aged *a*+1 in *L* at mid-year *t*, divided by the number aged *a* in *L* at mid-year *t*−1. It is the same group of children a year later in the same place. A rate above 1 means more children moved in than out (or died); below 1 means more moved out. Deaths in childhood are very small, so the rate is almost entirely moving in and out.
- **Normal years and exceptional years:** the years held in the settings as exceptional are left out of the middle line (from settings version 2 they are kept in the band: see below). The default is years to mid-2020, 2021, 2022, 2023 and 2024: Covid in 2020–21, and the exceptionally high migration of 2022–24. Every year not on that list counts as normal, so years from mid-2025 on join automatically. The list is a setting, not code.

## The settings (stored with every result, and shown in the (i))

| Setting | Default |
|---|---|
| Exceptional years (left out) | years to mid-2020, 2021, 2022, 2023, 2024 |
| Normal years used for the middle line | the five most recent normal years before the exceptional run (to mid-2015 … 2019), plus every normal year after it (2025 on) |
| Weighting | each pre-2020 year weight 1; each year from 2025 on weight 2 (the most recent evidence, after migration fell back) |
| Band | the lowest and highest of the projections made with each single year's rates, 2013 on, **exceptional years included** (settings version 2, Guy, 15 Oct 2026; version 1 used normal years only and caught the actual figure in only 28–64% of authorities in the back-tests) |
| Scenario line (optional) | rates averaged over the exceptional high years (to mid-2022 … 2024), labelled "if migration returned to 2022–24 levels" |
| Horizon | the latest estimate year + 11 |
| Ages | 0–18 |

## Step by step

1. **Rates.** For each authority, compute the ageing rate for every age 0–17 and every year from 2013 to the latest year.
2. **The middle rates.** For each authority and age, take the weighted average of the normal years' rates (settings above).
3. **The band.** For each year *y* from 2013 (normal and exceptional alike, from settings version 2), make a whole projection using that year's rates for every age (a real year's pattern, never a mix of extremes). The band is the lowest and highest of those projections in each future year.
4. **Ageing forward.** Start from the latest count. Each year, the number aged *a*+1 in year *t*+1 is the number aged *a* in year *t* times the rate for age *a*.
5. **Children not yet born.** Age 0 in a future year is the authority's latest age-0 count, moved by ONS's projected percentage change in age 0 from its own figure for the latest year (ONS's *change*, applied to the real starting point, never ONS's level). The band for these children runs from that figure down to births held flat at the latest count, or up to it, whichever way ONS's change points. A cohort that includes any child not yet born is drawn differently (hatched or lighter) and labelled "includes children not yet born". For secondary ages the line stays solid until about the horizon.
6. **An area around a school (any radius).**
   a. Take the neighbourhoods whose ONS population-weighted centroid lies within the chosen radius of the school.
   b. Each neighbourhood belongs to one authority (from NSPL postcodes; 2021 LSOAs nest in authorities, and any that don't are reported).
   c. Neighbourhood counts stop a year earlier than authority counts (mid-2024 against mid-2025). So step each neighbourhood from its latest year to the authorities' latest year with that authority's **actual** rates for that year, not the projected ones.
   d. Add the neighbourhoods up by authority and age, age each authority's group forward at that authority's rates (steps 2–5), then add the authorities together. Unborn children in the area are the area's share of its authority's age-0 count in the latest year, times the authority's projected age 0.
   e. Report the authority mix, e.g. "Within 5 miles: Reading 47%, Wokingham 46%, West Berkshire 6%, South Oxfordshire 1% of children aged 11–15".
7. **The authority view** (Area pill "local authority") is steps 1–5 on the authority's own counts. A county is the sum of its districts, each projected at its own rates.

## What it is, and isn't

- It is the **children living in the area**, projected from children already counted, at the area's own record of moving in and out. It is **not** a forecast of any school's roll, and it never says so; school roll projection is Victoria Consultancy's work, not the platform's.
- Every (i) on a chart using it includes this sentence: "A projection of children living in the area, not a forecast for the school."

## The (i), word for word in shape

Generated from the stored settings, so the text can't drift from the maths:

> **Sources.** ONS mid-year population estimates by single year of age: local authorities {first}–{latest} ({edition}); neighbourhoods (LSOA 2021) {first}–{latest} ({edition}). Births not yet counted: ONS 2022-based subnational projections, percentage change only.
> **Area.** {Within N miles of the school: neighbourhoods whose population-weighted centre lies within N miles ({k} neighbourhoods; authority mix …)} | {The local authority}.
> **How it is calculated.**
> 1. For each age, we measure how each authority's children changed in number from one year to the next as they got a year older: families moving in and out, and very rarely deaths.
> 2. We leave out {exceptional years}: Covid, and exceptionally high migration. We average the other years, giving {recent years} double weight.
> 3. We age today's children forward a year at a time, at those rates.
> 4. The band shows the lowest and highest results from using any single year's rates since {first year}, including {exceptional years}. It is a range of real years' patterns, not a confidence interval.
> 5. Children not yet born start from the latest count of babies, moved by ONS's projected change in births. They are drawn {lighter}.
> **Not a forecast for the school.**

## Back-test (the ingest reports it before anything is shown)

1. **Normal times.** Using only data to mid-2015, project every authority to mid-2019 (ages 4–10, 11–15, 16–17). Report the mean absolute % error, the worst 10, and the share within ±2%.
2. **The surge.** Using data to mid-2019 (normal years only), project to mid-2025. Report the same, against ONS 2022-based's own 2025 error. This is how wrong the method is when migration does something unusual. The band should catch most of it; report how often it does.
3. **Neighbourhood check.** For The Chase, Leighton Park and Acland Burghley at 5 miles, compare the area result (steps 6a–d) with the area's own observed year-on-year changes from neighbourhood history (2011–2024). Report it; don't use it.
