Three follow-ups to the top-nav round (d3b5db3, 2edfd0a, 92b4afc), in one pass. Do them in
this order -- each hands the next real, already-built pieces to reuse rather than duplicate:

1. Subject chip qualification icons (small, desktop-only)
2. Nav on Home/Recruitment/Meetings (real plumbing, not just markup)
3. Phone-width responsive nav (the big one -- depends on both of the above)

Separate commits per round are fine and expected, same as the rest of this build so far --
just do all three in this one working session rather than stopping to check in between.

=====================================================================
## 1. Subject chip qualification icons
=====================================================================

Closes a real gap between the wireframe and the live build. Confirmed by reading the code: the
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
a different system used for the tile picker itself, not live chip colouring.

ControlBar's `subjects` prop is currently `{ key, label, colour }[]` with no family info --
thread it through: page.tsx's `tickedItems.map(...)` call that builds this array already has
`i.qualificationType` in scope, it's just not passed on. Add a `family` (or `qualificationType`
+ derive family inside ControlBar, whichever reads cleaner) field, then render the icon inside
a small rounded square before each chip's label -- tinted background at low opacity when that
chip is focused, monochrome/transparent when not, exactly the on/off treatment the chip's own
border and text already get. KS2 already skips this prop's rows entirely, so nothing to guard
there.

Verify: a real school with a mixed subject list shows the correct icon per chip, not the same
icon repeated. A GCSE-only school's chips all correctly show the GCSE icon. Chip colours are
completely unchanged -- only the icon is new.

=====================================================================
## 2. Nav on Home/Recruitment/Meetings
=====================================================================

Extends the top-nav round to the three teacher pages explicitly out of scope for it:
/teacher (home), /teacher/recruitment, /teacher/meetings. Right now all three still show the
OLD sitewide src/components/NavBar.tsx (VicData wordmark, Sets, member-Home/Account or
Join/Login) instead of TeacherNav, and Recruitment/Meetings each additionally render their own
small `<TeacherChrome theme={theme} onTheme={setTheme} />` + "All dashboards" link in their own
header row (Home has neither -- no theme toggle anywhere on it today).

Confirmed by reading each file:

- src/app/teacher/page.tsx (Home): calls useTeacherTheme() but never renders TeacherChrome or
  any toggle. Its own header is just the teacher's name + school name + "What would you like
  to look at?" above the phase/feature tile list.
- src/app/teacher/recruitment/page.tsx and src/app/teacher/meetings/page.tsx: both render
  `<TeacherChrome theme={theme} onTheme={setTheme} />` plus a `<Link href="/teacher">All
  dashboards</Link>` in a header row next to their own page-specific `<h1>` question.
  Recruitment does NOT currently call fetchOnboardedPhases anywhere -- Meetings does
  (~line 196).
- src/components/NavBar.tsx hides itself only on `/^\/teacher\/(ks2|ks4|ks5)\/?$/`. Extend that
  check to also match `/teacher`, `/teacher/recruitment`, and `/teacher/meetings` exactly (not
  their sub-paths unless they have none) -- everywhere else (/, /join, /login, /sets, /member,
  /account) must keep the old bar exactly as it is, Sets included.
- TeacherNav (src/components/teacher/TeacherNav.tsx) currently requires a real `phase:
  TeacherPhase` prop to know which switcher tab is active. These three pages have no current
  phase. Loosen that to accept `phase: TeacherPhase | null` (PhaseSwitcher's existing `active =
  p === phase` comparison already does the right thing when `phase` is null) rather than
  forking the component.
- The label-visibility toggle's persistence (src/lib/teacher-view-data.ts's
  readSetting/writeSetting/setColumnSetting path, keyed per (profile_id, school_urn, phase) in
  teacher_view_preferences) was made to work on the phase dashboard by writing the same
  `nav.labelsOn`-style key into every onboarded phase's row. These three pages have no phase of
  their own to key off either -- reuse the identical approach: fetch the onboarded-phases list
  (add it to Recruitment, it's missing there) and read/write the setting across all of them the
  same way the phase dashboard already does.

What to build: render TeacherNav at the top of all three pages in place of what they show
today. Drop Recruitment/Meetings' own `TeacherChrome` + "All dashboards" (TeacherNav's Home
icon already covers that). On the phase switcher: your call, but here's the reasoning either
way -- Home's own tile list already IS a phase picker, richer than the nav's small switcher, so
a second picker in the nav above it reads as redundant; Recruitment and Meetings have no such
picker today, only the two-step "All dashboards" detour, so giving them the switcher (as plain
links, e.g. `/teacher/${p}`) is a genuine improvement. My recommendation: omit the switcher
segment on Home, include it (as plain phase links, none ever "active") on Recruitment and
Meetings. Say what you did and why if you land somewhere else.

Verify: NavBar is now hidden on exactly six routes and unchanged everywhere else -- confirm
Sets is still reachable from every other route. TeacherNav renders correctly on all three pages
including a working Account dropdown and theme toggle. Label toggle set from any one of these
pages is reflected on the others and on the phase dashboards, and survives a reload. Confirm no
changes to NavBar's behaviour on any non-teacher route.

=====================================================================
## 3. Phone-width responsive nav
=====================================================================

Builds the phone-width nav design that's been fully wireframed (NavPhone.dc.html) but never
landed in the real responsive build. Confirmed: there is no phone-specific breakpoint logic in
TeacherNav.tsx or ControlBar.tsx today -- they just flex-wrap. Do this last -- it reuses the
family-icon/colour derivation from part 1 and the TeacherPhase|null-capable PhaseSwitcher from
part 2.

Two rows, on /teacher/[phase] only (this doesn't touch Home/Recruitment/Meetings' own phone
layout -- their content isn't columned like the phase dashboard, so check their existing
responsive behaviour once this lands rather than rebuilding it speculatively).

**Row 1 -- identity/settings, icon-only, no labels at any width:** VicData wordmark on the
left; on the right, as one cluster: Home icon (no label) -> Account icon+dropdown (same
AccountMenu component) -> theme toggle icon. A 1px full-width divider below.

**Row 2 -- what you're looking at:** a phase-switcher badge that IS the dropdown trigger (real
PhaseGlyph icon + chevron, tap opens a menu listing every onboarded phase with the same
rgba(accent.rgb,0.14) active-tint derivation as desktop -- not the wireframe's own eyeballed
Post-16 tint, flagged there as an unverified guess); the existing Candidates/Results measure
toggle, unchanged; then, pushed to the row's right edge, the subject-focus control as its OWN
dropdown -- a chip showing the focused subject's family icon + label + chevron, opening a menu
listing every subject (same family icon/colour as part 1 gives ControlBar) with a divided-off
"± Edit subjects" row at the bottom, opening the existing subject-picker flow. NO
whole-dashboard Export button anywhere in the phone layout -- per-panel export (already real,
inside each panel's own footer -- see PanelFooter.tsx) is untouched. There is no
label-visibility toggle on phone -- icon-only throughout by choice, not a labels-off state of
the desktop nav.

Both layouts read from the exact same state (measure, focusKey, subjects, theme, phase,
phases) -- a rendering fork, not a data fork. Prefer a CSS-only breakpoint swap (Tailwind
responsive utilities) over JS viewport detection, to avoid a hydration flash. Check whether the
app already has an established breakpoint convention elsewhere and match it rather than
picking a new one; the wireframe's own phone frame was drawn at 390-430px, narrower than
Tailwind's default `sm` (640px) -- use your judgement on which breakpoint actually reads right
at real widths, and say what you picked and why. Optimise for not duplicating logic (the
phase-tint derivation, the subject family/colour derivation, AccountMenu, ThemeToggle, the
measure toggle, the "±" handler) across the two render paths.

Verify at real phone widths (375-430px, more than one): nothing overlaps or clips, both
dropdowns open/close correctly and don't fight each other, the phase switcher shows every
onboarded phase with the right one active, and switching phase/subject/measure from phone
produces identical state to doing the same from desktop. Confirm desktop above the breakpoint
is completely unchanged. Confirm per-panel export still works unaffected on phone. Confirm
nothing on Home/Recruitment/Meetings changed by this part.

=====================================================================
## Deliverable
=====================================================================

One build report covering all three parts: every file touched, the phase-switcher call from
part 2 and why, the breakpoint chosen in part 3 and why, and the verification steps from each
part. Commit and push, vicdata_public only.
