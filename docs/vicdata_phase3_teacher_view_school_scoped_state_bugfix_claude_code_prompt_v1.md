Read `docs/vicdata_phase3_teacher_view_school_scoped_state_bugfix_brief_v1.md` in full before starting — it has the confirmed root cause, found by reading the real code, not guessed.

## The bug, in one sentence

`teacher_view_onboarding` and `teacher_view_notes` are missing `school_urn` in their schema and their queries, unlike `teacher_view_preferences` which already does this correctly — so onboarding completion (and the subject picker embedded inside it) and personal notes silently follow a person between schools instead of resetting per school.

## Fix

1. Migration: add `school_urn text not null` to `teacher_view_onboarding`; change its key to `(profile_id, school_urn, phase)`. Backfill the one existing row with that profile's current school (via `school_memberships` → `school_accounts`), don't drop it.
2. Migration: add `school_urn text not null` to `teacher_view_notes`; change its key to `(profile_id, school_urn, chart_key)`. Same backfill treatment for its one existing row.
3. `fetchOnboardedPhases` and `completeOnboarding` (`src/lib/teacher-view-data.ts`) take a `schoolUrn` parameter and scope every query/upsert by it, exactly matching how `fetchPreferences`/`savePreferences` already do it. Update the call sites in `src/app/teacher/[phase]/page.tsx`.
4. `fetchNote`/`saveNote` take a `schoolUrn` parameter and scope by it the same way. Update the four `NoteBox` call sites in the same file.
5. Don't touch RLS — `profile_id = auth.uid()` is still correct and sufficient; this is purely about which rows get queried and written.

## Verification — real schools, real round trip

Using the real testing switcher (`ENABLE_TESTING_SCHOOL_SWITCHER`), move the account between at least two real schools of visibly different types. At each: confirm the onboarding walkthrough runs again in full, including the subject picker, with nothing pre-ticked; confirm a note written at one school doesn't appear at the other. Then switch back to the first school and confirm ITS onboarding, subjects, and notes are exactly as left — this must be correct persistence per school, not a reset-every-time hack. Name the two real schools you tested and what you saw at each step.

## Also in this pass: account page needs a Teacher View link

Small, separate, self-contained change while you're in this area — no brief needed, the ask is precise.

In `src/app/account/page.tsx`, the per-membership card currently renders one link (around line 253-257):

```tsx
{membership.status === "approved" && (
  <p className="mt-2 text-sm">
    <Link href={`/schools/${account.school_urn}/data`} className="underline">
      Open Data View
    </Link>
  </p>
)}
```

Change to two links, in this order:

1. **"Open Teacher View"** — new, placed above the existing link.
2. **"Open Advanced Dashboard"** — the same link that currently exists, just relabelled (the destination `/schools/${account.school_urn}/data` doesn't change).

**Before wiring the new link, check this:** `/teacher` (`src/app/teacher/page.tsx`) currently resolves which school to show by querying the caller's own `school_memberships` row directly — it doesn't take a school URN. That's fine today because a profile only ever has one membership (the testing switcher enforces this). But this card is rendered per-membership, and the existing Data View link is explicitly scoped to `` `/schools/${account.school_urn}/data` `` — the Teacher View link should follow the same explicit pattern if it's easy (e.g. `/teacher?school=${account.school_urn}` or a path param, whichever fits the existing routing with least disruption), so this card stays correct if multi-school membership is ever built, rather than silently relying on "there's only one membership" holding forever. If adding that is more than a trivial change, it's fine to link to plain `/teacher` for now and log a one-line note in `docs/vicdata_phase3_teacher_view_open_questions_v1.md` (continue the Q-numbering) flagging that the link isn't school-scoped the way its sibling is — don't turn this into a bigger change than asked for.

This makes switching schools easier to test (the whole point of the fix above): confirm "Open Teacher View" actually lands on that school's Teacher view using the real testing switcher against at least one school, and confirm "Open Advanced Dashboard" still goes to the same place it always did, with both labels rendering in the stated order.

## Scope

This is a narrow, surgical round — two persistence tables, four functions and their call sites, one migration each, plus the small account-page link change above. Don't expand into anything else in the Teacher view build while you're in these files. If you notice something else that looks similarly wrong while you're in here, log it in `docs/vicdata_phase3_teacher_view_open_questions_v1.md` (continue the Q-numbering) rather than fixing it unasked.

Commit and push once verified.
