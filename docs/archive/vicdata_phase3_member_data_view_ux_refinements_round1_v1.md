# VicData — Phase 3: Member Data View — UI/UX Sharpening Round 1

*Guy's own round of refinements, requested 2026-09-06, following the Map v1 layout pass (full-canvas map + floating overlays). Two categories: (A) layout/UI refinements to the shell, filters, and a new dynamic summary line; (B) data/functionality fixes and a rework of the comparator set ("Compared with"). Reorganized and clarified from Guy's own notes below — one item (B1) is flagged as genuinely unclear pending his confirmation.*

---

## A. Layout / UI refinements

### A1. School/college name above the topic breadcrumb
Add the school's name as its own line, directly above the existing topic breadcrumb (Rolls > Academic > Destinations > Context >), left-aligned with "VicData" in the row above it and with "Phase" in the row below it.

Example: `Acland Burghley School` sits above `Rolls > Academic > Destinations > Context >`.

### A2. Filters row — show only relevant filters, new controls
- **Show only the filters relevant to the school/college being viewed** — e.g. for Acland Burghley: Phase (Senior / Post-16), Gender (Girls/Boys), not every possible filter for every phase/sector.
- **New filter: change the date range examined.** The end date is fixed at the latest available year (2025-6) and can't be changed; the start date should be selectable.
- **Add a "Saved Sets" dropdown plus a "Save set" button** to the filter row, letting a member save their current comparator set/filter combination and recall it later. This should share one underlying save mechanism with the "Compared with" rework in B3, not be built as a second, separate thing.
- **FE colleges (Post-16 focus) get their own age filter: U19 and Adult.** U19 should itself resolve to ages 16/17/18, so an FE college's U19 headcount is comparable in size against a school's own Post-16 cohort as well as against other FE colleges.
- **Collapse control**: the filter row's expand/collapse behaviour becomes a show/hide arrow sitting inline in the same row as the filter choices themselves.

### A3. New: dynamic filter-summary sentence
A text line below the filter row, stating in plain language what the current filter/comparator combination means for what's shown on Map/Dashboard/Rankings. Updates live as filters change. Examples Guy gave:

- "Total roll 2019-20 to 2025-6 compared with 10 nearest state senior schools"
- "Girls roll 2019-20 to 2025-6 compared with all senior schools in Camden"
- "Sixth form roll 2019-20 to 2025-6 compared with schools and FE colleges in Camden, Islington and Haringey"
- "11 year old roll 2019-20 to 2025-6 compared with all schools in London"
- "Boarding population 2019-20 to 2025-6 compared with nearest 10 similar-sized boarding schools"

Needs a real sentence-template system driven by whichever filters/comparator set are actually active, not hardcoded strings.

## B. Data / functionality fixes and comparator-set rework

### B1. FE college numbers are currently all zero — real bug, needs wiring
Every FE college currently shows zero across the board; the underlying data isn't wired in. Needs investigating and fixing at the source, not patched per view.

**Flagged as unclear, needs Guy's confirmation**: alongside this, Guy asked to "sort exclusions" with a note that didn't fully come through ("map shows la swap ? HE etc"). The one unambiguous rule stated: **exclude any college with no U19 students at all** (e.g. City Lit, which is entirely adult/HE-focused) from lists meant to be U19/school-comparable. Confirm with Guy what else needs excluding — possibly Higher Education institutions appearing somewhere they shouldn't, or a Local-Authority attribution issue on the map — before guessing at the rest, or make the most reasonable call and log it per the usual protocol if he's not available to ask.

### B2. Special schools excluded from mainstream comparisons
Filters and the Data View map should behave the same way the existing public map already does with respect to Special Schools. This is the moment to properly close out the "Special Schools sector isn't in the original list-matrix" item flagged as an open decision in the previous build round, rather than continuing to leave it an implicit fallback.

### B3. Rename "Comparator" to "Compared with", and extend how it works
- Rename the "Comparator [Set]" label/UI wherever it appears to **"Compared with"**.
- Add a **"Select all"** button underneath the Local Authority list.
- Allow **adding additional/adjacent Local Authorities** as choices, not limited to a single LA at a time.
- Add **Region** and **Nation** as choices in the Sets picker — build the UI entries now but grey them out/disable until the underlying data infrastructure to compute those sets actually exists. Don't wire fake data behind them.
- **If a school belongs to a named group** (e.g. a Harris academy), add a set choice to compare with all other schools in that group.
- For the **"Nearest 10"** default set, add a button to expand it by 5 more schools at a time (Nearest 15, Nearest 20, …).

### B4. Map interaction changes
- Schools render as **small dots**, name shown only on hover/rollover, and **no data at all** until the school is actually added to the "Compared with" set — remove the current "faded but partially visible" state for un-added schools. A dot is either fully in (ticked, full data, as now) or a bare, unlabelled-until-hover dot with nothing else shown.
- **Turning off a filter/selector must hide the corresponding dots** on the map — confirm this isn't already silently broken.