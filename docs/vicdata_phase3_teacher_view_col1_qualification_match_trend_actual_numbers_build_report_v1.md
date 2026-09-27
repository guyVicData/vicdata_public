# Teacher view: Column 1 qualification match, Trend actual numbers: build report (v1)

Prompt: `vicdata_phase3_teacher_view_col1_qualification_match_trend_actual_numbers_claude_code_prompt_v1.md` (read in full). Built from `2fcd523`, one commit per section:

| Commit | Section |
|---|---|
| `45fbc35` | §1 Column 1 same-qualification filter |
| `04d4f9b` | §2 130448 Business & Law at 375px (screenshots) |
| `1013c2a` | §3 Indexed caption + Actual view |

Checks: `tsc --noEmit` is clean and `npm run build` succeeds. `eslint src` shows the same 7 problems as before, none in these files. **Not pushed.** Screenshots are in `docs/screenshots/col1_qualmatch_trend_actual_v1/`, from the same unauthenticated preview (real components, real data, true-viewport headless Chrome).

## Logged, no code (the prompt's "Already decided")

1. **Phone horizontal-bar fallback:** left as-is. Rows keep their natural height.
2. **Duplicate BTEC-size labels:** logged for a later round. §1 makes it *more* visible: 130448's Business & Law card is now eight BTEC-family rows, five of them reading "Business Studies (BTec, OCR, VRQ)" (see §2's screenshot).
3. **Per-school "most subjects in one category" query:** not needed and not run.
4. **(From §1) Other-bucket focus:** a focused Other-bucket subject groups every Other-bucket subject at the school in that category into one comparison, though DfE says they aren't comparable with each other. Logged beside the BTEC label issue.

## §1: Column 1 same-qualification filter (`45fbc35`)

**Option taken: a shared helper.** `focusQualFamily` / `inFocusQualFamily` sit in `page.tsx` just before `categoryItems`:
- `familyOfItem(phase, focusItem)`, with KS2 matching everything.
- `categoryItems`' peer filter gains `inFocusQualFamily(i)`.
- Context's §4c pair is now `contextFamily = focusQualFamily; inContextFamily = inFocusQualFamily`, so Column 1 and Context read one rule and can't drift apart.

Because `categoryItems` feeds everything else in the column, this applies to the Candidates bars, Results' series and category average, the England category line, and Trend and % Change.

On The Chase, focused on A-level Maths, Candidates is now 5 bars: Maths, Bio, Chem, Phys, Fur Maths. "Math Stud" (Core Maths, in the Other bucket) is gone. Results already matched, and now does so by rule rather than for lack of a points figure.

This applies at KS4 as well (gated only on KS2, like Context's): a focused GCSE subject's category now leaves out BTEC/OCR and other-vocational peers.

**Other-bucket-only check.** Searched in real data across 28 schools, the latest year, excluding AS/AEA as Column 1 does:
- **No school had two or more Other-bucket subjects in one category.** The Other-bucket-only categories found were all a lone EPQ ("Study Skills") in Enterprise & Applied, at 7 schools including 100369, 101676 and 102257. The mixed case is The Chase's Core Maths ("Mathematical Studies") beside five A-levels.
- **Either way, a focused Other-bucket subject now stands alone in Column 1:**
  - Candidates draws one bar (e.g. Math Stud, 37). There's no category average line, which needs two subjects.
  - Results has no points figure for Other, so its one row shows the existing "No published figures for this comparison."
  - Trend and % Change carry the one subject.
- **Sensible, if sparse.** Before §1, a focused Core Maths was drawn against the five A-levels in Candidates. The "Other isn't comparable with itself" concern only bites where a school has two Other-bucket subjects in one category, which the sample didn't contain.

## §2: 130448 Business & Law on a phone (`04d4f9b`)

Two 375px screenshots, because §1 changed what this card contains:
- **`phone-130448-business-law-13-stress.png`:** all 13 subjects (the pre-§1 mix), as the horizontal fallback. 11 rows show and the rest scroll inside the card: the fallback works at real scale.
- **`phone-130448-business-law-after-s1.png`:** what Column 1 now actually draws with a BTEC Business Studies focus: 8 same-qualification subjects, horizontal, all fitting without scrolling. A-level Business, Economics, Accounting and Finance are other qualifications and correctly absent.

## §3: Indexed caption and Actual view (`1013c2a`)

**Where it landed: both columns.** A correction to the prompt's pointer: Column 2's Trend isn't in `ComparisonsPanels.tsx`, which never draws `MultiTrend`. It's Context's, drawn by the shared `SubjectPanels.tsx` (which also draws Column 1 Results).
- `CandidatesPanels` (Column 1 Candidates) and `SubjectPanels` (Context) both get the change.
- In `SubjectPanels` it appears only where the measure is indexed (`shouldIndex`, i.e. entries): Context on Candidates. Results (points or rates, never indexed) keeps its Chart / Table pair, unchanged.

**Mechanism:**
- `MultiTrend` gains `index?: boolean`. Absent means the measure's own rule, as before; `false` is Actual, the same lines at real values.
- Context's "All subjects" (curated) view picks the same standout lines in both, since `topMovers` ranks by % change, which is identical on real and indexed values.
- The rail's buttons are now **Indexed / Actual / Table** (aria-labels and tooltips).
  - Indexed has a new icon (a line across a dashed "100" level), and Actual the plain line icon.
  - Actual is disabled when the span is too short for a line (the ranked-change fallback is identical in both).
  - The fitted trend line works in both chart views.
- A new `TrendScaleCaption` sits under the panel's heading whenever a line is drawn.

**The two captions, as they render:**
- Indexed: **"Change since 2021/22:** each line starts at 100 (no change); 110 = 10% more entries, 90 = 10% fewer."
- Actual: **"Entries each year, real numbers:** one scale for every subject, so small ones sit low."

The first draft of the indexed caption was a third longer. On the laptop card it pushed the legend's last entry out of view, so I cut it to two lines, and the screenshot now shows everything.

**Indexed beside Actual, same subjects** (`laptop-trend-indexed-vs-actual.png`: two real `CandidatesPanels`, the second switched by a real click on "Actual"): The Chase's Sciences & Maths A-levels, 2021/22–2024/25.
- **Mathematics:** real 38 → 31 → 27 → 22, indexed 100 → 82 → 71 → 58. Both falling, together.
- **Further Maths:** real 5 → 6 → 8 → 6, indexed 100 → 120 → 160 → 120. It's the one line above 100 in both views.
- **Base year:** each line's own first year shown, with no mismatch. Both panels flag "↓ Declining" and −42% (Maths).

**Phone** (`phone-trend-actual.png`): both views render. The indexed caption wraps to three lines at 375px, so the legend's last entry sits below the fold; the card scrolls to it, as panels already do when their content overflows.

## Judgement calls for Guy

1. **Caption wording** (above). I kept it to two lines on the laptop card; say if you want different phrasing. Once the caption is there, the legend's "100 = first year shown" entry repeats it. I left the legend as it was; it could go.
2. **Both columns in one round:** landed together. The change is small: one shared caption and one prop, and Context and Candidates share `MultiTrend`, so splitting would have left the two headcount Trends working differently for a round. If you'd rather stage it, `SubjectPanels`' part can be reverted alone (the `indexedTrend` branch).
3. **Not changed, possibly relevant:** `GeographyComparison`'s % Change chart (the LA / region / England lines) also indexes entries through `MultiTrend`, with neither caption nor Actual. It's a comparison view, not a Trend panel, so it's out of this round's scope. Say if it should follow.
4. **Phone:** the indexed Trend caption takes three lines at 375px (point above).

## Live checks for Guy (after a push, hard-reload)

1. The Chase, Column 1 Candidates focused on A-level Maths: five bars, no "Math Stud".
2. Same column, Trend: the caption under "Entries in Sciences & Maths", and three rail buttons. Actual shows Maths at 38 → 22 while Indexed shows it falling to 58.
3. Context, with Candidates on the shared toggle: the same three buttons and captions on its Trend. Switch the toggle to Results and it's back to Chart / Table.
