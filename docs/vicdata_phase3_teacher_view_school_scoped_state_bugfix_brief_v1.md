# VicData Phase 3 — Teacher view: onboarding and notes must be scoped per school (bugfix brief v1)

*Corrected after the fix shipped (commit `418d49f`) — see the note at the end. The brief below is left as originally written for the diagnosis and fix design, which were both correct; only two factual details in the "one existing row" claim and the call-site list were wrong, and are corrected in the note rather than silently edited away.*

## What's broken, confirmed against real code

Two persistence tables use the wrong key, both missing `school_urn`:

**`teacher_view_onboarding`** — schema is `(profile_id, phase)` only, no `school_urn` column at all. `fetchOnboardedPhases` (`src/lib/teacher-view-data.ts:16`) selects with no school filter; `completeOnboarding` upserts on `onConflict: "profile_id,phase"`. Compare to `teacher_view_preferences`, which correctly scopes every query by `.eq("school_urn", schoolUrn)` and upserts on `"profile_id,school_urn,phase"` — the onboarding table was simply never given the same treatment.

**Consequence, confirmed against the actual walkthrough logic** (`src/app/teacher/[phase]/page.tsx`): the subject picker ("Which subjects do you teach?", line ~322) lives *inside* the `if (!onboarded)` walkthrough, not as a separate step. Since `onboarded` is derived from the unscoped `fetchOnboardedPhases`, completing a phase's onboarding at one school marks that phase "done" everywhere. Switching to a new school (via the testing switcher or a real membership) skips the walkthrough entirely — including the subject picker — and the dashboard renders with whatever's in `teacher_view_preferences` for that school, which is correctly empty for a school never onboarded there, so it opens with nothing ticked and no prompt to fix it. This is the single cause of both symptoms reported: "onboarding cards only show once" and "subjects don't reset when I switch schools."

**Same mistake, found while investigating:** `teacher_view_notes` keys on `chart_key` alone (e.g. `"ks4:results"`, built in `[phase]/page.tsx`), with no `school_urn` in the table or the key. A note written at one school would silently reappear at any other school on the same phase/card.

The testing school-switcher itself (`src/app/api/testing/switch-school/route.ts`) is not part of this bug — it correctly gives the calling profile a fresh, real, approved membership at the target school. It's exactly the mechanism Guy wants for testing across many real schools; it just inherits the onboarding/notes bug rather than causing it.

## The fix

1. **Migration**: add `school_urn text not null` to `teacher_view_onboarding`, change its primary key/unique constraint to `(profile_id, school_urn, phase)`. There is exactly one existing row in production — backfill it with that profile's current `school_urn` (resolved via their current `school_memberships` → `school_accounts` join) rather than dropping it silently.
2. **Migration**: add `school_urn text not null` to `teacher_view_notes`, change its key to `(profile_id, school_urn, chart_key)`. Same backfill treatment for the one existing row.
3. **Code**: `fetchOnboardedPhases` and `completeOnboarding` take a `schoolUrn` argument, scope every query/upsert by it, matching the existing pattern in `fetchPreferences`/`savePreferences`. Update both call sites in `[phase]/page.tsx`.
4. **Code**: `fetchNote`/`saveNote` take a `schoolUrn` argument and scope by it the same way; update the four `NoteBox` call sites.
5. RLS policies (`profile_id = auth.uid()`) don't need to change — the fix is entirely about which rows the app queries and writes, not who can see them.

## Verification

Use the real testing switcher to move the same account between at least two real schools of different types (an independent boarding senior school and a sixth-form college would be a good pair, given the design's differing card sets). At each school, confirm: the onboarding walkthrough (including the subject picker) genuinely runs again; ticked subjects are empty until set; a note written at one school does not appear at the other. Then switch back to the first school and confirm its onboarding/subjects/notes are still exactly as left — this is a scoping fix, not a reset-on-every-visit fix, so the first school's state must persist correctly across the round trip.

## Corrections found by the build (commit `418d49f`, logged as Q21 in `docs/vicdata_phase3_teacher_view_open_questions_v1.md`)

Two things above were wrong, caught by Claude Code during the actual fix, not by this brief:

- **Row count**: there were **two** existing rows in each table, not one — `teacher_view_onboarding` had rows for `ks4` and `ks5`; `teacher_view_notes` had `ks4:results:Biology` and `ks5:results`. All four backfilled correctly via the profile's approved membership; nothing was dropped. The "one existing row" claim above was simply an undercount from checking the data less carefully than the build did.
- **Call sites**: this brief's fix instructions (§3) named only `[phase]/page.tsx` for `fetchOnboardedPhases`. Two more call sites existed — `src/app/teacher/page.tsx` and `src/app/teacher/meetings/page.tsx` — missed here entirely. They were caught safely because the build made the new `schoolUrn` parameter **required** rather than optional-with-a-default, so the TypeScript compiler surfaced every call site that needed updating. Worth carrying forward as a general rule: when threading a new required scoping parameter through a function, prefer making it required over optional-with-a-default specifically so the type checker catches every call site, rather than relying on the brief's own call-site list being exhaustive.

Both corrections were verified independently against the real repo and the real open-questions log before being recorded here.
