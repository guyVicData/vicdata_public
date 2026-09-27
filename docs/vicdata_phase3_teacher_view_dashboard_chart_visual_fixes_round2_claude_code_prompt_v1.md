# Teacher view dashboard: chart visual fixes, round 2 (regression check + real bug)

Guy's read after the round-1 fixes (`d5883a7`) landed: "this fix has actually made it worse" on
The Chase's Post-16 Candidates panel (Column 1 Panel 1) — too wide/too tall, cropping at the
bottom and right, and irregular gaps between bars that look driven by the label text.

I checked live (`vicdata.co.uk/teacher/ks5`, The Chase, Candidates panel) before writing this up.
Two separate things are going on — read both before touching code.

## 1. What's actually live may not be `d5883a7` — check this FIRST

Reading the live DOM directly (not a screenshot guess), the rendered bars-row markup was:

- The bars' flex wrapper: `class="relative flex-grow"` — **no `min-w-0`**.
- The scrolling row itself: `class="flex gap-4 overflow-x-auto px-1 pt-[6px]"` — **`px-1`, not
  `pl-1 pr-4`**.

That's not what's in the repo at `d5883a7` (`src/components/teacher/VerticalBars.tsx` there has
`"relative min-w-0 flex-grow"` and `"flex gap-4 overflow-x-auto pl-1 pr-4 pt-[6px]"` — confirmed
via `git diff d5883a7 -- src/components/teacher/VerticalBars.tsx` on `main`, which is empty, and
`git status`, which is clean and up to date with `origin/main`). What I found live is, class for
class, the **pre-round-1 markup** — literally what issue 2 in the original chart-visual-fixes doc
described before any of the five round-1 commits (`12a5842` through `d5883a7`).

That would fully explain the right-edge crop with no fade (the row never internally overflows —
`row.scrollWidth` ≈ `row.clientWidth` ≈ 275px at every width I tried — because without `min-w-0`
the row grows to its own content's full width instead of shrinking to the space the card gives
it, and something further up the tree clips the excess with no scroll affordance at all).

Before re-touching `VerticalBars.tsx`, confirm what's genuinely being served:

- Re-run the same live-vs-repo byte check the round-1 build report used, but this time also rule
  out a caching layer: the site responds with `server: cloudflare` in front of Render. Check
  whether Cloudflare (or Render's own edge) is caching the JS chunk/RSC payload for this route
  from before `d5883a7` deployed, and purge if so. A deploy that completed on Render's side can
  still serve stale bytes at the edge until that cache clears.
- If it turns out `d5883a7` genuinely isn't live yet for some other reason, treat this the same
  way as the earlier `origin/main` gap: report the actual served commit before doing anything
  else.
- Once you've confirmed the browser is genuinely getting `d5883a7`'s bundle, re-check the four
  original issues plus the two below against that confirmed-live code, not against a guess.

## 2. A real bug that survives even once `d5883a7` is genuinely live

Regardless of the deploy question, reading `VerticalBars.tsx` as it stands at `d5883a7` today,
one thing in round 1's own fix will still produce Guy's "irregular gaps" complaint once served
correctly:

The label span is `max-w-[4rem] line-clamp-2 ... whitespace-normal`. `max-w` is a **cap**, not a
fixed width — a column's actual rendered width is `max(bar width, label's own natural width)`,
so every column ends up a different width depending on how long its label happens to be. On The
Chase's Sciences & Maths set today (all under the 64px cap, so none of them wrap): "Math Stud" ≈
46px wide, "Fur Maths" ≈ 45px, "Bio" ≈ 14px (falls back to the bar's own 20px). Six columns, six
different widths, one constant `gap-4` between them — that unevenness in column width is exactly
what reads as "irregular gaps... determined by the label."

This is also the mechanism behind Guy's intuition that "Math Stud" and "Fur Maths" "should break
onto two lines" — they don't need to (they fit under 64px on one line), but if the column had a
**fixed** width instead of a capped one, a short label would center within it and a genuinely
long one would wrap within it, and every gap between bars would be identical regardless of label
length. Fix by giving the column (or the label span) a fixed width — e.g. `w-16` in place of
`max-w-[4rem]` — rather than trying to force particular labels to wrap. Recheck that the bar
itself (`width: 20` or `26`) still centers correctly within the new fixed-width column.

## 3. One more thing to check while you're in here: the two-line reservation constant

Not what's causing today's specific complaint (nothing on this panel currently wraps to two
lines), but worth fixing while you're looking at this file: `LABEL_LINE = 12` (top of the file)
assumes each label line renders at 12px. The *original* pre-round-1 constant, per the very first
bug doc, was `BELOW_AND_ABOVE = 25`, "sized for one ~15px label line" — i.e. the real rendered
line height for this label style is ~15px, not 12px. `BELOW_AND_ABOVE` is currently `6 + 4 +
2*12 = 34`; at the real ~15px line height, two lines need `6 + 4 + 2*15 = 40`. So a label that
*does* wrap to two lines today would be under-reserved by about 6px — the kind of thing that
would show up as a clipped descender or a cropped second line specifically for a school/subject
whose label is long enough to genuinely wrap. Measure the real rendered line height rather than
assuming, and correct `LABEL_LINE` (and recheck the `bodyH`/`plot` maths that follow from it) if
it's off.

## Build report

Report which of #1 or #2 (or both) turned out to be real, what the actual live commit was before
your fix (if #1), and reconfirm all four original chart_visual_fixes issues plus the two above
against a live page you've verified is genuinely serving your latest commit — at a laptop-ish
width (~1366×768), a narrow 3-column desktop width (~1440px, where this panel is narrowest), and
mobile (375px). Confirm specifically: no bar/label ever crops without a fade or full scroll-off;
all column widths are uniform regardless of label length; the chart has visible headroom at the
bottom of its card, not a flush zero-margin fit.

Guy's two round-1 decisions (bars-panel/Trend-panel alignment; whether to tighten spacing so 6
bars fit without scrolling) are still open and separate from this — don't fold them into this
round unless he says so.
