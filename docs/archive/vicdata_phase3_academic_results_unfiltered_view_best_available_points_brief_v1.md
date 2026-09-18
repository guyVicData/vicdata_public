# TYPE = All should show a real points figure when a school's offer sits in one bucket

## Where this came from

Guy noticed live, right after the bucket-aware points rollup round shipped: Sevenoaks School (URN 118952) now shows real IB category points under TYPE = IB, but under the default, unfiltered TYPE = All it still shows nothing. That's expected given last round's own scope — the `'all'` rows are the pre-existing A-level/GCSE-only aggregate, deliberately left untouched, and Sevenoaks has no A-level entries at all, so it honestly has nothing to show there. Not a bug. But it's a real, newly-visible gap worth closing now that per-bucket points genuinely exist: an IB-only (or BTEC-only, or T-Level-only) school looks the same under the default unfiltered view today as it did before last round shipped, even though real, honest points for its actual offer now exist one click away.

## The hard constraint, carried from every round this phase

**Never blend or average points across incompatible scales.** This is the same discipline that kept the IB Diploma's own 45-point total separate from the bucket-level points figure, and the same reason the `other` bucket has never had a points figure invented for it. A-level, IB, BTEC/OCR, and T-Level each have their own real, differently-scaled DfE challenge table — averaging a 0–60 A-level figure with a 0–72 IB figure would produce a number that looks precise but means nothing real. Do not build anything that computes a cross-bucket weighted average as a single blended figure. This constraint isn't up for revisiting in this round.

## What to build instead: single-bucket fallback, not blending

Within that constraint, the honest thing to show under TYPE = All is: **when a school's (or a category's) scoreable entries sit entirely, or very nearly entirely, in exactly one bucket that has a real points table, show that bucket's own points figure by default** — clearly labelled which bucket it's from, the same way the IB Diploma headline is labelled as IB's own metric rather than presented as directly comparable to A-level. When entries are genuinely split across two or more scored buckets, keep suppressing exactly as today, but say why plainly (something like "mixed offer — no single comparable figure" rather than the current bare "no real results figure yet", which reads as missing data rather than a genuine design boundary) — this is a UI wording judgement call, make it and say what you chose, same as prior wording rounds this phase.

Apply the same rule to the "Results, % change" card as to the "Results" current-value card — this phase already found and fixed one real bug (`results_pct_change_borrowed_points` round) caused by exactly this kind of rule being applied to one card and not its sibling. Don't reintroduce that class of bug here.

## Required first step: quantify the real shape of this before building the exact threshold

Don't guess at "entirely, or very nearly entirely, in one bucket" — query it. For KS5 schools/school-periods and their scoreable-entry buckets (`alevel`/`ib`/`btec_ocr`/`tlevel` — `other` never scores, ignore it for this purpose):

- How many are genuinely single-bucket (100% of scoreable entries in one bucket)?
- How many have a small minority in a second bucket (say, under 5–10% — pick and state your own real threshold once you see the actual distribution, rather than assuming one)?
- How many are genuinely mixed with no dominant bucket?

Report these real counts before deciding the exact fallback threshold, and use real judgement on where to draw the "near enough to one bucket" line once you see the actual distribution — say what you chose and why, the same way prior rounds in this phase have deviated from an initial proposal once real data was in hand.

Apply the same question at the category level too, not just whole-school — a school could be mixed overall but have one category (e.g. Sciences & Maths) that's 100% one bucket while another category is genuinely mixed. Check whether the real data makes this worth doing at category grain or whether whole-school grain is close enough in practice — report which you found and why.

## Sources page: explain cross-qualification-type comparability plainly

Guy's own framing of why this is fine to build: the concern isn't whether these are "real" numbers — they're real DfE grade entries run through real, externally-sourced conversion tables (DfE's Table 2g for IB, Pearson/OCR's own Tariff tables for BTEC/OCR, DfE's Table 51 for T-Level), same as the existing A-level figure already is. The concern is specifically about **comparing subject category figures across different qualification types** — an IB category score and an A-level category score are not on the same number line, even though both are now real and both can appear as "this school's category score" depending on which TYPE is selected. That needs to be explained somewhere a user would actually find it, not just implied by a small in-context label.

Find and read the real sources/methodology page (`src/app/sources/page.tsx` in `vicdata_public`) and add a real, plainly-worded section covering: what each bucket's points figure is derived from (name the real conversion tables), that every bucket's points are real and independently sourced, and that a category's points figure is only comparable to another school's figure **within the same qualification type/bucket** — a 48.52 under IB and a 48.52 under A-level are not the same achievement and should never be read as equivalent. This is a real, required deliverable of this round, not a nice-to-have.

## Verify

- Sevenoaks (URN 118952), TYPE = All: now shows real IB category points (clearly labelled as IB's own figure), matching what TYPE = IB already shows.
- A genuinely mixed real school (find one with meaningful entries split across two or more scored buckets): TYPE = All still honestly suppresses, with the improved wording rather than the old "no data yet" phrasing.
- A-level-only schools: TYPE = All behaviour is completely unchanged from before this round (still shows the existing `'all'`-row A-level figure).
- Results and Results-%-change cards both follow the same rule, on both the school side and the comparator side.
- The category-vs-whole-school grain decision, with real numbers behind it.

## Deliverable

Build report: the real distribution counts (single-bucket / near-single-bucket / genuinely mixed), the threshold chosen and why, the category-vs-whole-school grain decision, the wording chosen for the "mixed offer" case, the Sevenoaks and mixed-school verification, confirmation A-level-only schools are unaffected, and the sources-page section added (quote what was written). Commit and push, both repos.
