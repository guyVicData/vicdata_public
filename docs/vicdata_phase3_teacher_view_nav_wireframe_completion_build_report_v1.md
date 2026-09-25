# Teacher view nav: wireframe completion, build report (v1)

Prompt: `vicdata_phase3_teacher_view_nav_wireframe_completion_combined_claude_code_prompt_v1.md`, three parts, one commit each:

| Part | Commit |
|---|---|
| 1. Subject chip qualification icons | `b58f653` |
| 2. TeacherNav on Home, Recruitment, Meetings | `d48e5ab` |
| 3. Phone-width nav | `a09b58a` |

## Real locations checked before building

Every location the prompt names is real and matches its description:

- ControlBar's chips had no icon.
- `qualificationFamilyOf` (teacher-view-theme) and `familyIcon` (QualificationFamilyTiles) exist.
- Home calls `useTeacherTheme` but had no toggle.
- Recruitment and Meetings rendered `TeacherChrome` plus "All dashboards".
- Recruitment never called `fetchOnboardedPhases`; Meetings did.
- NavBar hid itself only on the three phase routes.
- TeacherNav required a non-null `phase`.
- There was no phone breakpoint logic anywhere.

Three things the prompt didn't cover, found while reading the code:

1. **Hiding the site NavBar strands signed-out visitors.** On `/teacher`, Recruitment and Meetings the site NavBar is a signed-out visitor's only Log in link. Home's signed-out error has none of its own, and Recruitment and Meetings don't handle being signed out at all (they render empty lists). Handled in Part 2.
2. **Dropping `TeacherChrome` drops Export.** On Recruitment and Meetings, `TeacherChrome` also carried Export, so removing it as written would have removed Export from those pages. Handled in Part 2.
3. **`NavPhone.dc.html` isn't in the repo.** Part 3 is built from the prompt's description of it.

## Part 1: subject chip icons

The page now puts a resolved `icon` on each row it passes to ControlBar, alongside `key`, `label` and `colour`. That row type is exported as `FocusSubject`. The icon is `familyIcon(phase, qualificationFamilyOf(phase, i.qualificationType))`, resolved once per subject, so a mixed list shows each chip's own family and a GCSE-only list shows the mortarboard on every chip.

I chose to pass the finished icon rather than the family id. ControlBar would otherwise need `phase` just to look it up, and the phone subject menu (Part 3) reads the same rows, so the lookup happens in exactly one place.

`SubjectIconSquare` (exported from ControlBar) is a 16px rounded square with an 11px glyph:
- When the chip is focused, it's tinted with the chip's own `s.colour` at 0x33.
- When it isn't, it's a plain muted glyph, the same on/off rule the chip's border and text follow.
- The chip colours themselves are unchanged. The chip's left padding went from 12px to 5px so the square sits inside the pill.

## Part 2: TeacherNav on Home, Recruitment, Meetings

**TeacherNav's `phase` prop is now `TeacherPhase | null`.**
- With `null`, every switcher item is a plain link and none is active.
- With `phases={[]}`, the switcher is omitted.
- The switcher always lists phases in `TEACHER_PHASES` order.

**Phase switcher: I went with your recommendation.** Home omits it, because its tile list already is the phase picker, and a richer one. Recruitment and Meetings show it as plain `/teacher/{p}` links, none active, which replaces the old two-step "All dashboards" detour.

**Label toggle.** Two new helpers in `teacher-view-data.ts`:
- `fetchNavLabels` reads the setting from the first onboarded phase's row.
- `saveNavLabels` writes it to every onboarded phase's row.

The new `useNavLabels(urn, phases)` hook in TeacherNav.tsx wraps them for the three phase-less pages. The phase dashboard still writes its own row through its in-memory `columns` state, because a column save that later wrote a stale `columns` back would otherwise wipe the key. It now uses `saveNavLabels` for the other phases, replacing the loop it had inline. Plumbing added per page:

- **Recruitment:** now fetches onboarded phases.
- **Meetings:** keeps the URN and phases it already fetched, which it used to throw away once the bundles were built.
- **Home:** keeps its URN.

If a school has nothing onboarded there's no row to store the setting in, so the toggle lasts for the visit only.

**Pages:**
- **Home:** TeacherNav at the top. Home now has a theme toggle for the first time.
- **Recruitment and Meetings:** TeacherNav replaces `TeacherChrome` and "All dashboards". **Export stays** as a standalone `ExportButton` in their header row. Dropping it would have removed a working feature, and the phase dashboard kept Export in the same way.
- **`TeacherChrome` wrapper deleted:** nothing uses it any more. The file now exports `useTeacherTheme`, `ThemeToggle` (icon only; its text variant was unused) and `ExportButton`. The theme logic, print effect and storage key are still each defined once.

**Sign-in.** The Account menu reads the local session. When there's no session its dropdown offers "Log in" (→ `/login`) instead of "Your Account" and "Log Out", so none of the four pages that now carry TeacherNav strands a signed-out visitor. The phase dashboard's own error-screen Log in link (`2edfd0a`) is unchanged.

**NavBar** now hides on exactly six routes: `/teacher`, `/teacher/ks2|ks4|ks5`, `/teacher/recruitment` and `/teacher/meetings`. I tested the rule against 18 paths:
- Those six (and `/teacher/` with a trailing slash) are hidden.
- `/`, `/join`, `/login`, `/sets`, `/sets/comparator/new`, `/member`, `/account` and `/sources` still show it, Sets included.
- So do `/teacherx`, `/teacher/ks6` and `/teacher/meetings/x`. An invalid phase still gets the site bar on its "Unknown phase" screen.

## Part 3: phone-width nav

**Breakpoint: `sm` (640px).** It's the app's established convention: about 60 uses of `sm:` against 33 of `lg:` and 2 each of `md:` and `xl:`. Every Teacher view page's padding already switches there. The wireframe's 390–430px frame would suggest a narrower custom breakpoint, but between 430 and 640 the desktop nav would have to fit a two-group row plus a control bar with a school name and chips into about 400px. The two-row phone layout reads better across that whole band.

**The swap is CSS only**, so there's no viewport check to render wrongly on first load. On `/teacher/[phase]`:
- `<PhoneNav className="sm:hidden">` renders the phone layout.
- `<div className="hidden sm:block print:block">` wraps TeacherNav + ControlBar. PhoneNav is `print:hidden`, so a print always gets the desktop header.

**`PhoneNav`** (in TeacherNav.tsx):
- **Row 1:** wordmark on the left; icon-only Home, `AccountMenu` and `ThemeToggle` on the right; then a full-width 1px divider. There's no label toggle.
- **Row 2:**
  - **Phase badge.** It uses `PhaseGlyph` and a chevron, and opens a menu of onboarded phases. With one phase it's plain context, the same rule as the desktop switcher.
  - **`MeasureToggle`.** Extracted from ControlBar; the desktop renders the same component, and `compact` only tightens its padding.
  - **Subject focus chip, at the right edge.** It shows the focused subject's `SubjectIconSquare`, label and chevron, or "All" when nothing is focused. It opens a menu with "All subjects", every subject, a divider, then "± Edit subjects", which calls the same `setSubjectPickerOpen(true)`.
- **No Export** on phone. The per-panel export in `PanelFooter` is untouched.

**Shared, not duplicated:**
- The phase tint is one function, `activePhaseStyle`, used by the desktop tabs, the phone badge and the phone menu.
- The page computes `navPhases`, `focusSubjects`, `onSharedMeasure` and `openSubjectPicker` once and hands the same values to both layouts. Switching phase, subject or measure on phone lands in exactly the same state as on desktop.
- Both dropdowns use `PanelMenu`/`useDismiss`. A pointerdown outside closes whichever is open, so opening one closes the other.

**Other pages:** Part 3 changed nothing on Home, Recruitment or Meetings. Their phone layout is still their existing flex-wrap, and they get the desktop TeacherNav wrapping to two lines at phone width. That's the "check once this lands" item, so it's on the live list below.

## Files touched (all three parts)

- `src/components/teacher/TeacherNav.tsx`: nullable phase, `useNavLabels`, session-aware Account menu, `activePhaseStyle`, `PhoneNav`
- `src/components/teacher/ControlBar.tsx`: `FocusSubject`, `SubjectIconSquare`, `MeasureToggle` extracted
- `src/components/teacher/TeacherChrome.tsx`: `TeacherChrome` wrapper and the text variant removed
- `src/app/teacher/[phase]/page.tsx`
- `src/app/teacher/page.tsx`
- `src/app/teacher/recruitment/page.tsx`
- `src/app/teacher/meetings/page.tsx`
- `src/components/NavBar.tsx`
- `src/lib/teacher-view-data.ts`
- `src/app/globals.css`: one comment

## Verification

**Done:**
- `tsc --noEmit` is clean after each part.
- `eslint` is clean on every touched file.
- `next build` succeeds.
- The NavBar route test above.
- Structurally, desktop above `sm` is unchanged. The only differences are:
  - A wrapper div now contains TeacherNav + ControlBar.
  - The chip icon (Part 1).
  - `shrink-0` on the measure toggle, which doesn't change it at desktop widths.

**Not done:** I haven't looked at any of this in a browser. Localhost is still behind the Basic Auth gate plus Supabase sign-in, and the preview-access route isn't enabled locally. These are still to check live:

- **Part 1:**
  - A mixed-qualification school shows a different icon per chip.
  - A GCSE-only school shows the mortarboard on every chip.
  - Chip colours are unchanged.
- **Part 2:**
  - The nav on all three pages: Account dropdown, theme toggle, and the switcher links on Recruitment and Meetings.
  - Signed out, the Account menu shows Log in.
  - A label toggle set on any page shows on the others and on the dashboards, and survives a reload.
  - Sets is reachable from the non-teacher routes.
- **Part 3:**
  - At 375, 390 and 430px nothing overlaps or clips. Row 2 is the tight one: the subject chip has about 50px of label at 375px and truncates.
  - Both menus open and close correctly.
  - Phase, subject and measure changes on phone match desktop.
  - Desktop at 640px and above looks as before.
  - Per-panel export works on phone.
  - How Home, Recruitment and Meetings look at phone width.

## Open decisions

- **§P2.1: Export on Recruitment and Meetings.** The prompt said to drop `TeacherChrome` entirely, which would have dropped Export too. I kept Export on its own. Recommendation: keep it, unless those pages are meant to have no whole-page export.
- **§P2.2: Log in inside the Account menu.** For a signed-out visitor it's one tap deep, behind the account icon. The alternative is to swap the icon itself for a visible "Log in" link when signed out. Recommendation: see it live first. The swap is a small change in `AccountMenu`.
- **§P3.1: School name on phone.** ControlBar's "GCSE — {school}" line doesn't appear in the phone layout. The prompt's row 2 doesn't list it, so I took that as intended. Say if it should come back, for example as a line under row 2.
