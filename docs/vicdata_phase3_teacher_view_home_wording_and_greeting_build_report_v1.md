# Teacher view — home page: personal greeting + correct card wording (Round D) — build report

Covers `vicdata_phase3_teacher_view_home_wording_and_greeting_brief_v1.md`. Two files changed: `src/app/teacher/page.tsx` and `src/lib/teacher-view-phases.ts` (additions only).

Untouched: Round A's card styling, icons and colours (`HomeCard.tsx` unchanged); the Recruitment and Meetings copy; the empty-school branch's content; and `PHASE_QUESTIONS` itself, which still heads the dashboard (`[phase]/page.tsx` is its only remaining user).

## 1. Card wording

A new `PHASE_HOME_CARD_DESCRIPTION` record sits beside `PHASE_QUESTIONS` in `teacher-view-phases.ts`. The home cards now use it instead of `PHASE_QUESTIONS[phase].howWell`:

- GCSE: "How well do pupils do in each of your subjects?"
- Post-16: "How well do students do in each of your subjects?"

Both are literal from `Home.dc.html`. **Flagged:** KS2 is not in the mockup, but the record needs an entry. It uses the existing KS2 question addressed to the teacher the same way: "How well do your pupils do in each area?" Reword freely.

## 2. Greeting

The page now reads the signed-in user's own `profiles` row (`email, full_name`, allowed by the existing `profiles_select_own` policy), alongside the membership lookup. The greeting is `full_name`, falling back to the profile email and then the auth email: the same `full_name || email` order `account/page.tsx` uses, with one extra fallback. For a signed-in user it is therefore never blank. With no session, the existing "Sign in…" error shows instead.

The top of the page is now in Home.dc.html's order:
1. the name as the page's `<h1>` (22px, bold);
2. the school name directly under it (13px, `--muted`): the existing line, moved;
3. "What would you like to look at?" as its own line 22px below (16px, weight 600, `--muted2`), now a plain paragraph rather than a heading.

The empty-school state's own heading, "Why is Teacher view empty for this school?", is an `<h2>` inside its panel, so it still reads correctly under the greeting. Its content is unchanged.

## Worth knowing before the live check

Only **one** profile in the entire `profiles` table has a `full_name` set, and the preview profile (`preview-agent@vicdata.co.uk`) is not it. Signed in through the preview link, the greeting will correctly show `preview-agent@vicdata.co.uk`, the fallback. The real-name case is only visible from the one account that has a name. If more names are wanted, that is a data or sign-up question, not a page one: `join/[urn]/page.tsx` writes `full_name` at sign-up, so accounts created another way have none.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on all Teacher view files and libs; `next build` passes.

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, in both themes:
1. the greeting shows the signed-in name (or, for the preview profile, its email);
2. the order is name → school → "What would you like to look at?";
3. the GCSE and Post-16 cards show their distinct new descriptions.
