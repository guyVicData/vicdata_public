# Teacher view top nav: build report (v1)

Brief: `vicdata_phase3_teacher_view_dashboard_top_nav_build_brief_v1.md`. First pass, meant to be fine-tuned live.

## Real locations checked before building

Every location the brief names is real and matches its description:

- `src/app/teacher/[phase]/page.tsx`: `useTeacherTheme()` is there. `fetchOnboardedPhases` is called in the loader, but its result was only used for `done.includes(phase)`, so it's now also kept in state (`onboardedPhases`). The `ControlBar` `chrome` prop carried `TeacherChrome` plus "All dashboards".
- `TeacherChrome.tsx`: the toggle and Export were one pair. **It is also used by `/teacher/recruitment` and `/teacher/meetings`**, and `/teacher` uses `useTeacherTheme`. That's why the split keeps `TeacherChrome` working as before (see below).
- `HomeCard.tsx` `PhaseGlyph`, `teacher-view-theme.ts` `PHASE_ACCENT`, `teacher-view-data.ts` `readSetting`/`writeSetting` → `savePreferences`, and the `account/page.tsx` `supabase.auth.signOut()` → `router.push("/")` all match.
- Live schema (Supabase `vicdata-public`): `teacher_view_preferences.columns` is `jsonb`, and there's one row per (profile, school, **phase**). No migration needed.

**Two places where the brief's grounding is wrong or incomplete:**

1. **"The page has no top nav bar at all" is not quite true.** The site-wide `NavBar` (`src/app/layout.tsx`) renders above every page, this one included. Adding TeacherNav as-is would have stacked two VicData wordmarks and two Account links. See decision §N1.
2. **The settings path is per phase.** A label toggle written only to the current phase's row would flip back when you use the nav's own phase switcher. See decision §N2.

## What was built

**New: `src/components/teacher/TeacherNav.tsx`.** Rendered above `ControlBar`, it's one row, left to right:

1. VicData wordmark (→ `/`).
2. Home link (2x2 grid icon in a circle, → `/teacher`).
3. Divider.
4. Phase switcher (`PhaseGlyph` + `PHASE_LABELS`, links to `/teacher/{phase}`, `aria-current` on the active one).
5. Three-lines label toggle.
6. Divider.
7. Account button with its dropdown ("Your Account" → `/account`, "Log Out" → the same `signOut()` + `router.push("/")` as the account page).
8. Theme toggle (circular sun/moon).

How it matches the wireframe:

- **Active phase tab:** `rgba(accent.rgb, 0.14)` background with accent icon and text, the same derivation as ControlBar's badge. Inactive tabs use `--muted`.
- **Colours are Teacher view tokens, not the wireframe's hexes,** because the wireframe was drawn dark-only. `--muted` stands in for #7a7a7a, `--panel-bg` for #1c1c1c and `--panel-border2` for #262626. In dark mode these land within a few shades of the wireframe, and they also work in light mode.
- **Sizes:** 34px rows, 12px/700 labels, 16px icons (`PhaseGlyph` is scaled from 20px by its wrapper, not forked), 10px gaps inside a cluster and 14px between clusters.
- **Account dropdown:** reuses `PanelMenu`/`useDismiss`, so Escape and click-outside behave like every other popover.
- **The nav is `print:hidden`.**

**Single-onboarded-phase switcher: shown as plain context.** A school with one onboarded phase sees that phase's icon and label, in the same active styling, as a non-interactive `<span>` rather than a one-tab switcher. A tab that can only lead back to the page you're already on looks clickable but does nothing. Keeping the active styling means the nav reads the same at either count. The switcher lists only onboarded phases (plus the current one, as a guard), in `TEACHER_PHASES` order.

**Label toggle persistence.** It uses the new key `NAV_LABELS_KEY = "nav:labels"` in `teacher-view-data.ts`, following the existing `prefix:` convention rather than the brief's example `nav.labelsOn`. Labels default ON, so only `"off"` is stored, the same "absent means default" rule the column keys use.

- It's written through `setColumnSetting`, which goes through `teacher_view_preferences` / `savePreferences`. It isn't stored in localStorage.
- Because of §N2 it is **also written to every other onboarded phase's row**, using the same read-modify-write pattern.
- One toggle controls the Home label and every phase label together.

**`TeacherChrome.tsx` split.** It now exports three pieces:

- `ThemeToggle({ theme, onTheme, variant })`: the only copy of the click handler, the aria label and the `beforeprint`/`afterprint` effect. `variant` changes only its appearance (`"text"` is the old Light/Dark button, `"icon"` is the nav's circle).
- `ExportButton`: `window.print()`, unchanged.
- `TeacherChrome`: now just `<ThemeToggle/><ExportButton/>`, rendering the same markup as before for Recruitment and Meetings.

The `vicdata.teacher.theme` storage key and `useTeacherTheme` are untouched and still defined once. Nothing is duplicated between the nav and the control bar.

The print effect lives in `ThemeToggle` because it depends only on `theme`, and every page that owns a theme renders the toggle. CSS `print:hidden` hides the button but the component stays mounted, so the effect still runs.

**`page.tsx`.** It renders `<TeacherNav>` above `ControlBar`, and `chrome={<ExportButton />}`. The theme toggle moved to the nav and the "All dashboards" link was dropped.

**`NavBar.tsx`.** It returns `null` on `/teacher/(ks2|ks4|ks5)` only (see §N1). The route list is written out in `NavBar.tsx` rather than importing `TEACHER_PHASES`, because that module imports the academic data layer and would pull it into every page's bundle.

## Files touched

- `src/components/teacher/TeacherNav.tsx` (new)
- `src/components/teacher/TeacherChrome.tsx`
- `src/app/teacher/[phase]/page.tsx`
- `src/lib/teacher-view-data.ts`
- `src/components/NavBar.tsx`

## Verification

- **Done:**
  - `tsc --noEmit` is clean.
  - `eslint` is clean on every touched file.
  - `next build` succeeds.
  - `git diff HEAD -- src/app/teacher/page.tsx src/app/teacher/recruitment src/app/teacher/meetings` is empty: those three pages are unchanged. They still import the same `TeacherChrome`, `useTeacherTheme` and `Theme` exports, and `TeacherChrome` still renders the same two buttons with the same classes. The only markup difference is that Export also carries `print:hidden` itself; it was already hidden in print by its wrapper.
- **Not done, so still to check live:** I couldn't look at the page in a browser. Localhost is behind the Basic Auth gate plus Supabase sign-in, and the passwordless preview route (`PREVIEW_ACCESS_ENABLED`) isn't enabled locally. Entering a credential is off-limits for me. These checks still need a live pass:
  - The nav renders on each onboarded phase's dashboard with the correct phase active.
  - Theme toggle and print from both a light and a dark start: light is forced for print and the theme is restored afterwards.
  - Export output is unchanged.
  - The label toggle survives a reload and a second session.
  - Your Account and Log Out work.

  The code paths for these are the existing ones, reused rather than rewritten, but none of them has been checked by eye.

## Open decisions

- **§N1: site-wide NavBar on the phase dashboards.** Finding: layout's `NavBar` already renders above `/teacher/[phase]` (wordmark, Sets, Home → `/member`, Account). Options:
  - (a) Hide it on the phase dashboards. **This is what I built.** The cost is that the "Sets" link is lost on those pages. So is the sign-in path on the "Sign in to see this dashboard" error screen, which now only has "Back".
  - (b) Keep both bars stacked.
  - (c) Keep the site bar and drop TeacherNav's wordmark.

  Recommendation: (a) for now, and revisit when TeacherNav comes to `/teacher`, Recruitment and Meetings. It's a one-line revert in `NavBar.tsx`.
- **§N2: label toggle scope.** Finding: preferences are per phase. I built it to write to every onboarded phase's row, so the toggle behaves as one setting. The alternative is to keep it per phase (only the current row). Recommendation: keep the current behaviour. A phase onboarded *after* the toggle was switched off starts with labels on, which is a small, harmless edge case.
- **§N3: Account and theme placement.** I built exactly the brief's order: one left-packed row, with Account and theme straight after the second divider. A more conventional layout would push the divider, Account and theme to the right edge. It's a one-class change if you'd prefer it once you've seen it live.
