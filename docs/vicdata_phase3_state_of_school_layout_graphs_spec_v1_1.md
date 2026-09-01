# VicData — Phase 3: "State of the School" Page — Layout & Graphs (v1)
*New phase, started 2026-09-01, immediately after the "Current State of the School Roll" narrative generator shipped to production (see `claude/vicdata_phase3_state_of_school_current_state_narrative_spec_v2_draft.md`). Guy's own sequencing: text live first, layout/graphs second, deliberately kept as separate pieces of work. Companion to `vicdata_phase3_state_of_school_page_spec_v1.md` (the original content-scope spec for this page) — that doc describes what sections the page should contain; this one covers how they're arranged and drawn.*

---

## 0. Scope and origin

The narrative text now renders live on the State of the School page, but its layout relative to the page's existing panels (roll by phase, gender split, boarding, shape graph) hasn't been designed — the narrative generator work was scoped purely as text content, not placement. Separately, the existing panels have accumulated some real gaps: the gender pie charts don't share a colour system with the shape graph, there's no boarding-percentage pie chart yet, and there's no stat at all for how a school's boarding numbers compare to its local authority.

This doc tracks that work using the same discipline as the narrative project: discover the actual current state before designing against it, don't assume a design system exists just because the roadmap once planned one, verify Claude Code's reports before relaying them, fold decisions into this doc as they're made.

---

## 1. Guy's brief, 2026-09-01 (verbatim, lightly formatted)

- Create a 2-column layout at the top of the page: "Current state of school" (the narrative text) takes 6 columns; to the right, 6 columns hold the roll and gender split panels.
- **Gender panel**: recolour the pie charts to match the gender colours used in the shape graph, which should itself match VicData's defined colour palette.
- Below roll-by-phase and boarding: add a new pie chart to the boarding panel showing % boarding at the school. Check whether boarding/day-student colours are already defined anywhere.
- Below that: a new stat/graph — the school's % of boarders in that local authority.

**My reading of the right-column stacking order, inferred from the brief's own structure, not yet confirmed against the real current layout**: gender panel, roll-by-phase panel, boarding panel (gets the new pie chart), all within the 6-column right side of the top section; then the new LA-boarders stat sits below the whole 2-column top section, likely full width.

---

## 2. Open questions before build

1. **What exactly does "school's % of boarders in that local authority" mean?** Two readings: (a) this school's boarder headcount as a share of *all* boarders across every school in the LA — how dominant this school is in local boarding provision, parallel to the existing "makes up X% of the independent-sector pupils in this local authority" sector stat already on the page; (b) the school's own boarding percentage again, which would be redundant with the pie chart directly above it. **Proceeding on reading (a)** unless Guy corrects it — flagged, not yet confirmed.
2. **Does "VicData's defined colour palette" actually exist in the codebase yet?** Not found in any project doc — the roadmap only records a style guide as *planned* ("To be written down as a short style guide: colours, chart types per data shape, iconography"), not shipped. Needs a direct check of the actual code, not an assumption either way.
3. **Does the shape graph currently encode gender at all?**, and if so with what colour values. Not established — needs checking before "match the gender colours in the shape graph" can be executed.
4. **Are boarding/day-student colours already defined anywhere** (even in an internal-only chart)?
5. **Data availability for the new LA-boarders stat**: is boarder headcount (not just percentage) reliable per school, and is there already any LA-level aggregate, or would this need a new precomputed table similar to `census_age_gender_cache` (built last round for the Topic 3 LA-average work)? If so, does it risk the same Hampshire/Birmingham-class large-LA performance issue already found and fixed once this round?
6. **Current page structure** — component names, current arrangement, and layout system (grid/flexbox/column framework) in actual use today. Not documented anywhere in the project; needs a direct look at the real code before designing a 2-column, 6/6 layout against it.

---

## 3. Discovery prompt sent to Claude Code, 2026-09-01

> New phase: page layout and graphs for the "State of the School" page, now that the narrative text is live. Discovery first, no building yet — report back before we design anything.
>
> **1. Current page structure.** What does the State of the School page actually look like right now — component names, current arrangement of the narrative text, the roll-by-phase panel, the gender panel, the boarding panel, and the shape graph. What layout system is in use (CSS grid, flexbox, a column framework) — is a 12-column-style grid already the pattern used elsewhere on the site, or would introducing one here be new?
>
> **2. Color definitions — three separate checks.** (a) Does the existing shape graph encode gender at all, and if so what hex/token values does it currently use? (b) Is there a formal design-tokens file, theme config, or style guide anywhere in the codebase (Tailwind config, CSS variables, a colors.ts, anything) that constitutes "VicData's defined colour palette" — or does color choice currently happen ad hoc per component? Report exactly what exists, don't infer a system that isn't there. (c) Are boarding/day-student colors defined anywhere already (any existing chart, even an internal one)?
>
> **3. Data availability for a new stat: this school's boarders as a % of all boarders across every school in the LA.** Do we have boarder headcount per school (not just boarding percentage) reliably enough to sum across an LA? Is there already an LA-level aggregate anything like this, or would it need a new aggregate similar to the `census_age_gender_cache` table just built for the Topic 3 LA-average work? Flag if the same Hampshire/Birmingham-class performance risk applies to summing boarders across a large LA's schools.
>
> Report back with what you find for all three — we'll design the actual layout and chart specs from that, not before.

**Status: prompt sent, report not yet received.**

---

## 4. Discovery report received, 2026-09-01 — findings

**1. Current page structure, confirmed real.** `src/app/schools/[urn]/page.tsx` renders into `DashboardGrid` (`src/components/dashboard/Card.tsx`) — a real `grid grid-cols-12 gap-5` with `gridAutoFlow: dense`, built 2026-08-28 specifically for this page. Cards declare one of four size tiers: small (4 cols), medium (6), wide (8), full (12), stacked on mobile, real size at `lg`. Current top-to-bottom order: `CurrentStateNarrative` (full — the narrative text just shipped), `RollCard` (medium — total roll + LA sector-composition donut), `PhaseBreakdownCard` (wide — roll-by-phase, XS–XL badges vs regional/national), `ShapeCard` (full — `ShapeChart` this-school-vs-peer plus `PopulationTrendSection` nested inside), `GenderSplitCard` (medium — two donuts; exact composition of the second donut wasn't legible in the paste, needs confirming), `BoardingCard` (small — plain text, no chart currently), then `PaidTrendsSection`, `SurroundingSchoolsCard`, and `ComingSoonCard` stubs. **The 12-col grid is this page's own established pattern**, not new to it — but no other page on the site uses a grid (home, join, sets, account, login, comparator/feeder-set builders are all simple centred flex/max-width single columns), so this stays scoped to this page, not a site-wide precedent.

**2. Colour definitions — three findings, one important tension.**
- **(a) Shape graph gender colours are real, but self-flagged as provisional and unwanted.** `ShapeChart.tsx` uses `TAG_COLOURS.Boys` (#155e75 light / #67e8f9 dark, cyan) and `TAG_COLOURS.Girls` (#9d174d light / #f9a8d4 dark, pink), properly theme-aware via CSS custom properties. **But this exact pairing is flagged provisional in both a code comment and `docs/OPEN_QUESTIONS.md` (2026-08-27) — Guy's own prior note says he doesn't want a stereotypical pink/blue pairing long-term and wants to revisit it.** `GenderSplitCard`'s current donut already uses the same two hex values, but only the light variant — not theme-aware, unlike `ShapeChart`. **Decision needed**: match `GenderSplitCard` to `ShapeChart`'s current cyan/pink as asked (accepting a colour scheme already flagged as not-final), or treat this round as the moment to pick new gender colours properly, in both places, since we're touching this anyway? Separately: fix `GenderSplitCard`'s missing dark-mode branching while recolouring, or leave that for later?
- **(b) No formal design-tokens file exists** — `globals.css` (Tailwind v4, no `tailwind.config`) defines only `--background`, `--foreground`, and font variables. The closest thing to a real shared palette is a `TAG_COLOURS` registry (exact file path not fully legible in the paste) — a genuine single source of truth for sector/boarding/phase/gender tag colours, used by filter buttons, `TypologyTags` pills, and now the shape chart. **But it's inconsistently applied**: `RollCard.tsx` defines its own local `SECTOR_COLOUR` (State #3f5f8a, Independent — value not legible) for its sector donut, using completely different hex values from `TAG_COLOURS`' own State (#15803d, green) / Independent / FE (#86198f, fuchsia) used everywhere else including this same page's own pills. The roll-by-phase card similarly hardcodes its own band colours, none from `TAG_COLOURS`, none dark-mode aware. **Out of scope for this round unless Guy wants it folded in** — not what was asked (gender, boarding), but a real, pre-existing inconsistency now visible.
- **(c) Boarding/day colours already exist and are ready to reuse.** `TAG_COLOURS.Boarding` (#9a3324 light / #f4a58f dark, coral), `.Day` (#075985 light / #7dd3fc dark, sky), and a "Boarding & day" mixed category (exact value not legible in the paste — needs confirming). Currently used only for `TypologyTags` pills — no chart, including `BoardingCard` itself (currently plain text, no colour treatment), applies them yet. Clean to reuse directly for the new boarding pie chart.

**3. Data for the LA-boarders stat — cheap to add, two caveats.** Per-school boarder headcount is reliable (same source as everything else, with the same male+female-vs-total consistency check already built in). **An LA-level aggregate already exists** — `roll_aggregates` (built 2026-08-07 for the rolls-spec §3 regional/national aggregates), has a `boarders_total` column summed per LA across every mainstream school, populated by `scripts/sync-roll-aggregates.ts` using the same accumulate-then-upsert pattern as the `census_age_gender_cache` table built last round. Confirmed populated with real 2025-period data (Worcestershire 2,049 boarders, Birmingham 153, computed 2026-08-07). **Not currently wired up** — the page's existing aggregate query only selects `total_roll`, `school_count`, `shape_label`, not `boarders_total`; adding the stat is one extra column plus `school.boarders / laAggregate.boarders_total * 100`, no new table or sync script needed. **No Hampshire/Birmingham-class performance risk** — this is a small, indexed, precomputed table already queried live on this page for other fields, not live aggregation over raw census rows.
   - **Caveat 1**: `roll_aggregates.boarders_total` is all-sector combined (state + independent + FE), no sector split. Topic 3's convention elsewhere on the page is same-sector comparison — if that's wanted here too, this aggregate needs a new sector dimension added. **Decision needed.**
   - **Caveat 2**: last computed 2026-08-07 (~3.5 weeks stale as of today), and none of the three sync scripts now in the codebase (`roll-aggregates`, `age-profile-aggregates`, `census-age-gender-cache`) have any scheduled job — all manually re-run. Recommend a fresh sync before shipping this stat. Worth a separate note that none of these are automated yet, though DfE census itself only updates annually so this may not be urgent to fix now.

**Status: discovery complete, no build yet.** Waiting on Guy's decisions (gender colour approach, dark-mode fix scope, sector-colour inconsistency in/out of scope, LA-boarders sector split) plus two clean re-checks (`GenderSplitCard`'s second donut composition, the "Boarding & day" hex value) before the build prompt is drafted.

---

## 6. Colour strategy — DECIDED (Guy, round 2, 2026-09-01)

**Not a recolour project. A consistency project.** Guy plans to actually recolour the palette later, as its own separate piece of work — right now, every place a semantic tag colour appears (sector, boarding, phase, gender — in tags/pills *and* in charts) should read from the one shared `TAG_COLOURS` registry, so that a future recolour is a single-place edit that propagates everywhere at once, rather than needing to be found and changed in five different hardcoded locations again.

**This resolves the earlier tension directly**: `GenderSplitCard` does get recoloured to match `ShapeChart`'s current cyan/pink — not because those are the final colours (they're still flagged provisional, still Guy's to revisit later), but because matching them now via the shared registry is what makes the *later* recolour trivial. Concretely, this round:
- `GenderSplitCard`'s donut switches from its own hardcoded light-only hex values to `TAG_COLOURS.Boys`/`.Girls`, and picks up proper light/dark theme branching (CSS custom properties, matching `ShapeChart`'s existing pattern) — needed so a future palette change actually propagates correctly in dark mode too, not just light.
- `RollCard`'s sector donut — previously flagged as a separate, out-of-scope inconsistency (its own local `SECTOR_COLOUR`, different hex values from `TAG_COLOURS`' State/Independent/FE) — is now in scope: switches to `TAG_COLOURS` directly, same reasoning.
- The new boarding pie chart uses `TAG_COLOURS.Boarding`/`.Day` directly, as already planned.
- **Open question, still unanswered**: does this consistency principle extend to `PhaseBreakdownCard`'s hardcoded band/badge colours (`BAND_COLOUR`, `ACTIVE_BG`, etc.)? These aren't an existing `TAG_COLOURS` category (no per-age-band semantic tag exists today) — a different kind of colour-coding (a size scale, not a tag), so it's not obviously covered by "tags, graphs etc." Not included in this round's build; left for a future round.

## 7. LA-boarders stat — DECIDED (Guy, 2026-09-01): no sector split, and only shown when the school itself has boarders

**No sector split needed** — resolves the caveat 1 open question from §4: the all-sector `roll_aggregates.boarders_total` is fine as-is, no new sector dimension required.

**New display rule, clarified (Guy, round 4): the gating only applies to the new LA-context stat, not to the school's own boarding pie chart.** Two genuinely different things, easy to conflate since both are boarding-related and sit in the same card:
- **The school's own day/boarding pie chart (§8 item 3, in `BoardingCard`) renders for every school, unconditionally** — a day-only school simply shows 100% day / 0% boarding. This is a fact about the school itself, true and meaningful (if unremarkable) for any school.
- **The LA-boarders stat (this section, item 4) only renders when `school.boarders_total > 0`** — hidden entirely for day-only schools, because a school with zero boarders has nothing meaningful to say about its share of LA boarding provision; the stat is genuinely irrelevant to it, not just uninteresting.

---

## 8. Build prompt sent to Claude Code, 2026-09-01

> Round 3: build the layout/colour-consistency/boarding-stat work now that the open questions are resolved. Spec: `claude/vicdata_phase3_state_of_school_layout_graphs_spec_v1.md` §4–§7 in the VicData project.
>
> **1. Top-of-page layout.** `CurrentStateNarrative` changes from full-width (12 cols) to 6 cols. To its right, a 6-col slot stacks `RollCard` and `GenderSplitCard` (both already medium/6-col — this is a repositioning, not a resize). `PhaseBreakdownCard` and `BoardingCard` stay below this new top row, in their current relative order. **`ShapeCard`'s position wasn't specified in the brief** — leave it exactly where it currently sits in the stacking order unless that visually conflicts with the new top row, in which case propose where it should go and flag it rather than deciding silently.
>
> **2. Colour consistency — not a recolour, a wiring fix**, so that a future palette change (Guy's own, separate, later project) is a single edit to `TAG_COLOURS` that propagates everywhere at once:
> - `GenderSplitCard`'s donut: switch from its own hardcoded light-only hex values to `TAG_COLOURS.Boys`/`.Girls`, matching `ShapeChart`'s current values, and add proper light/dark theme branching via CSS custom properties, matching `ShapeChart`'s existing pattern (currently `GenderSplitCard` is light-only).
> - `RollCard`'s sector donut: switch from its own local `SECTOR_COLOUR` constant to `TAG_COLOURS`' State/Independent/FE values directly.
> - Re-verify `GenderSplitCard`'s exact current second-donut composition directly from the code before touching it — this wasn't fully legible in the last report.
>
> **3. New boarding pie chart, added to `BoardingCard`. Renders for every school, unconditionally** — including day-only schools, which simply show 100% day / 0% boarding. Shows this school's boarding % (boarders vs day pupils, two slices) using `TAG_COLOURS.Boarding` (coral) and `.Day` (sky) directly — these are already defined and unused elsewhere, no new colour decision needed.
>
> **4. New LA-boarders stat**, placed below the existing panels (confirm full-width or otherwise sensible given the new top layout). Add `boarders_total` to the page's existing `roll_aggregates` query (currently only selects `total_roll`, `school_count`, `shape_label`) and compute `school.boarders_total / laAggregate.boarders_total * 100`. No sector split — the existing all-sector aggregate is fine as decided. **This one only — only render this stat when `school.boarders_total > 0`** — hidden entirely for day-only schools, for whom it's genuinely irrelevant, not just uninteresting. (Do not apply this gating to item 3's pie chart — that one always renders.) Run a fresh `sync-roll-aggregates.ts` before this ships, since the aggregate was last computed 2026-08-07 and none of the sync scripts run on a schedule.
>
> **Not in this round**: `PhaseBreakdownCard`'s band/badge colours (still an open question, not yet answered), and any change to the actual gender/sector/boarding hex values themselves (that's Guy's separate future recolour project — this round only wires existing values to the shared source consistently).
>
> Report back with: how the top-of-page layout actually renders (describe it, and flag if `ShapeCard` needed to move), confirmation the colour wiring works in both light and dark mode, the boarding pie chart working on a real school, and the LA-boarders stat rendering correctly (including correctly *not* rendering for a day-only school) plus the commit reference once it's ready to ship.

---

## 9. Round 3 report received, 2026-09-01 — built and committed locally, one figure needs reconciling before push

**Committed as `1b1ebac` on `main`, not pushed** — this round was scoped as build-and-report only, not go-live.

**Layout**: `CurrentStateNarrative` is now `size="medium"` (6-col), sibling to a new wrapper div (`col-span-12 lg:col-span-6`) stacking `RollCard` and `GenderSplitCard` — CSS grid's implicit row placement fills them side by side (6+6=12) with no nested sub-grid needed. `ShapeCard` didn't need to move — its `size="full"` (12-col) always starts a fresh row by construction, so it can't conflict with row 1. Confirmed structurally (exact class list extracted from rendered HTML), **not visually** — Chrome browser automation was blocked by a permission classifier this session, so no actual screenshot was taken. Worth a real look once the page is checked directly. Minor note flagged for later: if the narrative and the Roll+Gender stack end up meaningfully different heights, CSS grid's default row-stretch will leave empty space at the bottom of the shorter column.

**Colour consistency**: confirmed working both ways. `GenderSplitCard` already had the right values (`TAG_COLOURS.Girls`/`.Boys`), just wasn't theme-aware — now ported to the same scoped CSS-custom-property pattern as `ShapeChart`, confirmed matching in both light and dark blocks. `RollCard`'s sector donut confirmed swapped (State now #15803d green, not the old #3f5f8a blue).

**Boarding pie chart**: renders unconditionally as specified — Malvern (boarding) shows the correct 72.48% split; Bewdley (day-only) renders a plain 0%-boarding circle rather than being hidden, exactly as decided in §7.

**LA-boarders stat — logic confirmed correct, but the underlying total needs reconciling before this ships.** Malvern renders "31.7% of all boarders in Worcestershire board here. 453 of 1,427 boarders..." — the arithmetic checks out (453/1,427 = 31.75%, rounds to 31.7%) and Bewdley's card is correctly absent (`boarders_total = 0` gate working). **But Worcestershire's total boarders figure has moved from 2,049 (as reported computed 2026-08-07, in §4 above) to 1,427 now** — a ~30% drop between two runs that are both supposed to be summing the same 2025-period census data across the same schools. The sync script did hit a timeout this run and needed retry-with-backoff added before it completed — worth asking directly whether the retry logic itself is producing a correct full sum (e.g. not double-counting on retry, or conversely not partially failing silently on some schools) rather than assuming the fresher number is automatically the correct one just because it's fresher. **Not yet asked of Claude Code — needs a direct reconciliation question before this ships or is trusted as final.**

## 10. Not yet started

Whether `PhaseBreakdownCard`'s band/badge colours should also migrate to a shared source (§6, still unanswered) — a future round, not blocking this build.

The Shape-panel restructuring and Surrounding-Schools/Regional-National panel move requested by Guy 2026-09-01 (§11 below) — discovery not yet done.

---

## 11. Round 4 — Shape panel restructure, Guy's brief 2026-09-01

- **Shape panel**: remove the "peer matched" content currently on the right of the panel (the `AggregateShapeChart` comparison), and replace it with the `SurroundingSchoolsCard`'s content instead.
- **Add a new bar graph** illustrating that surrounding-schools data — one bar per school in the comparison set, showing school size (roll). Other schools' bars are grey and anonymised (numbered, not named); the focus school (this school) is named and its bar coloured distinctly so it visually stands out.
- **Move the "Regional & National Context" panel** up into the page slot that `SurroundingSchoolsCard` currently occupies (since that card's own content is moving into the Shape panel, its old slot is free).

**Not yet understood, needs discovery before a build prompt is drafted**: what exactly the current "peer matched" content in the Shape panel is (confirmed to be `AggregateShapeChart` per earlier discovery, but its exact current display needs checking); what `SurroundingSchoolsCard` currently contains and how its data is fetched (the nearest-20-schools mechanism from `vicdata_phase3_state_of_school_page_spec_v1.md` §3); and what component "Regional & National Context" actually refers to — this name hasn't come up in any prior discovery report. It may be `PopulationTrendSection` (already confirmed nested inside `ShapeCard`, per §4 above) under a different display name, or a separate, currently-stubbed component (`PaidTrendsSection` and unnamed `ComingSoonCard` stubs were mentioned in the original page-structure discovery but not itemised). Needs a direct check, not a guess.

---

## 12. Round 4 report received, 2026-09-01

**Task 1 — the Worcestershire boarders_total "discrepancy" from §9 was not a real bug — it was my own misreading of a corrupted paste.** Confirmed against the exact round-2 tool output (single query, one timestamp, 2026-08-07T17:57:57): Birmingham 153, Hampshire 2,049, Worcestershire 1,427. The earlier garbled report dropped Hampshire's row in transmission, and when I reconstructed the missing text I attributed Hampshire's 2,049 to Worcestershire — an error in my own reconstruction, not something Claude Code got wrong. Three independent runs of `sync-roll-aggregates.ts` this round (spanning the retry-logic fix) all reproduce Worcestershire at exactly 1,427 and Hampshire at exactly 2,049; `school_count` ticked up 254→255 between runs, consistent with ordinary incremental school-data growth over the intervening weeks, not aggregation instability. **Nothing to fix — the number was correct and stable all along.** Logged here in the interest of the same honesty this doc has applied to everyone else's mistakes.

**Task 2 — Shape-panel restructure discovery, clean:**
- **`AggregateShapeChart`** currently renders a grey, single-sided (deliberately no boy/girl split — free tier) horizontal bar chart, ages 4–18, showing the *pooled* profile across the whole matched comparison group — not one bar per school. Built from `aggregateSurroundingStat()` in `surrounding-schools.ts`, itself built from `findSurroundingSchools()` (nearest_schools RPC on distance + sector with a 40-candidate buffer → phase-tag-set intersection → exact gender match → skip schools with no real census data → first N nearest-first).
- **`SurroundingSchoolsCard`** currently renders a free-tier prose summary (`buildSurroundingSummary` — this school's size/sector/gender/phase vs. the matched pool, e.g. "...25% above the average roll of 342 for the 10 nearest independent senior schools"), a "combined shape is X" clause, a member-gated caption, and the real named list (`SurroundingSchoolsMemberList`, client-fetched, calling `findSurroundingSchools()` again independently — so free and member tiers can never disagree about which schools are "the N").
- **Correction to this doc's own earlier premise**: the comparison set is **nearest-10 today, not nearest-20** — `TARGET_COUNT = 10` in `surrounding-schools.ts`, explicitly commented as reduced from 20 during an earlier "Public View rebuild." The nearest-20 figure came from the original `vicdata_phase3_state_of_school_page_spec_v1.md` §3, which is now stale on this specific point.
- **"Regional & National Context" = `Regional.tsx`** — a separate, already-shipped small (4-col) card, literal eyebrow text "Regional & national context," showing LA/national school-count and pupil totals from `roll_aggregates`. **Not** `PopulationTrendSection` (nested inside `ShapeCard`, titled "Population trend in the area," a different dataset — population trend, not school/pupil counts) and not a `ComingSoonCard` stub.
- **Useful implications for the build**: `findSurroundingSchools()` already returns each matched school's own `totalRoll` server-side (`matchedSurrounding` in `page.tsx`) — just not currently exposed per-school to any chart, only pooled. A new bar-chart component can consume that array directly, no new data plumbing needed. The grey/anonymised/numbered treatment for non-focus schools also isn't a new rule — it matches an existing free-tier principle already enforced in this exact module (never show real names without membership; those stay behind `SurroundingSchoolsMemberList`'s own auth gate). The slot-swap itself is mechanically simple: `SurroundingSchoolsCard` and `RegionalNationalCard` (`Regional.tsx`) are already sequential `DashboardGrid` children in that order — moving Regional & National up is a relocation, nothing structural.

## 14. Round 5 report received, and go-live decision, 2026-09-01

**Round 5 confirmed clean.** Malvern's focus bar (625 pupils) cross-checks exactly against round 4's independently-reported boarding arithmetic (453 boarders ÷ 72.48% = 624.9 ≈ 625) — two numbers from two separate rounds agreeing, not just individually plausible. The prose summary's "55% above the average roll of 404" checks out (625/404 = 1.547 → 55%), and the peer average (404.3) matches the chart's own bars, confirming one shared data source rather than a second, possibly-diverging calculation. The standalone post-16 fallback was specifically tested and shows the correct "not enough nearby comparable schools" message rather than an empty chart.

**Decided (Guy, 2026-09-01): add the focus-school gold colour (#a97a1f) to the shared `TAG_COLOURS` registry as a proper token, rather than leaving it a one-off hardcoded hex in the bar chart component** — so it's included in the same future one-place recolour as everything else, even though it's a different kind of colour (a UI highlight, not a sector/gender/boarding tag).

**Decided: push live.** Both round 3 (`1b1ebac`) and round 5 (`c06a523`) are committed locally, not yet pushed. Go-live prompt below.

## 15. Go-live build prompt, 2026-09-01

> Two things, then ship. Spec: `claude/vicdata_phase3_state_of_school_layout_graphs_spec_v1.md` §14 in the VicData project.
>
> **1. Add the focus-school gold colour to `TAG_COLOURS` as a proper token** (e.g. `TAG_COLOURS.Focus` or similar — name it consistently with the existing entries), light/dark variants as needed matching the pattern already used for Boys/Girls/State/Independent/FE/Boarding/Day. Update the new surrounding-schools bar chart to read from it instead of its current hardcoded #a97a1f. This is purely a wiring change — same visual colour, just sourced from the shared registry so a future recolour project reaches it too.
>
> **2. Before pushing, run one more full regression** across the four original narrative go-live schools (Malvern, King's, Leighton Park, Bewdley) plus the standalone post-16 fallback case already tested, checking the whole page end to end this time — not just the pieces touched in isolation each round: the new 2-column top layout, both recoloured donuts in light and dark mode, the boarding pie chart (both a boarding and a day-only school), the LA-boarders stat (present and absent correctly), and the restructured Shape panel with its new bar chart. Confirm nothing regressed across rounds 3–5 now that they're all combined.
>
> **3. Push `1b1ebac`, `c06a523`, and the token-wiring commit to `origin/main`, and deploy.** Report back with: confirmation the focus-colour token works correctly, the full regression result, the final commit reference(s), and the live URL.

## 16. Round 5 build prompt, 2026-09-01 (superseded — see §15 for the actual go-live prompt sent)

> Build the Shape-panel restructure. Spec: `claude/vicdata_phase3_state_of_school_layout_graphs_spec_v1.md` §11–§12 in the VicData project.
>
> **1. Shape panel.** Remove `AggregateShapeChart` from the right side of `ShapeCard`. Replace that slot with `SurroundingSchoolsCard`'s existing content (the free-tier prose summary, the "combined shape is X" clause, the member-gated caption, and the real named list behind its existing auth gate) — moved in, not duplicated. `SurroundingSchoolsCard` no longer exists as its own separate `DashboardGrid` card once its content has moved. `PopulationTrendSection` (also nested inside `ShapeCard`) is untouched — not part of this restructure. If `AggregateShapeChart` becomes fully unused anywhere else on the page, flag it rather than deleting it outright — we may want it again later.
>
> **2. New bar chart**, added alongside the moved content: one bar per school in the nearest-10 comparison set (`matchedSurrounding` in `page.tsx` already has each school's `totalRoll` — use it directly, no new query needed), showing roll size. Non-focus schools render grey and anonymised/numbered (1, 2, 3…), consistent with the existing free-tier rule already enforced elsewhere in this module — no real names without membership. The focus school (this school) is named directly and its bar coloured distinctly so it visually stands out against the grey bars.
>
> **3. Slot swap.** `RegionalNationalCard` (`Regional.tsx`) moves up to occupy the page slot `SurroundingSchoolsCard` previously held, now that the latter's content lives inside the Shape panel instead. This is a straightforward relocation of two sequential `DashboardGrid` children — no data or logic changes to `Regional.tsx` itself.
>
> **This is a first pass on layout, not a final pixel spec** — the right side of the Shape panel now holds several pieces of content (prose summary, shape clause, the new bar chart, the member-gated caption/list); arrange them sensibly and describe the actual result rather than guessing we'll want a specific arrangement locked in. Report back with: how the Shape panel's right side actually looks now (component order, roughly how it reads), confirmation the bar chart renders correctly with real data (grey/numbered vs. focus-school-coloured) on at least one real school, and where `RegionalNationalCard` landed after the slot swap. Build and report only, as before — don't push/deploy without being asked.
