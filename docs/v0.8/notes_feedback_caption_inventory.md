# Every caption, and where its text went (0.8 notes and feedback)

The caption button ("What this shows") is retired on every panel. Each view's caption is now the **"What this shows" line at the top of its (i)**, above the sources and "How it is calculated". Full screen and "Print this graph" print it as that line. Dynamic captions are computed as before.

This is the inventory behind decision 1's "where the caption only repeats what the (i) already says, drop it, and list it". An agent read every caption against its view's (i): the source line plus the method from `src/catalogue/methods-*.ts`. Then I applied it, with three changes from its proposals:

| Proposal | Applied? |
|---|---|
| DROP (definite): SMT O-FLAGS, A-BANDS, C-PROJECTION; the not-ready / district states of P-AREA, C-MAP, C-BIRTHS×3 | **Dropped** |
| DROP (definite): groups GRP-S-TABLE and the reading line on the 10 views whose method has the READING step | **Dropped**, except when the group's source is undated: that variant (`combinedUndated`) is **kept**, since the (i) never says this group's source is undated |
| DROP (definite): Admissions M-NOW, P-FUNNEL, P-PIPELINE, M-BARS, M-TABLE | **Dropped** |
| DROP\* (judgement calls): Admissions P-MAP, P-TABLE, M-DONUT, M-MAP | **Kept**: to be strict, a caption that adds anything stays |
| DROP: Teacher's geography % change caveat (`pointsEligibleCaveat`) | **Dropped**: the method says it under "Left out" |
| Everything marked KEEP or KEEP (borderline) | **Kept**, moved into the (i) |

In the code, each drop carries a comment naming where its words already are. These are `captionOf` in `SmtDashboard.tsx` and `GroupDashboard.tsx`, `notesOf` in `AdmissionsDashboard.tsx`, and `CandidatesPanels.tsx`.

---


The rule: DROP a caption only when the view's (i) (the source line plus its MethodNote, including the method's `notes`) already says essentially all of it. KEEP it when it adds a caveat, a figure, a definition, a dynamic sentence or a pointer. Quotes are kept short.

Markers:
- **DROP\*** means a judgement call. The only words the (i) doesn't say describe something this view doesn't draw, for example ranges on a map, or results ranks on a donut.
- **KEEP (borderline)** means nearly all of it is in the (i). One honesty clause or a small detail is not.

## Summary

| Product | Kept | Dropped | Notes |
|---|---|---|---|
| SMT (`captionOf`, SmtDashboard.tsx:756) | 33 of 36 captioned dataviews (11 of them KEEP (borderline)) | 3 dataviews fully (O-FLAGS, A-BANDS, C-PROJECTION), plus the fallback or district state of 5 kept ones (P-AREA, C-MAP, C-BIRTHS ×3) | O-MAP and A-GRADES have no caption |
| Groups (`captionOf`, GroupDashboard.tsx:553) | 17 | 11 | All 28 views have a caption: by default, the reading sentence |
| Admissions (`notesOf().caption`, AdmissionsDashboard.tsx:660) | 15 | 9 (4 of them DROP\*) | 10 views have no caption (visible only, or none) |
| Teacher (`panel.summary`, ColumnPanels.tsx:296) | all but one | 1 (Candidates geography caveat) | Almost all are dynamic sentences |
| Meetings and other surfaces | n/a | 0 | No other footer caption source exists |

### DROP list (apply mechanically)

- smt: DV-SMT-O-FLAGS — `flagsRuleText()` (SMT_NOTES.flagsRule / flagsRuleNoResults)
- smt: DV-SMT-A-BANDS — SMT_NOTES.bandReserved
- smt: DV-SMT-C-PROJECTION — `notes.population` + `notes.projection` (smtNote populationProjected + projection)
- smt: DV-SMT-P-AREA, **not-ready fallback only** — SMT_NOTES.areaResidentsCaption
- smt: DV-SMT-C-MAP, **district / LA state only** (non-LSOA, or Area pill on the LA) — SMT_NOTES.shadeByDistrict
- smt: DV-SMT-C-BIRTHS, DV-SMT-C-BIRTHS-INDEXED, DV-SMT-C-BIRTHS-TABLE, **not-ready fallback only** — SMT_NOTES.births
- groups: GRP-S-TABLE — GROUP_NOTES.missingListed
- groups: GRP-O-ROLL — reading + GROUP_NOTES.likeForLike + comparedAgainst
- groups: GRP-O-RESULTS, GRP-A-TREND, GRP-A-POST16, GRP-P-ROLL — reading + comparedAgainst
- groups: GRP-O-NOW, GRP-S-NOW, GRP-A-NOW, GRP-P-NOW, GRP-P-SHAPE — reading (combined / combinedAtTime / combinedUndated)
- admissions: DV-ADM-M-NOW — ADMISSIONS_NOTES.groupShort
- admissions: DV-ADM-P-FUNNEL — ADMISSIONS_NOTES.funnelNote
- admissions: DV-ADM-P-PIPELINE — ADMISSIONS_NOTES.poolShort
- admissions: DV-ADM-P-MAP, DV-ADM-P-TABLE — ADMISSIONS_NOTES.poolShort (DROP\*)
- admissions: DV-ADM-M-BARS, DV-ADM-M-TABLE — inline "Cohort sizes from the census; shares are of this group; …"
- admissions: DV-ADM-M-DONUT, DV-ADM-M-MAP — the same inline string (DROP\*)
- teacher: DV-C1-CAND-TR-GEO-CHART, DV-C1-CAND-TR-GEO-TABLE — `pointsEligibleCaveat` (CandidatesPanels.tsx:371)

Groups caveat: on the 11 group DROPs, when the reading is "Members at the time" and the source is undated, the caption becomes `combinedUndated`. That says *this* group's source doesn't date membership. The (i) names the source and says "sources without dates count every listed school every year", but it never says that this group's source is undated. If you want to be strict, keep that one variant.

---

## 1. SMT

The (i) is `sourceOf(dv, c)` (SmtDashboard.tsx:718) plus `<MethodNote id={dv}>` (methods-smt.ts). For DV-SMT-C-* views it also includes `notes.sources` (SMT_NOTES.wSources). For C-PROJECTION it is the generated `projectionMethod()`.

Two suffixes are appended in some cases:
- `igcse`, from smtNote igcseView. Only for an IGCSE school, on O-SCORECARD, the results and trend views, A-NOW and A-AREAS.
- `withArea`, from the area's `igcseNote`. Only at GCSE with an incomplete area chosen.

Neither suffix is in any method (the methods only say IGCSE schools are "not ranked"), so wherever they appear they count towards KEEP.

| Dataview id(s) | Caption | Decision | Reason |
|---|---|---|---|
| DV-SMT-O-NOW | SMT_NOTES.size + `overview.p8.text` (p8Published / p8NoBaseline / p8Independent / p8NoGcse) | KEEP | The method covers the size fifths ("national fifths … XS … to XL"). p8.text is filled per school: "Progress 8, {year} … None for {years}". The method only says "the reason that applies is given". |
| DV-SMT-O-SCORECARD | SMT_NOTES.ranks + smtNote sinceBase (+ igcse) | KEEP | The method has the ranks: "highest first, ties share a place … count shows how many". sinceBase adds the reason: "the first year graded on the normal scale". |
| DV-SMT-O-FLAGS | `flagsRuleText(phases)`, which fills SMT_NOTES.flagsRule / flagsRuleNoResults | DROP | Method steps 1–5 give every clause: "three year-on-year moves", "at least 2 Attainment 8 points or 3 A-level points … at least 4 set schools", "bottom-fifth threshold", "Each flag shows the figures". The fill picks the school's own clauses from rules, not from data. |
| DV-SMT-O-ROLL-LINE, DV-SMT-O-ROLL-TABLE | `overview.notes.rollIndexed` (base year filled) + SMT_NOTES.rollAreaUndercount | KEEP | The method has no "Earlier area years count only schools still open … undercount". The base year is filled. |
| DV-SMT-O-RESULTS-LINE, DV-SMT-O-RESULTS-TABLE, DV-SMT-A-TREND-LINE, DV-SMT-A-TREND-TABLE | smtNote middleHalf + TREND_BASE_NOTE (+ igcse, + area note) | KEEP | middleHalf is in the method ("25th to 75th percentile"). TREND_BASE_NOTE adds "would make most schools look as if results had fallen". The two TABLE methods don't mention 2021/22 at all. |
| DV-SMT-O-MARKET-LINE, DV-SMT-O-MARKET-TABLE | SMT_NOTES.marketShort | KEEP (borderline) | The method gives the arithmetic: "pupils aged 11 across the school and its saved 11+ rivals". It doesn't give the honesty clause "not a share of the local market". |
| DV-SMT-A-NOW | SMT_NOTES.ranks (+ igcse, + area note) | KEEP | The A-NOW method says only "rank in the set among schools with that result". It has no "ties share a place" or "count says how many". |
| DV-SMT-A-AREAS | SMT_NOTES.ranks (+ igcse, + area note) | KEEP (borderline) | The method has "highest first, ties sharing a place". Only "The count says how many were ranked" is new. |
| DV-SMT-A-SUBJECTS | SMT_NOTES.ranks + smtNote smallEntries (min 5) (+ area note) | KEEP | The method has "fewer than 5 entries is listed but not ranked". It lacks the reason, "one or two pupils would decide the rank", and the count clause. |
| DV-SMT-A-VA | SMT_NOTES.alevelVa | KEEP | Adds the definition "compares each student … who started from similar GCSEs" and "range crosses 0 isn't clearly different". |
| DV-SMT-A-MIX, DV-SMT-A-MIX-TABLE | SMT_NOTES.entriesMix | KEEP | The share is in the method. It lacks "entries aren't graded, so the 2021/22 note doesn't apply". |
| DV-SMT-A-BANDS | SMT_NOTES.bandReserved | DROP | Method step 2: "top 25%, middle 50% and bottom 25% of entries when that round arrives". |
| DV-SMT-P-NOW | SMT_NOTES.size + shapesAround + levelAges | KEEP | The P-NOW method covers size only. It has no shapes ("a smaller sixth form isn't worse") and no level ages. |
| DV-SMT-P-SHAPE | the same three | KEEP | The P-SHAPE method has the level ages and "never ranking". It lacks size (XS–XL) and "a smaller sixth form isn't worse". |
| DV-SMT-P-ENTRIES, DV-SMT-P-POOL | SMT_NOTES.pool | KEEP (borderline) | Both methods describe counted-then-births. Neither says "A pool, not an intake". |
| DV-SMT-P-LEAVING | ADMISSIONS_NOTES.leaving16 | KEEP (borderline) | The method defines Year 12 over Year 11 and net leavers. Only the caveat "An estimate of net leavers" is new. |
| DV-SMT-P-MARKET | SMT_NOTES.marketShort | KEEP (borderline) | Same as O-MARKET: "not a share of the local market" isn't in the (i). |
| DV-SMT-P-PHASES, DV-SMT-P-PHASES-TABLE | smtNote rollByPhase (base filled from data) | KEEP | The method says "100 in the first year all lines have a figure". The caption names the actual base year, which is a figure. Otherwise it repeats the method. |
| DV-SMT-P-AREA (ready) | smtNote areaResidents (LA, ages) | KEEP (borderline) | The source and method cover the ONS LA residents and the ages. The caption adds the LA name and "not pupils". |
| DV-SMT-P-AREA (not ready) | SMT_NOTES.areaResidentsCaption | DROP | "ONS mid-year estimates, residents" is word for word in the source line. |
| DV-SMT-C-NOW | notes.children + births + projection + SMT_NOTES.wDeciles + smtNote mixInfo + SMT_NOTES.fsmInfo | KEEP | The method lacks the decile scale ("1 = the most deprived 10% … 10 = the least"), "England's 20% is by construction" and "families moving in and out". |
| DV-SMT-C-MAP (LSOA, around) | SMT_NOTES.mapNeighbourhoods + smtNote mapRing + wDeciles | KEEP (borderline) | Method step 1 has the 2 km ring and the circle. It lacks "joined through postcodes" and "so the shading has no hard edge". |
| DV-SMT-C-MAP (district / LA state) | SMT_NOTES.shadeByDistrict | DROP | Method step 5: "Before neighbourhood boundaries are loaded … shaded by census pupils of those ages". |
| DV-SMT-C-BYAGE, DV-SMT-C-AGES | notes.popByAge + smtNote wResidents (radius) | KEEP | The method has "children living in the area, not pupils". The caption adds the radius figure and "neither is divided by the other". |
| DV-SMT-C-NEARBY | notes.nearby (nearbyOverTime, with base and radius) + wResidents | KEEP | Adds the base year and radius figures, and "two different counts". |
| DV-SMT-C-BIRTHS (ready) | notes.births + notes.projection | KEEP | The births sentence is in the method. The projection sentence ("at the area's own record of families moving in and out") is not. |
| DV-SMT-C-BIRTHS-INDEXED, DV-SMT-C-BIRTHS-TABLE (ready) | notes.births + notes.projection | KEEP (borderline) | The births sentence is in the method. The projection sentence isn't, but these views draw no projection. If it were trimmed to births only, the caption would be a DROP. |
| DV-SMT-C-BIRTHS / -INDEXED / -TABLE (not ready) | SMT_NOTES.births | DROP | "Births are counted by local authority (ONS), by calendar year" is in the source and steps: "the LA's births each calendar year". |
| DV-SMT-C-PROJECTION | notes.population + notes.projection | DROP | The generated method has every part. Years: "Counted to mid-{y}; projected to {end}. Ages {ages}". Geography: within {radius}. Steps: "age today's children forward", "families moving in and out", the band. Rounding: "not a forecast for the school". |
| DV-SMT-O-MAP, DV-SMT-A-GRADES | no caption (`captionOf` returns null) | n/a | Nothing to move |

Out of scope: SMT chart bodies also take an in-chart `caption=` prop: IndexedLines on P-PHASES (rollByPhase), PoolLine on P-POOL (SMT_NOTES.pool) and PlainLine on P-AREA (areaResidentsCaption, plus wProjection). These are chart captions, not the footer button. They are listed so nobody mistakes them for footer captions.

## 2. Groups

The (i) is `sourceOf(id, c)` (GroupDashboard.tsx:544): the label, the membership sources and "DfE school census and performance tables", plus `groupMethodOf(id)` (methods-groups.ts).

`reading`:
- at_time, dated source: GROUP_NOTES.combinedAtTime
- at_time, undated source: groupNote combinedUndated
- otherwise: GROUP_NOTES.combined

All three restate the method's shared READING step ("'Members at the time' counts a school … 'All schools listed now' counts every current member"). So a reading caption is a DROP exactly where the view's method includes READING.

| Dataview id(s) | Caption | Decision | Reason |
|---|---|---|---|
| GRP-O-AGAINST | GROUP_NOTES.comparesOnly + missingListed (+ mixMatched when compare = mix_matched) | KEEP (borderline) | The method covers "same type and size band" and "Self-declared groups never enter a peer set". It lacks the examples "preps with no KS2, schools outside England" and "never left out silently", and mixMatched's "so the gap isn't just geography". |
| GRP-S-TABLE | GROUP_NOTES.missingListed | DROP | Method leftOut: "a school without a figure shows the reason (IGCSE …; prep: no KS2 …; outside England …)". |
| GRP-O-ROLL | reading + likeForLike + comparedAgainst | DROP | READING step. Step 2: "a school joining or leaving doesn't move the line". Sources: "The comparison set: {setLabel}". |
| GRP-S-GROWING | reading + likeForLike | KEEP | The S-GROWING method has no READING step, so the reading sentence isn't in the (i). |
| GRP-O-RESULTS, GRP-A-TREND, GRP-A-POST16, GRP-P-ROLL | reading + comparedAgainst | DROP | READING step, plus the set named in the sources and geography. The code comment says the (i) holds the full set name. |
| GRP-O-NOW, GRP-S-NOW, GRP-A-NOW, GRP-P-NOW, GRP-P-SHAPE | reading (default) | DROP | Each method's steps begin with READING. |
| GRP-O-MAP, GRP-O-JOINED, GRP-O-SHARE, GRP-S-SCATTER, GRP-S-SHAPES, GRP-A-RANKED, GRP-A-AREAS, GRP-A-VA, GRP-A-IMPROVING, GRP-A-BANDS, GRP-P-ENTRIES, GRP-P-LEAVING, GRP-P-MARKET, GRP-P-PROJECTION, GRP-P-GROWING | reading (default) | KEEP | These methods have no READING step. Note: most of these are per-school or placeholder views where "Combined figures add up …" hardly applies, so it would be better to drop it as irrelevant than to move it into the (i). That is your call, not a repeat. |

## 3. Admissions

The (i) is `sourceOf(dv)` (AdmissionsDashboard.tsx:688): the title template and measures, plus MethodNote. The method's `notes` come first: ADMISSIONS_NOTES.pool on P-PIPELINE, P-FUNNEL, P-MAP, P-TABLE, P-POOL-*, P-HOLD-*; groupShare on M-NOW, M-DONUT, M-BARS, M-MAP, M-TABLE, M-SHARE-*.

`withSexNote` (line 679) adds notSplitBySex / poolAreaNotSplit to `visible` only, never to `caption`. It has no effect here. The phone paths (lines 895–909) use `notesOf().caption` without it.

| Dataview id(s) | Caption | Decision | Reason |
|---|---|---|---|
| DV-ADM-M-NOW | ADMISSIONS_NOTES.groupShort | DROP | The method note groupShare: "A share of this group … Not a share of the local market". |
| DV-ADM-P-FUNNEL | ADMISSIONS_NOTES.funnelNote | DROP | Geography: "One area for births and pool". Step 5: "each is a separate count, not the same children". |
| DV-ADM-P-PIPELINE | ADMISSIONS_NOTES.poolShort | DROP | The pool note gives "the pool, not an intake". Step 4 gives "so the range widens". |
| DV-ADM-P-MAP, DV-ADM-P-TABLE | ADMISSIONS_NOTES.poolShort | DROP\* | The pool note covers the first sentence. "Ranges widen with distance" isn't in these methods, and these views draw no range. |
| DV-ADM-P-SHAPE, DV-ADM-M-SHAPE | SHAPES_NOTE (ShapeAndSize.tsx:115) | KEEP | The method says "the shared classifier names the shape". The caption adds the labels (Tube, Pyramid …) and "the same for schools and areas". |
| DV-ADM-P-ENTRY-LINE, DV-ADM-P-ENTRY-BARS, DV-ADM-P-ENTRY-TABLE | ADMISSIONS_NOTES.cohortShort | KEEP | "Cohort size, not new joiners" is not in the method. |
| DV-ADM-P-POOL-INDEXED, DV-ADM-P-POOL-TABLE, DV-ADM-P-AREA-POP | inline "Also: the school page's area population trend (ages 5–15)" | KEEP | A cross-reference that the (i) doesn't have. |
| DV-ADM-P-HOLD-LINE, DV-ADM-P-HOLD-TABLE | ADMISSIONS_NOTES.requirement | KEEP (borderline) | The method gives "the share you would need". "Not a forecast" isn't stated, and holdShare isn't among the method's notes. |
| DV-ADM-M-BARS, DV-ADM-M-TABLE | inline "Cohort sizes from the census; shares are of this group; results ranks …" | DROP | The source is the census, the groupShare note covers the share, and the results step says "place in England … whole-school headline". |
| DV-ADM-M-DONUT, DV-ADM-M-MAP | the same inline string | DROP\* | The census and share clauses are covered. The results-ranks clause isn't in these methods, but these views show no ranks. |
| DV-ADM-M-SHARE-LINE, -SHARE-NUM, -SHARE-RANKS, -SHARE-CHANGE, DV-ADM-M-ROLL-LINE | inline "The entry age band's roll sits on the same rail" | KEEP | A pointer to another tab, not in the (i). On M-ROLL-LINE it points at itself, so consider removing it there. |
| DV-ADM-P-NOW, DV-ADM-M-ACAD-RANK/-NUM/-CHANGE | `visible` only (laContext / AcademicFooter) | n/a | No caption |
| DV-ADM-M-MOMENTUM, -STRENGTHS, -VS-LINE, -VS-BARS, -FLAGS | none | n/a | No caption |

## 4. Teacher

The (i) is `panel.source` with the trend note, plus `<MethodNote id={preset}>` (ColumnPanels.tsx:122 `withMethod`; methods-teacher.ts). The caption is `panel.summary`. Each Trends panel merges its halves (`isChange ? changeHalf.summary : trendHalf.summary`).

| Host / panel | Caption | Decision | Reason |
|---|---|---|---|
| SubjectPanels: Current (line 657) | Dynamic: "{X} is N% of …", "{X} sits +d against …", best and worst rows | KEEP | Computed sentence |
| SubjectPanels: Trend (line 898) | Dynamic `trendSentence` + group clause. Fallback: "Not enough published years yet to describe a trend." | KEEP | Computed. The fallback is an empty-state message, not in the method. |
| SubjectPanels: % Change (line 1022) | Dynamic `moversSentence`. Fallback: "Not enough published years …" | KEEP | Computed |
| CandidatesPanels: Current (line 242) | Dynamic: "{X} is the largest subject … {Y} the smallest" | KEEP | Computed |
| CandidatesPanels: Trend (line 323) | Dynamic `trendSentence`. Fallback as above. | KEEP | Computed |
| CandidatesPanels: % Change, ranked views (line 421) | Dynamic `moversSentence`. Fallback. | KEEP | Computed |
| CandidatesPanels: % Change, geography views (DV-C1-CAND-TR-GEO-CHART, DV-C1-CAND-TR-GEO-TABLE) | `pointsEligibleCaveat` (static, line 371) | DROP | Method leftOut: "Area rows count points-eligible entries only (full-course GCSE …) … not its full Candidates count". |
| GradeCountsPanels: Current (line 152) | Dynamic: the selection's `answer`, or "{X}'s N graded entries in {yr}: most at {g}" | KEEP | Computed |
| GradeCountsPanels: Trends, spread and change (lines 190, 213) | `oneYearOnly` ("published grades for one year only …"), else none | KEEP | An empty-state message, not in the method |
| ComparisonsPanels: Current (line 636) | Dynamic: "This school is {r} of {n} on …" + `mapCaption` (from AcademicMapView `onCaption`). Else `rankingSet.noFigureNote` or "No published … figure …". | KEEP | Computed, or a per-school reason |
| ComparisonsPanels: Trend (line 876) | Dynamic `trendSentence` + versus clause. Fallback. | KEEP | Computed |
| ComparisonsPanels: % Change (line 971) | Dynamic: "This school's {m} has risen … against a rise of …" Fallback. | KEEP | Computed |

## 5. Meetings and anything else

- **meetings/SlideCanvas.tsx:282**: the CardBox passes `source` ("Source: {citation}") and `note` (the slot's own editable note). It passes **no `caption`**, so there is nothing to retire.
- A grep for `caption=` / `caption:` under src/components finds only the four hosts above (RailPanel.tsx:147 and admissions/ui.tsx just pass the prop through to CardBox). The other matches are:
  - in-chart caption props: SMT IndexedLines, PoolLine and PlainLine, and `SizeByPhase caption={false}`
  - AcademicMapView/RankingsMap `onCaption` callbacks, which feed Comparisons' dynamic summary
- dashboard-config/TeacherDashboard.tsx CardBoxes (lines 2031, 2064, 2276, 2294) pass no caption.
