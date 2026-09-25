Read docs/vicdata_phase3_teacher_view_dashboard_top_nav_build_brief_v1.md in full and execute
it. Guy compared the finished phone-width nav wireframe back against the desktop wireframe and
found one real inconsistency worth fixing: the theme toggle lives in the control bar on
desktop but in the top nav, right after Account, on phone. His call -- "lets just do #1" --
move it. Three other differences (GCSE/Post-16 switcher as tablist vs. dropdown, Export
present on desktop only, "+-" as standalone button vs. inside a dropdown) are intentional,
space-driven, and out of scope.

The catch, confirmed by reading the real code first: src/app/teacher/[phase]/page.tsx has no
top nav bar at all today -- no wordmark, no Home link, no GCSE/Post-16 switcher, no Account
menu. ControlBar.tsx is the only header-ish thing on that page, and its chrome prop (rendered
by TeacherChrome.tsx) currently carries the theme toggle, Export, and a plain "All dashboards"
link together. So this is building the nav bar the wireframe already specifies, for the first
time, with the theme toggle landing in it as the one real fix -- not just moving a button.

Real locations I confirmed by reading the code before writing the brief (verify yourself too):
page.tsx already imports PHASE_LABELS/TEACHER_PHASES/TeacherPhase from teacher-view-phases,
already calls fetchOnboardedPhases (~line 182) so you know which phases this school actually
has, already holds theme/setTheme from useTeacherTheme(). TeacherChrome.tsx renders the theme
toggle + Export as one inseparable pair today -- split it so the toggle can render standalone
in the new nav and Export standalone in ControlBar's chrome, without forking the underlying
hook/print-effect/localStorage logic into two copies. HomeCard.tsx exports PhaseGlyph({phase}),
the real icon already used for GCSE/Post-16 on the Teacher home page's tiles -- reuse it
directly for the switcher, don't redraw it (same "one icon everywhere" fix Guy already asked
for once on the subject chips). teacher-view-theme.ts's PHASE_ACCENT gives ks4/ks5 hex+rgb;
ControlBar.tsx's own qualification badge already derives its tint as
rgba(var(--accent-rgb,...),0.14) off this same accent -- derive each phase tab's active
background the identical way rather than hand-picking a hex (the wireframe's own Post-16 tint
was an unverified eyeball guess, flagged as such -- this removes the guess). teacher-view-
data.ts's ColumnState/readSetting/writeSetting plus the setColumnSetting callback already in
page.tsx (used today for SHARED_MEASURE_KEY) is the real per-user settings path, backed by the
real teacher_view_preferences table -- give the label-visibility toggle a new key the same way
(e.g. "nav.labelsOn") and persist through this exact path, not localStorage, so it follows a
teacher across devices. account/page.tsx has the real supabase.auth.signOut() call (~line
204) behind its existing "Log out" button -- reuse it for the new dropdown's "Log Out" row;
link "Your Account" straight to /account.

Build a new shared component (TeacherNav.tsx reads right, but match whatever convention
components/teacher/ already uses) rendered above ControlBar on page.tsx. Left to right: VicData
wordmark; a gap; Home icon+label link to /teacher (plain 2x2 grid icon); a thin 1px divider
(#262626); the phase switcher -- one tab per onboarded phase only (reuse the onboarded-phases
data the page already fetches), icon+label via PhaseGlyph/PHASE_LABELS, current phase shown
active with the derived rgba tint, others muted -- if only one phase is onboarded, use your
judgement on whether a one-item switcher is worth rendering vs. plain non-interactive context,
and say which you did; the label-visibility toggle (small three-lines icon, labels default ON,
persisted per the settings path above, one toggle covering Home's label and every tab's label
together); another thin divider; the Account button (circular icon, dropdown with "Your
Account" -> /account and "Log Out" -> real sign-out, closed by default, opens on click like
the app's other popovers); then the theme toggle immediately after Account -- the actual fix
this round is for.

In page.tsx, wherever TeacherChrome feeds ControlBar's chrome, keep only Export -- drop the
theme toggle (moved) and drop the "All dashboards" link (the new Home icon replaces it; having
both is two ways to do the same thing a few pixels apart).

Visual language, matched to the wireframe rather than invented fresh: ~34px-tall icon+label
rows, 12px/700 label text, 15-17px icons, #7a7a7a muted foreground for inactive items, #1c1c1c
circular backgrounds for the Home/Account/theme icon buttons, ~10px gaps within a cluster,
~14px between clusters. Adjust anything that doesn't sit well against the app's real existing
spacing scale once it's in context -- the wireframe is a guide, not a pixel-locked spec.

Out of scope: /teacher (home/phase-picker), /teacher/recruitment, /teacher/meetings -- none of
them have this nav either, whether they get it later is a separate future call, don't touch
them now.

Verify: nav renders correctly on every onboarded phase with the right one active; theme
toggling from the new position does exactly what it does today, same persistence, same print
behaviour (light-forced beforeprint, restored afterprint) -- confirm from both a light- and
dark-mode start; Export alone in the control bar still produces the same output; label toggle
persists across a reload and ideally a second session for the same teacher; "Your Account"/
"Log Out" do the same real things their existing counterparts do; the three other teacher
pages are unchanged -- confirm with a diff.

Build report: new component + every file touched, how TeacherChrome was split and confirmation
nothing duplicated between its two render sites, which way you went on the single-onboarded-
phase question and why, the verification above, confirmation the other three pages are
untouched. Commit and push, vicdata_public only.

This is a first real pass to react to and fine-tune live against, not a final pixel spec --
say so in the build report too.
