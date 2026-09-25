# VicData Teacher View — Trend & % Change chart-style redesign (build brief v1)

Source: "VicData Teacher View — Data Views Review (GCSE Candidates)" review doc (Claude Project doc `4c52e9e8-3cf5-413f-8c2c-ef2dbbd2d8d8`, rev 23) and the accompanying mockup artifact, "Candidates Trend — chart style options" (https://claude.ai/artifact/YNMP7aepgmEw6YGPkbBVSr). Every decision below was checked against the live app and the real source before being marked confirmed — this brief only restates what's already settled, it doesn't introduce new judgement calls.

Two items are genuinely open and should NOT be silently invented during the build — see "Open items," below, before touching subject-name labels or Column 3's third `vs:` choice.

---

## 1. Column 1 (Candidates) — Trend panel

**1a. Show every subject individually, grey tints, Current's own order.**
`CandidatesPanels.tsx`'s `focusSeries` (~L110-121) only ever builds two lines — the focused subject plus one dashed category-average line. Fix it the same way `changeFull` (~L128) already builds % Change's series: every subject in the category, each its own line/bar, grey tints in Current's left-to-right order, focus subject in the accent green, drawn last/on top.

**1b. Fix the year-range bug — this is the real cause of "why does it only show from 2023/24."**
`CandidatesPanels` is fed by its own `entries` prop, sourced from `fetchSubjectLevelData()` reading the raw `dfe_ks4_subject_entries` facts (`academic-data-view.ts` ~L1030), deliberately scoped to 2023/24-on because the older "historic" sibling source has an ambiguous, undisambiguated label set. Column 2 Context and Column 1 Results don't have this problem because they read `headline` (`academic_subject_headline`/`academic_subject_rollup`, real multi-period data back to 2020/21) via `entriesAt()`/`subjectPeriods` (`page.tsx` ~L766-774) and `groupValueFor()` (~L917-921).

Fix: point `CandidatesPanels` at `headline`'s `entriesTotal` (the same source and field Context already reads for its own entries figure) instead of the raw `entries` facts. The `FromYearMenu` "from" picker already exists and already works correctly here — it just needs real multi-year data to work with. Column 1 Current (the bar chart) is fed by the same short `entries` prop and inherits the same fix.

**1c. Trend-line toggle is dead in bars mode — fix or hide it.**
`TrendChart.tsx` switches to `TrendBars` (grouped bars per year) whenever there are fewer than 4 real published years (`TREND_LINE_MIN_YEARS = 4`, `trendChartKind()`). `TrendBars`'s own signature (`{ data, measure, fullscreen }`) never receives or uses `showFit` at all, so the "Trend line" toggle does nothing whenever the chart is in bars mode. With 1b shipped, Candidates should have 5 real years and cross the bars→line threshold on its own in most cases — but the toggle should still either get its own fit indicator in bars mode, or be disabled/hidden there, so it never again looks broken for whatever case still lands under 4 years.

**1d. Bar-chart style for many x-axis subjects — Option B confirmed for ≤3 years, Option D2 confirmed for 4+.**
Mocked up live in the artifact, sections A–D, with the refined B/D2 in the later "Confirmed" card:

- **Option B (≤3 years):** horizontal list, paired bars, reusing the list-bar pattern Column 2/3's Current views already use — no x-axis at all, so more subjects just means a taller list. Refinement: the number column shows the year-on-year change (count and %), not just the latest total — direction-coloured (green up / amber down / grey flat), matching the app's existing convention.
- **Option D2 (4+ years, i.e. once 1b ships):** multi-line, same `TREND_LINE_MIN_YEARS` threshold the single-focus case already uses, extended to every subject. Each subject's own line is **indexed to its own first published year = 100** (dashed baseline at 100 = "no change"), not drawn on a shared headcount scale — a shared scale pins small-entry subjects (e.g. Additional Science, ~8 candidates) flat against large ones (Maths, ~230), hiding their own real change. This is the same idea the % Change tab already uses, drawn as a line over time.
- **Option E — Table, added alongside the chart (both B and D2), same pattern Current already uses (chart/list toggle):** subject rows in Current's grey-tint order, one column per published year with real headcounts, a latest-year rank badge, and the same change column as Option B. Sortable by name, any year, or change. **Card/fullscreen split:** the dashboard card shows only the first and last published year; fullscreen opens every year in between. This exact split is reused everywhere else below — treat it as one shared pattern, not a one-off.

## 2. Subject-name shortening (Column 1, applies wherever a short label shows)

Today's rule — duplicated in `page.tsx`'s `shortSubject` and `CandidatesPanels.tsx`'s own separate copy of the identical function — is "first 4 characters + a full stop," no collision check: `label.length <= 6 ? label : label.slice(0,4) + "."`. Confirmed real collisions: "English Language"/"English Literature" → both "Engl."; "Physics"/"Physical Education" → both "Phys."; live-confirmed on screen: "Combined Science" and the "Sciences & Maths average" group label both → "Scie.".

**Fix, in priority order:**
1. Merge the two duplicate functions into one shared util.
2. **Primary fix — curated lookup table, confirmed 2026-09-25 (below).** First pass, standard UK subject-teacher shorthand — check each key against real subject-label strings in the DB before shipping (see the code comment); anything not yet keyed correctly just falls through to the fallback rather than breaking.
3. Word-initial algorithmic shortening stays only as the **fallback** for anything not in the table.
4. **Collision-check safety net**, applied regardless of which path produced a label: if two labels shown together still match, lengthen the shorter one until they don't.

```ts
// First pass, drafted 2026-09-25 -- standard UK subject-teacher shorthand, not yet
// checked against real DB subject-label strings. Verify each key matches the actual
// `subject`/`label` values live before shipping; anything that doesn't match falls
// through to the algorithmic fallback harmlessly, but should be re-keyed to match.
export const SUBJECT_ABBREVIATIONS: Record<string, string> = {
  "English Language": "Eng Lang",
  "English Literature": "Eng Lit",
  "Mathematics": "Maths",
  "Further Mathematics": "Fur Maths",
  "Combined Science": "Comb Sci",
  "Biology": "Bio",
  "Chemistry": "Chem",
  "Physics": "Phys",
  "Additional Science": "Add Sci",
  "Computer Science": "Comp Sci",
  "Statistics": "Stats",
  "History": "History",
  "Geography": "Geog",
  "Religious Studies": "RS",
  "Citizenship Studies": "Citizenship",
  "Philosophy": "Philosophy",
  "Sociology": "Sociol",
  "Psychology": "Psych",
  "Economics": "Econ",
  "Government and Politics": "Gov & Pol",
  "Law": "Law",
  "Classical Civilisation": "Classics",
  "French": "French",
  "German": "German",
  "Spanish": "Spanish",
  "Italian": "Italian",
  "Mandarin Chinese": "Mandarin",
  "Latin": "Latin",
  "Ancient Greek": "Anc Greek",
  "Welsh": "Welsh",
  "Urdu": "Urdu",
  "Polish": "Polish",
  "Arabic": "Arabic",
  "Art and Design": "Art",
  "Photography": "Photog",
  "Music": "Music",
  "Music Technology": "Music Tech",
  "Drama": "Drama",
  "Dance": "Dance",
  "Media Studies": "Media",
  "Film Studies": "Film",
  "Design and Technology": "D&T",
  "Product Design": "Prod Design",
  "Food Preparation and Nutrition": "Food Prep",
  "Textiles": "Textiles",
  "Engineering": "Engineering",
  "Information and Communication Technology": "ICT",
  "Business Studies": "Business",
  "Health and Social Care": "H&SC",
  "Construction": "Construction",
  "Hospitality and Catering": "Hosp & Catering",
  "Travel and Tourism": "Travel & Tourism",
  "Physical Education": "PE",
  "General Studies": "Gen Studies",
  "Critical Thinking": "Crit Thinking",
  "Extended Project Qualification": "EPQ",
  "Core Maths": "Core Maths",
};

// Bucket suffix, appended after the subject abbreviation for KS5 -- e.g. "Bio (AL)"
// vs "Bio (IB)" -- matching dfe-qualification-buckets.ts's real KS5_BUCKETS/KS5_BUCKET_LABEL.
export const KS5_BUCKET_SUFFIX: Record<"alevel" | "ib" | "btec_ocr" | "tlevel" | "other", string> = {
  alevel: "AL",
  ib: "IB",
  btec_ocr: "BTEC",
  tlevel: "TL",
  other: "Oth",
};
```

## 3. Column 1 (Candidates) — % Change panel

Today: a vertical diverging bar chart, one bar per subject plus the category average as an extra competing bar. Two confirmed real problems: (a) the same label-collision bug as §2 above; (b) one outlier (Additional Science's real +38%) forces an axis scale that squashes near-zero values (Biology's 0%, Chemistry/Physics's +2%) into an unreadable sliver.

**Confirmed: Option H — horizontal diverging list, ranked by % change.** No x-axis (removes the vertical-chart crowding past 5-6 subjects), sorted so reading order alone answers "which subjects moved most," same convention as Columns 2/3's own rankings. Problem (b) falls out of this layout as a side effect, not a separate fix — every row prints its number at full size next to the bar regardless of the bar's own length.

**Group average:** moved out of the bar/row list entirely, into a labelled dashed reference line — the way Trend and Context already treat their own group averages. Today's competing 8th bar is the actual inconsistency, not a feature.

**Rank as a separate view: no.** H already sorts by % change and already carries a rank badge — a dedicated Rank view would just repeat H's own ordering.

**Table (Option I): yes, build it.** A percentage alone never says whether it's a big move on a big base or a big move on a handful of candidates. Same shape as Option E: base year, latest year, the real count change, and the %, side by side, same first/last-year-then-fullscreen card split.

## 4. Column 2 (Context) — Trend and % Change

**Selected subjects: same treatment as Column 1, confirmed, no disagreement.** A user-curated Selected set is naturally bounded (a handful, hand-picked) — same shape as a subject category. Trend: §1's individual-subject/grey-tint/D2 behaviour. % Change: §3's H + dashed group-average line. Table (I) in both, same card/fullscreen split.

**All subjects: real scale problem, independently designed (not a straight copy of Column 1).** Maths' own "Whole School Context" lists 20 real subjects, confirmed live.

- **% Change (H) and Table (I): no change needed.** Both are lists, not axis charts — more subjects just means a longer, already-scrollable list, the same shape Column 2/3's own "Whole School Context" and Comparisons rankings already handle live at this same ~20-row count today.
- **Trend multi-line (D2): do NOT extend it literally.** 20 grey-tinted lines stop being individually distinguishable well before 20, indexed or not — past that point the chart shows noise, not "each subject individually."
- **Confirmed instead — Option K, "focus + top movers + a rest-of-school band":** the focused subject in green, the top 2 risers + top 2 decliners in grey tints as individual lines, everyone else folded into one shaded min–max "rest of school" band. The table underneath stays the complete record of all 20 subjects — same principle as moving the % Change group average into a reference line rather than a peer bar.
- **Table view for All-subjects Trend mirrors the same curated set, not an independent subset:** the focused subject plus the same top 2 risers + top 2 decliners the K chart draws, in the confirmed Table E/I style, plus one "Rest of school (N subjects)" row giving a min–max range rather than 16+ more individual rows. Card view shows this curated set; fullscreen opens the complete 20-row table — same card/fullscreen split as everywhere else, just applied to which *rows* are curated rather than which *years* are shown.

**Real code implication — read before touching `SubjectPanels.tsx`:** its `changeScope` prop (gates Trend and % Change both) is currently a single fixed value per column instance — Context is passed `changeScope="focus"` today, which is why its % Change and Current summary currently only ever describe the focused subject. Selected-subjects mode needs this to effectively become "all"; the All-subjects "focus + top movers + band" behaviour needs a **third mode**, not just an on/off toggle. `SubjectPanels.tsx` is also what Column 1 **Results** uses — design the prop change so Results' own behaviour doesn't shift as a side effect of this work.

## 5. Column 3 (Comparisons) — Trend and % Change

**Current design is sound and does not need to change:** `ComparisonsPanels.tsx`'s Trend and % Change deliberately never draw every comparator school as its own line. They draw exactly two series — "Your school" and one `vs:` choice (today: the set's own average, or one individual named school from a menu). The full ranked set is what the Current/Ranking view is for (bar chart, map, or sortable ranking — already built to scroll past 10 schools). That split stays.

**Confirmed addition — a third `vs:` choice: "All schools, individually."** Mechanically identical to §4's pattern, applied to schools instead of subjects: your school in the foreground colour, every comparator as its own grey-tinted line/bar (§1's B/D2 convention) while the set stays small, folding into §4's K (focus + top movers + rest-of-set band) once it doesn't. `TrendChart`/`ChangeChart` already support arbitrary series/bar counts generically (colour from the caller, footer legend already wraps/scrolls) — this is data-wiring onto existing chart primitives, not a new chart component. Today's 4 algorithmic sets run roughly 5–10 real schools (live-confirmed: Nearest 10 for The Chase resolved to 7 real schools), so a straight multi-line is safe at today's set sizes.

**Explicitly out of scope for this build:** the comparator-set chooser itself (letting a teacher expand/customise/save a named set, and the eventual region/nation-average comparator) is a separate, dedicated design pass — parked, not part of this brief. Where exactly "small" stops being small for Column 3's multi-line view depends on that separate pass, so don't hard-code today's ~10-school sets as a permanent ceiling.

---

## Open items — both resolved 2026-09-25

1. **Subject-abbreviation lookup table (§2) — resolved.** Table supplied above (first pass — verify keys against real subject-label strings before shipping). KS5's (subject, qualification bucket) keying is built into it via `KS5_BUCKET_SUFFIX`, matching the real bucket suffix already shown live at Post-16 ("Biology (GCE A level)").
2. **Column 3's third `vs:` choice (§5) — sanity-checked and confirmed by Guy, 2026-09-25.** Design unchanged from what was mocked up (own school in foreground colour, comparators grey-tinted individually while the set is small, folding into §4's K pattern once it isn't; small/large threshold stays a named constant, not hard-coded). Both items now carry the same confidence as §1-4 — nothing left open in this brief.

---

## Scenario coverage — Post-16, KS2, boarding, IB, FE colleges

Checked separately, against `teacher-view-phases.ts`, `dfe-qualification-buckets.ts` and `default-comparator-lists.ts`, plus (for FE) the private `vicdata` ingest repo. Full writeup is in the review doc's own "Do these foundational data views hold up..." section; summary:

- **Post-16:** everything above applies unchanged (measures are already phase-aware) — only real addition is open item 1's bucket-suffix note.
- **IB schools:** no chart-style change needed — IB is a real, carefully-modelled Post-16 qualification bucket with its own point scale, deliberately kept apart from A-level's grading. One thing not yet checked live: what the "A*–E rate" threshold measure shows for a pure-IB entry (IB isn't graded A*–E) — worth a live look before calling this fully proven.
- **FE colleges — CORRECTED, provisional, not settled.** An earlier pass in this review concluded FE colleges have no results data at all — that was wrong, and leaned on the Data View's *roll/headcount* history (a genuinely separate, real gap) rather than academic *results*. Guy: FE results are already visible in the advanced (Data View/Member) view, from memory a one-year-only view. Checked in the private `vicdata` ingest repo: `dfe_ks5_subject_results.py` ingests DfE's own "Schools and colleges — subject entries and grades" dataset (explicitly schools AND colleges, two real vintages, 2023/24 + 2024/25), and `academic_subject_rollup` (what `headline` reads) has no school-census join that would structurally exclude a census-less FE college. **Not yet confirmed:** whether real FE-college rows actually populate `academic_subject_headline`/`rollup` today, and where the "one year only" memory comes from (possibly the value-added source, `dfe_ks5_subject_value_added.py`, rather than entries/grades; possibly a real per-vintage ingest gap for FE URNs specifically). Confirm this directly (a DB check, or Claude Code, or Guy's own look at the Data View) before treating FE colleges as either fully covered or fully out of scope for a Teacher View dashboard — if results do populate, every decision in this brief likely applies unchanged.
- **Boarding schools:** no chart-style change — boarding only affects Column 3's default comparator-set generation server-side (already live, quintile-matched). Teacher View has no UI to see or override this (unlike the Data View's own Boarding filter pill) — that's the parked comparator-set chooser's territory, not this brief's.
- **KS2 — CORRECTED framing.** No chart-style change is still the right call (KS2 genuinely has no subjects/entries/per-subject Context by design — `focusSubjects` is hard-coded empty for KS2 — so none of §1-4's per-subject work applies, and Column 3 Comparisons' whole-school headline measure is phase-agnostic). But the earlier "not verified live — no primary school reachable" framing understated the real situation. The round-6 card-mechanism build report (`docs/vicdata_phase3_teacher_view_dashboard_card_mechanism_round6_brief_v1.md`, 2026-09-23) states twice, plainly: "Teacher view has no KS2 instance at all." Guy independently recalls the same. This isn't a test-account gap — there are genuinely no live KS2/primary schools onboarded to Teacher View today, so none of this has ever been exercised against a real school. The `TEACHER_PHASES`/`PHASE_QUESTIONS`/`page.tsx` KS2 branches are real, generic, code-complete work from round 5 (`hasCurrentPhaseData()` would surface a real KS2 tile the moment a primary school with current data joins) — so "no chart-style change needed" still holds architecturally — but treat KS2 as dormant/unlaunched, not "built and merely unverified." Nothing in this brief should be built or tested against a live KS2 scenario before a real primary school actually joins.
