### F-23 (with F-26): the local shape at a 16+ intake

**Ages 11 to 15, not 4 to 15.** The prompt says 4–15, but the triage note on F-23 and F-26 (6 Nov, later than the prompt) makes them one request. F-26 refines F-23: "needs to show ages 11-15 in the feeder schools and in the feeders area". So at 16+ the local shape and the feeder cards both cover ages 11–15, and primaries aren't counted at 16+. That makes F-26 done by the same change.

**What changed at 16+** (`views-api.ts` `shapeView`, `ShapeAndSize.tsx`):
- **The set:** the current feeder set a year below entry (age 15), with the school left out. These are the same schools as the feeder cards beside it: the 10 nearest state secondaries (`DEFAULT_SECONDARIES`, 11–16 schools first), or a saved rung list or feeder lists. Before, the set was the youngest rung's 15 nearest primaries, ages 4–10.
- **What it counts:** ages 11–15 only, so a secondary's sixth form doesn't shape "the area you recruit from". The classifier runs on that summed profile.
- **The cards:** the set's schools at age 15, in the set's order, each with a row per age 11–15 (age 15 highlighted). Each card's shape label and XS–XL size are unchanged.
- **The words:**
  - the caption reads "All pupils aged 11–15 in the 10 nearest secondaries (schools teaching 11 to 15), together." (with a saved list: "the N schools on your saved list");
  - the cards say "A row per age, 11–15";
  - the (i) text (`methods-admissions.ts`) names the 16+ set and ages.

**Leighton Park (110110):**

| Intake | Local shape | Cards |
|---|---|---|
| 16+ (new) | **Tube**: 8,037 pupils aged 11–15 in 10 secondaries (Maiden Erlegh School in Reading, Oakbank, Maiden Erlegh Chiltern Edge, Gillotts, Langtree, Frogmore, Sandhurst, The Hurst, Bohunt Farnborough, Calthorpe Park) | the same 10 at age 15, 5 rows each |
| 11+ (unchanged) | Funnel: the 15 nearest primaries, drawn over ages 4–10 | the same 15 at age 10, 7 rows each |
| 4+ (unchanged) | Funnel: the same 15 primaries, drawn at age 4 only; the caption reads "aged 4–4" | the 15 at age 4, 1 row each |

**Not changed, noted:**
- **4+:** "aged 4–4" could read "aged 4".
- **Custom ages from 12+ to 15+:** these still draw the primaries' local shape beside age-below secondary cards. Nobody has raised either; both are in OPEN_QUESTIONS.

**Test: R-LOCAL-SHAPE-16** (new rule, `admLocalShape16`; real data, read-only). It passes:

> 16+ ages=11-15, 16+ schools=10, 16+ cards=10x5, 11+ ages=4-10, 11+ schools=15, 11+ cards=15x7

At 16+ it checks:
- `localShape.ages` is [11, 15];
- the set is the pipeline's age-15 set without the school, and the cards are those schools in that order;
- the bars are ages 11–15 and every card has 5 rows;
- the caption is as above.

At 11+ it checks round 1's output: no ages, the youngest rung's 15 primaries, bars 4–10, 7-row cards, round 1's caption.

**Checks (branch `v0.8-fdg-f23`):**
- **tsc:** clean (after `next typegen`).
- **eslint:** 0 errors. The 3 warnings are in files this change doesn't touch.
- **`next build`:** clean.
- **Unit tests:** 536 / 536 (`src/**/*.test.ts`, each file on its own).
- **Catalogue unit tests:** 77 / 77.
- **Rule tests:** 128 PASS, 0 FAIL (MANUAL 15, NONE 19, SUPERSEDED 6).
- **Catalogue docs:** regenerated (168 rules).

**Parity (Admissions, every view, DOM):** base `8f6e8b7` against the branch. Each tree rendered every Admissions view with its own code (`AdmissionsEveryView`, as the rule tests render it, at width 900) over live data, read-only. The schools were 110110, 137625 and 117037, at 4+, 11+ and 16+.
- **4+ and 11+:** all 6 pairs byte-identical.
- **16+:** all 3 pairs differ, in 38 hunks each, and every hunk is inside Pipelines' Shape and size (the local shape and its feeder cards). That is the allowed difference. The data each route returns is identical apart from `shape.localShape` and `shape.localProfile`, so figures are unchanged.
- **Pixels:** not run, because no classes or CSS changed and the 4+ and 11+ markup is identical.

**Screenshots:** in `docs/v0.8/feedback_deploy_gate_screenshots/f23/`. They come from the Admissions preview harness, fed with Leighton Park fixtures from the branch: `leighton_park_16p_light.png`, `leighton_park_16p_dark.png`, `leighton_park_11p_light.png`, `leighton_park_11p_dark.png`.
