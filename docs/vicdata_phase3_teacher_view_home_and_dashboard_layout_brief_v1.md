# Teacher view — home page rebuild + dashboard grid/width fix (Round A)

## Why this brief exists

Guy's review of the live site after the card-content rebuild (`e9fb152`): "the start
page looks nothing like the first screen in the mockup (no icons, no use of colour, a
2x2 grid)" and "the dashboard does not use the whole width of the window, and again has
a 2x2 grid so the whole column idea doesn't work."

Both are confirmed, verified directly against the mockup source (`Home.dc.html`,
`GCSE-Dashboard-Desktop.dc.html`) and the real code (`src/app/teacher/page.tsx`,
`src/app/teacher/[phase]/page.tsx`) — not assumed. This is **Round A of two**. A second
round (onboarding flow rebuild — qualification-family selection, category-grouped
subject picker, live results preview — plus the shared list-styling fix) is scoped
separately and deliberately NOT part of this brief. Do not touch onboarding step
content, `TickList.tsx`, or anything under `!onboarded` in `[phase]/page.tsx` as part of
this round.

## What NOT to touch in this round

- Onboarding (`!onboarded` branch in `src/app/teacher/[phase]/page.tsx`, `TickList.tsx`)
  — a separate round is coming for this.
- Card *content* (pie chart, bar rows, results comparison, subject chips) — already
  rebuilt and verified live in the previous round. This round is purely the page-level
  container/grid around that content, plus the home page.
- The delta colour question (green vs muted-grey/red-only-negative) is still open and
  unrelated to this round — do not change `DELTA_POSITIVE`/`DELTA_NEGATIVE` here.

---

## 1. Home page rebuild — `src/app/teacher/page.tsx`

### Current state (confirmed by reading the file)

The phase tiles render as a generic Tailwind grid: `<div className="mt-6 grid gap-3
sm:grid-cols-2">` of `<Link className="rounded-lg border border-neutral-200 p-4
transition hover:border-blue-400 dark:border-neutral-800 dark:hover:border-blue-600">`.
No icons, no colour, no hover-tint. Recruitment/Meetings tiles below use the identical
generic style.

### Target (literal, from `Home.dc.html`)

A single-column stacked list (`display:flex; flex-direction:column; gap:12px`), not a
2-column grid. Each card is `border-radius:14px; background:#131315` (map to
`var(--panel-bg)`/existing theme token, not a literal hex, so dark/light both work) with
a `1.5px` border, `padding:16px`.

Each card's content is `display:flex; align-items:center; gap:12px`:
- A 38×38px icon box, `border-radius:10px`, background = the phase/feature colour at
  14% opacity, icon coloured with the same solid colour.
- Title (15px, weight 700) + one-line description (13px, muted) to its right.
- Below the icon row, for phases only: a "Take the 4-step tour to unlock →" line in the
  phase's solid colour (12.5px, weight 600) — this is the existing
  `state === "open-dashboard" ? "Open dashboard" : "Take the 4-step tour to unlock"`
  logic already in the file; only its *styling* needs to move from generic blue link text
  to the phase colour, sitting below the icon row rather than inline.

Hover state (`.card-gcse:hover` etc. in the mockup): on hover, `border-color` becomes the
phase colour and `background` becomes that colour at ~10% opacity. Implement as a
Tailwind/CSS hover variant per phase, not literal mockup class names.

Colours (already established in `src/lib/teacher-view-theme.ts`'s `PHASE_ACCENT` for
GCSE `#34d399` / Post-16 `#a78bfa` — reuse those constants, don't redefine them). Two new
colours needed for Recruitment (`#fbbf24`, amber) and Meetings (`#fb7185`, rose) — add
these as named constants near `PHASE_ACCENT` in `teacher-view-theme.ts` rather than
inlining hex in the page component.

Icons — literal SVG paths from the mockup, reproduce exactly (`viewBox="0 0 256 256"
fill="currentColor"` for GCSE/Post-16, `viewBox="0 0 24 24" stroke="currentColor"` for
Recruitment/Meetings):

**GCSE** (custom glyph):
```svg
<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <g transform="matrix(1,0,0,1,-1836,0)">
    <g transform="matrix(1,0,0,1,1836,0)">
      <g transform="matrix(3.925511,0,0,2.731409,-25.25031,-68.515531)">
        <path d="M22.987,54.357C22.987,51.636 23.462,49.231 24.411,47.143C25.36,45.054 26.626,43.314 28.208,41.921C29.727,40.592 31.452,39.58 33.382,38.884C35.312,38.188 37.258,37.839 39.22,37.839C41.182,37.839 43.128,38.188 45.059,38.884C46.989,39.58 48.745,40.592 50.327,41.921C51.846,43.314 53.08,45.054 54.03,47.143C54.979,49.231 55.454,51.636 55.454,54.357L55.454,57.775L45.771,57.775L45.771,54.357C45.771,52.016 45.122,50.291 43.824,49.184C42.527,48.076 40.992,47.522 39.22,47.522C37.448,47.522 35.914,48.076 34.616,49.184C33.319,50.291 32.67,52.016 32.67,54.357L32.67,90.052C32.67,92.393 33.319,94.118 34.616,95.225C35.914,96.333 37.448,96.887 39.22,96.887C40.992,96.887 42.527,96.333 43.824,95.225C45.122,94.118 45.771,92.393 45.771,90.052L45.771,77.331L38.081,77.331L38.081,68.787L55.454,68.787L55.454,90.052C55.454,92.9 54.979,95.336 54.03,97.361C53.08,99.386 51.846,101.064 50.327,102.393C48.745,103.785 46.989,104.829 45.059,105.525C43.128,106.222 41.182,106.57 39.22,106.57C37.258,106.57 35.312,106.222 33.382,105.525C31.452,104.829 29.727,103.785 28.208,102.393C26.626,101.064 25.36,99.386 24.411,97.361C23.462,95.336 22.987,92.9 22.987,90.052L22.987,54.357Z"/>
      </g>
    </g>
  </g>
</svg>
```

**Post-16** (custom glyph):
```svg
<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <g transform="matrix(1,0,0,1,0,-3.395208)">
    <g transform="matrix(3.244681,0,0,2.257681,-67.887782,-33.320102)">
      <path d="M33.714,106L33.714,48.662L24.031,55.781L24.031,45.529L33.714,38.409L43.397,38.409L43.397,106L33.714,106Z"/>
      <path d="M73.396,38.409L62.384,66.793L62.573,66.983C62.89,66.73 63.38,66.524 64.045,66.366C64.709,66.208 65.58,66.129 66.655,66.129C68.364,66.129 69.946,66.54 71.402,67.363C72.858,68.186 73.997,69.23 74.82,70.496C75.263,71.192 75.611,71.888 75.864,72.584C76.117,73.28 76.338,74.198 76.528,75.337C76.655,76.476 76.75,77.916 76.813,79.657C76.876,81.397 76.908,83.596 76.908,86.254C76.908,88.469 76.876,90.289 76.813,91.713C76.75,93.137 76.655,94.323 76.528,95.273C76.338,96.285 76.101,97.14 75.816,97.836C75.532,98.532 75.168,99.26 74.725,100.019C73.459,102.108 71.766,103.722 69.646,104.861C67.526,106 65.137,106.57 62.478,106.57C59.82,106.57 57.447,105.984 55.359,104.813C53.27,103.643 51.593,102.045 50.327,100.019C49.821,99.26 49.425,98.532 49.141,97.836C48.856,97.14 48.65,96.285 48.524,95.273C48.334,94.323 48.207,93.137 48.144,91.713C48.081,90.289 48.049,88.469 48.049,86.254C48.049,84.166 48.081,82.441 48.144,81.081C48.207,79.72 48.302,78.533 48.429,77.521C48.555,76.571 48.745,75.701 48.998,74.91C49.251,74.119 49.536,73.28 49.853,72.394L62.573,38.409L73.396,38.409ZM67.225,79.514C67.225,78.059 66.75,76.888 65.801,76.002C64.852,75.116 63.744,74.673 62.478,74.673C61.213,74.673 60.105,75.116 59.156,76.002C58.207,76.888 57.732,78.059 57.732,79.514L57.732,92.045C57.732,93.501 58.207,94.672 59.156,95.558C60.105,96.444 61.213,96.887 62.478,96.887C63.744,96.887 64.852,96.444 65.801,95.558C66.75,94.672 67.225,93.501 67.225,92.045L67.225,79.514Z"/>
    </g>
    <g transform="matrix(1.372534,0,0,1.372534,13.667421,-49.625185)">
      <path d="M146.689,128.685L146.689,111.735L153.055,111.735L153.055,128.685L170.005,128.685L170.005,135.051L153.055,135.051L153.055,152L146.689,152L146.689,135.051L129.74,135.051L129.74,128.685L146.689,128.685Z"/>
    </g>
  </g>
</svg>
```

**Recruitment** (lucide "users-round"-style — matches the icon already used for the
Candidates card on the dashboard, so it may already exist as a shared icon component):
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
```

**Meetings** (lucide "calendar-clock"/simple calendar glyph):
```svg
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
```

### What to keep unchanged

All of the existing data-fetching logic — membership lookup, `/api/teacher/phases`
fetch, `fetchOnboardedPhases`, the `error` state, and the `phases.length === 0` "Why is
Teacher view empty for this school?" branch. This is a visual restyle of the working
list, not a rewrite of its logic. Recruitment/Meetings keep their real `href`s
(`/teacher/recruitment`, `/teacher/meetings`) — the mockup's `href="#"` on those two
cards is just an unwired placeholder in the design tool, not a signal to remove the real
links.

---

## 2. Dashboard grid/width — `src/app/teacher/[phase]/page.tsx`

### Current state (confirmed by reading the file)

The onboarded dashboard's main wrapper (line ~572): `<main className="mx-auto
max-w-4xl bg-[var(--bg)] p-4 text-[var(--fg)] sm:p-6">`. The four cards
(Candidates/Results/Context/Rankings) render inside `<div className="mt-6 grid gap-4
sm:grid-cols-2">` (line ~624) — two columns, wrapping to a 2×2 block on anything wider
than mobile.

### Target (literal, from `GCSE-Dashboard-Desktop.dc.html`)

The mockup's laptop-width container is `width: 1280px`. Tailwind's `max-w-7xl` is
exactly `80rem` = `1280px` — use that in place of `max-w-4xl`.

The four cards sit in one row via:
```css
display: grid;
grid-template-columns: 1fr 2px 1fr 2px 1fr 2px 1fr;
gap: 18px;
align-items: start;
```
That is four equal content columns with three explicit 2px divider columns between them
— not `gap`-only spacing. Each divider is its own grid item: `<div
style="background: var(--divider);"></div>` (confirm `--divider` exists as a theme token
already — if not, alias it to the existing `--border`/`--panel-border` token rather than
inventing a new one). The mockup hides the dividers entirely while any card is
fullscreen (`ui.noneFullscreen` conditional) — replicate that: when `CardBox`'s
fullscreen state is active for any of the four cards, don't render the divider elements
for that row.

This 4-column-with-dividers layout is a wide-viewport-only design — the mockup only
specifies two breakpoints (390px mobile, 1280px laptop), so the exact intermediate
breakpoint is a judgement call, not something literal to copy. Reasonable default:
single column below `md`, 2-column at `md`, the full 4-column-with-dividers grid at
`xl:` (1280px, matching `max-w-7xl`) and above. Flag this breakpoint choice in the build
report so it can be adjusted if it looks wrong live — this one detail isn't mockup-literal
the way everything else in this brief is.

Everything *inside* each column (icon, heading, box, pie/bars/map, subject chips,
"Expand"/"Add a view" accordion) is unchanged — this is purely the container grid
around already-correct card content.

### What to keep unchanged

The onboarding wrapper (`max-w-2xl`, separate `<main>` block for `!onboarded`) is not
part of this round. The `Loading…` state wrapper (`max-w-4xl`, line ~350/353) can stay as
is unless it's trivial to match — not a priority.

---

## Verification

Before calling this done: load `/teacher` and confirm the stacked single-column list
with tinted icons and hover-tint, in both light and dark, for a school with at least one
onboarded and one un-onboarded phase. Load an onboarded phase dashboard at a wide
viewport (≥1280px) and confirm all four cards sit in one row with visible thin dividers
between them, and that the layout collapses sensibly at mobile width. Confirm fullscreen
still works correctly within the new grid (a card expanding to fullscreen shouldn't leave
the grid looking broken underneath).
