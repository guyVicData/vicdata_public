## Step 0 — Get the briefs into the repo, before anything else

Neither `vicdata_phase3_teacher_view_design_brief_v2.md` nor this prompt exists in any repo yet — both only exist as documents outside the codebase. Before touching any code:

1. Add `vicdata_phase3_teacher_view_design_brief_v2.md` (the v2 brief, provided alongside this prompt) to `docs/` in whichever repo(s) hold this code (confirm — likely `vicdata`, possibly `vicdata_public` too, same as prior rounds).
2. Add this prompt itself to the same `docs/` folder(s), so the instructions this build ran from are a permanent, referenceable part of the repo's history, not just a one-off pasted prompt.
3. Commit and push this as its own standalone first commit, before any Phase 1 work begins.

Then: read `docs/vicdata_phase3_teacher_view_design_brief_v2.md` in full. It supersedes `docs/vicdata_phase3_role_based_views_hod_design_brief_v1.md` for design purposes (that v1 doc is still worth reading for context and for the already-shipped zero-candidate/special-schools filtering work referenced in its own build report, but build from v2).

## Operating mode for this round — read this before starting Phase 1

This needs to land as **one continuous build in one pass** through all ten phases below, not a stop-and-check-in-repeatedly round.

- **Create `docs/vicdata_phase3_teacher_view_open_questions_v1.md` at the start of the build.** Every time something comes up that would normally be worth pausing to ask Guy about — a genuine design or implementation judgment call where the brief doesn't fully spell out the answer — do not stop. Make the most reasonable call consistent with the brief's stated principles (natural-language-question headings, radical visual consistency, comparisons-and-context-everywhere, mobile-first, per-dataset onboarding as the unlock mechanism, etc.), log it in that doc as you go (what the question was, what you decided, and why), and keep building. Treat this doc as a running log, appended to through the build, not written once at the end.
- **Only stop the whole round for a genuinely unsolvable or blocking issue** — meaning one of:
  - a hard technical contradiction (the brief assumes two things that can't both be true of the real system);
  - a missing prerequisite that makes a phase structurally impossible to build at all (not just harder, or requiring a judgment call);
  - a real-data finding that invalidates a core assumption the rest of the build depends on (in the spirit of the zero-candidate round finding the brief's own hospital-schools hypothesis was wrong — that's the level of finding that justifies stopping, not routine data quirks).
  Ordinary UX and implementation judgment calls — how exactly to lay out a card, which of several reasonable gating rules to apply, how to phrase a natural-language heading, what threshold counts as "meaningful" for a trend flag — are exactly what the open-questions doc is for, not a reason to pause. If in real doubt whether something is a true blocker or a judgment call, default to treating it as a judgment call, log it, and keep going; the round can always come back to it afterwards.
- It's fine, per the existing guidance below, for the build report to say a later phase wasn't reached or was only partially completed — that's a normal, honest outcome of a large build, not the same thing as stopping the round.

**This is a large, multi-part build — the first full standard view on the platform, not a single-topic round like most prior prompts in this project.** Work through it in the phase order below, verifying real data before building each phase (the project's standing discipline — confirm against `vicdata-production`/`vicdata-public`, don't assume). Where a later phase turns out to depend on a real-data fact that isn't as the brief assumes, apply the operating mode above: log it and make the best call unless it's a genuine blocker per the criteria above. It is entirely acceptable for the build report to say a later phase was not reached or was only partially completed — do not claim something is done that wasn't actually verified against real data and a real school.

## Scope boundaries — read this before touching anything

**In scope**: everything in v2's §§1–16 except where explicitly marked "not this build."

**Explicitly NOT in scope — do not build, even partially:**
- §4's department dropdown/rename/roster (1.1) and §8's department-vs-department comparison (1.2).
- §9's quartile/grade-band Results view.
- Custom Dashboards (self-service or authored-and-pushed), referenced in §17.
- Any sharing mechanism for custom views, Recruitment jobs, or Meetings (§16).
- §13's results-day fast-ingest technical work — build the lightweight v1 notification UI (dashboard banner, login notice, "NEW" pill) but do NOT attempt to redesign or speed up the ingest pipeline itself; that's a separate, dedicated piece of work.
- §8's Comments on datasets (unchanged from v1, still just flagged).
- Parent, SMT, Finance, and Admissions views — this build is Teacher view only.

If you find yourself about to build any of the above, stop — it means something in this prompt was ambiguous, not that scope has quietly expanded.

## Phase 1 — Account and role model

- Confirm the real current account/role data model (read the code, don't assume from the brief's prose).
- Add **Teacher** as the default, self-selected role for an individual joining alone.
- Add **HOD**, **SMT**, **Finance**, **Admissions** as real, admin-grantable roles at the school level. HOD carries no functional difference from Teacher yet (its department capability is 1.1, out of scope) — it just needs to exist as a real, assignable designation now, per §3.
- Confirm role, not job title, is what the rest of this build gates on.
- Confirm there is genuinely no "logged in but unpaid" state to handle (§15) — role can only be set after joining as a paid member, individually or via a school. If the real account model contradicts this, stop and flag it — this assumption underpins §15 entirely.

## Phase 2 — The per-dataset onboarding and dashboard mechanism (§5)

This is the structural core everything else hangs off. Build it generically across three phases (KS2, KS4, KS5), not hardcoded to two.

- For a given school, determine which phases it has **genuine current data for** — real, non-zero, real-measure data in the most recent available year, reusing the exclusion logic already shipped for zero-candidate filtering (v1 §13, `stagesPresent()`). A phase with only historical data and nothing current should not show as available.
- **Verify against real data**: whether independent junior/preps have real KS2 data in `dfe_ks2_attainment`. This was never checked in the design round. Query it directly. The answer determines whether this school type gets a KS2 tile at all, on top of its already-confirmed lack of KS4/KS5 access.
- Home screen shows a real, clickable tile per available phase. Unonboarded-but-available → starts that phase's one-off walkthrough. Onboarded → straight to that phase's dashboard. No locked/teaser third state.
- Completing a phase's onboarding is what unlocks its dashboard, permanently, per-person, per-phase. No separate "show again" setting to build (§6 resolves this by the mechanism itself).

## Phase 3 — The four cards, KS4/KS5 and their KS2 equivalents (§5, §6)

Confirm against the real backend before building (§18's first verification task) — don't build from the provisional card-to-data mapping in v1 §5 without checking it.

- KS4/KS5: Candidates (entries by subject, %-change), Results (headline result by subject, comparison anchor), School Context (§4 below — build the full menu, not a single pie), Rankings (comparator sets, §7 of the brief).
- KS2: Roll (age-10/Year 6 cohort from Rolls data), Results (six fixed domains, richest available metric per domain — reuse the existing KS2 domain-comparison work, don't rebuild it), nearest-10-primaries in place of School Context, LA/region/national tiers in place of Rankings.
- Subject-picker works at real taught-qualification granularity (AS Maths ≠ Statistics), not subject-family level — verify the real subject/qualification taxonomy supports this distinction before building the picker on top of it.
- Onboarding content for all four steps per §6 — Candidates/Roll (live count), Results (headline graph + anchor), School Context (simple pie, ticked subjects vs. rest of school), Rankings (default comparator preview + anchor).

## Phase 4 — Card interactions (§7)

- Expand-to-focused-view with the scrollable tick-to-add/remove list, same gesture as the subject picker. Reset-per-column button.
- Gate the add-list by column topic, ticked subject(s), and qualification type (reuse the existing qualification-type-comparability filter — verify it actually covers every real subject/qualification combination you're about to expose through this list, per §18's third verification task).
- Saved state per person per column — now a hard requirement, not optional, since customisation depends on it persisting.
- Mobile-first and full-screen presentation mode as a first-class requirement across every screen in this build, not just Rankings' existing export tabs.
- Universal PDF/print export, light/dark theme (default dark, both palettes designed together), colour consistency.

## Phase 5 — School Context, full menu (§8)

Build the five real comparison axes (vs. whole-school average for that qualification; vs. same-category subjects; vs. all other subjects; vs. a user-chosen selection; category vs. all other categories), for both Results and Candidate numbers, with trend views wherever 3+ years of data exist. This populates the School Context add-list from Phase 4 — build it as that list's real content, not a separate mechanism.

## Phase 6 — Recruitment (§10)

- Job entity: free-text title, real subject-taxonomy scoping for the comparison.
- Candidate entity per job: name (only PII field), current school (via existing school-search), interviewed tick, interview date/time. Sortable/filterable list.
- Automatic comparison: own school vs. candidate's current school, scoped to the job's subject, across sector, gender, roll size, candidate/entry size, subject results, and trends — using whichever of KS4/KS5 both schools genuinely have data for.
- HoD-set delete-by date at job creation, editable/extendable afterwards. No other retention machinery.
- Creator-only visibility. Mobile-first.

## Phase 7 — Meetings (§11)

- Meeting entity: name, date, delete-by date (editable).
- Select graphs from any card/phase the person has access to (not gated to one phase) and sequence into linked slides.
- 1-up view and grid view.
- Creator-only visibility. Mobile-first and full-screen, same as everything else.

## Phase 8 — Personal notes and "this moved" (§12, §13)

- Personal, private note per person per chart — visible only to its author, built on the same saved-state infrastructure as Phase 4.
- Automatic flagging when a real, meaningful year-on-year change occurs (candidates or a ranking shifting materially) — surfaced on the relevant card, not requiring the person to notice it themselves. Use real historical data to define what counts as "meaningful" — don't invent an arbitrary threshold without checking what real year-on-year variation actually looks like across real schools.

## Phase 9 — Lightweight notifications (§13)

Dashboard banner, login notice, and a "NEW" pill wherever something's genuinely changed (new data landed, or a "this moved" flag from Phase 8 fired). No email/push infrastructure. Do not touch ingest timing — that's explicitly out of scope (see Scope boundaries above).

## Phase 10 — Design texture as implementation, not just intent (§14)

This isn't a separate phase to bolt on afterwards — apply it throughout Phases 2–9 as you build: every heading across the whole Teacher view is phrased as the real question it answers (not a label), radical visual consistency in position/icon/colour across every subject/phase/card, comparison-and-context treatment applied generously rather than to a bare minimum, and the onboarding live-count moment protected and reused wherever a similar live-feedback opportunity exists. Do not touch the advanced view's or public site's existing headings — that harmonisation is a deliberately separate, later pass.

## Verification and build report

Same discipline as every other round in this project: real data, real schools, checked before and after, not code inspection alone. For each phase, name at least one real school you tested against and what you actually saw. Call out explicitly:
- Which of §18's three verification tasks were resolved, and what the real answer was (especially the independent junior/prep KS2 question — this could change Phase 2's scope for that school type).
- Any phase not reached, or only partially built, and why.
- Anything in the brief that turned out to be wrong once checked against real data or real code, the same way the zero-candidate round found the brief's own hospital-schools hypothesis was incorrect.
- A summary of `docs/vicdata_phase3_teacher_view_open_questions_v1.md` — how many judgment calls got logged, and the handful that matter most for Guy to sanity-check first.

Commit and push once verified, per the normal working pattern, across whichever repos actually hold this code — including `docs/vicdata_phase3_teacher_view_open_questions_v1.md` itself, so the log of judgment calls made during the build is preserved alongside the code they affect.
