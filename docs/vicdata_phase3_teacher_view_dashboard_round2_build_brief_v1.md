# VicData Teacher View — GCSE Dashboard Round 2: Build Brief

Ground-truthed against the live `vicdata_public` repo (HEAD `6c0feef`, the content-round build) before writing this, so every section below points at the real file and mechanism, not a guess. This round is phase-generic: `/teacher/[phase]` is one route for GCSE and Post-16, and every component below already takes `phase` as a prop, so a GCSE build lands on Post-16 automatically — except §12, which needs its own KS5 sentence (decided: "students" throughout). See the "Post-16 scope" table in the notes doc for the full per-item audit.

## §1 — Second-row nav: wrong icons, redundant "GCSE" label

`focusSubjects` in `page.tsx` (~L1095) builds each chip as `${i.subject} · ${qualificationShortLabel(phase, i.qualificationType)}` with an icon from `familyIcon(phase, qualificationFamilyOf(phase, i.qualificationType))` (`QualificationFamilyTiles.tsx`).

Two separate problems:
- **The label**: dropping the `· GCSE` suffix is straightforward — the top ControlBar badge already says "GCSE — The Chase", so repeating it on every chip is redundant. Change `label` to just `i.subject`.
- **The icon**: this is a real design mismatch, not a mapping bug. `familyIcon` only has three icons at KS4 (`gcse` / `btec_ocr` / `other_vocational`) and five at KS5 — it was built for the onboarding qualification-family tiles (`QualificationFamilyTiles.tsx`, "which qualifications do you teach?"), where three tiles is correct. Reused here, every standard-route GCSE subject — Maths, Biology, History, everything — resolves to the same `"gcse"` family and shows the identical mortarboard icon. There is no per-subject icon set anywhere in the codebase to fall back on (checked `CategorySubjectPicker.tsx` and the category-taxonomy code from last round — neither carries one).
  **Decision needed**: drop the icon from these chips entirely (the subject name alone is legible, especially with the "· GCSE" suffix gone), or commission real per-subject icons (bigger job, and out of scope for this round unless Guy wants to fast-track it). Recommend dropping it for now and flagging a separate icon-set round if wanted.

## §2 — Results Column 1 subheading

`subjectHeadings.results.question` in `page.tsx` (~L1113): currently `` how well ${learners} do in ${subj} ${qual}. ``, e.g. "how well pupils do in Biology GCSE." Already phase-aware (`learners` = pupils/students). Refine per Guy's wording — likely drop the repeated `${qual}` since the panel title already carries the subject, but keep final copy to taste.

## §3 — Candidates Column 1 subheading

Same `subjectHeadings` object, `candidates.question`: currently `` how many ${learners} take ${subj} ${qual}. `` Same treatment as §2.

## §4 — Results Column 2 (in context) subheading

`subjectHeadings.context.question` (~L1117) is currently ONE string shared by both Candidates and Results modes: `` how ${subj} compares with ${contextAgainst === "selected" ? "the subjects you selected" : "the whole school"}. `` Guy wants it to say something different depending on measure ("results compared with..." vs "entry numbers compared with...") and to name the school. This means splitting `context` into `context.results` / `context.candidates` (mirroring how `candidates`/`results` are already split), and plumbing in the existing `schoolName` state (already used at L1170 for ControlBar and L1454 for Comparisons' `targetName` — same variable, no new plumbing needed).

## §5 — Candidates Column 2 (in context) subheading

Same change as §4, the `candidates` variant of the new split `context` headings.

## §6 — Candidates Column 3 subheading

`subjectHeadings.rankings.question` (~L1118): `` how ${subj} compares with the ${setLabel}. `` `setLabel` already comes from `comparatorSetOptions`, which is already phase-aware for the "similar size" option ("Similar-sized sixth forms" at KS5 vs "Similar-sized schools" at KS4) — so the wording just needs care not to double up "schools" when `setLabel` already ends in "schools"/"sixth forms" (e.g. "Nearest 10 schools" already contains the noun).

## §7 — Move explanatory text into an info panel

There's no existing "click to reveal" affordance anywhere in `CardBox.tsx` or `ColumnPanels.tsx` to reuse — this is genuinely new UI. Currently explanatory prose (the `PanelSummary` lines under charts, e.g. "Additional Maths (FSMQ) has grown the most...") renders inline, always visible, inside the panel's `captionLine` area (`CardBox.tsx` ~L250). Needs a small new affordance: an info icon/button that reveals this text in a popover or expandable row, closed by default. Should sit in the same footer row as the existing source/export/flag controls (`CardBox.tsx`'s `footerLead`/`flag`/`footerActions` props from last round, ~L107) rather than a new UI pattern.

## §8 — Graph/rankings table overlapping the bottom menu

`CardBox.tsx`'s `fixedHeight` mode (used by every panel) positions its footer `absolute inset-x-3 bottom-2.5` over content that reserves `pb-9` (36px) of padding (~L228, L251). Worth checking whether that reserved padding still matches the footer's real height now that it carries more (source + export + flag, post round-8), especially in the rankings table / fullscreen graph views where content can be taller than the fixed card. Needs a look with real content to confirm where it's actually clipping.

## §9 — Increase panel height slightly

`CardBox.tsx` `PANEL_HEIGHT = 224` (~L53). This was deliberately reduced from 256 last round (comment there: ~800px total for a ~800px laptop viewport with 2 panels open + 1 collapsed). A "slight" increase — 232–240 — should still fit that target; exact number is a judgement call to make live against the real viewport.

## §10 — Whole-school context bar chart: show all subjects, not just the focused one

This is the big one, and it turns out to be smaller than it looks: the machinery already exists. `SubjectPanels.tsx`'s Context-column instance already has a bar-chart view (`HorizontalBarsIcon`) and a sortable-table view (`RankListIcon`) as toggle options alongside the donut (~L225–235) — built for a general multi-subject list, complete with a peer-average marker (`benchmarkLabel`). The reason it currently shows one bar is upstream: `contextSeries` in `page.tsx` (L980) is filtered to `tickedItems.filter(i => i.key === focusKey)` — literally just the focused subject. Widening that filter to the school's full real subject list (same population Column 1's category comparison already draws on) makes the existing bar view show everyone at once, average included. "Focus stays on the selected subject, user can scroll" needs the container to scroll the focused row into view on mount/focus-change (`ViewChart` doesn't do this today — new, but small).

## §11 — Ranking view of §10, styled like Column 3

Also already exists as a toggle in the same panel (`RankListIcon` → `SortTable`, ~L282) — once §10 widens `contextSeries`, this view gets every subject for free. Just needs a pass to match Column 3's (`ComparisonsPanels.tsx`) visual ranking-table style rather than whatever `SortTable`'s generic look is today.

## §12 — Whole-school-context sentence wording

`SubjectPanels.tsx` (~L294): `` {focusedSubject?.label} is {Math.round(donutPercent)}% of {donut.groupLabel.toLowerCase()} ({measure.format(donutGroupValue!)}) in {...}. `` `donut.groupLabel` is `contextGroupLabel` (`page.tsx` L952: `"Selected subjects"` / `"Whole school"`), which FIVE other places also read (benchmark label, trend/change questions, the Current tag) and must keep saying "whole school" — so this one sentence needs its own dedicated string, not a `contextGroupLabel` edit. Decided wording: "{Subject} is {N}% of all students at {school} ({total}) in {year}." for both phases (school name via the existing `schoolName` state, same as §4/§5).

## §13 — Whole-school-in-context panel heading: stray "back" icon, missing year picker

Found it: `SubjectPanels.tsx` already has a year stepper here (`beforeTag`, ~L219, gated on `yearControl && realIdx.length > 1`) — a previous/next pair (`PanelIcons.tsx` `PrevYearIcon`/`NextYearIcon`). `PrevYearIcon` is a plain left-pointing chevron, which reads exactly like a stray "back" button, especially disabled/greyed when `atRealIdx <= 0` (the common case). This predates the `FromYearMenu` dropdown built for Trend in round 8 (S11) — recommend replacing this stepper with the same `FromYearMenu` component for consistency, which resolves both halves of the complaint (the confusing chevron goes away, and the panel gets the same proper year-picker the Trend panel already has).
