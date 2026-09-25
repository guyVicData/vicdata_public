# Teacher view dashboard: accordion, comparator chooser (first draft), full screen (first draft), and one bug fix — Claude Code prompt (v1)

Brief: `vicdata_phase3_teacher_view_accordion_chooser_fullscreen_round_build_brief_v1.md`. Build in this order, one commit per part, same convention as previous rounds (content round S1-S12, round 2, Trend & % Change redesign).

Context you don't have from a conversation: the Trend & % Change redesign (`bd466a2`...`45fca0c`) was walked through live today. Its own §D2 ("say if you want the group-average line back on Trend as a dashed line too") is answered: **no** — leave it as built, off the individual Trend charts, only on % Change's dashed line. No code change for that.

Everything else below is new.

## Part 1 — bug fix: Comparisons Trend chart collapses to zero height with many comparators

Found live today: on a Comparisons Trend panel (card view, not fullscreen), switching "vs:" to "All schools, individually" against a set of 9 comparators makes the chart disappear entirely — no axis, no lines, just the legend. Confirmed by inspecting the DOM: the chart's own `<svg>` renders at `width: 334, height: 0`.

**Root cause**, in `src/components/teacher/TrendChart.tsx`: the chart's outer column (`<div className="mt-1 flex min-h-0 flex-grow flex-col">`, around line 144) stacks the plot row (`<div className="flex min-h-0 flex-grow gap-2">`, line 145, holding the y-axis and the `<svg>`), the x-axis row, the "Academic year" caption, and — last — the legend (`<div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 pl-10">`, around line 253). In the fixed-height card view (`CardBox`'s `PANEL_HEIGHT`), the legend is `shrink-0`: it takes whatever it needs. With two or three legend entries that's fine. With ten (nine comparators plus the "100 = first year shown" reference-line entry) it wraps to several lines and, at typical card width, ends up consuming the entire column's available height, squeezing the `flex-grow` plot row to zero. `CardBox`'s content wrapper already has `overflow-y-auto`, but that doesn't help here — the total content isn't taller than the box, it's that the legend's natural size and the chart's flex-grow size are competing for the same fixed budget and flex gives the legend everything it asks for first.

Fullscreen doesn't have this problem — confirmed live, the chart renders correctly there with all nine lines, own-school in the foreground colour, comparators grey-tinted, and the "100 = first year shown" dashed reference. % Change doesn't have this problem either, in card or fullscreen — it's a ranked list (`ChangeList`), not a chart with an unbounded legend.

**Fix:** give the plot row a floor it can't be squeezed below, e.g. `min-h-[110px]` (or whatever you judge reads as a usable chart at card width — this is a floor, not a redesign) on the `flex min-h-0 flex-grow gap-2` div at line 145. If the legend then pushes the panel's total content taller than the card's fixed height, that's fine and correct — the card's own `overflow-y-auto` will scroll it, which is a much better failure mode than the chart disappearing. Don't touch the fullscreen path; it isn't broken.

Worth noting: Part 2 below (the accordion) gives every open panel a lot more height, which will make this specific 9-comparator case far less likely to bite in practice. Fix the floor anyway — it's a real bug independent of how much room the panel has, and a future set with even more comparators, or a narrow phone width, can still hit it.

## Part 2 — accordion: one panel open at a time, and it gets real room

Content round S10 gave each column's three panels (Current, Trend, % Change) independent open/shut state, explicitly **not** an accordion — its own comment in `ColumnPanels.tsx` says "more than one can be open (not a single-open accordion)." Change that: opening a panel now closes the other two in the same column. This is a small, deliberate revision to S10, made with the aim of freeing up real height for the open panel's chart.

**State change**, `src/lib/teacher-view-panels.ts`, `togglePanel`:

```ts
// Opening a closed panel makes it the only open one; opening the open one closes it.
// A standard accordion, not S10's independent-toggle model -- see the round's own
// note on why: a wider panel with only one thing in it draws a much better chart.
export function togglePanel(open: PanelId[], id: PanelId): PanelId[] {
  return open.includes(id) ? open.filter((p) => p !== id) : [id];
}
```

Update the comment block above `PANEL_ORDER`/`DEFAULT_PANELS` and `ColumnPanels.tsx`'s own top-of-file comment (the "Rules this component owns" list, point 2) to describe the accordion instead of independent toggles. Persistence is unaffected — `panelsFrom` still reads/writes the open set, which is now always zero or one panel; nothing about the storage shape changes, so nobody's saved state needs migrating. A column nobody has touched still opens with Current alone (`DEFAULT_PANELS`), and the "everything collapsed" state (click the one open panel closed) is still valid, same as before.

**Height.** `CardBox.tsx`'s `PANEL_HEIGHT` (currently 232px) was sized for "two panels open plus one collapsed bar fits a laptop viewport" (its own comment walks through the arithmetic each round has revised — 256 → 224 → 232). That constraint no longer applies: a column is now one open panel plus two collapsed bars (each roughly 40-44px, from `CardBox`'s `collapsed` early return). Redo that arithmetic for the new shape and raise `PANEL_HEIGHT` substantially — page padding, nav, control bar, column header and pills, two ~44px collapsed bars, then whatever's left for the one open panel, against a typical ~800-900px laptop viewport. Do the sizing exercise properly rather than guess a number; document it in the constant's own comment the way every previous round has. This is the whole point of the change — a materially taller chart area, not a token bump.

Whether that height stays a single fixed constant (as now — every open panel the same height, whichever of the three it is, so the three columns still read as aligned) or becomes a floor with room to grow for content-heavy panels (Comparisons' "all schools individually" Trend, or a subject list with 20+ rows) is your call — flag which you went with and why, the same way S10 and round 2 flagged their own height judgement calls.

**Not in scope for this part:** anything about which panel opens by default when a column is *reset* (stays Current, per `DEFAULT_PANELS` — untouched) or about persistence format (untouched, as above).

## Part 3 — comparator (school) chooser, first draft

Today's "Compared against" control in `ComparisonsPanels.tsx` (~line 530, the `PillMenu` fed by `setOptions`/`changeSet`) only offers a handful of fixed preset sets ("Nearest 10 schools", etc.) with no way to build or reuse a custom one. Build a first draft of a proper chooser, reusing real, already-shipped pieces rather than inventing new ones:

**Design convention — reuse, don't reinvent.** Guy was explicit: this should follow the same conventions as the real "which subjects do you teach" picker, `src/components/teacher/CategorySubjectPicker.tsx` — tabs per family/category (filled pill when active, outline when not, each showing its own ticked count), a "Selected so far" panel of removable coloured chips, collapsible category cards (coloured dot + label + "N of M ticked" + chevron), and checkbox rows tinted to the category's colour (`${colour}14` background, `colour` border) when checked. For schools, "category" reading is by local authority (this is what the wireframe below groups by); reuse the same visual language, not the same taxonomy.

**A wireframe reference already exists**, built and iterated live with Guy earlier: `https://claude.ai/artifact/8SLvLpLqFUHeaDoiv5yR2v` (currently Version 2) — a comparator/schools chooser List pane rebuilt specifically to match `CategorySubjectPicker.tsx`'s conventions (LA-grouped, coloured, tabbed, chip-based). Open it for the interaction pattern and layout; it's a design reference, not code to port.

**Backend — reuse the real schema, don't invent a new one.** `saved_sets` / `saved_set_members` (migration `20260807093000_saved_sets.sql`) already model exactly this: `owner_membership_id` null = shared/admin-owned (unlimited count, visible to every approved member via RLS), non-null = personal (visible only to its owner). `src/app/api/comparator-set-peers/route.ts` already reads this schema for the rolls product — follow its pattern for a new Teacher-view-facing route rather than duplicating the query logic; Teacher View doesn't consume `saved_sets` today, so this is new plumbing, but the tables and their RLS are not.

**Confirmed product decisions** (asked and answered earlier, before the wireframe was built — carry these into the real build, not just the mock):
- Personal-set cap: **raised from 3 to somewhere in 5-10** (Guy's own words: "raise it (e.g. 5-10)" — pick a number in that range, it doesn't need to be exact).
- Map/candidate scope while building a set: **ticked set plus nearby candidates** (not the whole map, not ticked-only).
- Editing a shared/admin-owned set: **account holder / admin only** — an ordinary member can use a shared set but not edit its membership.

**Wire it in** as a new option inside the existing "Compared against" `PillMenu` (e.g. "Choose schools…" alongside the existing presets, or a "Manage sets" row if that reads better once it's live) — opening the chooser as a modal, matching the app's existing modal conventions (`TeacherModal`, same as `CardBox`'s fullscreen and the subject picker). Once a custom set is saved, it should appear in the same pill's list as a first-class option alongside the presets, and become the active `setId` the Comparisons column reads from (i.e. it needs to fit `changeSet`'s existing shape, or that function needs a small extension to accept a custom set id — your call which is cleaner given the current code).

This is explicitly a first draft, same as the Trend/% Change round's "build it, then walk through it live" approach — get the mechanism working end to end (create a personal set within the new cap, use a shared set if one exists, see it drive Comparisons) rather than polishing every corner; we'll review live tomorrow alongside everything else in this prompt.

## Part 4 — full screen, first draft

`CardBox.tsx`'s fullscreen modal already does more than it might look like at a glance: real title, the natural-language `question` as a subheading, the view-rail (`actions` — chart/table toggle etc.) carried over unchanged, and the caption (the panel's one-line conclusion) printed as visible text (`captionLine`), not hidden behind an icon the way it is in the compact card view. What it doesn't do yet, and what Guy asked for when this was first discussed (Teacher View dashboard's fullscreen, not the separate Data View/Member product): the **source line** is currently print-only (`hidden ... print:block`) — invisible on screen in fullscreen, only reachable via the small `SourceNote` icon in the footer — and there's no separate area for "warnings and notes" the way Guy described (a rail beside the main content, rather than everything living in one bottom footer row).

Build a first pass at this, inside `CardBox`'s `fullscreen && <TeacherModal>...` block only — the compact card view is untouched, and stays icon-driven (that's deliberate, from round 2 §7-8, to save space where space is scarce):

- Make the source line always-visible text in fullscreen, in the same place it already sits for print (right under the caption), instead of `hidden`/print-only. Screen and print then show the same thing, which is simpler than the two-state hidden/printed split it has now.
- Add a narrow rail to the right of the main content (chart/table + description + source), for whatever the panel has that reads as a flag or a note: today that's the growth/decline `flag` (currently right-aligned in the bottom footer row) and the private per-person `PanelNote`, if one exists for that panel (currently an icon-triggered popover, `PanelNote` in `PanelFooter.tsx`). Move the flag there, and surface the note's text directly if one is saved (still editable via the same popover trigger, just also visible rather than only reachable by clicking an icon) — this is the closest real analogue to "warnings and notes" that exists in the app today; there's no separate warnings system yet (S12's flag is explicitly "the first of our flags," per the content round's own build report), so don't invent one — just give the pieces that do exist a proper place in fullscreen rather than cramming them into the bottom row.
- Keep the footer row for what's left (Export, the caption/source triggers on the card view — unaffected since this only touches the fullscreen branch).

Treat the exact proportions as your judgement call, flagged the way every other round flags one — Guy described this in terms of a 7-column-ish main area with a narrower side rail when he first raised it; that was about a different product's layout (Data View), so take the proportion as a rough steer, not a spec, and build something that reads well at the sizes Teacher View's fullscreen modal actually is. This is a first draft to react to live tomorrow, same as Part 3.

## Verification

Same bar as every previous round: `tsc --noEmit`, `eslint`, `next build` clean on every commit. You're behind the auth gate for live checks as always, so note in the build report what you could and couldn't verify — in particular, Part 1's fix is worth a `console.log` of the plot row's rendered height or similar sanity check if you can manage one without a browser, since the whole bug was invisible to type-checking and linting the first time.

## Open decisions to flag in the build report

- Part 2: which height you landed on for `PANEL_HEIGHT`, and the arithmetic behind it (same as every prior round's own note on this constant) — plus whether you kept it a single fixed value or gave it a floor-with-room-to-grow instead, and why.
- Part 3: whatever real integration seams you hit wiring a new comparator set into `changeSet`/`setOptions` that the brief didn't anticipate — this is explicitly first-draft territory.
- Part 4: how you split the main area from the rail, and what exactly landed in the rail for each of the three panel types (Current/Trend/% Change may not all have a flag or a note to show).
