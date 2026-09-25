# Build the teacher dashboard's top nav bar, and move the theme toggle into it

Wireframed across several rounds on the Redesign.dc.html canvas board, then proven out at phone width too (NavPhone.dc.html, a two-row layout). Once the phone version settled, Guy compared it back against the desktop wireframe for consistency and found four real differences: the theme toggle lives in the control bar on desktop but in the top nav (right after Account) on phone; the GCSE/Post-16 switcher is a full tablist on desktop but a dropdown on the phase badge on phone; Export exists on desktop but was deliberately dropped on phone; and "±" edit-subjects is a standalone button on desktop but a row inside the subject dropdown on phone. His call: only the first one is worth fixing — "lets just do #1" — the other three are intentional, space-driven differences between the two widths, not bugs.

**The catch, confirmed by reading the real code before writing this brief**: `/teacher/[phase]/page.tsx` doesn't have a top nav bar at all today. There's no VicData wordmark, no Home link, no GCSE/Post-16 switcher, no Account menu anywhere on that page — `ControlBar.tsx` is the only header-ish thing it has, and its `chrome` prop (rendered by `TeacherChrome.tsx`) currently carries the theme toggle, Export, and a plain "All dashboards" text link, all together. So this round isn't "move a button" — it's building the nav bar the wireframe has already fully specified, for the first time, and landing the theme toggle in it as the one real fix.

## Real locations, confirmed by reading the code before writing this (verify directly yourself too)

- `src/app/teacher/[phase]/page.tsx` — the page. Already imports `PHASE_LABELS`, `TEACHER_PHASES`, `type TeacherPhase` from `@/lib/teacher-view-phases`; already calls `fetchOnboardedPhases` (~line 182) to know which phases this school has actually onboarded; already holds `theme`/`setTheme` from `useTeacherTheme()`; already renders `<ControlBar ... chrome={<><TeacherChrome theme={theme} onTheme={setTheme} /><Link href="/teacher">All dashboards</Link></>} />` (~line 1026-1041). The new nav goes above `ControlBar` in this same return block.
- `src/components/teacher/TeacherChrome.tsx` — today renders the theme toggle and Export as one inseparable pair off `useTeacherTheme()`. Split it: the theme toggle needs to render standalone in the new nav, Export needs to stay in `ControlBar`'s `chrome`, and neither should fork the underlying logic (the `beforeprint`/`afterprint` theme-forcing effect, the `vicdata.teacher.theme` localStorage read/write) into two copies.
- `src/components/teacher/HomeCard.tsx` — exports `PhaseGlyph({ phase })`, the real icon already used for GCSE/Post-16 on the Teacher home page's own tiles. Reuse it directly for the switcher rather than redrawing the glyph — this is the same "one icon for one thing everywhere" fix Guy already asked for once on the subject chips ("we discussed importance of consistency").
- `src/lib/teacher-view-theme.ts` — `PHASE_ACCENT` (`ks4: {hex:"#34d399", rgb:"52,211,153"}`, `ks5: {hex:"#a78bfa", rgb:"167,139,250"}`). `ControlBar.tsx`'s own qualification badge already derives its tinted background as `rgba(var(--accent-rgb,...),0.14)` off this same accent — use the identical `rgba(accent.rgb, 0.14)` derivation for each phase tab's active background, rather than a hand-picked hex. (The wireframe's own Post-16 active-state tint was an unverified eyeball guess, flagged as such at the time — deriving it the same way the badge already does removes the guess entirely.)
- `src/lib/teacher-view-data.ts` — `ColumnState`, `readSetting`/`writeSetting`, and the `setColumnSetting` callback already in `page.tsx` (used today for `SHARED_MEASURE_KEY`) are the real per-user settings-persistence path, backed by the real `teacher_view_preferences` table and `savePreferences`. Give the nav's label-visibility toggle a new key the same way (e.g. `"nav.labelsOn"`) and persist through this exact path — not localStorage, not component state alone — so it follows a teacher across devices, which is what the wireframe's own note for this toggle asks for.
- `src/app/account/page.tsx` — the real `supabase.auth.signOut()` call (~line 204) behind its existing "Log out" button. Reuse the same call for the new dropdown's "Log Out" row; link "Your Account" straight to `/account`.

## What to build

A new shared component — name it however it fits the existing `components/teacher/` conventions; `TeacherNav.tsx` reads right — rendered at the top of `/teacher/[phase]/page.tsx`, above `ControlBar`. Left to right:

- The VicData wordmark.
- A gap, then a Home icon+label link to `/teacher` (a plain 2x2 grid "dashboard" icon, nothing fancier — it's just the way back to the phase-picker home screen).
- A thin 1px vertical divider (`#262626`).
- The phase switcher: one tab per phase this school has actually onboarded (reuse the onboarded-phases data the page already fetches — don't offer a phase nobody's set up), each tab icon+label using `PhaseGlyph` and `PHASE_LABELS`, the current route's phase shown active (filled `rgba(accent.rgb,0.14)` background, accent-coloured icon and text), any other muted. If a school only has one phase onboarded, use your judgement on whether a one-item "switcher" is worth rendering at all versus just showing that phase's icon+label as plain, non-interactive context — say which you did and why.
- The icon/label visibility toggle (small three-lines icon), labels default ON, persisted per the settings path above, applying to the Home link's label and every switcher tab's label together — one toggle, not per-item.
- Another thin divider.
- The Account button: circular icon, opens a small dropdown with "Your Account" (→ `/account`) and "Log Out" (the real sign-out call above). Closed by default, opening on click like the app's other popovers.
- The theme toggle, immediately after Account — this is the one substantive move this brief is actually asking for. Split `TeacherChrome.tsx` so its theme-toggle half can render standalone here (same hook, same print effect, same storage key) without Export coming along with it.

In `page.tsx`, wherever `TeacherChrome` is invoked for `ControlBar`'s `chrome`, keep only Export. Drop the theme toggle from there (it's moved) and drop the "All dashboards" text link — the new Home icon in the nav already covers that, and having both would just be two ways to do the same thing sitting a few pixels apart.

Match the wireframe's visual language rather than inventing new tokens: roughly 34px-tall icon+label rows, 12px/700 label text, 15-17px icons, `#7a7a7a` muted foreground for inactive items, `#1c1c1c` circular backgrounds for the Home/Account/theme icon buttons, ~10px gaps within a cluster and ~14px between clusters. If any of that doesn't sit well against the app's actual existing spacing scale once you're looking at it in context, adjust — the wireframe is a guide, not a pixel-locked spec.

**Explicitly out of scope this round**: `/teacher` (the home/phase-picker page), `/teacher/recruitment`, and `/teacher/meetings` are untouched. None of them currently have this nav either, and whether they should get it later is an open question for a future round, not this one.

## Verify

- The nav renders identically in structure on every onboarded phase's dashboard, with the correct phase always shown active.
- Theme toggling from the new nav position does exactly what it does today — same effect, same persistence, same print behaviour (forces light on `beforeprint`, restores on `afterprint`). Confirm by exporting/printing from both a light- and dark-mode start.
- Export, now alone in the control bar, still produces the same output as before this change.
- The label-visibility toggle persists across a reload, and — if you can test it — across a second session for the same teacher, not just the current browser tab.
- "Your Account" and "Log Out" in the new dropdown do the same real things their existing counterparts already do elsewhere in the app.
- `/teacher`, `/teacher/recruitment`, and `/teacher/meetings` are unchanged — confirm with a diff, not just by not having opened them.

## Deliverable

Build report: the new component and every file touched, how `TeacherChrome` was split (and confirmation nothing duplicated the theme-toggle logic between the two places it now renders), which way you went on the single-onboarded-phase switcher question and why, confirmation of the verification above, and confirmation the other three teacher pages are untouched. Commit and push, `vicdata_public` only.

Guy's plan from here is to get this built and then fine-tune it live rather than iterate further on the static wireframe — treat this as a first real pass to react to, not a final pixel spec.
