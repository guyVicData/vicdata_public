# VicData — Phase 3: "Current State of the School Roll" Narrative Generator (v2 draft)
*Tightened from Guy's hand-edits of the shipped v1 output for three real schools (Malvern College, The King's School, Leighton Park School), 2026-08-31. This is a working draft for the next revision pass, not a finished spec — provisional calls are marked as such throughout, and worked examples are provided so Guy can hand-edit this round the same way as the last.*

---

## 0. What changed from v1, and why

v1 shipped as eight separate topic-sentences in a fixed order. Guy's edits across all three schools converge on a genuinely different shape: four paragraphs, reordered, with several topics merged together. That restructuring is adopted directly below — it's consistent across all three examples, not a one-off. Where the three examples *disagree* with each other, this draft makes a provisional call (marked **PROVISIONAL**) rather than guessing silently, so the next hand-edit pass can correct it directly rather than requiring another round of discussion first.

**One item is not a template question at all and is logged separately in §6**: The King's School's real phase tag. Guy's edit relabels it "a through school with pupils aged 1 to 17" rather than "a senior school." If that's the correct tag, the shipped age-range fix (`observedSpanForPhase()`, built to crop out what looked like a stray age-1 nursery record) may be silently deleting a real cohort at every through-school, because it assumed the wrong phase tag was the truth. This needs investigating at the data layer, not patched in the text template.

---

## 1. Style rules (carried over from v1, with two corrections)

- Word-form numerals for "one of X" framing, numeric everywhere else — unchanged.
- Single-sex suppression principle — unchanged.
- **"county" → "Local Authority," always.** v1 hardcoded "the county's independent-sector pupils," which is wrong for any unitary authority, London borough, or metropolitan borough (Reading, in Guy's Leighton Park edit, is not a county). Use "the Local Authority's independent-sector pupils" universally unless a future LA-type field lets us say "county's" only where genuinely true.
- **No "(GIAS figures)" citation** — dropped in all three edits, dropped from the template.
- **No trend language, with one narrow, deliberate exception**: Guy's edits add "The gender balance varies from year to year" as a general caveat after the gender-composition sentence, unconditionally, in all three examples — not tied to the specific 4b divergence check (none of these three schools cross the 42.85pp cut). **PROVISIONAL**: treated below as a new, always-on hedge distinct from 4b, not a stand-in for it. Confirm this reading — the alternative is that it's placeholder text standing in for where 4b's real sentence goes when it fires, which would be a different design.

---

## 2. Paragraph 1 — Phase, age range, gender (was Topic 2, now leads)

**Template**: "{{school_name}} is a {{phase_word}} school, {{age_range_clause}}. It is {{gender_composition_phrase}}, with {{dominant_gender}} making up {{pct}}% of all pupils. The gender balance varies from year to year."

`{{age_range_clause}}` forks on whether the school has genuine early-years provision (per §6 — from GIAS's own phase/nursery flag, not inferred from patchy age 1–3 census numbers): **"with pupils from early years to age {{age_high}}"** when it does, **"with pupils aged {{age_low}} to {{age_high}}"** (both numeric, statutory range only) when it doesn't. Phase word and the statutory end of the range still need a **correctly tagged phase** (through/senior/junior/etc.) and the real observed span for that phase.

**Malvern**: *"Malvern College is a senior school, with pupils aged 13 to 18. It is co-educational, roughly balanced, with boys making up 53% of all pupils. The gender balance varies from year to year."* — no early-years phase, numeric range throughout, unaffected by §6.

**The King's School**: *"The King's School is a through school, with pupils from early years to age 17. It is co-educational, roughly balanced, with boys making up 53% of all pupils. The gender balance varies from year to year."* — revised from Guy's own first-pass "aged 1 to 17" to name the phase rather than assert a number for it, per §6; still depends on confirming King's genuinely has early-years provision via the right data field, not just a leftover age-1 record.

**Leighton Park**: *"Leighton Park School is a senior school, with pupils aged 11 to 18. It is co-educational, with boys making up 55% of all pupils. The gender balance varies from year to year."* — no "mostly boys" qualitative label attached, since 55.1% sits right at the edge of the balanced band; **PROVISIONAL**: dropping the qualitative label near the boundary rather than committing to "mostly boys" for a borderline case. Confirm whether that's deliberate hedging or just an omission.

---

## 3. Paragraph 2 — Sector context and size (Topics 1 + 3 merged, Topic 3 redesigned)

**Template, sector half — DECIDED (Guy, round 3), refined further**: "One of {{word_number}} independent schools in {{LA_name}}, {{school_name}}'s pupils make up {{pct}}% of the independent-sector pupils in this local authority." Confirmed 3/3 across round 3's edits: prepositional phrasing ("in this local authority"), lowercase, not the possessive "the Local Authority's..." from the round-2 build. One small inconsistency to settle, not a design question: King's edit dropped the article ("of independent-sector pupils" vs. Malvern/Leighton Park's "of the independent-sector pupils") — recommend keeping "the," it reads more naturally and is what 2 of 3 actually wrote.

**Template, size half — PROVISIONAL, this is the biggest open item.** v1's nearest-10-peers/dynamic-geography mechanism (built and characterized last round) is absent from all three edits. In its place, each edit compares sub-phases against a plain **Local-Authority average**, but the three don't agree on structure: Malvern names individual sub-phases with mixed results, King's collapses to one blanket line since every phase agrees, Leighton Park adds a second, national comparator for one phase only. Below is a synthesis, not a confirmed design — pick per-phase clauses when sub-phases diverge, one blanket clause when they don't, and treat the national comparator as optional rather than default:

"The school is {{overall_size_word}} — {{per-phase clause(s), OR blanket clause if phases agree}}."

Per-phase clause: "{{phase_name}} ({{Year_range}}) is {{size_word}}{{, larger/smaller than the {{LA_name}} average}}{{optional: but smaller/larger than the national average}}."

Blanket clause: "each phase from {{youngest_phase}} to {{oldest_phase}} is {{comparison_word}} than the {{LA_name}} average."

**Malvern**: *"One of fifteen independent schools in Worcestershire, Malvern College's pupils make up 9.5% of the Local Authority's independent-sector pupils. The school is large — the sixth form (365 pupils) is particularly large, while the secondary years (Years 9–11) are smaller than the Worcestershire average."*

**The King's School**: *"One of fifteen independent schools in Worcestershire, The King's School's pupils make up 19.3% of the Local Authority's independent-sector pupils. The school is large — each phase from early years to sixth form is larger than the Worcestershire average."*

**Leighton Park**: *"One of eight independent schools in Reading, Leighton Park School's pupils make up 27.6% of the Local Authority's independent-sector pupils. The secondary phase (Years 7–11) is medium sized — larger than the Reading average but smaller than the national average. The sixth form is larger than average."*

Headcounts are inconsistently kept (Malvern's 365, nowhere else) and peer-comparison rank claims ("one of the three/four large schools compared") are dropped throughout — both provisionally dropped below pending confirmation.

**Likely bug, round 3, not caught by either the build or Guy's edit: Year-group labels must cap at Year 13.** Malvern's sixth form is labelled "Years 12–14" in both the round-2 build output and Guy's edit of it — neither of us caught it in review. English schools don't have a Year 14; sixth form is Years 12 and 13 regardless of a pupil's actual age. This is almost certainly the age-18 edge resurfacing: age 18 maps mechanically to "Year 14" under the simple age-minus-4 formula, but a real 18-year-old at school (repeated year, late birthday, whatever the reason) is still in Year 13 — the same unresolved age-18 edge case flagged back in Round 5 of the shape-classifier audit (Malvern's real 76-pupil Upper Sixth). **Fix: cap the Year-group label at Year 13 regardless of the real observed age span extending to 18.**

**Grammar fix, confirmed by round 3 — phase-count-aware blanket clause.** The round-2 build's blanket clause read "each phase from secondary phase to sixth form is larger..." for Leighton Park (only 2 phases), which is awkward — "from X to Y" implies a range with more than two named points. Guy's edit fixed it to "both phases, secondary and sixth form, are larger than the Reading average." King's has 3+ phases (early years, secondary, sixth form) and "each phase from early years to sixth form" reads fine there. **Rule: use "both phases, {{a}} and {{b}}" for exactly two phases; "each phase from {{first}} to {{last}}" for three or more.**

---

## 4. Paragraph 3 — Shape (Topics 4a + 5 merged)

**Template**: "VicData defines {{school_name}}'s current roll as having a {{shape_label}} shape{{, meaning [plain-language explanation]}}."

Plain-language explanation is included for resolved shapes (Wineglass, Pyramid, etc.) and omitted or replaced with the "doesn't fit a standard shape" framing for Irregular.

**Topic 5 (the "N genuine changes beyond normal variation" count) — PROVISIONAL: dropped as a separate sentence, its substance folded into the shape sentence's own wording ("year groups fluctuate," "vary in size").** Present in 2 of 3 edits (dropped in Malvern and Leighton Park, kept in King's with the exact count, "nine genuine changes"). Confirm: drop always, or keep the exact count when it's notably high?

**Malvern**: *"VicData defines Malvern College's current roll as having a Wineglass shape, meaning that the top of the school is much larger than the bottom, and students join at multiple entry points."*

**The King's School**: *"The King's School's year groups fluctuate in size, so VicData defines its current roll shape as Irregular — nine genuine changes beyond normal variation, more than ordinary year-to-year noise."* (count retained here per Guy's own edit; see open question above)

**Leighton Park**: *"VicData defines Leighton Park School's current roll as having an Irregular shape — its year groups vary in size in a way that doesn't fit one of the platform's standard shapes."*

Note: the explicit "(ages 5 to 17)" statutory-scope parenthetical is dropped from this sentence throughout (stated once, up front, in Paragraph 1) — but see the flag in §6: for a school with a real post-17 cohort (Malvern's 18-year-olds), dropping this scope note here risks reintroducing the exact confusion §0 of v1 was built to prevent. Recommend keeping a light scope note somewhere on the page for such schools even if not repeated in this sentence — open question, not yet resolved either way.

---

## 5. Boarding / day, and Local context (Topics 6, 7, 8 merged)

**Round 3 supersedes round 2's open item on this — Claude Code built it as a standalone factual sentence, as recommended, and Guy's round-3 edits then added something further, confirmed 3/3.**

**New in round 3, confirmed 3/3, not yet characterized against more than one example per branch: a second clause after the boarding fact, connecting the boarding percentage to whether local population trends actually matter for that school.** Branches, inferred from Guy's edits — **now a sector × boarding matrix, not boarding percentage alone (round 4 addition, see below)**:
- **State day school — DECIDED (Guy, round 4): catchment is genuinely local, treat it differently from independent day schools.** *"{{school_name}} is a state day school, meaning that population trends in the locality really matter."* — note "really," distinguishing it from the independent-day wording below. This is also the trigger for the region-comparison clause reintroduced in the LA/region paragraph, below.
- Independent day school, 0% boarding (King's): *"{{school_name}} is a day school, meaning that population trends in the locality matter."* — no "really": even a non-boarding independent school draws from further afield than a state day school's assigned catchment, so the framing is milder.
- Majority boarding (Malvern, 72.5%): *"With {{pct}}% of pupils boarding, the school is not reliant on the local catchment."*
- Majority day, some boarding (Leighton Park, 23.4%): *"With the majority of pupils day students, trends in the local market matter."*

Each branch still has only one real worked example behind it (state day school has none yet) — needs testing against a larger sample before shipping as more than a placeholder pattern.

Worth a second look once live, not just on paper: this new clause and the closing disclaimer two sentences later ("shape does not itself indicate whether subject to these declines") are now doing adjacent jobs in the same paragraph — one says whether the school is locally exposed, the other says the shape can't tell you either way. May read as redundant once real people see the whole paragraph together.

**Local context — line-break structure, confirmed 3/3.** No longer one dense block: "Local context:" on its own line, then the boarding-and-catchment sentence as its own paragraph, then the LA/region decline stats as their own paragraph, then the closing disclaimer-and-CTA as its own paragraph. Four visually distinct chunks.

**Closing CTA — confirmed 3/3: drop the specific shape name, use generic wording.** Round-2 build said "...whether its Wineglass shape is constant..."; every round-3 edit changed this to "...whether the shape of the school's roll is constant..." — avoids naming the shape a third time in one paragraph (it's already named in the shape sentence and the disclaimer sentence just before this).

**Template**: "Local context:

{{school_name}} is a {{boarding_day_phrase}} school{{, with {{pct}}% of pupils boarding}}. {{boarding-catchment clause, branch above}}.

{{LA_name}}'s school-age population (ages 5 to 15) is currently in {{LA_tier}} ({{negated LA_pct}}%){{state-day branch only: , {{comparative_phrase}} the {{region_name}} region, which}} is in {{region_tier}} ({{negated region_pct}}%).

{{school_name}}'s {{shape_label}} shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether the shape of the school's roll is constant or has changed over time? Join VicData to find out."

**State day school, round 4 (Guy's real example)**: *"Local context:

{{school_name}} is a state day school, meaning that population trends in the locality really matter.

Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline (-15.9%), shrinking even more than the West Midlands region, which is in Decline (-8.7%).

..."* (disclaimer and CTA sentence unchanged from the other branches)

King's and Leighton Park's Local Context paragraphs (§5's worked examples above, both drafted before this round's clarification) should now also carry the regional-comparison clause — not yet re-drafted here, flagged for the next build pass rather than guessed at without a real figure to check the comparative direction against.

**New product information, round 4, not yet a build item for this text: a members-area capability to define custom catchment areas and see aggregated population trends for that specific area**, rather than only the fixed LA/region administrative boundaries this free text uses. This is real and worth logging, but **Topic 8's own rule is "only reference features that actually exist... no invented capabilities"** — so this shouldn't appear in the closing CTA until it's confirmed already built or formally roadmapped, not just described in this conversation. Flagged in §7 rather than added to the template yet.

**"— a steeper/shallower decline than the region" comparison clause — DECIDED (Guy, round 4), refined further same round: the real dividing line is majority-day vs. majority-boarding, not state vs. independent.** Guy confirmed directly: the regional comparison matters for King's (independent, pure day) and Leighton Park (independent, majority day with some boarding) too, not just state day schools. So the clause renders for every branch **except** majority-boarding — state day school, independent day school, and majority-day-with-some-boarding all get it; only Malvern's "not reliant on the local catchment" branch doesn't. The state/independent distinction still matters for the "really matter" vs. "matter" wording intensity (state day schools' catchment is even more hyper-local than an independent day school's), but not for whether this clause appears at all.

**Needs building out beyond the one direction in Guy's example**: *"Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline (-15.9%), shrinking even more than the West Midlands region, which is in Decline (-8.7%)."* — the comparative phrase ("shrinking even more than") only covers the case where the LA is declining faster than the region. Needs the general form for every real relationship an LA/region pair could have: LA declining faster than region, LA declining slower than region, LA growing while region declines, LA and region roughly matching, and so on — not just the one direction this example shows.

**Decline percentages — DECIDED (Guy, round 3): display as negative numbers.** "Steep Decline (-15.9%)," not "Steep Decline (15.9%)." Guy's own intuition — positive should read as growth — matches the near-universal convention (finance, weather, any signed percentage a reader has seen before); the underlying metric happens to be defined the opposite way for a technical reason (it's a "how much smaller is the young cohort" measure), which is an internal computation detail a reader shouldn't have to know. **Fix at display only**: negate the number when printing it in prose; the tier boundaries and the underlying metric stay exactly as built (Growing <0%, Stable 0–2%, Decline 2–15%, Steep Decline 15–25%, Severe Decline >25%, all against the original, un-negated metric). No change to tier logic, no risk to the classification itself. **Check before building**: does the existing `PopulationTrendSection` dashboard component (which already uses this same metric, shipped before this project) ever print the raw signed number to a user anywhere? If not, this is a free choice with nothing to stay consistent with. If it does, flip that display too, or the same underlying value will read with opposite signs in two places on the same platform.

**Malvern** (round 3, real): *"Local context:

Malvern College is a boarding and day school, with 72.5% of pupils boarding. With 72.5% of pupils boarding, the school is not reliant on the local catchment.

Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline (-15.9%), and the West Midlands region is in Decline (-8.7%).

Malvern College's Wineglass shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether the shape of the school's roll is constant or has changed over time? Join VicData to find out."*

**The King's School** (round 3, real): *"Local context:

The King's School is a day school, meaning that population trends in the locality matter.

Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline (-15.9%), and the West Midlands region is in Decline (-8.7%).

The King's School's Irregular shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether the shape of the school's roll is constant or has changed over time? Join VicData to find out."*

**Leighton Park** (round 3, real): *"Local context:

Leighton Park School is a boarding and day school, with 23.4% of pupils boarding. With the majority of pupils day students, trends in the local market matter.

Reading's school-age population (ages 5 to 15) is currently in Decline (-9.6%), as is the South East region (-12.4%).

Leighton Park School's Irregular shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether the shape of the school's roll is constant or has changed over time? Join VicData to find out."* — negative signs now the confirmed, decided convention (see above), not an error to correct.

---

## 6. Not a template question — a data-reliability principle, highest priority

**Refined per Guy (2026-08-31): ages 1–3 are genuinely unreliable in the DfE census, not just a King's-specific tagging error.** Most nurseries aren't school-run, so they don't report into the census most of the numeric age-range and shape logic is built on — a school's real early-years provision can exist without being visible, or reliably countable, in that data at all. That rules out both of the obvious fixes: cropping the age-1 record out (as `observedSpanForPhase()` currently does) silently deletes a phase that may genuinely exist; stating it as a precise number ("ages 1 to 17," as Guy's own first-pass edit did) implies a reliability the data doesn't have.

**Design principle: name the phase, don't number it, below the statutory threshold.** Where a school genuinely has an early-years/nursery phase, the text should say so in words — "from early years" / "from nursery" — rather than an age number, and reserve literal ages for the statutory range (4/Reception upwards) where DfE census coverage is actually solid. Whether a given school has real early-years provision should come from GIAS's own phase-of-education / has-nursery flag, not be inferred from patchy census headcounts at ages 1–3 — inferring it from the numbers is exactly the trap the v1 build fell into either way (crop it or trust it).

**This also affects Topic 3 (size).** King's edit claims "each phase from early years to sixth form is larger than the Worcestershire average," which extends a quantitative size comparison to the early-years phase specifically. That comparison is only as trustworthy as the underlying census coverage — if peer schools' nurseries are inconsistently captured (some school-run and counted, others farmed out to private providers and invisible to the census), an "early years is larger than average" claim risks comparing real data to a phantom baseline. Worth deciding whether Topic 3 states a school has an early-years phase (descriptive, safe) without making a quantitative size claim about it (comparative, only as good as patchy data allows).

**Confirm before any more template work**: what field actually marks a school's real phase (through/senior/junior, nursery-or-not) in the data, whether King's carries the right one, and how many other schools might be mis-tagged the same way.

---

## 7. Open items requiring Guy's confirmation (not guessed at above)

**Resolved by round 3, no longer open:**
- Boarding sentence — standalone fact, confirmed, now with an added catchment/local-trends clause (see §5) instead of King's causal "so..." framing.
- "Gender balance varies from year to year" — confirmed as a general always-on hedge, distinct from 4b, since it survived unedited across all of round 3.
- Decline percentages — confirmed negative-sign display (§5, decided this round).
- Qualitative gender label near the 45–55% boundary — the built 3pp hedge zone went untouched in round 3's edits; treated as accepted.
- Sector-context wording — settled 3/3 (§3).
- Closing CTA wording (drop shape name) — settled 3/3 (§5).
- Local-context paragraph breaks — settled 3/3 (§5).
- "— a steeper/shallower decline than the region" clause — resolved by round 4: renders for every branch except majority-boarding, not state-day-only (§5).

**Still open:**
1. Topic 3's redesign — per-sub-phase vs. blanket, LA-average vs. nearest-peer, national comparator or not, headcounts in or out.
2. The King's phase tag and, more broadly, which data field should mark real early-years provision (§6) — a data investigation, not a wording call. Also: should Topic 3 make a quantitative size claim about an early-years phase at all, given patchy comparability, or describe it without comparing it?
3. Drop Topic 5's exact count always, or keep it when notably high (King's "nine")?
4. Dropping the "(ages 5 to 17)" scope note from the shape sentence — safe, or does it need to survive somewhere for schools with real post-17 cohorts (Malvern)?

**New from round 3:**
5. The boarding-catchment clause's branches (§5) — inferred from one example each, not characterized against a larger sample. Needs testing before it ships as more than a placeholder pattern.
6. That clause and the closing disclaimer may be saying overlapping things in the same paragraph — worth a look once live.
7. Year-group labels must cap at Year 13 — likely bug, not caught by either the build or Guy's edit (Malvern's "Years 12–14").
8. Small wording inconsistency: "of the independent-sector pupils" vs. "of independent-sector pupils" (missing article in King's edit) — recommend keeping "the."

**New from round 4:**
9. The comparative LA-vs-region phrase ("shrinking even more than," per Guy's one example) needs the general form built out for every real relationship an LA/region pair could have — faster decline, slower decline, growing against a declining region, roughly matching — not just the one direction shown.
10. Is "state day school" (sector = state, boarding = none) sufficient on its own to trigger the "really matter" wording, or does it need a further check (e.g. actual admissions-catchment data, where it exists) before assuming every state day school is genuinely local? (Note: this no longer gates whether the region-comparison clause appears at all — see below — only the wording intensity.)

**New from round 4:**
11. Region-comparison clause now confirmed to render for King's and Leighton Park too (independent day / majority-day), not just state day schools — real worked examples for those two not yet re-drafted with this clause included.
12. New members-area capability: defining a custom catchment area to see aggregated local population trends. Real product information, but not yet confirmed built or formally roadmapped — don't add to Topic 8's CTA until that's confirmed, per the existing "no invented capabilities" rule.
