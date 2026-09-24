# Teacher view — Round 8: 3-column redesign — build report

Covers `vicdata_phase3_teacher_view_dashboard_round8_3column_redesign_brief_v1.md` and its companion prompt, built against `Redesign.dc.html` read directly from the Design artifact.

Five commits, each `tsc --noEmit` / `eslint` / production-build clean before the next, each pushed as it landed.

| | commit |
|---|---|
| §§1–2 grid → 3 columns, shared toggle | `7cc0cf5` |
| §§3–3a panel height, view rail, pinned footer, titles | `b26735c` |
| §§4–6 source popover, per-panel print, Export, notes | `44da87f` |
| §3 follow-up: Context's duplicate chip row | `8cc3dae` |

---

## Two of brief §1's grounding claims did not survive checking

The prompt said §1 was "grounding you should re-verify yourself, not take on faith". Both of these were raised with Guy before the affected sections were built.

**"No private-note mechanism exists anywhere in `vicdata_public`" — wrong.** `teacher_view_notes` has been live since the original Teacher-view persistence migration: confirmed against the production database (3 real rows, RLS enabled, table comment *"Personal private note against a specific chart (brief v2 section 12). Visible only to its author."*). `fetchNote`/`saveNote` were in `teacher-view-data.ts`, and a `NoteBox` was rendering under all four columns.

The check had been scoped to `src/components/teacher/`; the note UI lived in `page.tsx`. **Consequence: §6 was a relocation and re-keying, not new functionality — and needed no migration**, since `chart_key` is free text.

**"No 'custom dashboard' or 'Meetings' feature exist in the codebase" — half wrong.** No custom-dashboard concept, correct. But Meetings is fully built: `/teacher/meetings`, the `meetings` and `meeting_slides` tables (both with live rows), and `addSlide(supabase, meetingId, chartKey, position, caption)`. `meeting_slides.chart_key`'s own comment describes exactly what "Copy to a presentation" would write.

**Guy's call: keep it disabled this round anyway.** So it is disabled — but because he chose that, not because nothing exists to attach to. The caveat that informed the choice: the meetings deck renders slides keyed `"<phase>::<view id>"`, and round 6 replaced those view ids with the panel model, so slides made from a round-8 panel would not render in a deck without also teaching the slide renderer the new keys.

Both bullets are worth correcting in the brief so a later round does not re-inherit them.

The other §1 claims all checked out: the 4-column arbitrary grid, `CardBox`'s prop set, the citation rendering as a 9.5px sentence, and `TeacherChrome`'s page-level `window.print()` with `beforeprint`/`afterprint` theme forcing.

---

## §§1–2 — Three columns, one toggle

**Landed together, deliberately.** The grid change alone would have left one of Candidates/Results unreachable until the toggle existed — a commit with a whole column and no way into it. The prompt asked for a commit per section; this is the one place I merged two, and the reason is above.

Column 1 merges Candidates and Results and they **share one column key**, because the toggle changes what the panels are *about*, not which panels you kept — switching to Results and finding your Trend panel gone would read as a bug. The "New" badge follows the toggle so it sits on the measure the new data actually landed in.

**Two real removals**, not additions alongside: `ContextPills`' own Candidates/Results pill, and Comparisons' `COMPARISONS_MEASURES` pill. Both columns keep their own dimension, which the shared toggle does not answer — Context's "Compare against" (which group) and Comparisons' "Compared against" (which schools). On Results, Context also follows Column 1's sub-measure, so "Results" means the same figure in both columns rather than two columns both claiming to show results while showing different ones.

Everything measure-specific stayed **out** of the shared bar, per §3's row-alignment fix.

Chips are single-select, per Guy's resolution — one focus subject for the whole dashboard, read by Context and Comparisons, with `null` meaning what each already called it ("All subjects" / "Whole school"). Column 1's multi-subject bars are untouched.

## §§3–3a — Panel height, rail, footer, titles

**The height is computed, which §7 asked for explicitly.** At the 1280px cap: 1232px of content, less four 18px gaps and two 2px dividers, leaves 1156 across three tracks — a **385px column**. The wireframe's proportion is 260 at 394, so 260 × 385/394 = 254px, rounded to **256**.

One judgement inside that: scaled against the **column track**, which is the brief's own wording ("260px at its own 394px column width"). Scaling against the panel's inner width instead — 353px once `DashboardColumn`'s padding comes off — gives 233px. The wireframe's 394 is genuinely ambiguous between the two, since its panel and its column head are both 394 wide. See "judgement calls" below for what 256 actually leaves.

The view-choice icons moved to a vertical rail with a divider; fullscreen and Remove stayed exactly where round 7 put them. The footer is genuinely pinned — absolutely positioned, with the panel reserving its room in its own bottom padding — so a short chart and a long one put their controls in the same place. Charts fill the height the panel leaves them. Comparisons' Ranking list scrolls inside its own box.

§3a: the Current tag names its column ("Candidates 2024/25" / "Results 2024/25" / "Context 2024/25"), so a panel read fullscreen or printed still says which card it came from. Column 1's heading icon flips with the toggle — that fell out of the merge passing the live `columnId`, which was the bug Guy flagged.

## §§4–6 — Footer functions

**§4** The citation is an "i" that opens the same text. The popover opens **upward**, because the footer is pinned to the panel's bottom edge. The fullscreen view keeps a real printed citation line: a figure on its own page needs its source *on* the page, where a popover is no use.

**§5** "Print this graph" is real and reuses what exists — it opens the panel's own fullscreen modal, marks `#teacher-root`, prints, and unwinds on `afterprint`. `TeacherChrome`'s page-level print and light-theme forcing are untouched and still apply.

The isolation uses `visibility`, not `display`, deliberately: hiding every other element outright collapses the layout the modal is positioned against, and the panel then prints in the wrong place or not at all.

**§6** Notes are per panel on the existing table — `"ks4:candidates"` becomes `"ks4:candidates:trend"`. Fetched **once per school** rather than once per panel (nine panels would be nine round trips per load). Privacy is enforced where it already was, by RLS of `profile_id = auth.uid()`, not by anything in this code. The draft is seeded when the note opens rather than synced by an effect, so a note still loading on first paint cannot overwrite something half-typed.

---

## Simplifications and judgement calls made without Guy there to confirm

1. **The panel height, 256px — the §7 open item, and the thing most likely to need a look.** Worked through with the real classes, the space left for a chart is: **136px** with no control row, **98px** with a pill row, **68px** when pills and chips wrap to two rows. Context is on 98 now that its duplicate chips are gone; Column 1's Trend is the 68px case when several subjects are ticked. That is thin. If it reads badly live, the honest lever is the height itself — the arithmetic above is in `CardBox`'s own comment so the next person can redo it against whichever reading they prefer. **These are calculated, not measured** — the caption's real rendered height in particular is an estimate.

2. **Column 1 keeps an in-panel chip row; Context does not.** §3 says the shared chips must not touch Column 1's multi-subject selection, so Column 1's Trend still needs a way to pick which subject it plots. Context's focus now comes from the bar, so a second row there was two controls for one piece of state. Defensible, but it does mean the two columns' Trend panels have visibly different control rows.

3. **Column 1's two modes share one persistence key** (`candidates`). A panel set built in Candidates mode is the same set in Results mode. The alternative — a set per mode — would mean the toggle silently changing which panels exist, which seemed worse. It does mean the old separate `results` pins are orphaned; with no real users that costs nothing.

4. **`NoteBox` and `fetchNote` are deleted**, replaced by the per-panel note. Existing rows keyed `"<phase>:<column>"` are no longer read by anything — three rows in production, all Guy's own test notes. Not migrated, on the same "no real users yet" basis round 6 §6.10 established. Say the word and a one-line re-key is easy.

5. **KS2 panels are not fixed-height.** `fixedHeight` is opt-in, so the KS2 single boxes still size to content. KS2 remains out of scope, as in rounds 6 and 7.

6. **The site nav in the wireframe** (Sets / GCSE / Post-16 / Recruitment / Meetings / Home, theme and account as icons) was not built. It is not in the brief's build sections and is a change to the app shell rather than the dashboard. The theme toggle, Export and "All dashboards" are kept in the control bar's right-hand end instead.

7. **The wireframe's dark palette** is not copied literally — the build uses the existing `#teacher-root` theme tokens, which cover light and dark. Same reasoning as round 6's judgement on the wireframe's teal pills.

---

## Verification

**Checks:** `tsc --noEmit` clean. `eslint` at exactly its pre-existing baseline — 5 errors, 2 warnings, all in `SchoolSearch.tsx`, `account/page.tsx`, `PeerTrendChart.tsx`, `SchoolMap.tsx`, none touched this round. Production build passes. Every commit clean before the next began.

**Verified by direct inspection rather than by eye:**

- **Both old measure pills are genuinely gone, not hidden** — `COMPARISONS_MEASURES` has zero occurrences left; `ContextPills` no longer takes `candidatesMeasure`/`resultMeasures`/`onMeasure`; the only surviving `MeasurePicker` use is Column 1's sub-measure under its own heading.
- **The grid is three columns** — one `grid-cols-[1fr_2px_1fr_2px_1fr]`, three `<DashboardColumn>` render sites.
- **Notes are per panel and private by RLS** — `panelNoteKey(phase, columnId, panelId)` is the only key builder, and the table's policy is `profile_id = auth.uid()`.
- **The panel-height arithmetic** was computed from the real grid constants, not estimated.

**Security advisory surfaced while checking the schema** (not caused by this round): `public.spatial_ref_sys` has RLS disabled. It is the table PostGIS creates, which is the usual reason this fires, and it holds public coordinate-system reference data — but the advisory should be your call rather than mine. Enabling RLS without a policy would block all access, so it needs a read policy alongside if you do it.

### Live click-testing: still blocked

Unchanged from rounds 6 and 7, and now three rounds deep. Re-checked, not assumed: `localhost:3000` returns 401 (`ACCESS_GATE_ENABLED=true`, which `.env` says not to flip without your go-ahead), and `/api/testing/preview-session` returns 404 with `PREVIEW_ACCESS_*` unset.

**This round needs it more than the last two did.** Rounds 6 and 7 were mostly data and logic, which I can verify against expected values. Round 8 is a layout round: fixed panel heights, a pinned footer, a vertical rail, upward-opening popovers and a print stylesheet are all things whose correctness is *visual*, and none of them are covered by the checks above.

**Checklist, against The Chase (URN 100053) at GCSE and the same school's 16+ dashboard:**

1. **The toggle drives all three columns**, not just Column 1 — switch it and confirm Context and Comparisons both change measure.
2. **Row alignment** — the Current/Trend/%change panels start at the same y-position across all three columns in *both* toggle states, including Candidates mode, where Column 1's spacer is what holds the row height. This is the specific thing Guy caught in the wireframe.
3. **Panel height** — see judgement call 1. Column 1's Trend with several subjects ticked is the worst case; that is the one to look at first.
4. **Print one panel** — it should produce that panel, not the dashboard, with its citation printed on the page.
5. **A note saved by one user is invisible to a second** viewing the same school and panel.
6. **The Ranking list scrolls** rather than growing the panel, on a long comparator set.
7. **Both phases**, per round 7's parity discipline. Every change is in a shared component with no per-phase branch, so parity is structural — but that is an argument, not an observation.

Either the preview link or the three `PREVIEW_ACCESS_*` vars in `.env` unblocks all of it. I still have not minted a session with the service-role key — that remains your call.
