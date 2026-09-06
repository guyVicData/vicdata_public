# VicData — Phase 3: Member Data View — Graphs (formerly Dashboard) Redesign v1

*Two immediate bug fixes from live testing of UI/UX Sharpening Round 2, plus the first section of a larger redesign of the "Dashboard" view — renamed "Graphs" — requested 2026-09-06. Graphs will grow over multiple future rounds ("then start adding/amending others" — Guy's words); this round specs Section 01 (Overview) only. Colour/chart guidance below follows the house dataviz method (categorical hues assigned in fixed order and never re-cycled, one axis per chart, diverging pairs reserved for direction/polarity, validate any new palette before shipping).*

---

## Immediate bug fixes

### Bug 1: FE colleges missing from Post-16 view of Acland Burghley
Starting from Acland Burghley and looking at Post-16, no FE colleges appear anywhere in the comparator set/lists — despite Round 1's summary-sentence spec explicitly describing "Sixth form roll … compared with schools and FE colleges in Camden, Islington and Haringey" as a real, intended case. Investigate wherever the Post-16 candidate pool is built (likely the same nearest-schools/default-list logic already patched for FE numbers in Round 1's B1) and confirm FE colleges are actually included as candidates when Post-16 is active, not just correctly computing once added.

### Bug 2: "Hide/Show compared schools" was built to the wrong reading — please correct
This was my misreading of Guy's original request, not a build error: it was specced and built as "hide these schools' data from the map" (display-only, membership untouched). What Guy actually meant: **collapse/hide the schools list itself inside the "Compared with" sidebar box** — long lists are pushing the sidebar's vertical height too tall (and, since the shell now shares a row with the map, that's dragging the map's height down with it). Please:
- Add a proper collapse control on the "Compared with" schools list (accordion-style, matching the existing collapse-arrow component already standardised in the last round) — collapsed state shows just a count ("14 schools") with an expand affordance, matching whatever collapse pattern the filter row already uses for consistency.
- The existing map-display-only hide toggle from last round can stay as-is if it's cheap to leave in — it's a legitimate feature, just not what solves this particular complaint. Use your judgement on whether to keep both as separate controls (they do different jobs) or fold one away if it's genuinely redundant once the list itself can collapse — log whichever you pick.

## Graphs redesign — Section 01: Overview

### Global changes
- **Rename "Dashboard" to "Graphs"** everywhere it's user-facing (tab label, PDF export headers, etc.). Your call whether the underlying route/component name changes too — low-stakes either way, just be consistent.
- **Layout**: one main graph at roughly 2/3 width and 2/3 height of the content area; secondary graphs/tiles arranged to its right and below.
- **The page scrolls**, like the public home page, and is organised into named sections in the same visual style — this round only builds Section 01; leave clear structure for Sections 02+ to slot in later without a rebuild.
- **Graph titles react to active filters but stay short** — not the full A3 summary-sentence treatment, just the minimum needed to stay accurate, e.g. "Roll Trends since 2019-20" becomes "Post 16 Roll Trends since 2019-20" when the Post-16 filter is active. Reuse the same filter-state logic A3 already has, just a terser template variant, not a second parallel system.

### Section 01 — Overview

**Main graph: "[Phase] Roll Trends since [start year]"**
- A multi-line chart, one line per school currently in the "Compared with" set, all shown by default — the member can narrow the set down (via the existing tick-list) if there are too many lines to read.
- **Each school gets a fixed, stable colour** — assign from a categorical palette in a fixed order and never repaint a school's colour when the set changes size (per house convention: colour follows the entity, not its position in a list). A legend below the chart maps each colour to its school name.
- **A toggle button on the graph** to show/hide a computed "Average of all other schools" line (mean of every non-focus school currently in the set) — render it visually distinct from real schools (e.g. dashed, neutral grey) so it's never mistaken for an actual school's line.
- **The focus school renders in red**, per Guy's explicit instruction, flagged "for now." **Worth knowing**: red is already this app's established colour for "declining" on the Map's trend scale, and will also appear on the new growth/decline chart below (as a real direction, not an identity marker) — so the same red will mean two different things in the same section depending on which chart you're looking at. Guy's called this provisional already; if it causes real confusion once it's live, the fix would be giving the focus school a distinct visual treatment beyond colour alone (e.g. a heavier line weight or a marker) rather than reserving red for identity. Build to the "always red" instruction now; log the tension so it doesn't get silently forgotten.
- **X-axis**: show every year, not just the endpoints, with a subtle vertical gridline at each year.
- **Y-axis**: real value ticks/labels (currently apparently blank/unlabelled — make sure this one has them).
- Run any new categorical palette through this codebase's existing colourblind-safety validator before shipping (same standard the Map's trend/sector colours were already held to) — don't ship an unvalidated guess the way the Map's trend ramp originally was.

**To the right of / below the main graph, same section:**

1. **Current Roll** — keep the existing stat tile (headline number + growth figure) as-is. Replace whatever chart currently sits with it with a **bar chart**: one bar per school in the comparator set, sorted largest-to-smallest current roll, the focus school's bar in the same red identity highlight, every other bar a single neutral/muted colour (this is one measure across many schools, not multiple identities, so it doesn't need the full categorical palette — just the one highlighted bar against a neutral field). Hover on any bar reveals that school's name and exact value.

2. **New chart: growth/decline rate**, one bar per school in the set. Recommend building this as a **diverging bar chart** (bars extending left/right from a zero centre-line) using the same validated blue/red diverging pair the Map's trend scale already uses — growing = blue, declining = red — rather than inventing a third colour scheme. This means the focus school's bar will correctly be whichever colour matches its own real direction, not forced red — if you still want the focus school identifiable here, use an outline/ring rather than overriding its fill colour, since on this specific chart the colour's job is showing direction, not identity, and those two jobs would conflict if both tried to claim red/blue.

### Section 02 — Market share
Heading only for this round — no chart spec yet, more to follow in a later round. Just reserve the section in the new scrollable structure.

### Section 03 — Gender split
The existing gender-split chart, carried into the new section structure, with one new rule: **hide this section entirely when the focus school has only one gender** (a single-sex school) — there's nothing meaningful to show. Use whatever coed/gender classification the app already has for this (the same one driving the existing Gender filter's relevance logic).