# Teacher view: four chart visual fixes: build report (v1)

Built from `ddba6ac`, one commit per fix. Only `TrendChart.tsx` and `VerticalBars.tsx` changed.

| Commit | Fix |
|---|---|
| `12a5842` | 1. Line charts: x-axis labels never overlap |
| `b1211f9` | 2. Bar charts: rightmost bar no longer cropped mid-bar |
| `1df7439` | 3. Bar charts: labels wrap to two lines |
| `7e65ce3` | 4. Bar charts: left margin |

Checks: `tsc --noEmit` is clean and `npm run build` succeeds. `eslint src` shows the same 7 problems as before, none in these files. Localhost is gated, so every measurement below comes from the headless harness. It client-renders the real `CardBox` (fixed height, icon rail) inside the dashboard's column and page padding, with the built CSS, at a pinned page width. Nothing needing a click (fullscreen) was measured.

## 1. Line charts: x-axis label overlap (`12a5842`)

**The main cause wasn't tick spacing.** The last label carried `right-0`, which already puts its right edge on the final tick, *and* an inline `transform: translateX(-100%)` meant to override the class's transform. But Tailwind v4's `translate-x-*` sets the separate CSS `translate` property, so nothing was overridden and both shifts applied. The last label sat a whole label-width (34px) short of its tick, on top of the label before it.

Measured at 375px before the fix: "2023/24" at 246–281px, "2024/25" at 260–295px, when it should end at the last tick (329px).

Changes:
- **The last label uses `right-0` alone.**
- **Thinning is based on measured widths, not a count.** The x axis is now a small `XAxis` component. It measures its own width and one label's rendered width: synchronously before the first paint, then on every resize. It shows the most labels whose boxes stay at least 6px apart:
  - first and last always show;
  - between them every n-th label, using the smallest n that fits, dropping the label before the last if that alone collides;
  - if even the two ends collide, only the latest year shows.
- This also fixes the old count rule's own collision. With 8 periods it showed labels 0, 2, 4, 6 plus 7, putting "2023/24" beside "2024/25" even at 500px.
- **Fullscreen** follows the same rule. At fullscreen width that normally means every year, which is what the old fullscreen cap was for.

Measured after the fix, labels shown (no overlaps at any width):

| Page width | 4 periods | 8 periods |
|---|---|---|
| 320 | first, last | 3 |
| 375 | all 4 (14px clear before the last) | 3 |
| 500 | all 4 | 4 |
| 800 | all 4 | all 8 |
| 1200 | all 4 | all 8 |

## 2. Bar charts: cropped rightmost bar (`b1211f9`)

**Not a padding problem at root: the row never scrolled.** Its flex parent (`relative flex-grow`) had no `min-w-0`, so it grew to the bars' full width. At 375px the row was 316px wide inside a 236px content box. Because the row never overflowed itself, it never scrolled, and the card's own `overflow-hidden` cropped it: "Fur Maths" was cut at 236px, and Comp Sci was out of sight with nothing to scroll to.

Changes:
- **`min-w-0` on the bar area:** at 375px the row is now 198px wide with 328px of content, and it scrolls.
- **Trailing padding `pr-4`:** scrolled fully right, the last column sits 16px clear of the edge.
- **Edge fade:** while bars sit past the right edge, the row fades out over its last 28px, so a bar the edge cuts reads as "scroll for more". The fade goes once you reach the end, or when everything fits: none at 800px.
- **Scrollbar room:** now that the row really scrolls, Windows browsers draw a horizontal scrollbar under it. Its height is measured and taken out of the bar area, so the labels can't be pushed under the card's clipped bottom edge. It's 0 on macOS overlay scrollbars.

## 3. Bar charts: two-line labels (`1df7439`)

- **Label:** `truncate` is replaced by a two-line clamp (`line-clamp-2`, `whitespace-normal`, `break-words`, centred), still capped at 4rem wide, with a 12px line height.
- **`BELOW_AND_ABOVE`:** from 25 to 6 + 4 + 2 × 12 = 34. That reserves two lines always, so every chart's baseline sits at the same height whether or not a label wraps. The bar area gives up 9px of height.
- **Measured:**
  - One-line labels are 12px high.
  - "Business Studies" wraps onto two lines (24px), fits with 0px to spare at the card's content bottom, and isn't clipped.
  - A deliberately over-long label clamps to two lines with an ellipsis.
  - Every bar's baseline sits 28px above the content bottom.

## 4. Bar charts: left margin (`7e65ce3`)

Measured against the sibling Trend panel at 375px, from the content edge next to the icon rail:

| | Axis figures start | First mark (bar / plot) starts |
|---|---|---|
| Trend panel (sibling) | 13px | 40px |
| Bars panel, before | 17px | 46px |
| Bars panel, after | 3px | 32px |

- **The excess vs its sibling was only about 6px.** The largest single empty space was inside the fixed 30px axis box, which left 17px blank before two-digit figures like "37".
- **Change:** the axis is now as wide as its widest figure: about 5.6px a character, which errs wide, plus 2px each side, minimum 12px. It is 16px for two-digit figures. A 4-digit axis ("1,739") measured 32px with the text unclipped.
- **Caveat:** I can't see your screen, so this is my best identification of the gap you mean, from the measurements rather than a guess. The rail, rail divider and column gap are shared with every panel and unchanged.

## Open decisions for Guy

1. **Is this the gap you meant (fix 4)?** The bars panel now starts 8px *tighter* than the Trend panel below it (32px vs 40px). If you'd rather the column's panels line up, I can:
   - size Trend's y axis the same way: it has the same fixed box, 32px with 13px blank; or
   - give the bars axis a floor that matches Trend.
2. **Should the bar row fit more before scrolling?** At The Chase's desktop card width, 6 bars overflow by only a few pixels, so the fade appears with one bar partly behind it. A smaller gap between bars (16px to 12px) would let 6 fit without scrolling at most desktop widths. I didn't change the spacing without asking.

## Live checks for Guy

1. **Phone width (375px), any Trend panel with 2021/22–2024/25:** four labels, none touching. A longer range thins without overlap.
2. **The Chase Post-16 Candidates panel 1, card view:** no bar cut mid-way. If the row still doesn't fit, the right edge fades, the row scrolls, and scrolled to the end "Fur Maths" and the last bar show in full with space after.
3. **Same panel:** any label longer than a line wraps to two lines, not an ellipsis.
4. **Same panel:** the gap between the rail and the axis figures is smaller. Tell me if it's the gap you meant (open decision 1).
