# Teacher view accordion / chooser / full-screen round: build report (v1)

Brief and prompt: `vicdata_phase3_teacher_view_accordion_chooser_fullscreen_round_{build_brief,claude_code_prompt}_v1.md`, plus the "stop after this round" addendum.

Built from `45fca0c`, one commit per part:

| Part | What | Commit |
|---|---|---|
| 1 | Bug fix: Trend chart at zero height | `8483b53` |
| 2 | Accordion and panel height | `d0e3ef2` |
| 3 | Comparator chooser, first draft | `372414b` |
| 4 | Full screen, first draft | `117d808` |

Nothing else was picked up, as the addendum says.

## Part 1: Trend chart collapsing to zero height (bug fix)

`TrendChart`'s plot row (`flex min-h-0 flex-grow gap-2`) now has a 110px floor (`min-h-[110px]`). The fullscreen path is untouched: it sets its own height.

**Verified in a real browser layout, not just the type checker.** I rendered `MultiTrend` server-side with ten series, placed it in a replica of `CardBox`'s fixed-height card (232px), used the app's own compiled CSS from `next build`, and measured the SVG in headless Chrome:

| | SVG height | Card content box (visible / total) |
|---|---|---|
| Before | 0px (reproduces the live bug exactly) | — |
| After | 110px | 150px / 358px, so the legend scrolls |

## Part 2: accordion and panel height

- **Accordion:** `togglePanel` is now `open.includes(id) ? open.filter(…) : [id]`, as specified. The comments above `PANEL_ORDER` and ColumnPanels' rule 2 now describe the accordion. Persistence is unchanged. A set saved under the old model with two or three panels open still loads, and the next click in that column settles it to one.
- **`PANEL_HEIGHT`: 232 → 384px.** The full arithmetic is in the constant's comment. Summed from the real spacing classes, everything that isn't the open panel comes to about 407px:

  | Item | px |
  |---|---|
  | Page top padding | 24 |
  | Nav | 34 |
  | Control bar | 82 |
  | Grid margin | 24 |
  | Column top (border, accent bar, padding) | 20 |
  | Two-line sentence heading | 42 |
  | Pills | 36 |
  | Two collapsed bars (58 each) | 116 |
  | The open panel's margin | 12 |
  | Column bottom | 17 |

  A 13" laptop (1440×900) gives a browser viewport of about 790px, which leaves 383px; rounded to 384. That's 65% taller than 232. Column 1's occasional "this moved" note (~28px) can tip a 790px screen into a short scroll.
- **Judgement call (§D1): a single fixed height, not a floor that grows.** Each column's open panel still lines up with the others, whichever panel each has open. Content taller than 384px (a long subject list, a ten-school legend) scrolls inside the panel's own box, rather than making one column longer than the rest.

## Part 3: comparator chooser (first draft)

**What was built, end to end:**

- **Server:** a new route, `/api/teacher/saved-comparator-sets`. It passes the caller's own token through, following `comparator-set-peers`, so RLS decides visibility. It returns:
  - the caller's membership and `canEditShared` (`is_admin`, or being the account's `account_holder_membership_id`);
  - every comparator set with its members, ranked rows and year series;
  - the 30 nearest same-phase schools as candidates, with local authority and sector.
- **Shared ranking logic:** the pool, rows and series code moved unchanged out of the dashboard route into `src/lib/teacher-view-comparator-series.ts`. A new `rankFixedSets` ranks a saved set exactly like a preset, including the GCSE IGCSE exclusion. (With no pool to refill from, a flagged member is simply left out.)
- **Writes:** `src/lib/teacher-view-saved-sets.ts` saves from the client under RLS, the same way `/sets/comparator/new` does: `saved_sets` plus `saved_set_members` with status `confirmed`. Deleting a set is supported.
- **Chooser UI:** `ComparatorSetChooser.tsx`, a `TeacherModal` following `CategorySubjectPicker`'s conventions via the v2 wireframe:
  - sector tabs (state / independent) with ticked counts;
  - a "Selected so far" panel of removable chips;
  - collapsible local-authority cards ("N of M ticked", chevron), with checkbox rows tinted in the sector colour;
  - "+ 5 nearest", "Add a school…" (the existing `SchoolSearch`) and "Filter this list…";
  - a Personal / School (admin) choice, a name field, Save and Delete, and a "k / 8 personal sets used" note.

  A new set starts from whichever set is selected now, and records that in `config.startedFrom`.
- **Pill menu:** "Compared against" now has the wireframe's groups: Starting points (the four presets), Your sets (k / 8, each with Edit), School's sets (Edit if you may), then "Choose schools…". A saved set becomes the selected set, and a deleted selected set falls back to the first preset.
- **Personal cap 3 → 8** (the wireframe's number, inside the agreed 5–10):
  - `PERSONAL_COMPARATOR_CAP = 8` in the app;
  - **migration `20260925232857_personal_comparator_cap_8`, applied to the live `vicdata-public` database** (the same way every other migration here has been). It changes only the trigger function's limit; confirmed live that the function now checks `>= 8`;
  - `/sets/comparator/new`'s hard-coded "3" now reads the constant.

**Where the build met the existing code (§D2):**

- **(a) One key space for all sets.** Saved sets are merged into the page's comparator-set map as `saved:<id>`, and their series into `seriesByUrn`. So `changeSet`, the saved-selection check and the per-subject map fetch all work unchanged; no parallel path was needed. The preset list is now typed as a string id plus a group rather than `RankingsSetId`.
- **(b) The cap is shared across products.** `saved_sets` is one pool across Teacher view, the Data View and `/sets`, so the raise applies everywhere, and a set made here appears in the Data View too. I think that's intended ("reuse the real schema"), but it's worth knowing.
- **(c) Sentence wording for saved sets.** A saved set's name is the user's own, so sentences quote it ("compares with the schools in "Grammar rivals"") and the Current tag reads "Candidates against Grammar rivals", not "at the …".
- **(d) Target school.** Your own school is never a member row; it's always row one, as with the presets.
- **(e) Sector colours.** There's no shared sector palette in the app, so the wireframe's blue and pink are named constants in the chooser.
- **Not in this first draft:** the wireframe's Map pane, the "Add area" bulk action, and group-by alternatives. The List pane is the whole editor for now.

## Part 4: full screen (first draft)

Only `CardBox`'s fullscreen branch changed; the compact card is untouched.

- **Source line:** plain visible text under the caption, on screen and in print (it used to be print-only, with an "i" icon on screen).
- **Rail (§D3):** a 15rem rail to the right on large screens. Against the roughly 1150px-wide modal on a laptop, that's about the "7-column main, narrow rail" steer. It stacks under the main area on narrower screens. It shows:
  - **Flag:** the growth/decline word, on Trends panels only (in all three columns). Current and % Change have no flag, so the rail shows the note alone there.
  - **Your note · private:** the saved note's text shown outright (or "No note on this panel yet."), with an "Add note" / "Edit note" button opening the same `PanelNote` editor, downward. **It's hidden in print,** because a printed panel can be handed on.
- **Footer:** now carries only the Trend-line toggle (Trends) and Export. The note icon is dropped from the footer in fullscreen only, because the rail carries it.
- **KS2 boxes** have no flag or note, so they get no rail.

## Verification

**Done:**
- `tsc --noEmit` and `next build` are clean.
- `eslint` is clean on every file this round touched. The only errors in the tree are the two pre-existing ones in `src/app/account/page.tsx`, untouched.
- Part 1 was measured in headless Chrome as above.
- The Part 3 migration is confirmed applied live.

**Not done (localhost is still password- and sign-in-gated):**
- the accordion and the 384px panel on a real screen;
- the chooser end to end: create a personal set, see it drive Comparisons, edit it, and use or edit a shared set as admin and as an ordinary member;
- the fullscreen rail.

These are for tomorrow's walkthrough.

## Open decisions

- **§D1 (Part 2):** 384px, fixed, with no grow-with-content. Say if a tall screen should get more.
- **§D2 (Part 3):** the integration points (a)–(e) above. The biggest is (b), the cap raise applying across products.
- **§D3 (Part 4):** the rail's 15rem width, and what's in it (flag on Trends only, the note everywhere, the note hidden in print).
