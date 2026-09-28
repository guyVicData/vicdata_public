# Teacher view — Trends row merge & view titles (build brief v1)

Two changes, one round: collapsing each column's Trend and % Change panels into one "Trends" panel (Guy's two-row reorg — top row Current, bottom row Trends, absorbing every table/ranking/chart/map that lived in the old third row), and giving every view inside it a clear, real title above its chart/table/map. Both GCSE and Post-16, since both phases render through the same three column components — nothing phase-specific to touch.

## Why now, together

The merge is what makes titling urgent. Today, Trend and % Change are two separate accordion panels, each defaulting to one view, so a missing title is rarely felt — the panel's own tag ("Trends", "% Change") plus context does most of the work. Once every table/chart/map from both panels sits behind ONE action rail, a person clicking through six-plus options with no per-view title has to guess what's on screen from the icon alone. Guy's ask — "every data view in the second row has a clear title... title goes above the chart/table/map" — is the necessary companion to the merge, not a separate round.

## What exists today, real (grounded against the three column components)

The panel-level heading (`tag` + `afterTag`, e.g. "Trends — from 2021/22") always shows; it names the PANEL, never the specific view inside it. Below that, titling is inconsistent and mostly absent:

- `CandidatesPanels.tsx`: a `titled()` wrapper puts "Entries in {categoryLabel}" above Trend's AND Change's body, for every view inside each, whenever there's a real category to name — the one column that already does this consistently. Change's geography-comparison mode is left out of that wrap on purpose, because it already carries its own real heading (below).
- `SubjectPanels.tsx` (Results and Context — the same component, two call sites): the equivalent wrap ("Entries/Results in {categoryLabel}") is applied ONLY to Current. Trend and Change get nothing from it. Trend's Indexed/Actual chart views separately get `TrendScaleTitle` — a real, already-good explanatory sentence ("Change since 2021/22: each line starts at 100…"). Trend's Table and Map views get no title beyond the panel tag; Change's non-geography chart and table (the ranked list and the year table) get nothing either.
- `ComparisonsPanels.tsx`: no per-view title mechanism exists anywhere. The map views' only text is a legend label drawn inside the map itself ("% change since 2021/22"), which explains the map's own colour key, not what the view as a whole is. Its table and ranked-bars views have nothing.
- **Already real and good, in both Candidates and Results/Context**: the % Change panel's geography mode (school vs. LA/region/England) — both its chart and its table — is titled by `GeographyComparison.tsx`'s own real heading, "{geography.label} against the wider system". This is genuinely already clear; it needs no work.

So "some do but many don't" is real, and it's uneven column to column, not just view to view — Candidates already does the right thing for most of its views; Comparisons does it nowhere.

## The % change audit, specifically (Guy's check: will every % change view be identifiable when sorting which to keep)

Every real % Change view, column by column, with its true current state:

| Column | % Change view | Titled today? |
| --- | --- | --- |
| Candidates | Ranked list (no geography) | Yes, when a category exists to name ("Entries in {categoryLabel}") — no title for a lone subject with nothing to compare |
| Candidates | Table (no geography) | Same as above |
| Candidates | Chart / table (geography mode) | Yes, real — "{geography.label} against the wider system" |
| Results / Context | Ranked list (no geography) | **No title at all** |
| Results / Context | Table (no geography) | **No title at all** |
| Results / Context | Chart / table (geography mode) | Yes, real — same heading as Candidates' |
| Comparisons | Ranked bars | **No title at all** |
| Comparisons | Table | **No title at all** |
| Comparisons | Map | **No page title** — only a colour-key label inside the map itself |

Five real, confirmed gaps: Results/Context's two non-geography views, and all three of Comparisons' views. Candidates' non-geography views are titled whenever there's a category to name (the common case); the geography-mode views, in both columns that have one, are already fine and untouched by this round.

## The fix: one required title line, every view, same slot

Generalise `TrendScaleTitle`'s existing pattern (a plain, semibold, `--muted2` one-line `<p>` directly above the body — the same shape as Candidates' `titled()` line) into the ONE mechanism every view in the merged Trends panel uses. Not optional, not view-type-specific. Two things go in it, only when they're not already obvious from the merged panel's own tag/afterTag:

1. **Scope**, when there is one — the category, geography, or comparator-set label the numbers are drawn from ("in Humanities & Social Sciences", "against its LA, region and England", "against comparator schools").
2. **Shape**, whenever more than one view could otherwise look alike once merged — table vs. chart vs. map, indexed vs. actual, ranked vs. plain.

Existing good titles (the `TrendScaleTitle` sentences) are kept as-is; this fixes the views that currently have nothing.

### Modelled examples, for a read on the wording before this goes into every view

- Comparisons, Trend → Map (currently titleless; only a legend label inside the map): **"Change since 2021/22, coloured by school"**
- Comparisons, Change → Map (currently titleless; a different legend label inside the same-looking map): **"% change since 2021/22, coloured by school"** — this is also what stops the two maps reading as the same view once they're one click apart in the same rail.
- Comparisons, Change → Ranked bars: **"% change since 2021/22, ranked against comparator schools"**
- Comparisons, Trend → Table / Change → Table: **"Every comparator school, by year"** / **"Every comparator school, 2021/22 vs latest, ranked by change"**
- SubjectPanels (Results/Context), Trend → Map (currently titleless): **"{Subject} — change by school, on the map"**
- SubjectPanels (Results/Context), Change → Ranked list / Table (currently titleless — the real gap the audit above found): **"Results in Humanities & Social Sciences"** / **"Entries in Humanities & Social Sciences"**, matching the wording Candidates' own `titled()` already uses, so the same scope reads the same way in every column that has one.
- Candidates, Change → Table for a lone subject with no category to name (the one real Candidates gap): **"Entries by year, since 2021/22"** — a plain fallback so a subject with nothing to compare against still gets a shape-naming line, not silence.

If this style and level of detail reads right, Claude Code writes the exact wording per real view (subject names, category labels, year spans) rather than this brief enumerating all of them — there are more than a dozen once every phase/measure combination is counted, and the real strings (subject label, category label, geography label, measure noun) already exist in each component's own scope.

## The merge itself

`PanelId` shrinks from `"current" | "trend" | "change"` to `"current" | "trend"` (cosmetic — `PANEL_NAME`'s `trend` entry is already `"trends"`, so the merged panel's toggle/aria label needs no wording change). `PANEL_ORDER`/`DEFAULT_PANELS` follow.

Each of the three column components merges its own `trend: PanelRender` and `change: PanelRender` into one `trend: PanelRender`:

- `actions` concatenate (Trend's view buttons, then Change's), each label made unique where the same word appears in both halves — "Table" → "Trend table" / "Change table"; Comparisons' "Map" → "Trend map" / "Change map". A flat rail with two identically-labelled buttons is exactly the confusion the title line above doesn't fully solve on its own — someone still has to click to find out which "Table" they got.
- The two components' separate view-state hooks (e.g. Candidates' `trendView`/`changeView`) become one enum spanning every option, so `body` is a single switch rather than two.
- `tag`/`afterTag`/`question`/`footerLead`/`flag`/`legend`/`headline` keep whichever of the two panels' behaviour make sense for a merged panel — default to Trend's (it's first, and this is a mechanical merge Guy will edit by hand next), noting in the build report anywhere Change's version seems clearly better so Guy can decide.

**Persistence.** `panelsFrom(saved) { return PANEL_ORDER.filter(p => saved.includes(p)) }` already silently drops any saved id no longer in `PANEL_ORDER` — a returning user with "change" open just finds it gone, no migration needed or added. Worth confirming this is fine as-is rather than mapping old "change" saves onto the new merged "trend" id; it's a one-click reopen either way, and the brief's default is to leave `panelsFrom` untouched.

**Scope.** Only `CandidatesPanels.tsx`, `SubjectPanels.tsx` (covers Results and Context — both are the same component), `ComparisonsPanels.tsx`, plus the shared `teacher-view-panels.ts` and `ColumnPanels.tsx`'s `PANEL_NAME` map. Both GCSE and Post-16 render through this same component tree, so nothing phase-specific needs touching.

## What this round is not

Not a decision about which views survive — Guy said he'll go column by column afterwards and drop what isn't earning its place. This round's job is: merge cleanly, keep everything reachable, and make everything nameable while it's still all there — trimming later is easier when every option is clearly labelled and titled today than when some are unlabelled guesses.
