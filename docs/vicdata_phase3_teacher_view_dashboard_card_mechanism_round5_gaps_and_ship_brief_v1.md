Read `docs/vicdata_phase3_teacher_view_dashboard_card_mechanism_round5_brief_v1.md` and the round-5 build report first — this is the follow-up, closing the gaps that build report logged in `docs/OPEN_QUESTIONS.md`, then shipping.

## Context

The round-5 build report surfaced something important: round 4 (box-per-view, fullscreen toggle, share icon, "Edit this view" link) was never actually built into the real app — it only ever existed in the design mockups. Round 5 is therefore the first real build of the card mechanism, not an upgrade of a live one. The real catalogue turned out simpler than the brief assumed: the same five comparisons for every ticked subject in three of the four columns, and no menu at all in Rankings, before this round's work.

Guy has reviewed the build report and wants everything it flagged built now, then committed and pushed in one stage so both of you can review it on the live site — per the usual working pattern (`docs/OPEN_QUESTIONS.md`/ways-of-working: "Guy prefers to test on the live site while developing, rather than reviewing purely local builds before shipping," and build-through-push can be rolled into a single authorised stage for lower-stakes work). This is that authorisation.

## What to build

**1. Missing Rankings comparator sets.** The real Rankings catalogue currently only offers the map/nearest-10 default; add the four other comparator sets from the design brief, each its own pinnable view with the short title already settled there:
- "Nearest 10, as a list" (the ranked-list version of the same real 10)
- "Nearest 10, same sector" (state vs. state, independent vs. independent)
- "Local rivals"
- "Similar-sized schools" (GCSE) / "Similar-sized sixth forms" (Post-16)

**2. Missing Candidates comparator.** Add "Entries, % of year group" (entries as a share of the whole cohort, not just a raw count) as a pinnable Candidates view.

**3. KS2 titles.** The build report proposed "Year 6 cohort" and "Nearest primaries" for KS2 since the GCSE wording ("this year", "10 nearest schools") would be factually wrong there. Go with those — reasonable, and easy to reword after the live review if they read wrong on screen.

**4. Two bugs, now more visible with dynamic titles.**
- KS2 Results card prompts for a subject, but KS2 has no subject picker — fix so KS2 doesn't ask for something it can't offer.
- "Vs. your comparison set" doesn't persist its chosen comparison — fix so the choice survives a reload/revisit.

## Ship

Once the above builds, typechecks, lints, and the production build passes: commit and push. This is Guy's explicit go-ahead to skip the usual separate review-before-push step for this round, because local verification is blocked by the Supabase Auth redirect allow-list (localhost isn't on it) and Guy would rather test the real thing than fight that locally. Confirm what deploys where pushing to the working branch triggers (Vercel or otherwise) and roughly how long it takes, so Guy knows when to look. Delete the gitignored `.env.local` with the local preview-access settings before or as part of this commit if it's still present (it should already be excluded by .gitignore, but confirm `git status` is clean of it).

## Verification

Once live: same checklist as the round-5 brief (titles resolve correctly per column including the new Rankings/Candidates views, fullscreen opens/closes correctly including on Rankings, light theme covers the new modal/map legend, the real map renders with pan/zoom) — but run it on the live site this time rather than the blocked local preview. Name the real school(s) checked.

## Scope

Same boundary as round 5: card mechanism, titles, fullscreen, theme, map, plus the two named bugs and the four/one added comparator sets above. Nothing else — no new comparator logic beyond what's listed, no onboarding or picker rework beyond the KS2 fix, share icon stays inert. Log anything else you notice in `docs/OPEN_QUESTIONS.md` rather than fixing it unasked.
