# Teacher view: chart fixes + subject picker, combined round: build report (v1)

Prompt: `vicdata_phase3_teacher_view_dashboard_chart_and_picker_combined_claude_code_prompt_v1.md` (read in full; the round3 and subject-picker drafts were not built separately). Built from `091d448`:

| Commit | Scope |
|---|---|
| `da03216` | §2 Trend y axis sized to its figures |
| `8d7ce3f` | §1 10px bar gap; §3 horizontal-bar fallback |
| `7b26a8b` | §4 compact modal, Context picker, per-category and global toggles |

Checks: `tsc --noEmit` is clean and `npm run build` succeeds. `eslint src` shows the same 7 problems as before, none in these files. **Not pushed.**

## The preview

The page is gated, so I built an unauthenticated preview in the scratchpad (not in the repo).
- **What it renders:** the real components, bundled with the built CSS, fed a fixture pulled through the app's own fetchers.
  - The Chase (137625): its real 2024/25 Sciences & Maths entries (Maths 22, Math Stud 37, Bio 16, Chem 15, Phys 13, Fur Maths 6), labelled by the real `shortSubjectLabels`; its Maths A-level trend; and its 34 real picker items.
  - For §3, the largest category at college 130448: Business & Law, 13 subjects.
- **How it was shot:** headless Chrome over the DevTools protocol, with true device emulation, so the modals' viewport sizing and Tailwind breakpoints behave as on a device. Laptop is 1366×768; phone is 375×812.
- **Context's modal** was opened the real way (pill, then "Selected subjects"), and "Tick all" was clicked for real.
- The screenshots are in the session scratchpad. I can commit them under `docs/` if you want them kept.

## §1 Bar gap: 16px → 10px

- **Laptop 3-column card:** The Chase's six bars now fit upright with no fade, in uniform 30px columns with even gaps. It doesn't look cramped.
- **Where it still doesn't fit** (a phone), §3 takes over rather than scrolling.
- **Column padding:** the bar (20px) sits centred in its 30px column, 5px either side. With the 10px gap the spacing read right in the screenshot, so I left the column width alone.

## §2 Trend y axis

- **`TrendChart.tsx`:** the axis width now comes from its widest figure (about 5.6px a character plus the 8px tick mark), in both the line chart and its short-series bar form. The x-axis spacer, the "Academic year" caption and the legend follow the same measured width, instead of their fixed 32px/40px offsets.
- **Nothing else relied on the old width.** No other component uses those offsets, and `MultiTrend` renders through `TrendChart`.
- **Screenshots:** on The Chase's column, the Trend axis figures now line up with the bars axis above.
- **Coverage gap:** I previewed The Chase's entries (2 digits) and points ("50.0") trends, both over 4 years. **I didn't separately screenshot a KS4 subject or a longer period range.** The code path is the same, and the width follows the labels, but that check is still owed.

## §3 Horizontal-bar fallback

**Trigger: measured fit, not a count.** The chart already knows its box width, value-axis width and uniform column width.
- It turns horizontal when *n* columns + gaps won't fit beside the axis.
- The labels' font is now measured from the chart box itself, not from a rendered label, so the column width is known in either orientation before the first paint.
- A wider card holds more bars upright from the same rule. In the screenshots, 130448's 13 subjects are horizontal on the card and **upright in fullscreen**.

**Shape:**
- one row per subject, in the chart's existing order (focused subject first, then by entries);
- the label on the left, right-aligned, up to two lines, in a column up to 128px or 40% of the width;
- bars proportional to the largest, with each figure at its bar's end;
- no value axis.

It takes its natural height, and the card scrolls vertically, as Ranked list does. The Ranked list / bars toggle is untouched. Both orientations are the same measured element, so resizing turns it back.

**Seen in the screenshots:**
- Laptop: 13 Business & Law subjects read clearly.
- Phone: The Chase's six bars turn horizontal (212px available, 238px needed). They read well, but the fixed-height card is left mostly empty below the rows.

**Per-school worst case: not queried.** It needs sign-off, as the prompt says. It would be a count of each school's subjects per family and year from `academic_subject_headline`.

## §4 Subject picker

- **4a:** `TeacherModal` gains `size="compact"`: a centred panel at most 28rem wide and 12px clear of a phone's edges, as tall as its content, then scrolling itself. The fullscreen size stays the default and is unchanged.
  - The "±" QuickEdit picker uses the compact size.
  - **Onboarding step 2 isn't a modal** (it renders inline in the onboarding page), so it had no size to change. It gains 4d's per-category toggles.
- **4b:** Context's pill menu keeps "All subjects" / "Selected subjects".
  - Choosing "Selected subjects" closes the menu and opens the compact modal.
  - Once selected, an "Edit selection (n of m)…" row reopens it.
  - The flat in-dropdown list is gone.
- **4c:** no qualification step. The modal offers only subjects in the focused subject's qualification family (e.g. 22 A-level subjects at The Chase).
  - **Decision:** the group itself follows the same rule. A key ticked earlier under another family is left out of Context's group rather than counted while invisible in the picker.
  - With nothing ticked, the "fall back to the subjects you teach" default is limited to that family too.
- **4d:** per-category "Tick all" / "Untick all" on each category header, next to its count.
  - The header is now a row of two buttons (expand, and toggle), since one button can't contain another.
  - This lives in `CategorySubjectPicker` itself, turned on by passing `onSetTicked`, so it's one write per bulk change.
  - Verified by a real click: Sciences & Maths went to "5 of 5", the global count to "5 of 22", and the chips updated.
- **4e:** a global Select all / Deselect all with an "n of m ticked" count, turned on with `showAllToggle`. Context uses it.
- **4f:** no Apply button. Every change writes immediately, as before.
- **Picker options:** `tabs={false}` (one implicit family, no tab row or per-family headings), `defaultExpanded` (Context opens the focused subject's category), `onSetTicked`, `showAllToggle`.
- **Phone:** the "ticked" in "0 of 2 ticked" drops below 640px, because it pushed category names onto three lines.
- **Found in the screenshots and fixed:** the A-level tile still described itself as "A level, Advanced Extension Award", and Other didn't mention AEA, although AEA moved to Other two rounds ago. The descriptions now read "A level" and "AS level, AEA, EPQ, Core Maths, Pre-U and similar".

**`ComparatorSetChooser.tsx`: not relevant.** It picks comparison *schools*, not subjects, and mentions `CategorySubjectPicker` only in a comment. It still uses the fullscreen modal, untouched.

## Found along the way (not fixed)

**Duplicate labels for different BTEC sizes.** 130448's Business & Law has five different BTEC Business Studies qualifications (different sizes), and all five shorten to the same "Business Studies (BTEC) (BTec, OCR, …". The cause is `shortSubjectLabels`' collision fallback, which names the qualification *bucket*, and five items share it. This existed before this round: Part C made each exact qualification its own row. It's visible in any Candidates chart at a school like this, vertical or horizontal, and fixing it needs a size-aware short label (e.g. "Ext Dip", "Found Dip").

## Open decisions for Guy

1. **Phone, horizontal on a short list:** should the rows stretch to fill the card's height, or stay compact with empty space below (as now)?
2. **BTEC sizes sharing one label** (above): fix in a later round?
3. **Context membership (4c):** narrowing the group to the focused subject's qualification family is a real behaviour change. Confirm that's the intent, not just narrowing what the picker offers.
4. **Push:** say when, and I'll push and confirm what's live, as before.

## Live checks for Guy (after a push, hard-reload)

1. The Chase, laptop, Candidates panel 1: six even bars, no fade, and Trend panel 2's axis figures in line with the bars' axis.
2. On a phone, the same panel: horizontal rows with figures at the bar ends.
3. "±": a compact centred panel, not a near-fullscreen one, with "Tick all" on category headers.
4. Context → Compare against → Selected subjects: the compact modal, same-qualification subjects only, Select all / Deselect all, "Tick all" per category, and the donut and group changing as you tick.
