# Teacher view — dashboard card mechanism, Round 7 (polish) — build report

Covers `vicdata_phase3_teacher_view_dashboard_card_mechanism_round7_polish_brief_v1.md` and its companion prompt. A direct follow-on to round 6, found by walking the deployed GCSE dashboard rather than the wireframe.

Six commits, each `tsc --noEmit` / `eslint` / production-build clean before the next, each pushed as it landed.

| | commit |
|---|---|
| §7 the period/value bug | `a118338` |
| §§1–3 header, headings, icon rows | `fdc79a8` |
| §§4–5 chart type by data length, bar autoscale | `4048128` |
| §8 Context two pills | `49a55d1` |
| §9 Comparisons subject-specific | `47fc77d` |
| §9 follow-up: loading state | `e4eaf3b` |

**On §0 (phase parity).** Every fix landed in a component KS4 and KS5 already share — `DashboardColumn`, `CardBox`, `ColumnPanels`, `TrendChart`, `VerticalBars`, `SubjectPanels`, `ComparisonsPanels`, `PillMenu`. There is no `phase ===` branch in any of the changes. Parity here is structural, not something I did twice and checked twice; the one thing that genuinely differs per phase is *which measures exist*, which was already the case. The live half of that claim is still outstanding — see Verification.

---

## §7 — The bug (done first, since it was the one with a confirmed repro)

**Traced, not guessed.** `academic_subject_headline` *has* rows for 2020/21 — entries were recorded — but `avg_point_score` is null for every school and every subject that year, nationwide, exactly as brief §6 found. So every Results trend arrived with a leading null period, and everything that read `periods[0]` named 2020/21 as the start of a series that genuinely begins in 2021/22: the panel's tag, the "From:" pill's label, and the narrative's "since …".

**Worth being precise about what was and was not wrong.** The *values* were always real — `endpoints()` has always skipped nulls — so "from X to Y" read real figures. It was the period they were attributed to that was invented. A 2021/22 figure labelled 2020/21 is not a real fact about 2020/21, which is why this reads as "neither is real" from the card even though half of it was.

It also explains the second symptom: the "From:" pill's *options* came from `periodsWithData` (correct, 2021 on) while its *label* came from `periods[0]` (2020), so the control and its caption disagreed with each other.

Confirmed not to be chart geometry, as the brief said — `TrendChart`'s line and its x-axis labels share one position formula and cannot drift apart.

**Fixed once, in a shared helper.** `trimToData()` drops leading and trailing periods where nothing is published; all three panel sets build their series through it, so the tag, the pill, the axis and the sentence cannot disagree about where a series starts. That is why the same symptom on Context's "All subjects" aggregate needed no separate fix — same helper, one change.

Interior gaps are deliberately left alone. A missing middle year is real, and `TrendChart` already draws it as a break rather than a line through it.

**One thing I could not reproduce.** The brief quotes the panel as reading *"grown from 4.9 to 5.2"*. For Maths (General) the code path produces "5.2 to 5.1" from the real 5.18 → 5.14, and I could not make it emit 4.9 from any input. The most likely explanation is that the chip was on "All subjects" across several ticked subjects, where a mean of 4.9 is plausible, and the panel was identified by the subject of interest. I have not claimed to fix something I could not reproduce: what is fixed and verified is the period attribution, which is reproducible and was wrong on every Results trend at every school.

Also fixed in passing: "All subjects**'s** average point score" — a plural takes a bare possessive, and it read as a typo on every aggregate trend.

## §§1–3 — Header, headings, icon rows

**§1** One header row per card: the shipped per-column icon, the card's short name, the question as its subtitle, "+ Add" on the right. The wireframe's arrangement with the real icon kept, per the brief — not the wireframe's plainer layout instead of it. §14's question survives as the subtitle, so the card gains a short name without losing the sentence. `COLUMN_TITLE` is one record shared by the header and onboarding step 4, so the two can't name a card differently.

Add moved out of `ColumnPanels` into `AddPanelButton` so it could sit in that row. Panel state still belongs to the page, which owns persistence.

**§2** The tinted pill behind panel headings is gone — on the real dashboard it read as a button, and nothing about "Current — 2024/25" is clickable. Plain text, 11px → 13px so losing the background isn't a demotion.

**§3** Exactly two icons top-right (fullscreen, remove — both act on the panel); the view-choice icons moved to their own row under the heading, beside the figure they change. The fullscreen glyph is the wireframe's, changed in `ExpandIcon` itself so every fullscreen control and the modal's close button stay one mark.

## §§4–5 — Chart type and bar scale

**§4** Three real years or fewer draws bars; four or more draws a line. It counts *real* years, not slots, and it respects the "From:" control — a four-year line cropped to three becomes bars, because the chart should suit what it's actually drawing.

The split lands exactly where brief §6 said it would: average point score has four real years (2021/22 on) and draws a line; Grade 4+ has two (2023/24 on) and draws bars. Same card, two DfE datasets, two real histories.

Bars keep zero as their floor where the line crops its axis. A bar read against a non-zero baseline exaggerates every difference — the last thing a three-point series should do — while a line is showing direction rather than magnitude.

**§5** Bar axes autoscale to the largest real value. Candidates' Current chart was rounding up to a "nice" number: a tallest bar of 231 against an axis top of 500, half the height, for no reason a reader could see.

## §8 — Context's two pills

Replaces round 6's combined dropdown. That was recorded last round as Guy's deliberate choice, so the reversal is stated rather than slipped in.

"Matching Comparisons' pattern exactly" is implemented as **literally the same component** — `PillMenu` is new and both columns use it, and Comparisons' own inline pills were refactored onto it in the same commit. A second lookalike is how "exactly" quietly stops being true the first time one copy gets a padding tweak. `ContextPicker.tsx` is deleted, not left behind.

One deliberate asymmetry inside the menu: every row closes the popover except "Selected subjects", which reveals its checklist underneath — closing there would hide the thing just asked for.

## §9 — Comparisons: Graph and Ranking follow the subject

Round 6 §6.7 recorded comparator data as whole-school-only. It was wrong, and the Map in the same column had been disproving it for rounds. So the subject chips stop belonging to the Map and become one selection for the whole column; Graph, Ranking, Trend and % change all read the chosen subject's real per-school rows via `subjectYearsFor` over the profiles the Map already loads. Nothing new is fetched to do it.

The Measure pill follows too: with a subject active the figure is that subject's own points per entry, so its label, format and scale change from Attainment 8 to Average point score rather than keeping a name that no longer describes the number. Every narrative names what's being compared — "3 of 11 on Geography average point score" is a different claim from "3 of 11 on Attainment 8".

Three things this needed beyond the swap:

- **The profiles fetch covers the union of all four sets**, not just the nearest ten, since the chip has to keep working whichever set "Compared against" is on. Same route, same call, longer urn list — and the dashboard route already resolves that same union server-side, so it's a known-sane size.
- **A real "Whole school" chip and an explicit no-subject state.** Without one, picking it fell straight back to the first chip, because the Map's own default is the first ticked subject. That default is kept, so the chips still mean what they always did.
- **Ranking moved to a shared `rankByValue()`.** Schools with no published figure are left *unranked* rather than placed last — "no data" is not a position, and that matters far more per-subject than whole-school, since a comparator that simply doesn't enter this subject now has nothing to rank. Ties share a position and the next rank skips.

Where the Map reports its own rank it still wins, because a figure beside a map should match the map.

**One defect I caught in self-review and fixed** (`e4eaf3b`): the per-subject rows arrive on the Map's heavier fetch, and with a chip active by default the other views rendered "No published figures for this comparison yet" while it was in flight — a claim about the data made before the data arrived. They now say they're loading, and their summaries hold back until there's something to summarise.

---

## Simplifications and judgement calls made without you there to confirm

1. **The % change chart keeps its padded axis and its ±10% floor**, while §5's autoscale went to the Current bar chart and the new trend bars. Nobody complained about % change, and it's the one chart where filling the height would hurt: with every subject inside ±1%, an axis of ±1% turns noise into a dramatic picture. Say the word and it's one line.

2. **§4's threshold reads the sliced series, not the full one.** Cropping a four-year line to three years with "From:" switches it to bars. I think that's right — the chart should suit what it's drawing — but the brief could also be read as "decide once from the underlying data".

3. **Bars use zero as their floor; the line still crops its axis.** Not specified. The reasoning is in §4 above; it means a bar chart and a line chart of the same series can look differently dramatic, which is intentional.

4. **Comparisons defaults to the first ticked subject, not Whole school.** That's the Map's existing behaviour, and "the same chip selection the Map already offers" pointed at keeping it. It does mean the card's default view changed from whole-school Attainment 8 to a subject. Whole school is one click away and the narrative always names which is active — but this is the most visible default change in the round.

5. **The subtitle in the new header row is the natural-language question**, not the wireframe's shorter descriptive line ("Entries this year, every subject you teach"). §14 treats those questions as load-bearing and they were already the card's heading; replacing them with new copy felt like a bigger change than a layout round should make unasked.

6. **"Context" as the column's short name**, where onboarding step 4 says "School Context". The header row is tight, and the round-7 brief calls it "Context" throughout. Onboarding still reads "School Context" — flagging in case you want them identical.

7. **§7's "4.9"** — see above. I fixed and verified the period attribution; I have not claimed to have fixed a figure I couldn't reproduce.

---

## Verification

**Checks:** `tsc --noEmit` clean. `eslint` at exactly its pre-existing baseline — 5 errors, 2 warnings, all in `SchoolSearch.tsx`, `account/page.tsx`, `PeerTrendChart.tsx`, `SchoolMap.tsx`, none touched this round. Production build passes. Every commit above was clean before the next began.

**Logic verified directly against expected values:**

- **§7, against the exact repro's real production numbers** (null, then 5.18 / 5.15 / 5.36 / 5.14 for 2021–2024): the series starts 2021/22, the tag's span starts 2021/22, the sentence says "since 2021/22" and never mentions 2020/21, and the "From:" options and label now agree. Plus trailing gaps, both ends at once, **interior gaps surviving untouched**, two series trimming together to the earliest period either covers, and an all-null series collapsing to empty rather than to a fake range.
- **§4, at the boundary itself** as the brief asks: exactly 3 → bars, exactly 4 → line. Plus nulls not counting toward the threshold, both real measures either side of it, and a cropped line becoming bars.
- **§9, that the fix is visibly doing something** rather than coincidentally matching, as §10 asks: on the same five schools, ranking on Attainment 8 and on one subject's points per entry give different orders, and our own school moves 3rd → 2nd. Plus a school with no figure for the active subject dropping out of the subject ranking while keeping its whole-school one, ties sharing a position, and "no figure" never being given one.

### Live click-testing: still blocked, same as round 6

Re-checked this session, not assumed:

- `http://localhost:3000/` → **401**. `ACCESS_GATE_ENABLED=true`, and `.env` says not to flip it without your go-ahead. I haven't.
- `/api/testing/preview-session?token=…` → **404**. `PREVIEW_ACCESS_ENABLED` / `_TOKEN` / `_EMAIL` are still unset locally, so the route fails closed as designed.

Either unblocks it: the preview link for the deployed site, or those three vars in `.env`. I still haven't minted a session with the service-role key — that's your call.

**Checklist to run, and what I'd want eyes on most.** Everything is live on `main`, so this is also the list if you're looking yourself. Against The Chase (URN 100053) for GCSE, and **the same school's 16+ dashboard**, which is the parity half I can't verify:

1. **§7 the repro** — Results → Trend → Maths (General). It should read "since 2021/22", never 2020/21, and the tag should say 2021/22–2024/25. Then a second subject with a genuine leading gap, per §10.
2. **§4 at the boundary** — Results on Average point score should draw a **line** (4 real years); switch to Grade 4+ and it should become **bars** (2 real years). Same card, one click apart — that's the clearest single test of this round.
3. **§9 doing something real** — pick a subject where the comparator set's own per-subject figures differ from their Attainment 8 order, and confirm the Ranking order actually changes against Whole school. This is the item most likely to look right while being subtly wrong, because a coincidentally-matching order proves nothing.
4. **§§1–3** — one header row with the real column icon and Add on the right; plain panel headings with no pill; exactly two icons top-right and the view icons under the heading.
5. **§8** — Context's two pills, and that they look and behave identically to Comparisons' (they're the same component, so any visible difference is a bug).
6. **Themes and width** — light/dark, and a phone-width pass on the new header row, which is the densest thing this round added.

**What I can say without the live check:** every figure is computed from data the dashboard route already returned, by functions verified above against expected values, and the phase-parity claim is structural — there is no per-phase branch in anything this round touched. What the live check covers that this doesn't is the signed-in wiring, the real map inside the new column-level chip selection, and how the new header row behaves at real widths.
