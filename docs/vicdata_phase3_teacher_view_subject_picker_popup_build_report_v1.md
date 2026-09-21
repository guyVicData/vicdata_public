# Teacher view — subject picker as a popup from "±" — build report

Covers `vicdata_phase3_teacher_view_subject_picker_popup_brief_v1.md`. Files: new `src/components/teacher/TeacherModal.tsx`; changed `CardBox.tsx` and `[phase]/page.tsx`.

Untouched, as required: `QualificationFamilyTiles` and `CategorySubjectPicker` (moved into the popup unchanged), onboarding's steps, and how every card reads `ticked`/`columns`. KS2 is unaffected: both the "±" and the popup stay behind `phase !== "ks2"`.

## One modal shell, now shared

The brief allowed either copying CardBox's fullscreen shell or factoring it out. It is factored out, so there is one modal implementation rather than two copies that could drift apart. `TeacherModal` holds exactly what CardBox's fullscreen had:
- `fixed inset-0 z-[1500]`, `role="dialog" aria-modal="true"`;
- a real `<button>` backdrop (dimmed and blurred) that closes on click;
- Escape to close;
- body-scroll lock while open;
- focus moved to the panel's close button on open;
- the `inset-[3%]` / `sm:inset-[5%]` floating panel.

The caller renders it only while open, inside `#teacher-root` so the theme applies. `ExpandIcon` and the close button's classes (`MODAL_CLOSE_BUTTON_CLASS`) live beside it.

**CardBox now uses it** for its fullscreen, with no change in behaviour. Its separate "report fullscreen to the dashboard" effect (which hides the column dividers) stays in CardBox. The one small addition inside the shell: `onClose` is held in a ref, so a caller passing a fresh arrow each render doesn't re-run the open effect.

## The popup

- New page state `subjectPickerOpen`.
- The "±" in the chip header is now a `<button onClick={() => setSubjectPickerOpen(true)}>`, with the same look and glyph, the same `aria-label`/`title`, and `aria-haspopup="dialog"`.
- The always-rendered `<section id="subjects">` at the foot of the page is gone. Its contents (the "Which subjects do you teach?" heading, the "Personal to you…" caption, and the family tiles plus category picker, including the Round C quick-edit logic) render inside `{phase !== "ks2" && subjectPickerOpen && <TeacherModal …>}`.
- A close button in the corner uses CardBox's exit icon and style. Escape and backdrop click close it too.
- **Live update, no save step:** nothing about the state changed, only where the controls render. Ticking updates `ticked` immediately, and the cards behind the backdrop change as you tick.
- **Copy, flagged:** the caption's "updates every card above" became "updates every card on the dashboard", since the picker no longer sits below the cards.
- Stale comments about "±" scrolling to the foot of the page are updated. No `#subjects` anchor remains anywhere.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on the page and all Teacher view components; `next build` passes.

**Modal behaviour, driven for real.** A temporary local harness (deleted, not committed) rendered a real `CardBox` and a "±"-opened `TeacherModal` holding the real `QualificationFamilyTiles` and `CategorySubjectPicker`. Headless Chrome drove it over the DevTools protocol, reading state from the DOM:

| Step | Dialog | Body scroll | Focus | Ticked state behind |
|---|---|---|---|---|
| Page load | none | normal | — | geo |
| "±" clicked | "Which subjects do you teach?" | locked | close button | geo |
| History ticked inside the popup | open | locked | — | **geo, his** (live) |
| Escape | none | restored | — | geo, his (kept) |
| Re-open, backdrop click | none | restored | — | geo, his (kept) |
| Card fullscreen opened | "…, full screen" | locked | exit button | — |
| Card fullscreen, Escape / backdrop | none | restored | — | — |

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, both phases, both themes:
1. no picker on the page by default;
2. "±" opens it as a modal;
3. ticking updates the cards live;
4. Escape and backdrop close it with ticks kept;
5. KS2 has neither.
