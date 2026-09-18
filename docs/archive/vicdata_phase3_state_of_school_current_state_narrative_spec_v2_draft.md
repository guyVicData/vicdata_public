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

**Template, sector half (unchanged in substance from v1, reworded)**: "One of {{word_number}} independent schools in {{LA_name}}, {{school_name}}'s pupils make up {{pct}}% of the Local Authority's independent-sector pupils."

**Template, size half — PROVISIONAL, this is the biggest open item.** v1's nearest-10-peers/dynamic-geography mechanism (built and characterized last round) is absent from all three edits. In its place, each edit compares sub-phases against a plain **Local-Authority average**, but the three don't agree on structure: Malvern names individual sub-phases with mixed results, King's collapses to one blanket line since every phase agrees, Leighton Park adds a second, national comparator for one phase only. Below is a synthesis, not a confirmed design — pick per-phase clauses when sub-phases diverge, one blanket clause when they don't, and treat the national comparator as optional rather than default:

"The school is {{overall_size_word}} — {{per-phase clause(s), OR blanket clause if phases agree}}."

Per-phase clause: "{{phase_name}} ({{Year_range}}) is {{size_word}}{{, larger/smaller than the {{LA_name}} average}}{{optional: but smaller/larger than the national average}}."

Blanket clause: "each phase from {{youngest_phase}} to {{oldest_phase}} is {{comparison_word}} than the {{LA_name}} average."

**Malvern**: *"One of fifteen independent schools in Worcestershire, Malvern College's pupils make up 9.5% of the Local Authority's independent-sector pupils. The school is large — the sixth form (365 pupils) is particularly large, while the secondary years (Years 9–11) are smaller than the Worcestershire average."*

**The King's School**: *"One of fifteen independent schools in Worcestershire, The King's School's pupils make up 19.3% of the Local Authority's independent-sector pupils. The school is large — each phase from early years to sixth form is larger than the Worcestershire average."*

**Leighton Park**: *"One of eight independent schools in Reading, Leighton Park School's pupils make up 27.6% of the Local Authority's independent-sector pupils. The secondary phase (Years 7–11) is medium sized — larger than the Reading average but smaller than the national average. The sixth form is larger than average."*

Headcounts are inconsistently kept (Malvern's 365, nowhere else) and peer-comparison rank claims ("one of the three/four large schools compared") are dropped throughout — both provisionally dropped below pending confirmation.

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

**Boarding — PROVISIONAL: kept as its own plain snapshot sentence, no causal framing.** Leighton Park keeps it standalone ("Leighton Park School is a boarding and day school, with 23.4% of pupils boarding."); King's folds it into "Local context" with causal-sounding wording ("The King's School is a day school so it is having to deal with local conditions.") — flagged as a real concern, not just a style choice: that phrasing implies the day-school status causes exposure to local population decline, which the two facts sitting next to each other don't actually establish, and it runs against this project's own "don't attach causal explanation to unexplained facts" rule (rolls spec §8). Malvern's edit drops the sentence entirely, which looks like an accidental omission given it survives in the other two. Recommend: standalone factual sentence, no "so..." causal clause, kept for every school with boarding data — but this is Guy's call to confirm.

**Local context (Topic 7 + Topic 8 merged)**:

**Template**: "Local context:
{{LA_name}}'s school-age population (ages 5 to 15) is currently in {{LA_tier}} ({{LA_pct}}%), and the {{region_name}} region is in {{region_tier}} ({{region_pct}}%).{{optional: — a steeper decline than the region}}
{{school_name}}'s {{shape_label}} shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether its {{shape_label}} shape is constant or has changed over time? Join VicData to find out."

**"— a steeper decline than the region" comparison clause — PROVISIONAL: dropped.** Present in Malvern's edit only, absent from King's and Leighton Park; majority pattern (2 of 3) taken as the current best guess.

**Malvern**: *"Local context: Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline (15.9%), and the West Midlands region is in Decline (8.7%). Malvern College's Wineglass shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether its Wineglass shape is constant or has changed over time? Join VicData to find out."*

**The King's School**: *"Local context: The King's School is a day school. Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline (15.9%), and the West Midlands region is in Decline (8.7%). The King's School's Irregular shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether its Irregular shape is constant or has changed over time? Join VicData to find out."* (boarding sentence moved here, causal "so..." clause removed per the flag above — confirm)

**Leighton Park**: *"Leighton Park School is a boarding and day school, with 23.4% of pupils boarding.
Local context: Reading's school-age population (ages 5 to 15) is currently in Decline (9.6%), and the South East region is in Decline (12.4%). Leighton Park School's Irregular shape does not itself indicate whether the school has been subject to these local population declines. Want to see whether the school's size is growing or shrinking, and whether its Irregular shape is constant or has changed over time? Join VicData to find out."* — **sign corrected from Guy's draft**: his edit read "-9.6%" and "-12.4%," but the shipped convention is positive = decline, matching Worcestershire's 15.9% and West Midlands' 8.7% elsewhere; flagging rather than silently trusting either sign — worth checking the live figures directly, since a genuinely negative South East figure would mean Growing, not Decline as labelled.

---

## 6. Not a template question — a data-reliability principle, highest priority

**Refined per Guy (2026-08-31): ages 1–3 are genuinely unreliable in the DfE census, not just a King's-specific tagging error.** Most nurseries aren't school-run, so they don't report into the census most of the numeric age-range and shape logic is built on — a school's real early-years provision can exist without being visible, or reliably countable, in that data at all. That rules out both of the obvious fixes: cropping the age-1 record out (as `observedSpanForPhase()` currently does) silently deletes a phase that may genuinely exist; stating it as a precise number ("ages 1 to 17," as Guy's own first-pass edit did) implies a reliability the data doesn't have.

**Design principle: name the phase, don't number it, below the statutory threshold.** Where a school genuinely has an early-years/nursery phase, the text should say so in words — "from early years" / "from nursery" — rather than an age number, and reserve literal ages for the statutory range (4/Reception upwards) where DfE census coverage is actually solid. Whether a given school has real early-years provision should come from GIAS's own phase-of-education / has-nursery flag, not be inferred from patchy census headcounts at ages 1–3 — inferring it from the numbers is exactly the trap the v1 build fell into either way (crop it or trust it).

**This also affects Topic 3 (size).** King's edit claims "each phase from early years to sixth form is larger than the Worcestershire average," which extends a quantitative size comparison to the early-years phase specifically. That comparison is only as trustworthy as the underlying census coverage — if peer schools' nurseries are inconsistently captured (some school-run and counted, others farmed out to private providers and invisible to the census), an "early years is larger than average" claim risks comparing real data to a phantom baseline. Worth deciding whether Topic 3 states a school has an early-years phase (descriptive, safe) without making a quantitative size claim about it (comparative, only as good as patchy data allows).

**Confirm before any more template work**: what field actually marks a school's real phase (through/senior/junior, nursery-or-not) in the data, whether King's carries the right one, and how many other schools might be mis-tagged the same way.

---

## 7. Open items requiring Guy's confirmation (not guessed at above)

1. Topic 3's redesign — per-sub-phase vs. blanket, LA-average vs. nearest-peer, national comparator or not, headcounts in or out.
2. The King's phase tag and, more broadly, which data field should mark real early-years provision (§6) — a data investigation, not a wording call. Also: should Topic 3 make a quantitative size claim about an early-years phase at all, given patchy comparability, or describe it without comparing it?
3. Drop Topic 5's exact count always, or keep it when notably high (King's "nine")?
4. Boarding sentence: standalone fact (recommended) or folded into Local context with causal framing (King's draft)?
5. "— a steeper decline than the region" clause: drop (majority) or keep (Malvern)?
6. "Gender balance varies from year to year": new always-on hedge, or placeholder for 4b's conditional sentence?
7. Dropping the "(ages 5 to 17)" scope note from the shape sentence — safe, or does it need to survive somewhere for schools with real post-17 cohorts (Malvern)?
8. Qualitative gender label near the 45–55% boundary (Leighton Park) — hedge deliberately, or fill in as normal?
