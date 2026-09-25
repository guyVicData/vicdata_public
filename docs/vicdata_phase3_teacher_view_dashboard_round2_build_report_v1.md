# Teacher view dashboard round 2: build report (v1)

Brief: `vicdata_phase3_teacher_view_dashboard_round2_build_brief_v1.md`. Prompt: `..._claude_code_prompt_v1.md`. Built on HEAD `6c0feef`, one commit per prompt part:

| Part | Brief sections | Commit |
|---|---|---|
| 1 | §1 | `826c83c` |
| 2 | §2, §3, §6 | `53728dc` |
| 3 | §4, §5, §12 | `3398909` |
| 4 | §13 | `6748704` |
| 5 | §10, §11 | `bd40870` |
| 6 | §9 | `6efcc47` |
| 7 | §8 | `ce82608` |
| 8 | §7 | `7578853` |

Every file and search string the prompt named matched HEAD. Line numbers had moved a little, as expected.

**Housekeeping:** another stale, empty `.git/index.lock` (14:30, no git process running) blocked the Part 1 commit, so I removed it. It's the second time today. Something local, probably an editor's git integration, is leaving them behind.

## Part 1: focus chips

- **Label:** the chip reads just the subject name. **Beyond the prompt:** a subject ticked under two qualifications (e.g. GCSE and BTEC Art) keeps "· GCSE" / "· BTEC …" on those two chips only. Otherwise they would be two identical chips.
- **Icon: dropped, as recommended.** `FocusSubject.icon` and `SubjectIconSquare` are removed from ControlBar and from both phone chip surfaces. `familyIcon` is still used by the onboarding tiles.
- **Per-subject icons:** I don't think a per-subject icon set is worth building for this row; the name reads fine alone. If you want one for other reasons (the home page, the picker), that's its own design round.

## Part 2: subheadings

- **Results:** "how well {pupils|students} do in this subject."
- **Candidates:** "how many {pupils|students} take this {GCSE|A level|…}."
- **Comparisons:** "how this subject compares with the {set label}."
  - No set label currently doubles its noun ("the nearest 10 schools", "the similar-sized sixth forms", "the local rivals").
  - A guard appends "schools" only if a future label arrives without a noun.
- `learners` is untouched.

## Part 3: Context heading and donut sentence

- **Headings:** `subjectHeadings.context` is split into `results` / `candidates`, and the Context column picks the variant from the shared measure toggle.
  - Results: "this subject's results compared with {the whole school | the subjects you selected} at {school}."
  - Candidates: "entry numbers compared with {…} at {school}."
  - `schoolName` is the existing state; the fallback is "your school" while it loads.
- **Donut sentence:** a new, separate `donut.shareOf` string, built in the page. `contextGroupLabel` and its five other readers are untouched.
- **⚠ Judgement call, flagged (§D1):** the donut's share is of the school's total subject **entries**, not of its students. A pupil sits several subjects: Maths might be 10% of entries while nearly every pupil takes it. So "{Subject} is N% of all students at {school}" would state something false. As built:
  - Whole school: "{Subject} is N% of **all student entries** at {school} ({total}) in {year}." This keeps your "students" decision and is accurate.
  - Selected subjects: "{Subject} is N% of entries in the subjects you selected at {school} ({total}) in {year}."

## Part 4: Context year control

- The prev/next chevron pair is gone. `FromYearMenu` gained a `mode="year"` for this panel: it lists **every** real year, latest included and newest first, and reads "2024/25 ▾" rather than "From 2024/25 ▾".
- **Why a mode rather than the plain component:** Context's Current picks one year to show, not the start of a range. The plain "from" menu leaves out the latest year, because a range needs two points.
- **Tag change:** the year moves out of the tag text ("Whole School Context") into the menu beside it.
- **Removed:** `PrevYearIcon`, `NextYearIcon` and the stepper code.

## Part 5: Context shows the whole school

- **`contextSeries`:** the focused subject plus every other item the school has with entries. That's the same `items` population Column 1's category is drawn from, without the category filter.
  - A subject with no figure on the active measure is left out, e.g. a BTEC on points at GCSE.
  - Peers are drawn muted; the focused subject keeps its colour.
  - `focus={focusKey}` is unchanged.
- **Bar view:** the focused row is emphasised, and the bars scroll inside the panel, starting with that row centred. `ViewChart`'s row layout now marks its emphasised row, and a new `CentredOnTarget` holds the centring logic that used to live inside ComparisonsPanels. Comparisons still uses it for its ranking.
- **Table view:** it now matches Column 3's ranking, with no colour dots and the focused row tinted in the phase accent and centred when the list scrolls.
  - The third column stays "vs Whole school" (the delta) rather than a rank, because that's the comparison this panel exists to make (§D3).
  - The same table styling also applies to Column 1's table (same component).
- **Donut:** still focused-subject-only, as specified.
- **Beyond the prompt, flagged (§D2):** Context's % Change panel stays focused subject + group only (a new `changeScope="focus"`). It drew one bar per subject, which would be twenty-odd bars now; Column 1 keeps its category bars.
  - Context's Current **summary sentence** ("X sits furthest above the whole school average; Y is the one below it") is now computed across the whole school's subjects, so it may no longer be about the teacher's own subject. It's now behind the Part 8 button; worth a look (§D2).

## Part 6: panel height

**232px**, the bottom of the 232–240 range. I couldn't measure a viewport (see Verification). Two open panels double any change: +8px is about +16px on the roughly 800px estimate from last round, while 240 would be +32px. Part 8 also takes captions out of the panel body, so the chart area grows by more than 8px anyway. If it still feels cramped live, 240 is the next step.

## Part 7: footer overlap

**Cause:** the reserved padding wasn't short. The footer is 17px tall, pinned 10px up, inside a 36px reserve. The real problem was that the content column had **no overflow rule**: content taller than its space (a long ranking, a trend chart plus its legend) spilled into the reserve and drew under the footer, because the panel only clips at its outer edge.

**Fix:** the content column scrolls within its own box (`min-h-0 overflow-y-auto`), which ends above the reserve. Lists that centre their own row still scroll themselves.

**Judgement call:** in a small panel, an over-tall chart now scrolls rather than being squeezed or clipped. Fullscreen wasn't changed: its footer is in normal flow there, not pinned, so it can't overlap.

## Part 8: captions behind a button

- New `CaptionNote` in PanelFooter: a real button with a speech-bubble icon ("What this shows"), closed by default. It opens upward like the "i" and closes on Escape or an outside click.
- It sits in the footer right after the "i". Every panel's caption moved there, with or without a flag.
- Fullscreen still prints the caption, because there's room.
- This also fixes last round's §D3: the Trend sentence was only reachable as a hover tooltip, which the phone layout can't use.

## Files touched

- **Page:** `src/app/teacher/[phase]/page.tsx`
- **Components** (`src/components/teacher/`): `ControlBar`, `TeacherNav`, `SubjectPanels`, `ComparisonsPanels`, `CardBox`, `PanelFooter`, `PanelIcons`, `ViewChart`, `FromYearMenu`
- **New:** `CentredOnTarget.tsx`

## Verification

**Done:**
- `tsc --noEmit` is clean.
- `eslint` is clean on every file this round touched.
- `next build` succeeds.

**Pre-existing lint errors:** `eslint src` as a whole reports five errors, in `src/app/account/page.tsx` and `src/components/SchoolSearch.tsx`. Neither file was touched by this round (checked against `6c0feef`). I left them alone.

**Not done:** I couldn't view any of this live. Localhost is behind the Basic Auth gate and sign-in, and I don't enter credentials. Still to check:

- Chip labels, including a school with a subject under two qualifications.
- The heading and donut wording at GCSE and Post-16.
- The year menu on Context.
- Context bars and table on a school with many subjects: the focused row starts centred and moves when the focus changes.
- The 232px height at your usual window size.
- A long ranking or trend chart no longer drawing under the footer.
- The caption button on desktop and phone.

## Open decisions

- **§D1 (Part 3): "students" vs "student entries".** Built as "…% of all student entries at {school}", because the share is of entries, not students. Say if you want different wording; I'd avoid anything that reads as a share of students.
- **§D2 (Part 5): Context now shows the whole school.** Two follow-ons:
  - (a) % Change stays focused + group only (built).
  - (b) The Current summary sentence now ranges over the whole school; it may be better rewritten as "{focused} sits N above/below the whole-school average".
- **§D3 (Part 5): table style.** It matches Column 3's look (accent row, no dots, centred), but its third column is still the delta vs the group rather than a rank. Adding a rank column is easy if you want it to read as a ranking literally.
- **§D4 (Part 1): duplicate subject names.** Those chips keep a qualification suffix; everything else is bare.
- **§D5 (Part 6): panel height.** 232px, unmeasured; 240 is the next step.
