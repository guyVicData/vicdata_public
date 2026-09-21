# Teacher view — onboarding rebuild + shared list styling (Round B)

## Why this brief exists

Round A (home page + dashboard grid/width, `b48fe23`) is built and verified live. This is
Round B: Guy's remaining two complaints from the same review — "there is no qualification
or category selection in the teaching selection" and "selection list layout is very
basic" — plus the fuller picture found reading every onboarding mockup file
(`GCSE-Step1..4.dc.html`, `Post16-Step1..4.dc.html`).

**The mockup's onboarding is a real four-screen mechanism, not four screens with one
designed and three sketched.** Step 1: tick which qualification families you teach (a
few tiles). Step 2: tick which subjects, grouped by category, filtered to the families
ticked in step 1. Step 3: a live results preview of exactly what was ticked. Step 4: a
static "here's what you'll get" summary before landing on the dashboard. The real build
currently has one flat, ungrouped subject list at step 0 and three placeholder sentences
at steps 1–3.

## The most important finding: don't invent new taxonomy data

The mockup's step 1/step 2 data (`QUAL_TYPES` in the `.dc.html` files) is the design
tool's own **hardcoded demo data** — a static JS array, not something wired to a real
data source, because the design tool has no access to this platform's database. Read
against the real codebase, almost all of it already exists as real, live taxonomy:

- **KS5 qualification families** = `KS5_BUCKETS`/`KS5_BUCKET_LABEL` in
  `src/lib/dfe-qualification-buckets.ts` — `alevel`/`ib`/`btec_ocr`/`tlevel`/`other`,
  labelled exactly "A-level"/"IB"/"BTec, OCR, VRQ"/"T Level"/"Other". This is a byte-for-
  byte match to Post-16 Step 1's five tiles. Use `bucketFor(qualificationType)` directly
  — do not re-derive this grouping.
- **KS4 qualification families**: no existing 3-way bucket function, but the patterns
  already exist in `qualificationShortLabel` (`src/lib/teacher-view-theme.ts`) — GCSE
  (`qualificationType === "GCSE (9-1) Full Course"` or the Double Award variant),
  BTEC & OCR (`/^btec/i` or `/cambridge national/i`), Other vocational (everything else).
  Factor a small `ks4QualificationFamily(qualificationType): "gcse" | "btec_ocr" |
  "other_vocational"` out of those same patterns, next to `qualificationShortLabel` in
  `teacher-view-theme.ts`, rather than inventing a new classification or duplicating the
  regexes inline.
- **Subject categories** ("Arts, Media & Design", "Sciences & Maths", etc. in Step 2) =
  the platform's real, existing subject-family taxonomy: `familyLabelFor()` in
  `teacher-view-catalogue.ts`, backed by `subject_family_map` / the same lookup
  `CategoryFilter.tsx` and `SubjectAreaSection.tsx` already use elsewhere in the app.
  Every one of the mockup's category names (bar one) is one of the real 8 fixed
  `family_id` values in `src/lib/subject-family-colours.ts`'s `SUBJECT_FAMILY_COLOURS`
  (`sciences_maths`, `humanities_social`, `languages_literature`, `arts_media_design`,
  `business_law`, `technology_eng_construction`, `health_care`, `enterprise_applied`).
  Use `familyLabelFor()` for the category a subject belongs to and
  `SUBJECT_FAMILY_COLOURS`/`cssVarNameForSubjectFamily()` for its colour dot — this is a
  real, site-wide colour identity already, not a set of colours to invent per the
  mockup's own arbitrary hex choices.

This means Step 1 and Step 2 are real, data-driven screens built on taxonomy that
already exists and is already colour-themed elsewhere in the app — not a port of the
mockup's demo arrays.

## What NOT to touch in this round

- Round A's home page and dashboard grid — done, verified, don't touch.
- Card content, `CardBox.tsx`, `ColumnBuilder.tsx`'s underlying pinning logic.
- The delta-colour question (green vs muted-grey/red-only-negative) — still open,
  unrelated to this round.
- The GCSE Results comparison-anchor fix (subject-level national average via
  `academic_subject_rollup`, replacing the current family-level substitute) — a separate,
  not-yet-briefed fix. Step 3 of this round (the results preview) should reuse whatever
  the dashboard's own Results computation is *at the time this round is built* so the two
  never disagree — don't build a second, different computation for the preview. Note in
  the build report that Step 3 will need revisiting once that anchor fix lands.

---

## Step 1 — qualification-family tiles (new screen)

Real file: `src/app/teacher/[phase]/page.tsx`'s `!onboarded` branch, currently `step ===
0`. This becomes a new first step, pushing the existing subject picker to step 1 (index
shifts by one throughout; keep "step X of 4" visible and correct).

Tiles, tick-to-select, literal from the mockup (`border-radius:12px`, 34×34px icon box at
"family colour" 18% opacity when selected background / 10% card tint, a checkbox-style
indicator — filled square+tick when selected, empty bordered square when not):

**KS4** — three tiles, in this order, sourced from `KS5_BUCKET_LABEL`-equivalent local
constants (GCSE/BTEC & OCR/Other vocational), each only shown if the school has at least
one real subject entry under that family (don't show a tile with nothing behind it):
```svg
<!-- GCSE -->
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
<!-- BTEC & OCR -->
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>
<!-- Other vocational -->
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
```
Colours: GCSE uses `PHASE_ACCENT.ks4` (`#34d399`, already a constant); BTEC & OCR
`#60a5fa`; Other vocational neutral `#a1a1aa`.

**KS5** — five tiles from `KS5_BUCKETS` in order, same tick-to-select pattern, only
shown where the school has real entries. Icons and colours (also only shown where real
data exists):
```svg
<!-- A-level, #f472b6 -->
<svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,-306,0)"><g transform="matrix(1,0,0,1,306,0)"><g transform="matrix(1,0,0,1,12,0)"><g transform="matrix(3.925511,0,0,2.731409,-34.25031,-69.515531)"><path d="M43.113,82.362L38.366,57.87L38.176,57.87L33.43,82.362L43.113,82.362ZM19.19,106L34.284,38.409L42.353,38.409L57.447,106L47.764,106L44.916,91.476L31.721,91.476L28.873,106L19.19,106Z"/></g></g></g></g></svg>
<!-- IB, #38bdf8 -->
<svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,-918,0)"><g transform="matrix(1,0,0,1,918,0)"><g transform="matrix(1,0,0,1,12,0)"><g transform="matrix(1,0,0,1,0,-2)"><g transform="matrix(3.925511,0,0,2.731409,-77.25031,-66.515531)"><rect x="23.841" y="38.409" width="9.683" height="67.591"/><path d="M42.923,106L42.923,38.409L57.067,38.409C60.168,38.409 62.811,38.884 64.994,39.833C67.178,40.782 68.965,42.048 70.358,43.63C71.75,45.212 72.747,47.032 73.348,49.089C73.949,51.146 74.25,53.282 74.25,55.497L74.25,57.965C74.25,59.8 74.108,61.351 73.823,62.616C73.538,63.882 73.111,64.99 72.541,65.939C71.465,67.711 69.82,69.23 67.605,70.496C69.883,71.572 71.56,73.154 72.636,75.242C73.712,77.331 74.25,80.179 74.25,83.786L74.25,87.583C74.25,93.532 72.81,98.089 69.931,101.253C67.051,104.418 62.447,106 56.118,106L42.923,106ZM52.606,74.673L52.606,96.317L56.783,96.317C58.745,96.317 60.279,96.032 61.387,95.463C62.494,94.893 63.333,94.102 63.902,93.089C64.472,92.077 64.82,90.874 64.947,89.482C65.073,88.09 65.137,86.571 65.137,84.925C65.137,83.217 65.042,81.729 64.852,80.464C64.662,79.198 64.282,78.122 63.713,77.236C63.08,76.35 62.225,75.701 61.149,75.29C60.074,74.878 58.65,74.673 56.878,74.673L52.606,74.673ZM52.606,47.522L52.606,66.129L56.972,66.129C60.2,66.129 62.368,65.322 63.475,63.708C64.583,62.094 65.137,59.737 65.137,56.636C65.137,53.598 64.519,51.32 63.285,49.801C62.051,48.282 59.82,47.522 56.593,47.522L52.606,47.522Z"/></g></g></g></g></g></svg>
<!-- BTec, OCR, VRQ, #2dd4bf -->
<svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,-612,0)"><g transform="matrix(1,0,0,1,612,0)"><g transform="matrix(3.925511,0,0,2.731409,-22.25031,-68.515531)"><path d="M56.403,38.409L42.543,106L33.999,106L20.234,38.409L30.487,38.409L38.176,85.59L38.366,85.59L46.15,38.409L56.403,38.409Z"/></g></g></g></svg>
<!-- T Level, #fb923c -->
<svg width="17" height="17" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1,0,0,1,-1224,0)"><g transform="matrix(1,0,0,1,1224,0)"><g transform="matrix(1,0,0,1,12,0)"><g transform="matrix(3.925511,0,0,2.731409,-20.25031,-69.515531)"><path d="M29.917,106L29.917,47.522L18.715,47.522L18.715,38.409L50.802,38.409L50.802,47.522L39.6,47.522L39.6,106L29.917,106Z"/></g></g></g></g></svg>
<!-- Other, #a1a1aa -->
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
```

Default state: pre-tick every family the school has real entries under (the mockup shows
some pre-selected) — a teacher with only GCSE and BTEC entries shouldn't have to
discover and tick "GCSE" manually. Next button always enabled once at least one family is
ticked.

---

## Step 2 — category-grouped, tab-filtered subject picker (replaces current step-0 flat list)

Real data: the existing `SubjectItem[]` (`buildSubjectItems`, already in
`[phase]/page.tsx`) filtered to only the families ticked in Step 1. Group by real
`familyLabelFor()` category within each qualification-family tab (families with zero
real subjects among the ticked ones simply don't appear as a tab).

Structure, literal from the mockup: qualification-family tabs (pill buttons, count
badge, active = filled in family colour); a "Selected so far" panel always showing every
ticked subject as a removable chip, grouped by qualification family, coloured by
`SUBJECT_FAMILY_COLOURS`; below that, collapsible category sections (coloured dot +
category label + "N of M ticked" + chevron), each expanding to a checkbox row per
subject, checked rows getting the category's colour as a light background tint and
border (mirrors `TickList`'s existing checked-row idea, just with colour). New component
— this doesn't fit `TickList`'s shape (grouping, tabs, per-item colour), so build it as
its own, e.g. `CategorySubjectPicker.tsx`, rather than bending `TickList` to do a job it
wasn't designed for.

Keep a visible live entries/candidate count somewhere on this step (design brief §6's
"watch the real count update live" — don't lose that just because the qualification
split moved it out of step 0).

---

## Step 3 — live results preview (new screen, currently a placeholder sentence)

For every subject ticked in Step 2: a row with icon, subject name, qualification-family
label, real score, real bar (school's score vs. England average position on the bar),
and one line of real delta text — reusing the dashboard's own Results computation (see
"What NOT to touch" above: do not build a second implementation). Legend at top: a small
swatch per ticked qualification family plus "England average" as a vertical tick mark —
literal from `GCSE-Step3.dc.html`.

---

## Step 4 — views summary (new screen, static)

Four rows, one per view type (Candidates/Results/School Context/Rankings), each with the
already-established phase-accent-tinted 38×38px icon (reuse the exact icons already used
on the dashboard's own column headers — don't redraw them) and the one-line question from
`PHASE_QUESTIONS`. No real data needed — this is purely explanatory, identical in
structure for both phases, differing only in accent colour and the phase-specific
question wording already defined in `teacher-view-phases.ts`.

---

## Shared list styling — `TickList.tsx`

Guy's "selection list layout is very basic" applies beyond onboarding: `TickList` is
also what `ColumnBuilder.tsx`'s view-pinning list and the meetings slide-picker use.
Since Step 2 above needs a bespoke component, don't try to retrofit category grouping
into `TickList` itself — but do give checked rows real visual weight there too, so the
"same gesture" principle (design brief §14) doesn't leave those two other pickers looking
plain by comparison: a checked row should show a coloured left border/background tint
(reuse `colourByGroup`'s existing per-item colour in `ColumnBuilder`'s case) rather than
just a ticked checkbox on an otherwise identical grey row. Keep `TickList`'s existing
generic props shape — this is a visual upgrade to how a checked row renders, not a
rewrite of its API or its three call sites' logic.

---

## Verification

Before calling this done: run through a full onboarding walkthrough live for a phase
with real GCSE + BTEC data (Step 1 pre-ticks the families with real entries; Step 2 shows
only those families as tabs, correctly grouped by real category with real colours; Step 3
shows real scores for what was ticked; Step 4 is the static summary) and confirm landing
correctly on the real dashboard afterward with exactly the ticked subjects reflected in
the header chips. Repeat for Post-16 (5 possible families). Check both light and dark.
Confirm `ColumnBuilder`'s view-pinning list and the meetings slide-picker still work
exactly as before, just with the new checked-row treatment.
