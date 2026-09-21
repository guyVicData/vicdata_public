# Teacher view — home page: personal greeting + correct card wording (Round D)

## Why this brief exists

Live side-by-side review with Guy (his own words: "my home dashboard says 'how well do
they do in each of my subjects' — the old wording"). Two real gaps found comparing the
live `/teacher` page against `Home.dc.html`, both confirmed against the real code:

## 1. Card description wording is wrong

Live: both GCSE and Post-16 cards show "How well do they do in each of my subjects?" —
identical text on both cards. This is `PHASE_QUESTIONS[phase].howWell`
(`src/lib/teacher-view-phases.ts`), the first-person dashboard-heading text, reused here
by mistake. Home.dc.html's card copy is different text, phase-specific, addressed to the
teacher:

- GCSE: "How well do **pupils** do in each of **your** subjects?"
- Post-16: "How well do **students** do in each of **your** subjects?"

Add this as its own copy, separate from `PHASE_QUESTIONS` (e.g. a small
`PHASE_HOME_CARD_DESCRIPTION` record in `teacher-view-phases.ts` or inline in
`src/app/teacher/page.tsx`) — don't overload `PHASE_QUESTIONS.howWell` to serve both the
dashboard heading and the home card, since the two are deliberately worded differently
and will need to diverge further later. Recruitment and Meetings copy already matches
the mockup exactly — leave those untouched.

## 2. The personal greeting is missing

Home.dc.html's actual top-of-page structure, in order: a name-as-headline greeting
("Guy Beckett", 22px bold) with the school name underneath it (13px, muted) — THEN,
separately below that, "What would you like to look at?" (16px, weight 600, muted, not
a page heading). The live build currently has none of the greeting: "What would you
like to look at?" is the page's only heading (`<h1>`), with the school name as its
direct subline.

The real name is available: `profiles.full_name` (confirmed live — populated at
sign-up in `src/app/join/[urn]/page.tsx`, and already read the same way
`src/app/account/page.tsx` reads it: `profiles(email, full_name)`, falling back to
email when `full_name` is null). `src/app/teacher/page.tsx` already fetches the
session and could fetch `full_name` for the signed-in user's own profile alongside the
existing school-membership lookup.

Target structure for `src/app/teacher/page.tsx`:
- Greeting line: the signed-in user's `full_name` (fall back to their email if
  `full_name` is null, same pattern `account/page.tsx` already uses — never show
  nothing here).
- School name directly under it, small and muted (this is the school-name line that
  already exists in the code today — just move it under the new greeting rather than
  under a generic heading).
- "What would you like to look at?" as its own line below that, no longer doing double
  duty as the page's only heading.

## What NOT to touch

The card list styling, icons and colours from Round A — this is wording and the
greeting header only. Recruitment/Meetings copy. The `phases.length === 0` empty-state
branch — check its heading still reads sensibly once the greeting is added above it, but
don't rewrite its content.

## Verification

Live, both themes: confirm the greeting shows the real signed-in name (not a hardcoded
placeholder), the school name sits under it, "What would you like to look at?" is a
separate line beneath both, and GCSE/Post-16 cards now show their distinct, phase-correct
description text.
