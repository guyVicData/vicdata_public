# Teacher view — subject picker: a popup from "±", not an always-visible section

Guy: "also subjects chooser should not be shown on the dashboard - its called only when the user preses the +- button as a pop up."

## What's there now

`src/app/teacher/[phase]/page.tsx`, `phase !== "ks2"` only:

- A "±" link in the subject-chip header (~line 838-850): `<a href="#subjects" ...>±</a>` — an anchor that scrolls down the page.
- The picker itself, always rendered at the foot of the page (~line 1141-1193): `<section id="subjects">`, headed "Which subjects do you teach?", containing the family tiles (`QualificationFamilyTiles`) and the category subject picker (`CategorySubjectPicker`) — the same two controls onboarding's own steps 1-2 use, reused here for "quick edit."

So today the whole picker is permanently part of the page; "±" only jumps the scroll position to it.

## What to build

Turn the picker into a real popup, opened only by "±", using the same modal shell `CardBox` already has for its own fullscreen (`src/components/teacher/CardBox.tsx`, ~line 66-158) rather than inventing a second modal pattern: `fixed inset-0 z-[1500]`, `role="dialog" aria-modal="true"`, a real `<button>` backdrop for click-to-close, Escape-to-close, body-scroll-lock while open, and the panel positioned at `inset-[3%]`/`sm:inset-[5%]`. Either factor that shell out into a small shared component both `CardBox` and this popup use, or copy the same markup/hooks directly — whichever is the smaller diff; just don't build a third, differently-behaved modal.

Concretely:

1. New local state in the phase page, e.g. `const [subjectPickerOpen, setSubjectPickerOpen] = useState(false)`.
2. The "±" control (~line 838-850) becomes a `<button onClick={() => setSubjectPickerOpen(true)}>` instead of an `<a href="#subjects">` — same look, same `±` glyph, same `aria-label`/`title`.
3. The `<section id="subjects">` block (~line 1141-1193) stops being permanently rendered. Its content — heading, "Personal to you..." caption, the family tiles + category picker IIFE — moves inside the modal, rendered only `{subjectPickerOpen && (...)}`, with a close control (reuse the same exit-fullscreen icon/button style `CardBox` uses) and Escape/backdrop-click closing it the same way.
4. Behaviour stays live-update, exactly as now — ticking a subject or a family tile updates `columns`/`ticked` state immediately, which is what drives every card above; the popup does not need a separate "Save"/"Done" step, since nothing about that state management changes, only where the controls are rendered.
5. KS2 is unaffected — it never had "±" or this section (`phase !== "ks2"` gates both today; keep that).

**What NOT to touch:** the family-tiles/category-picker components themselves (`QualificationFamilyTiles`, `CategorySubjectPicker`) — reused as-is, just relocated into the modal. The onboarding flow's own steps 1-2 (separate pages, not this section). Every other card on the dashboard and how they read `ticked`/`columns` state — unchanged; they don't know or care whether the picker is inline or in a popup.

## Verification

Both phases (not KS2), both themes:

1. The "Which subjects do you teach?" picker is not visible anywhere on the page by default — no permanent section at the foot of the dashboard.
2. Clicking "±" opens it as a real modal (backdrop, centred panel), matching the visual weight of a card's own fullscreen.
3. Ticking/unticking a subject or family inside the popup updates the dashboard's cards live, same as before.
4. Escape and clicking the backdrop both close the popup without losing the tick state.
5. KS2 has no "±" and no popup, same as today.
6. `tsc --noEmit` and `next build` clean.
