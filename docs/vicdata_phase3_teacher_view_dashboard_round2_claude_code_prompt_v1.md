# VicData Teacher View — GCSE Dashboard Round 2: Claude Code Build Prompt

Repo: `vicdata_public`, current HEAD is the content-round build (`6c0feef`). This round is copy and layout refinement on the Teacher View dashboard (`/teacher/[phase]`), found by Guy's live review. Ground truth for every part below has already been checked against the real code — file paths and line numbers are current as of `6c0feef`, but re-read each file before editing since round content shifts line numbers.

The route is one shared implementation for `ks4` (GCSE) and `ks5` (Post-16) via the `phase` prop — nothing below should special-case one phase unless a part explicitly says so. Only Part 3 has phase-specific copy (decided: "students" for both the general noun and the whole-school-context sentence at Post-16 — i.e. just use "students" everywhere that sentence appears, both phases).

One commit per part, in this order. A short build report at the end, same format as last round (what you built, anything you changed beyond what's written here, any open decisions for Guy).

## Part 1 — Second-row nav chips: drop the qualification suffix and the family icon

`page.tsx`'s `focusSubjects` builder (search `FocusSubject[] = phase === "ks2"`): change the chip label from `` `${i.subject} · ${qualificationShortLabel(phase, i.qualificationType)}` `` to just `i.subject`. The qualification is already named once, up in the ControlBar badge ("GCSE — The Chase" / "Post-16 — The Chase") — repeating it on every chip is noise.

For the icon: `familyIcon(phase, qualificationFamilyOf(...))` only has 3 possible icons at KS4 and 5 at KS5 (`QualificationFamilyTiles.tsx`'s `FAMILY_ICONS`) — it was built for the onboarding "which qualifications do you teach?" tiles, where 3 tiles is correct, not for a per-subject nav row. Every standard GCSE subject collapses to the same `"gcse"` icon, so right now every chip shows an identical mortarboard regardless of subject. There is no per-subject icon set in the codebase to swap in instead. Drop the icon from these chips entirely rather than keep showing a meaningless repeated glyph — the subject name alone, without the redundant qualification suffix, is enough to read. If you think a per-subject icon set is worth building instead, say so in the report rather than improvising one.

## Part 2 — Subheading wording pass

`page.tsx`'s `subjectHeadings` builder (search `S11: each column's heading as one sentence`). Update the `question` strings:
- `results`: from `` how well ${learners} do in ${subj} ${qual}. `` to a cleaner "how well {learners} do in this subject." pattern — drop the repeated qualification suffix (already visible in the panel title and the top badge).
- `candidates`: same treatment, "how many {learners} take this {qual}." — here the qualification word IS the useful bit (GCSE vs A Level vs BTEC), so keep it, just drop anything redundant.
- `rankings`: `` how ${subj} compares with the ${setLabel}. `` — check `setLabel` doesn't already end in "schools"/"sixth forms" before appending your own noun (it does for "Nearest 10 schools" and "Similar-sized sixth forms" already).

Keep `learners` (pupils/students) exactly as it already resolves per phase — don't touch that mechanism.

## Part 3 — Split the Context column heading by measure, name the school, fix the donut sentence

Three related changes, same area of `page.tsx`:

1. `subjectHeadings.context` is currently one `{title, question}` shared by both Candidates and Results. Split it into `context.results` and `context.candidates` (same shape as `candidates`/`results` already are), each with its own question text: Results — "this subject's results compared with {the subjects you selected / the whole school} at {school}."; Candidates — "entry numbers compared with {the subjects you selected / the whole school} at {school}." Wire the two `DashboardColumn` call sites for the context column (one per measure, or wherever the toggle branches) to the right variant. School name is the existing `schoolName` state (already used for the ControlBar badge and Comparisons' `targetName` — same variable, just reference it here too).

2. `SubjectPanels.tsx`'s donut summary sentence (search `is {Math.round(donutPercent)}% of`) currently reads `{Subject} is {N}% of {contextGroupLabel} ({total}) in {year}.` `contextGroupLabel` ("Whole school"/"Selected subjects") is reused in five other places (benchmark label, trend/change question text, the Current tag) that must keep their current wording — don't touch `contextGroupLabel` itself. Instead, pass this ONE sentence a new, separate string built in `page.tsx` and threaded down (e.g. a new prop, don't overload `groupLabel`): "{Subject} is {N}% of all students at {school} ({total}) in {year}." — "students" applies to both phases here, decided.

## Part 4 — Context panel: swap the year stepper for the FromYearMenu dropdown

`SubjectPanels.tsx`'s Context-column instance has a `beforeTag` prev/next year stepper (search `Previous year`) using `PrevYearIcon`/`NextYearIcon` from `PanelIcons.tsx` — a plain left/right chevron pair, gated on `yearControl && realIdx.length > 1`. Disabled (the common state, since `atRealIdx <= 0` most of the time), the left chevron reads as a stray "back" button — that's what Guy's flagging, not a real leftover to delete, just a confusing control. Replace it with the same `FromYearMenu` dropdown component built for the Trend panel in round 8 (S11) — same "from {year} ▾" pattern, same component, no new UI. This also resolves "we don't have the year picker": this panel will now have the real one instead of the stepper.

## Part 5 — Context bar/table views: show every subject, not just the focused one

`page.tsx`'s `contextSeries` (search `const contextSeries: SubjectSeries[]`) is currently filtered to `tickedItems.filter(i => i.key === focusKey)` — one subject. `SubjectPanels.tsx`'s Context instance already has working bar-chart (`HorizontalBarsIcon`) and sortable-table (`RankListIcon`) views built for a full subject list, complete with the peer/England-average marker — they just have one row to show today. Widen `contextSeries` to the school's full real subject list for this phase (the same population Column 1's category comparison already iterates — reuse that, don't rebuild it), keeping `focus={focusKey}` so the focused subject is identifiable in the wider list.

Two follow-on behaviours the wider list needs:
- The bar view should auto-scroll so the focused subject's bar is visible on open (and when focus changes), rather than requiring the user to hunt for it in a long list — small addition, doesn't need to be a full virtualized-scroll system, just scroll the row into view.
- The table view (already `SortTable`) should visually match Column 3's (`ComparisonsPanels.tsx`) ranking-table style rather than its current generic look, so "ranking view" reads consistently across the dashboard.

Donut view is untouched by this — it stays focused-subject-only, since a donut only makes sense for one slice against the group total.

## Part 6 — Panel height

`CardBox.tsx`'s `PANEL_HEIGHT` (currently `224`, reduced from `256` last round for viewport reasons — see the comment above it). Bump it slightly — try `232`–`240` — and sanity-check against a real ~800px laptop viewport with 2 panels open + 1 collapsed, same target the last reduction was tuned to. Note the value you land on and why in the report.

## Part 7 — Fix graph/rankings-table overlap with the panel footer

`CardBox.tsx`'s `fixedHeight` mode positions its footer `absolute inset-x-3 bottom-2.5` (search `fixedHeight ? "absolute`) over content given `pb-9` of reserved padding. Check whether that reserved space still covers the footer's real height now that it can carry source + export + a flag (post round-8) — this is most likely to show up in the rankings table and any fullscreen graph view where content runs long. Fix by increasing the reserved padding to match the footer's actual height, or another approach if you find a better one — just confirm the graph/table content never renders under the footer at any panel size.

## Part 8 — Move explanatory captions into a click-to-reveal info control

There's no existing "click to reveal" pattern in `CardBox.tsx`/`ColumnPanels.tsx` to reuse — this is new. Currently the explanatory `PanelSummary` prose (e.g. "Additional Maths (FSMQ) has grown the most...") renders inline and always-visible in the panel's caption area. Add a small info icon/button, closed by default, that reveals this text on click — sitting in the same footer row as the existing source/export/flag controls (`footerLead`/`flag`/`footerActions` props, round-8 work) rather than inventing a new layout slot. Keep it keyboard-accessible (a real button, not a hover-only tooltip, since hover doesn't work on the phone nav this dashboard also serves).

## Deliverable

One build report in `docs/`, one commit per part (8 commits), pushed to `vicdata_public` main. Run `tsc --noEmit` and lint before the final commit. Flag in the report: your Part 1 icon decision if you went a different way, your Part 6 panel-height number, and anything in Part 3/5/7 that needed a judgement call beyond what's written here.
