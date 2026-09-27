# Teacher view chart visual fixes, round 2: build report (v1)

Prompt: `vicdata_phase3_teacher_view_dashboard_chart_visual_fixes_round2_claude_code_prompt_v1.md` (read in full). Built from `d5883a7`, fix in `b1bbba1`, pushed and **confirmed live at 08:38:41 UTC**. Only `VerticalBars.tsx` changed.

## Which was real

**#1 (stale deploy or edge cache): not real at the server. `d5883a7` was live when the markup was read.** Checked before touching code:

- **The live chunk was current.** vicdata.co.uk served `3wvykh0o1jwzd.js`, the teacher chunk from `d5883a7`'s build, byte-identical to my build. It contained round 1's `relative min-w-0 flex-grow` and `pl-1 pr-4`, with `last-modified` 08:11:47 UTC, the round-1 deploy.
- **The pre-round-1 chunk was gone.** `2bsj47ak9a375.js` returned 404, so no fresh page load could run the old code.
- **No edge cache is involved.** Cloudflare answers `cf-cache-status: DYNAMIC` for these chunks, and the page itself is behind the gate (401, `DYNAMIC`). Chunk names are content hashes, so a cache can't serve old code under the new name. There was nothing to purge.
- **Nothing deployed contains the markup that was read.** The exact string (`flex gap-4 overflow-x-auto px-1 pt-[6px]` under `relative flex-grow`) is pre-round-1 `VerticalBars`, and no chunk in the build contains it. The similar string that *does* exist belongs to `TrendChart`'s short-series bars (`flex justify-around gap-2 overflow-x-auto px-1 pt-[6px]`), a different component.
- **Most likely explanation:** the tab was loaded before the 08:13 deploy. The dashboard doesn't re-fetch its JavaScript when you move between pages, so an old tab keeps running old code until a hard reload.

I can't read the live DOM myself (Basic Auth gate), so **please hard-reload** (⇧⌘R) before re-checking.

**#2 (column widths driven by label length): real, fixed.** Details below.

**#3 (label line height): the doc's premise didn't hold, but the headroom point did.**
- The label's line height is set explicitly (`lineHeight: 12px`) since round 1. Measured, a one-line label is 12px and a two-line one 24px, so `LABEL_LINE = 12` was right; the ~15px was the *old* default leading.
- But a two-line label did end flush with the card's content edge (0px), which is the "no headroom" complaint. Added `BOTTOM_ROOM = 6`, so `BELOW_AND_ABOVE` = 6 + 4 + 2 × 12 + 6 = 40. `bodyH` and `plot` follow from it unchanged.

## The fix (`b1bbba1`)

**Every column in a chart now has one width:** the widest single *word* among its labels, measured with the label's real font before the first paint, floored at the bar width and capped at 64px. The bar centres within it.

- **Not a fixed `w-16`, as the doc suggested.** Six 64px columns plus gaps make a ~460px row, so it would scroll on almost every card.
- **Not the widest whole label either.** I tried that first: 48px columns and a 388px row on The Chase, wider than before round 2.
- **Why the widest word:** multi-word labels wrap at their space. "Math Stud" becomes "Math / Stud" and "Fur Maths" becomes "Fur / Maths", which is what you expected them to do. On The Chase's set every column is 30px and the row needs 280px.
- **Room for the second line:** it was already reserved, so wrapping costs no height.

## Re-checks

Headless harness: the real `CardBox` card, built CSS, The Chase's Sciences & Maths labels. At 1366 and 1440 the dashboard is capped at `max-w-7xl` (1280px), so the three-column card is about 385px wide at both. That column gives a 254px bar row, and 450px was measured for comparison.

| Width | Columns | Gaps | Bars centred | Row needs / has | Fade | Scrolled to end: last bar clear by | Room under labels |
|---|---|---|---|---|---|---|---|
| 375 (phone) | 6 × 30px | all 16px | yes (0px off) | 280 / 212 | yes | 16px | 18px (one line), 6px (two lines) |
| 1366 / 1440 (385px column) | 6 × 30px | all 16px | yes | 280 / 254 | yes | 16px | 18 / 6px |
| 450px column | 6 × 30px | all 16px | yes | 280 / 319, fits | none | — | 18 / 6px |
| 375, long labels | 6 × 54px | all 16px | yes | 424 / 212 | yes | 16px | 6px min; a 3+ line label clamps with "…" |

The original four issues against this code:

1. **Trend x labels:** `TrendChart.tsx` is unchanged since round 1's measurements, with no overlaps from 320px to 1200px.
2. **No bar or label is cropped without a fade or a full scroll-off:** confirmed at all widths above.
3. **Two-line labels:** confirmed, with 6px of headroom now instead of 0.
4. **Axis width:** unchanged since round 1.

Plus this round's two:

- **Column widths are uniform whatever the label text:** confirmed.
- **The chart has visible room at the bottom of its card:** confirmed, 6px minimum.

**Live:** `0b66-pu920-on.js` is byte-identical to my build and is being served. The previous teacher chunk now returns 404. The page itself is gated, so the on-screen check is yours.

## Still open (not folded in, as the prompt says)

1. **Bars/Trend panel alignment** (round 1, decision 1).
2. **Tighter spacing so 6 bars fit without scrolling** (round 1, decision 2). With 30px columns, The Chase's six bars need 280px against 254px on the 3-column desktop card: 26px over, so one bar sits partly behind the fade. A 10px gap between bars would make them fit; 12px would still be 6px over.

## Live checks for Guy (hard-reload first)

The Chase Post-16 Candidates panel 1, card view, at your laptop width and on a phone:

1. All six columns are the same width with even gaps, and "Math Stud" and "Fur Maths" each sit on two lines.
2. Nothing is cut without the right-edge fade. Scrolling to the end shows "Fur Maths" in full with space after it.
3. There's a little space under the labels before the card's bottom edge.
