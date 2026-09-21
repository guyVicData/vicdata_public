# Teacher view — home page rebuild + dashboard grid/width (Round A) — build report

Covers both items in `vicdata_phase3_teacher_view_home_and_dashboard_layout_brief_v1.md`. Built against the mockup source itself (`Home.dc.html`, `GCSE-Dashboard-Desktop.dc.html`, read directly from the Design artifact), not only the brief's quotations of it.

Round B's territory was not touched: nothing under `!onboarded` in `src/app/teacher/[phase]/page.tsx` changed (the diff to that file is the `<main>` width and the grid wrapper, nothing else), and `TickList.tsx` is unchanged (`git diff --quiet` confirms). `DELTA_POSITIVE`/`DELTA_NEGATIVE` are unchanged.

## 1. Home page — `src/app/teacher/page.tsx`

The phase list is now `Home.dc.html`'s stacked single column (`flex flex-col gap-3`), not a two-column grid. Each card, in the new `src/components/teacher/HomeCard.tsx`:

- 14px radius, 1.5px border in `--panel-border`, `--panel-bg` background, 16px padding.
- A 38×38px icon square, 10px radius, tinted `rgba(<colour>, 0.14)`, holding the glyph in the solid colour: the brief's literal GCSE "G" and Post-16 "16+" paths (256×256 viewBox, fill) and the stroke icons for Recruitment and Meetings (24×24).
- Title (15px/700) and one-line description (13px, `--muted2`) beside it.
- For phases only, the existing `Open dashboard` / `Take the 4-step tour to unlock` line under the icon row, now in the phase colour (12.5px/600) with the mockup's arrow.
- Hover: the border takes the card's colour and the background a 10% tint of it. Implemented once, through a per-card `--tile` / `--tile-rgb` custom property and Tailwind `hover:` utilities, not per-phase class names.

Colours: GCSE and Post-16 reuse `PHASE_ACCENT`. Recruitment (`#fbbf24`) and Meetings (`#fb7185`) are the new `FEATURE_ACCENT` constants beside it in `teacher-view-theme.ts`, in the same `{ hex, rgb }` shape.

Unchanged: the membership lookup, the `/api/teacher/phases` fetch, `fetchOnboardedPhases`, the `error` state, the empty-school branch, and the real `/teacher/recruitment` and `/teacher/meetings` hrefs. Moving the markup into `HomeCard.tsx` was needed so the verification harness (below) could render the real component; Next's app router also only allows a page file to export its page.

**Judgement calls, flagged:**
- **Recruitment/Meetings wording** follows the mockup: titled "Recruitment" and "Meetings", with the questions as the description lines. Their previous titles were the questions themselves. The questions are kept, so §14's question still leads each card's reading.
- **KS2 has no mockup colour or glyph.** A primary school's KS2 card uses the neutral `--muted` tone and a small "KS2" text glyph rather than borrowing a palette colour that would read as meaning something. Needs a design decision if KS2 should have its own accent.
- **The home page follows the Teacher view theme.** The card tokens are scoped to `#teacher-root`, so the home `<main>` now carries that id and the `data-theme` from the existing `useTeacherTheme` hook. It shows whatever theme was last chosen on a dashboard. No toggle was added here and no new mechanism.

## 2. Dashboard grid/width — `src/app/teacher/[phase]/page.tsx`

- `<main>`: `max-w-4xl` → `max-w-7xl` (80rem = 1280px, the laptop board's own width).
- The four cards now sit in the new `src/components/teacher/DashboardGrid.tsx`: `grid items-start gap-[18px]`, with `xl:grid-cols-[1fr_2px_1fr_2px_1fr_2px_1fr]`. That is four equal columns with three explicit 2px divider columns, as in the mockup. Each divider is its own grid item painted `var(--divider)`.
- `--divider` did not exist as a token, so it is an alias of the existing `--panel-border2`, per the brief, not a new colour: `#2a2a2e` dark, `#d8d8dd` light. (The mockup's own value is `#4a4a54` dark, noticeably brighter. Say if the dividers read too faint live.)
- The dividers are `self-stretch`, so they run the full row height. The mockup's own dividers are empty divs in an `align-items:start` grid; taken literally they would collapse to zero height.

**Breakpoints — the one choice here that is not mockup-literal, flagged as the brief asked:** stacked single column below `md`, two columns at `md` (768px), the full four-column row with dividers at `xl` (1280px) and up. The dividers only exist at `xl`; below it they are `display:none` and take no grid track.

**Dividers during fullscreen:** the mockup hides them while a card is fullscreen, and so does this build. But they turn **invisible** rather than being removed. Removing three grid items would let the four cards reflow into the 2px divider tracks, which is exactly the "grid looking broken underneath" the verification section warns about. `CardBox` reports open/close through a small `FullscreenReport` context (a no-op default, so a CardBox anywhere else is unaffected). That covers pinned boxes deep inside `ColumnBuilder` as well as each column's default box. It is a count rather than a flag, so closing one box can never clear another's state.

Card content is unchanged.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on every changed file; `next build` passes.

**Live-site verification has NOT been done.** vicdata.co.uk still returns the Basic Auth gate to this session's browser, and the preview-session link needs the production token, which is not available here. Separately, the Chrome browser extension could not take a screenshot of any page this session, including example.com (a "script injection timed out" error on every capture), so it could not be used even locally.

**What was verified instead:** a temporary local harness (deleted, not committed) rendered the **real** `HomeCard`, `DashboardGrid`, `DashboardColumn`, `CardBox`, `ViewChart` and `SharePie` with Acland Burghley fixture figures, on a local production build. Headless Chrome was driven over the DevTools protocol to set viewports, hover and click, with values measured from the live DOM, not just eyeballed:

| Check | Result |
|---|---|
| Home, 390px dark and light | Stacked single column, tinted icon squares with the literal G / 16+ glyphs, amber Recruitment, rose Meetings, phase-coloured action lines |
| Home hover (Post-16 card), dark and light | Computed border `rgb(167,139,250)`, background `rgba(167,139,250,0.1)` |
| Dashboard 1280px, dark and light | Four columns, all at top 133px and 280px wide, in one row; three dividers `2×476px` (full row height), `#2a2a2e` dark / `#d8d8dd` light |
| Dashboard 1024px | Two columns of 479px, two rows; dividers `display:none` |
| Dashboard 390px | One stacked column of 358px |
| Fullscreen on the Rankings box, 1280px, dark and light | Dialog opens over the blurred page; dividers `visibility:hidden`; all four columns unmoved (top 133, width 280) underneath |

The harness does not exercise the real page's data wiring, the real map, or the signed-in state; only the live check does. To close this round: open the preview link (or sign in) at vicdata.co.uk/teacher and at an onboarded dashboard, at a wide window and a phone-width window, in both themes, and open fullscreen on any card.
