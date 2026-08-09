# VicData Public — Review Log (v1)
*One task at a time, reviewed in parallel by Claude Code (technical verification) and Guy (hands-on, as a real user would experience it). Findings from both sides land here. A task isn't closed until both sides have actually reported, not just one.*

---

## Task 1: Security — access gate and search-engine invisibility

**Objective 1 — the access gate genuinely blocks unauthenticated access:**
- An unauthenticated request to the site is blocked, not just the homepage — deep routes too (e.g. a school page, the account area)
- The correct credentials actually let a real person in
- Session behaviour after login is sane (doesn't re-prompt on every page)

**Objective 2 — the site is genuinely invisible to search engines right now:**
- `robots.txt` disallows all
- `noindex` renders site-wide, not just on some pages
- No preview/staging deployment exists anywhere that could leak around the gate
- Real-world sanity check: the domain doesn't show up in an actual `site:vicdata.co.uk` Google search (expected to be clean this early regardless, but worth confirming as a genuine check, not an assumption)

**Guy's access**: credentials for the access gate were set by Claude Code during the build and should be sitting in Render's dashboard under the web service's Environment variables — look for whatever the access-gate credential keys were named there. If they're not obviously findable, that's itself worth logging as a finding below, since it means they need to be surfaced properly regardless of how this review goes.

### Findings — Claude Code

Verified independently against production via direct HTTP requests, not source review.

- **Credentials**: confirmed via direct Render API query (not just local `.env`), no drift between deployed and local. `ACCESS_GATE_USER=vicdata`, password as shared above.
- **Unauthenticated blocking**: `/`, `/schools/110110` (Leighton Park), `/account` all return clean 401s — no content leak in the rejection body (23-byte "Authentication required").
- **Session behaviour**: stateless HTTP Basic Auth, no cookies, no custom session code — the browser's native credential caching handles "stay logged in," nothing app-side to misbehave.
- **`robots.txt`**: content is correct (`Disallow: /`) — but the file itself sits behind the access gate, so an unauthenticated crawler gets a 401 rather than the actual disallow body. Flagged as fine in practice (documented crawler behaviour treats 401 as full-disallow) but a nonstandard setup worth knowing about, since `robots.txt` is normally meant to be openly fetchable.
- **`noindex`**: identical tag confirmed present on all three page types tested independently.
- **Preview/staging deployments**: none exist — only two Render services total (this app, and the unrelated ingest-repo admin tool).
- **New finding, not part of the original ask**: `vicdata.co.uk` and `www.vicdata.co.uk` are now fully DNS-verified and live (were still pending at the end of the last session). Tested directly: root domain correctly gated (401/200), `www` correctly redirects to the gated root with no content leak in the redirect itself.

Overall: all six original objectives check out clean against live production, no gaps found.

### Findings — Guy

Logged in successfully with the shared credentials — confirms the access gate works correctly from a real user's perspective, not just via direct HTTP requests.

### Resolution

**Closed.** Access gate confirmed working from both sides (Claude Code's direct HTTP verification + Guy's real login). Indexing gate confirmed via Claude Code's technical check; no separate manual check needed given the site's current pre-launch state. The `robots.txt`-behind-the-gate nuance is noted, not a blocker.

---

## Task 2: School search — accuracy and completeness

**Objective 1 — punctuation/spelling variants return good results.** Common variants (e.g. "kings" vs "king's") shouldn't meaningfully change result quality — normalisation was part of the original design (the Club ISS pattern this was built from explicitly strips punctuation before matching), so this may be a case of that step not actually being applied, not a fuzzy-matching gap.

**Objective 2 — no false negatives for real schools.** A known real school (King's School Worcester) isn't appearing in results at all — this is a more serious class of problem than poor ranking, and needs root-cause investigation: is the school missing from `school_entities` entirely, missing specifically from the search index/`search_vector`, or present but never matched due to the same punctuation issue as Objective 1?

**Objective 3 — is this isolated or systematic?** Worth checking whether apostrophe'd school names generally have this problem (there will be many — King's, St Mary's, Queen's, etc.), not just fixing this one instance and moving on.

### Findings — Guy

- Search is "very sensitive to common misspellings" — "kings" vs "king's" gives meaningfully different results.
- "King's School Worcester" does not appear in search results at all, despite being a real, known school.

### Findings — Claude Code

Two genuinely separate root causes, not one shared apostrophe issue as first suspected — confirmed empirically, not by inference:

- **Finding 1**: not an FTS/tokenization issue (Postgres's stemmer already treats "King's" and "Kings" identically, confirmed via direct `ts_debug` testing). The real mechanism: the trigram tie-breaker added earlier to fix an "Eton" ranking bug is punctuation-sensitive at the character level (`similarity()` scored 0.267 vs 0.538 for the same school depending on query spelling) and silently favours whichever variant the user typed. A regression introduced by that earlier fix, not a gap in the original design.
- **Finding 2**: unrelated to apostrophes. "King's School Worcester" is a colloquial name — the real GIAS-registered name has no "Worcester" in it, and this specific school's `town` field reads "Worcestershire" (the county) rather than a real town, a GIAS data-quality quirk. Two compounding regressions from the original Club ISS design: FTS's mandatory AND-conjunction fails outright when any query word has no matching stem, and this build's whole-phrase `ilike` fallback (vs. Club ISS's original per-word chained checks) doesn't rescue it even though a per-word check would have.
- **Systematic check**: apostrophes are *not* the systematic cause of Finding 2 (4 other apostrophe'd generic-name schools all matched correctly). The real systematic condition is the county-vs-town data quality issue — 349 schools affected, a real but separate and smaller population than the 3,307 apostrophe'd schools. Both findings share an underlying structural fragility (mandatory-AND + whole-phrase matching breaks on any word absent from indexed text) but have non-overlapping specific triggers.

### Resolution

**Root cause and fix plan identified, deliberately held — not actioned.** Per Guy's direction: no code changes until the full review is complete, across all tasks. Fix plan and the exact prompt to send when the review concludes are saved below, ready to use without needing to reconstruct the reasoning later.

**Fix plan when actioned**: two low-risk restorations of proven Club ISS patterns — input normalisation before all matching stages (fixes Finding 1) and per-word `ilike` fallback matching (fixes Finding 2's rescue path) — plus an explicit re-verification that the original "Eton" ranking case isn't regressed by the Finding 1 fix, since it touches the same code path that case depends on. The 349-school county/town data-quality issue and the broader mandatory-AND structural fragility are separately held for later, not part of this fix (see backlog doc).

**Saved prompt, ready to send once the review concludes:**

```
Proceed with the two fixes from your Task 2 investigation, both are
low-risk restorations of the original Club ISS pattern, not new design:

1. Restore input normalisation (strip punctuation) applied before all
   matching stages — FTS, ilike, and critically the trigram
   similarity() call, since that's the actual mechanism behind Finding
   1. Confirm both "kings school" and "king's school" now score
   identically for schools with an apostrophe in their real name.

2. Restore per-word ilike fallback matching (chained, one call per
   word) instead of the current whole-phrase substring check. Confirm
   "King's School Worcester" now returns The King's School
   (urn 117037) correctly.

3. Before calling this done: re-verify the original "Eton" ranking
   case the trigram tie-breaker was added to fix still works correctly
   — the Finding 1 fix touches that same code path, and regressing the
   thing it was built to solve would be a bad trade.

4. Spot-check a handful of the other apostrophe'd and county/town-field
   schools already identified in your investigation, not just the two
   specific cases from this review.

Do not attempt the broader mandatory-AND-conjunction rework — that's
deliberately held for later, per the review log. Report actual
before/after test results, not just "fixed."
```

---

## Task 3: State of the School page

**Objective 1 — core data accuracy.** Roll numbers, current gender split, and current boarding split match reality for schools you know well.

**Objective 2 — shape classification, your domain judgement specifically.** The classifier was built as an explicitly provisional first pass (rolls spec §4) — this is the first real chance to sanity-check it against schools you actually know. Do the five categories (tube/pyramid/mushroom/wineglass/irregular) feel right on real schools, or does anything look obviously wrong?

**Objective 3 — free/paid boundary works correctly within the app itself.** Separate from the site-wide access gate (already reviewed in Task 1) — once logged in with the access-gate password, does the app's *own* membership tier logic correctly show free content and gate paid content appropriately for a non-member view, vs. showing paid content once actually verified as a member?

**Objective 4 — single-sex suppression, a real child-protection check.** The *documentation* discipline was required from the start; the *display* suppression itself was flagged as a to-do, not yet built (going-live notes §4). Worth deliberately checking a genuinely single-sex school's gender-split display for anything that could reveal a small minority count.

**Objective 5 — edge cases already known about.** Surrounding-schools section: does it correctly skip-and-backfill for 6th-form/FE-corporation schools with no roll data, and does it correctly exclude PRU/AP (while Secure Units remains a known, deliberately unresolved gap — not a new bug if it shows up)?

**Objective 6 — safety framing principles are actually implemented, not just designed.** A school's own line woven into multi-line context (never standalone), no red/down-arrow styling on free-tier charts, plain-language captions present, paywall prompts free of alarm-language.

**Objective 7 — "coming soon" placeholders** for academic/social/destinations are visibly present, not silently missing.

**Schools to check**: Leighton Park, Woldingham, Camden School for Girls, Acland Burghley, Yerbury Primary School, St John's Primary School Holloway, Worcester Sixth Form College. Worcester Sixth Form College specifically overlaps with the search-bug review (Task 2) — worth watching for anything else Worcester-shaped.

### Findings — Claude Code

Reviewed against live production for all 7 named schools, cross-checked against raw DfE census data directly.

**Objective 1**: confirmed accurate for all schools with data (arithmetic + raw-data cross-check). Worcester Sixth Form College correctly shows no data. **Flagged for Guy's own sanity check**: Acland Burghley's gender split (802♂/174♀, 64%/36%) is confirmed accurate against raw census data, not an app bug, but genuinely unusual for a mixed comprehensive.

**Objective 2 — two real classifier findings, need Guy's judgement**:
- Finding A: "Pyramid/Funnel" doesn't distinguish magnitude of decline — schools retaining 83% vs. 36% of cohort into sixth form get the identical label. Camden sits right on the ±15% stationary threshold boundary.
- Finding B: every primary school will always classify as "Mushroom" by structural definition (rise-then-fall is inevitable for any primary's age profile), not because of an actual notable bulge. Worth deciding whether this classification should even apply to primary-only schools.

**Objective 3**: fully confirmed across multiple real scenarios (invalid creds, cross-school access, unverified-first-member, verified member) — all behave correctly.

**Objective 4 — important structural finding**: no suppression risk found this year (Woldingham's male count is genuinely zero throughout), but more importantly, the page currently only shows a single total gender split, never broken down by age band — meaning the risk the suppression principle exists to prevent **cannot currently occur, not because suppression was built, but because no sufficiently granular view exists yet.** Incidental safety, not designed safety. **Directly relevant to the shape-chart design work in progress** — an age-by-age gender chart is exactly the feature that would remove this incidental protection. Camden's 934♀/174♂ correctly shown unsuppressed as a legitimate large structural minority — the mechanism works correctly for the case it's not meant to catch.

**Objective 5 — one confirmed clean, two real gaps**:
- PRU/AP exclusion confirmed clean across all London schools checked.
- New gap: `nearest_schools` never got the mainstream-only filter that `feeder_candidates`/`comparator_candidates` got after the search-bug fix — confirmed via a real FE institution appearing in a candidate list. Currently harmless but inconsistent.
- Bigger gap: 6th-form/FE skip-and-backfill doesn't actually trigger for genuine FE-corporation schools — Worcester Sixth Form College has no "Surrounding schools" section at all, not a degraded one. Root cause: the computation is gated on the *target* school having its own roll data, backwards logic given the feature is about nearby schools. Affects all ~502 genuine gap institutions, broader than the narrower case the original logic handles.

**Objective 6 — mostly present, real gaps**:
- "Woven into context, never standalone" is technically satisfied only because no free-tier chart exists yet — untested, not actively verified.
- No red/down-arrow styling — confirmed clean.
- Captions inconsistent: Shape and Surrounding Schools have explanatory text; **gender split and boarding split have none at all** — bare numbers on exactly the figures the tiering principle is meant to protect.
- Paywall copy confirmed using the spec's exact suggested wording.

**Objective 7**: confirmed present and visible on all 7 pages, including where the rest of the page has nothing to show.

No code changes made. All test accounts/memberships cleaned up, database confirmed back to zero test rows.

### Findings — Guy

**Resolves Claude Code's Objective 2, Finding B directly — a methodological fix, not a display preference.** Shape classification should use ages 5–17 only, excluding 4 and 18. Reasoning: neither age represents a complete cohort at census date — Reception-age children only turn 5 partway through the year, Year 13 pupils only turn 18 partway through — so both edges are structurally undercounted relative to every age in between, a measurement artefact of the census date rather than a real enrolment pattern. This artefact creates a false "rise" at the very start of every primary school's age profile, which is what was tripping the universal "Mushroom" classification — trimming the range removes the cause rather than needing a primary-only exception.

**Conceptual anchor for the whole typology, worth carrying into future user-facing explanation**: absent any real driver (demographic shift, attrition, competitive intake, external entry points), a stable school's natural shape is a flat tube — similar numbers at every age. Every other shape represents a genuine story, not classifier noise. Tube is the baseline, not just one of five equally-likely outcomes.

**Chart design confirmed**: horizontal orientation preferred over vertical (oldest at top, youngest at bottom, boys/girls diverging left/right from centre) — "much better... easier to impose a shape."

### Resolution

*(pending — Task 3 stays open until Guy's own findings land too)*

---

## Template for future tasks

**Objective(s)**: ...
**Findings — Claude Code**: ...
**Findings — Guy**: ...
**Resolution**: ...
