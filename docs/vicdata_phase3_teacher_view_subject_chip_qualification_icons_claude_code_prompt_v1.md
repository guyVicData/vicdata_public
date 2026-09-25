Closes a real gap between the wireframe and the live build, found while surveying what from
Redesign.dc.html/NavPhone.dc.html hasn't shipped yet. Confirmed by reading the code: the
subject focus chips in src/components/teacher/ControlBar.tsx (~line 105-121) render only a
coloured pill and the label -- no icon. The wireframe adds a small tinted icon square before
the label so a chip's qualification family (GCSE/BTEC-OCR/vocational) is visible at a glance,
using the real family icons already drawn for the onboarding tile picker, not a redrawn set.

Real pieces to reuse, confirmed present: qualificationFamilyOf(phase, qualificationType) in
src/lib/teacher-view-theme.ts returns the family id string; familyIcon(phase, familyId) in
src/components/teacher/QualificationFamilyTiles.tsx returns the icon node for it (mortarboard
for GCSE, certificate+check for BTEC/OCR, three dots otherwise). The chip's existing colour
(ControlBar's `s.colour`, sourced from colourByGroup() at the call site in
src/app/teacher/[phase]/page.tsx's ControlBar invocation, ~line 1026) is the ONE colour system
to tint the icon with -- don't introduce QUALIFICATION_FAMILIES' own hex table for this, that's
a different system used for the tile picker itself, not live chip colouring (this distinction
already burned a wireframe pass once, worth not repeating in the real build).

ControlBar's `subjects` prop is currently `{ key, label, colour }[]` with no family info --
thread it through: page.tsx's `tickedItems.map(...)` call that builds this array already has
`i.qualificationType` in scope, it's just not passed on. Add a `family` (or `qualificationType`
+ derive family inside ControlBar, whichever reads cleaner) field, then render the icon inside
a small rounded square before each chip's label -- tinted background at low opacity when that
chip is focused, monochrome/transparent when not, exactly the on/off treatment the chip's own
border and text already get. KS2 already skips this prop's rows entirely (`phase === "ks2" ?
[] : ...`), so nothing to guard there.

Verify: a real school with a mixed subject list (some GCSE, some BTEC/OCR if any exist in real
data, or check via a school known to have vocational entries) shows the correct icon per chip,
not the same icon repeated. A GCSE-only school's chips all correctly show the GCSE icon. Chip
colours are completely unchanged from before this change -- only the icon is new. KS2's empty
subjects list still renders nothing extra.

Commit and push, vicdata_public only. Small enough for a one-line commit message, no build
report needed.
