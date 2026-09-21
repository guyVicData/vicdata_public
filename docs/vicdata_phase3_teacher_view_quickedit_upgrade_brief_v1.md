# Teacher view — upgrade the dashboard's "change subjects" picker to match onboarding (Round C)

## Why this brief exists

Guy, live on the real dashboard: "bottom of dashboard shows 'Which subjects do you
teach? Personal to you. Changing it updates every card above.' and not the dashboard
icons." Confirmed by reading the real code and the matching mockup file.

Round B rebuilt the **first-time onboarding** flow (`!onboarded` branch) into
qualification-family tiles + a category-grouped picker. It deliberately did not touch
the **returning-user "change subjects" picker** at the foot of the already-onboarded
dashboard (`src/app/teacher/[phase]/page.tsx`, the `<section id="subjects">` block, ~line
1093) — that's a separate code path, reached by clicking the "±" next to the subject
chips at the top of the dashboard (which scrolls down to this section rather than
navigating away — a real, deliberate choice already in the code, see the comment at
line ~811: "Changing subjects lives in the picker at the foot of this page, so that is
where '±' goes." Keep that placement). That section still renders the old flat
`SubjectPicker`/`TickList` — no icons, no qualification families, no category grouping.

The mockup has a dedicated file for exactly this screen —
`GCSE-QuickEdit.dc.html`/`Post16-QuickEdit.dc.html` — and its own script comment says
the quiet part out loud: "Same taxonomy as GCSE-Step2 — kept identical so quick-edit and
onboarding never disagree." So this is not a new design problem, it's a rollout gap:
Round B built the right components, this one remaining call site just hasn't been
switched over to them yet.

## What to do

Replace the contents of the `<section id="subjects">` block (currently just
`<SubjectPicker items={items} ticked={ticked} onToggle={toggle} />`) with the same
qualification-family tiles + `CategorySubjectPicker` built in Round B for onboarding
Step 1 and Step 2 — reuse those exact components, don't build a third implementation.
Differences from the onboarding version, per the mockup and the real returning-user
context:

- **One screen, not two steps.** The mockup's QuickEdit combines what onboarding splits
  across Step 1 and Step 2 into a single panel: family tiles at the top, the category
  picker immediately below (no "Next" button between them — there's no reason to force a
  click-through for someone who already knows the mechanism). Keep the existing section
  wrapper, heading, and subcopy ("Which subjects do you teach?" / "Personal to you.
  Changing it updates every card above.") — only what's inside changes.
- **Default family selection comes from the real current state**, not "pre-tick
  everything with data" (that default is right for first-time onboarding; here the
  teacher already has a real prior selection in `ticked`/`items` — derive which families
  are pre-ticked from what's already selected, per the mockup's own
  `noDataFamiliesSelected` handling for a ticked-but-empty family).
- No results-preview or views-summary steps here — those are onboarding-only. This
  section ends where the picker ends; the cards above it already show the live result of
  whatever's ticked.
- If `SubjectPicker` (the function wrapping `TickList` at the top of
  `[phase]/page.tsx`) has no other call sites once this changes, remove it rather than
  leaving a second, now-unused subject-picker implementation in the file. Check first —
  don't remove it if something else still uses it.

## What NOT to touch

Onboarding itself (Round B, already shipped and verified), the subject-chip header row,
the "±" link's behaviour (scroll-to-section, not navigate-away — that's correct and
deliberate), card content, Round A's layout.

## Verification

Live, both phases, both themes: confirm the foot-of-page picker now shows qualification
tiles and the real category-grouped picker (same visual language as onboarding), ticking
a new subject updates the header chips and all four cards above without a page reload,
and the "±" link still scrolls to this section correctly.
