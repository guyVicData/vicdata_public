Extends the top-nav round (d3b5db3, 2edfd0a, 92b4afc) to the three teacher pages that were
explicitly out of scope for it: /teacher (home), /teacher/recruitment, /teacher/meetings.
Right now all three still show the OLD sitewide src/components/NavBar.tsx (VicData wordmark,
Sets, member-Home/Account or Join/Login) instead of TeacherNav, and Recruitment/Meetings each
additionally render their own small `<TeacherChrome theme={theme} onTheme={setTheme} />` +
"All dashboards" link in their own header row (Home has neither -- no theme toggle anywhere on
it today).

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
  p === phase` comparison already does the right thing when `phase` is null -- nothing matches,
  every tab renders muted, none needs new logic) rather than forking the component.
- The label-visibility toggle's persistence (src/lib/teacher-view-data.ts's
  readSetting/writeSetting/setColumnSetting path, keyed per (profile_id, school_urn, phase) in
  teacher_view_preferences) was made to work on the phase dashboard by writing the same
  `nav.labelsOn`-style key into every onboarded phase's row. These three pages have no phase of
  their own to key off either -- reuse the identical approach: fetch the onboarded-phases list
  (add it to Recruitment, it's missing there) and read/write the setting across all of them the
  same way the phase dashboard already does, rather than inventing a second storage path.

What to build: render TeacherNav at the top of all three pages in place of what they show
today. Drop Recruitment/Meetings' own `TeacherChrome` + "All dashboards" (TeacherNav's Home
icon already covers that, same reasoning as the original round). On the phase switcher: your
call, but here's the reasoning either way -- Home's own tile list already IS a phase picker,
richer than the nav's small switcher (it shows onboarding state and a description per phase),
so a second picker in the nav above it reads as redundant; Recruitment and Meetings have no
such picker today, only the two-step "All dashboards" detour, so giving them the switcher (as
plain links, e.g. `/teacher/${p}`, letting a teacher jump straight into a phase dashboard) is a
genuine improvement, not just consistency for its own sake. My recommendation: omit the
switcher segment on Home, include it (as plain phase links, no phase ever "active" since
there's no current one) on Recruitment and Meetings. Say what you did and why if you land
somewhere else.

Verify: NavBar is now hidden on exactly six routes (the three ks-phase dashboards plus these
three) and unchanged everywhere else -- confirm Sets is still reachable from every other route.
TeacherNav renders correctly on all three pages including a working Account dropdown and theme
toggle (Home gets a working theme toggle for the first time -- confirm it doesn't fight with
the phase dashboard's own stored theme, they share the same hook/storage key so it shouldn't).
Label toggle set from any one of these pages is reflected on the others and on the phase
dashboards, and survives a reload. Confirm no changes to NavBar's behaviour on any non-teacher
route.

Build report: what you did on the phase-switcher question and why, confirmation of the
verification above, every file touched. Commit and push, vicdata_public only.
