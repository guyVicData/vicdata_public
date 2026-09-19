# VicData — Phase 3: Role-Based Views — Teacher View (v2, build-ready)

*Supersedes `vicdata_phase3_role_based_views_hod_design_brief_v1.md` for design purposes — that document is kept as the historical record of how this design was reached (including the already-shipped zero-candidate/special-schools filtering work, see its own build report) and should still be read for that context, but this v2 is the one to build from. The single biggest change from v1: the role and dashboard originally called "Heads of Department" are renamed **Teacher view** throughout, because most people using it are ordinary teachers, not heads of department — HoD becomes an extra designation layered on top, not the thing that defines the view.*

---

## 1. Purpose and scope

This is the build-ready spec for the platform's first role-scoped **standard view**: Teacher view. It covers the full account/role model needed to support it, the per-dataset onboarding and dashboard mechanism (generalised across KS2, GCSE, and Post-16, with a future phase able to drop in without redesign), the four "ways of seeing" cards and their real content, two standalone extra features (Recruitment and Meetings), and the house-style principles that apply throughout. Everything here is intended to be genuinely buildable now, from data views the platform already has. Items that are good ideas but not part of this build are explicitly labelled with where they sit on the roadmap (§17), not silently dropped.

---

## 2. View model (unchanged from v1)

**Advanced view** — the existing power-user build (rolls, academic results, comparator sets, rankings). A tier a school's own admin can grant to a user who can cope with it.

**Standard view** — the new, role-scoped, simplified dashboards this brief covers. **All paid.**

**Default/free view** — the existing free-tier experience, built on roll data. To be revisited once standard-view work is done. Not designed here.

Most of the underlying data views needed for Teacher view already exist in the advanced build; this is largely a re-presentation/simplification layer, with the exceptions noted throughout.

---

## 3. Account and role model

### The base role: Teacher

**Teacher view is the default role, self-selected.** When an individual joins the platform on their own, they get Teacher view automatically — no role picker needed for the common case. This matters for go-to-market as much as product design: the real challenge is finding an audience both *within* schools (individual teachers signing up on their own) and among schools themselves, and a zero-friction default is central to the first kind of growth.

**Deliberately flat, no permission split within Teacher view itself.** Every individual's subject selection is personal to them, not owned by anyone senior and inherited by others. A teacher who only teaches two or three subjects can narrow to just those.

**The subject-picker works at the real taught-qualification level, not just subject-family level.** Someone might teach AS Maths but not Statistics — these need to be distinct, selectable items, not folded into one "Maths" bucket. The picker suggests items from the subject family a person arrives through, but lets them search and add from any family.

### HOD: Teacher, plus

**HOD is a real, admin-grantable role from day one**, even though its only distinguishing capability (the department dropdown and roster, §4) isn't built until 1.1 (§17). Building the role name in now means no school needs re-classifying once that capability ships — responsibilities are likely to get more granular once real pilot schools are using this, and the role model should be ready to absorb that rather than needing a migration each time.

### Admin-granted roles: SMT, Finance, Admissions

Unlike Teacher (self-select) and HOD (admin-grantable, low-stakes), **SMT, Finance, and Admissions are all admin-granted**, not self-selectable — all three plausibly carry more sensitive material (governance notes, financial data, applicant/family information) that shouldn't be available on request the way the base Teacher view is. SMT absorbs what earlier drafts called "head/governors" — the renaming is deliberate, avoiding overloading "head" (a job title) as a role name.

### Folded, not forgotten

**Director of Studies** folds into SMT, because "director of studies" is an independent-school-specific title — state schools have year-group leaders instead, not a DoS role at all. Revisit properly when SMT's own view gets designed.

### Sector-aware labelling

Role *display labels* should come from a language file keyed by role + sector, since sector is known at signup and DoS/year-group-leader isn't the only place this matters — the underlying data is sector-blind, but role naming on top of it isn't.

### Identity vs. role

Name and job title are free text, profile display only. Role is selected from the fixed vocabulary above, and role — not job title — drives which view and dataset someone gets.

### Later batches, not this one

- **Parent view** — scoped around each child and that child's school, and around school searches, rather than "my subjects" the way Teacher view is. **Correction from v1**: subject-level scoping still matters heavily within that, especially for school search at sixth form — being able to compare schools by specific subject choices (e.g. "which of these schools is strong in the A-levels my child wants") is likely to be one of the most compelling things this platform can show a parent. Parent view is not designed here, and the subject-picker mechanism should **not** be assumed to transfer directly — it needs its own design once this gets picked up, informed by both the child/school framing and the real importance of subject-level comparison. The roadmap's own parked "parents" decision (re: model-honesty/over-reading risk on shared views, §16) still needs a deliberate revisit before any parent-facing sharing gets built.
- **B2B view** — suppliers/consultants/journalists, overview-level. Carries the phase-2 authored/pushed custom-dashboard capability (§16).
- **School-group/MAT view** — all schools in a group, at once.

---

## 4. Departments (1.1 — not this build)

**Not part of this round**, but specified precisely so 1.1 can be built without re-opening the design:

- Department becomes a real field: a dropdown, scoped per school, populated from names other users at that school have already entered, plus the ability to add a new one if the right department doesn't exist yet.
- **Teachers can belong to more than one department** — genuinely common (e.g. a Performing Arts department spanning subjects the platform's own taxonomy keeps separate), and the data model needs to support this as a many-to-many relationship from the start, not bolted on later.
- **Admin or HOD can rename a department and see its full teacher roster.** Plain Teacher can join/create but not rename or see the roster — this is HOD's actual distinguishing capability, referenced in §3.
- This is additive groundwork for **1.2**'s department-vs-department comparison (§8, §17) — 1.1 builds the real structural data; 1.2 is the comparison feature built on top of it, once real pilot schools have real coverage to compare.
- **For this v1 build**, the subject-picker stays exactly as designed below: personal and informal, no stored "department" entity. Nothing here changes v1's build.

---

## 5. The per-dataset onboarding and dashboard mechanism

This is the core mechanism the whole Teacher view is built on, and it replaces v1's more tentative framing (a single global onboarding, primary treated as a wholly separate future branch).

**Onboarding happens once per dataset, not once globally.** Completing a phase's walkthrough is literally what unlocks that phase's dashboard section. A teacher at a through-school might do the GCSE walkthrough on day one and get the GCSE dashboard, then do the Post-16 walkthrough separately, in their own time, when they're ready — each phase teaches the same underlying pattern fresh, on that phase's own real data, and gets faster to absorb the second time round. This is a deliberate progressive-disclosure mechanism, not just a gating rule.

**A school's home screen shows a real, clickable tile for every phase it has genuine current data for** — not just historically, but in the most recent available year (this reuses the zero-candidate/real-data-quality logic already shipped, see v1's §13). A phase the school has data for but the person hasn't onboarded into yet is still a visible, clickable tile — clicking it starts that phase's one-off walkthrough. An already-onboarded phase goes straight to its dashboard. There is no third "locked/teaser" state.

**Datasets covered by this build: KS2, KS4 (GCSE), KS5 (Post-16).** Destinations is a real future phase — an ingest not yet done — and the mechanism is designed generically enough that a third (or fourth) phase slots in later without redesign; nothing here should hardcode "two phases."

**Independent junior/preps**: confirmed to have no HoD/Teacher-academic role, since these school types have no secondary-phase academic data. **Unverified, needs a real check before build**: whether independent junior/preps have genuine KS2 data in `dfe_ks2_attainment` — this was never actually queried in this design round (unlike special schools, which was checked directly), and shouldn't be assumed either way.

### The same four questions, phase-appropriate axis each time

The genuinely nice generalisation from this design round: every phase asks the same four "ways of seeing" questions, just pointed at a different real axis.

| Question | KS4 / KS5 (GCSE / Post-16) | KS2 |
|---|---|---|
| How many? | **Candidates** — entries per subject | **Roll** — the age-10/Year 6 cohort size, from the existing Rolls data (not exam entries) |
| How well? | **Results** — per-subject headline result | **Results** — per-domain headline result (six fixed domains: Reading, Writing, Maths, GPS, Science, RWM combined) |
| Relative to what's near me? | **School Context** — see §8 for the full menu | **Nearest 10 primaries** — replacing "other subjects in my school," which doesn't exist at KS2 |
| Relative to wider comparisons? | **Rankings** — comparator sets (§7) | **Local authority / region / national** — the wider tiers out from nearest-10 |

KS2 has no Candidates-as-entries concept (every pupil sits the same fixed tests) and no within-school subject-share concept (every KS2 school does all six domains) — which is exactly why Roll and Nearest-10-primaries stand in for them, rather than KS2 simply lacking two of the four cards as an earlier draft of this design assumed.

---

## 6. Onboarding content (all four steps specced)

Each step reuses the previous step's ticked subjects (or, for KS2, is whole-school by nature) and follows the same shape: a live, real preview of that card's default view, with a comparison anchor, plus one line of explanation. **Every heading throughout is phrased as the actual question it answers — see §14, this is now a fundamental principle, not a stylistic nice-to-have.**

- **Candidates / Roll**: the subject-confirmation mechanism from the original wireframe — tick subjects, watch the real count update live (e.g. "84 candidates"). At KS2 there's no picker step, since every school does all six domains.
- **Results**: a graph of the latest headline result per subject/domain, reusing the ticked subjects, each with a real comparison anchor rather than a bare number.
- **School Context**: a simple pie of the ticked subjects' share of total entries against every other subject in the school, with one line on why "how many take it" and "how it fits alongside everything else" are different questions. (The full card goes well beyond this single pie — see §8.)
- **Rankings**: default comparator preview (nearest-10 or similar-schools, see §7) with a real anchor, one line on "relative to other schools, not just your own."

**Onboarding repeatability is resolved by the per-dataset mechanism itself** — since completing a phase's walkthrough once is what unlocks it permanently, there's no separate "show again" question to answer; a person simply doesn't see the walkthrough again for a phase they've already unlocked.

---

## 7. Card interactions

**Simplified default card content**: each card starts with one graph plus a small number of key figures, not a fuller multi-series treatment — deliberate, both less overwhelming and a genuine incentive to interact.

**Expand to a focused view — and build it up.** This is the single biggest interaction-model addition in this round. The expanded/focused view isn't just "switch how the one graph is shown" — it's a real builder: a **scrollable, tick-to-add/remove list** (the same gesture as the subject picker — radical consistency, §14) of the views available for that column, which get pinned onto the dashboard and accumulate into something the person actually built. A **reset button per column** wipes it back to the single default view.

**The add-list is gated to stay manageable, not a flat catalogue**: whatever's offered is scoped to that column's own topic (a Results column never offers a Rankings-type view), further scoped to the ticked subject(s), and further scoped to the relevant qualification type for that subject (reusing the existing qualification-type-comparability logic, so a subject with both a GCSE and a vocational-equivalent entry only offers genuinely comparable views).

**Saved state is now a hard requirement, not optional.** Column customisation only makes sense if it persists — this settles what v1 left as a "build vs. skip" question. The same interaction data doubles as usage telemetry; the associated GDPR/privacy work (a new personal-data category, staff behavioural data) remains a real compliance task, not resolved here.

**Mobile-first *and* full-screen for meetings — a first-class, cross-cutting requirement**, not a card-level detail. Every screen needs to work genuinely well on a phone and be presentable full-screen on a projector, not just "responsive" in between. This generalises the universal PDF/print export already planned (every map, graph, and ranking gets full-screen view and export) into an explicit design goal running through the whole build.

**View types (map/graph/rank) are not a fixed menu** — which ones are meaningful follows from what's being compared (a within-school comparison has no geography, so Map is genuinely irrelevant, not deprioritised). "Rank" and "table" are the same underlying sortable mechanism rendered differently. Not being formalised into a general rule now — refined dashboard-by-dashboard.

**Colour**: consistency across the whole project is the priority now, not the exact palette/semantics. A unified redesign pass and a per-user override (doubling as colourblind accessibility) are the escape valves.

**Light/dark theme**: a proper toggle, defaulting to dark, both palettes designed together from the outset. Universal PDF/print export defaults to a light, print-safe rendering regardless of on-screen theme.

---

## 8. School Context — the full menu

Originally a single pie; now a genuinely rich card, because it's relevant to a wide range of real discussions — resource allocation, KPIs, and more.

**For both Results and Candidate numbers**, five real comparison axes:

1. Your subject vs. average school performance in that qualification.
2. Your subject vs. other subjects in the same subject category.
3. Your subject vs. every other subject in the school.
4. Your subject vs. a user-chosen selection of subjects.
5. Your subject's whole category vs. every other category.

**For each, a trend view is available once 3+ years of data exist**, alongside the current-position view. This full menu is exactly what populates School Context's add/remove scrollable list (§7) — it isn't a separate mechanism.

**Department-vs-department comparison (new idea, logged as 1.2, not this build)**: genuinely sharper than an individual-subject comparison, but structurally dependent on 1.1's real department data existing with real coverage across a school's HoDs — not buildable until pilot schools are actually using 1.1. Distinct in both dependency and timing from the two items below, which are **not** tied to pilot-school coverage at all.

---

## 9. Results — the quartile idea (logged, not this build)

Confirmed for this build: latest headline result per subject/domain as the default graph, with a **trend history** option in the expanded view once 3+ years of data exist.

**Not this build**: a view showing how each *quartile* of pupils is doing, not just the headline average — aimed at schools that over-focus on top grades. This is a genuinely different way of looking at results and deserves its own design session once the basic dashboard is live and being used, rather than being squeezed in now. Its timing is open-ended ("once the basic dashboard is done"), not gated on any technical precondition the way department-vs-department is.

---

## 10. Recruitment

A standalone feature, not one of the four repeating cards — genuinely new territory for the platform (its first named, real individual) but a smart reuse of data that's already there.

**What it does**: a Teacher-view user creates a **Job** (free-text title, e.g. "Maths KS3 & 4 Teacher," scoped to a real subject from the platform's taxonomy for comparison purposes — the free-text title can include things like KS3 that aren't independently measurable, the subject scoping is what actually drives the comparison). For each **Candidate** on that job: a name, their current school (looked up via the existing school-search mechanism), a tick box for interviewed/not, and interview date/time — making the candidate list easy to sort and filter.

**The comparison**: automatic, own-school-vs-candidate's-current-school, scoped to the job's subject, across sector, gender, roll size, candidate/entry size, subject results, and trends — using whichever measurable phases (KS4/KS5) both schools genuinely have data for. This reuses data the platform already has; nothing here is a new data view.

**Privacy**: the candidate's name is the only personal-data field. Everything else shown is the same ordinary school-level contextual data used everywhere else on the platform — not data *about* the candidate.

**Retention**: the HoD (or whoever creates the job) sets a delete-by date when the job is created, and can push it out later if the process runs long (second rounds, etc.). No separate policy machinery — this is the whole retention model.

**Mobile-first, deliberately**: this is exactly the kind of thing used in the moment — checking a candidate's school comparison on your phone right before an interview.

**Visibility for this build**: creator-only, private. Sharing a job with a co-interviewer isn't built now — logged in the sharing bucket (§16) for whenever sharing gets designed properly.

---

## 11. Meetings

A second standalone feature, same shape as Recruitment: a Teacher-view user names a **Meeting**, sets its date, and sets a delete-by date (editable if rescheduled). Within it, they select graphs — from any card, any phase they have access to, not gated to one dataset — and sequence them into linked slides, viewable **1-up** (for presenting) or **in a grid** (for an overview). Genuinely useful for governor meetings, department meetings, SMT meetings, or two parents comparing notes.

**Visibility for this build**: creator-only, private, same as Recruitment — though Meetings is the more obviously shareable of the two (you'd often want to send a finished slide sequence to people who weren't in the room). Logged in the sharing bucket (§16).

---

## 12. Personal notes, and comments (still separate)

**Personal, private notes — adopted for this build.** A much lighter thing than the governance-scoped Comments idea below: any Teacher-view user can leave a private note against a specific chart (e.g. "ask X about this dip"), visible only to them, using the same saved-state infrastructure that already exists per person per card. Cheap to add now.

**Comments on datasets — still out of scope, unchanged from v1.** The admissions/leadership-scoped idea (annotations that accumulate institutional context, for governance/board-pack use) stays flagged, not designed: visibility scope and interaction with PDF export remain open, and this isn't part of the Teacher view build at all.

---

## 13. Notifications

**"This moved" — adopted.** When a real, meaningful year-on-year change happens (candidates up/down sharply, a ranking shift), the relevant card surfaces it automatically, rather than waiting for someone to notice. A natural extension of "never show a bare number without a comparison anchor" (§14) into "and tell me when the comparison itself is worth noticing."

**New-data-in — adopted, and the important one.** When DfE releases new results, this should reach users within **hours**, not days — described as likely to generate a real spike of engagement. This needs its own dedicated technical pass (DfE's actual release calendar per dataset, an ingest pipeline staged and fast enough to run the moment data drops) rather than being fully specified here as just a notification.

**v1 channel, deliberately light**: a banner on the dashboard, a notice on login, and a **"NEW" pill** wherever something's actually changed. No email/push infrastructure needed for this build — that can come later if the lighter version proves insufficient.

---

## 14. Design texture — now adopted, not just proposed

All of v1's design-texture ideas are adopted as house style for this build, plus two additions that came out of this round:

- **Radical visual consistency** — pixel-identical position, icon, and colour language everywhere a pattern appears. Confirmed as vital.
- **Natural-language questions as headings — now a fundamental, load-bearing principle, not one bullet among several.** Every card, every onboarding step, every item in School Context's comparison menu, Recruitment, Meetings — all of it is named as the real question it answers, not a generic label. Scoped to this new Teacher view only for now; the advanced view and public site get their headings brought into line in a separate, later pass.
- **Comparisons and context, everywhere** — a broader, more proactive restatement of "never show a bare number without a comparison anchor": the intent is to keep adding comparison and context throughout the product, not just meet a minimum bar.
- **Protect and extend the onboarding live-count moment.**
- **Let the brand breathe a little at the edges**, without compromising the seriousness of the data itself.
- **Ownable surfaces build the pleasure** — named custom items, remembered state, a personal subject list.
- **Mobile-first and full-screen-for-meetings** — restated here as a design-texture principle as well as a functional requirement (§7): this product needs to feel considered at both size extremes, not merely responsive.

---

## 15. Internal role/school switch (build & QA tool) — unchanged from v1

A **role switch** and **school switch** on the account view let an internal account view the platform as any role at any real school, without provisioning a genuine account for every combination — serves verifying the phase-tile logic, subject taxonomy, and sector-label system across a real spread of schools.

Resolved (v1): no paid/unpaid toggle needed (works from an already-entitled login). Resolved (v1): a genuine **system admin** role, distinct from the existing per-school **school admin** role — sits outside the school hierarchy entirely. Must stay strictly read/preview.

**No "unpaid Teacher view" state exists to design.** Role can only be set once someone has joined as a member (individually or via their school) — joining is itself the paid step. The public site continues providing its existing free roll-data information, with clearer copy on what the members' side delivers; the members app never needs to handle an entitled-but-unpaid case.

---

## 16. Sharing — still the big open item, unchanged in substance

Not designed here. The open fork (follow/subscribe a live view vs. duplicate a copy) is unresolved, as is whether within-school sharing simply reuses the existing Comparator/Feeder Set admin-owned pattern. The parent-to-parent sharing tension (§3) remains flagged as a real risk needing the roadmap's parked "parents" decision revisited deliberately, not assumed.

**Growing the "would want sharing eventually" bucket**, without resolving the mechanism: Recruitment (a co-interviewer seeing the same job) and Meetings (sending a finished slide sequence to people who weren't in the room) are both logged as strong future candidates.

---

## 17. Roadmap — what's not in this build, and why

Being precise about *why* each item is deferred, since they're not all the same kind of "later":

**1.1 (near-term, no external dependency)**:
- Admin-defined department dropdown, multi-department membership, HOD's rename/roster capability (§4).

**1.2 (genuinely gated on 1.1 existing *and* real pilot-school usage)**:
- Department-vs-department comparison (§8) — structurally can't work until schools have real department coverage from 1.1.

**Next round, open-ended timing, informed by usage of what ships now (not gated on any precondition)**:
- Quartile/grade-band Results view (§9).
- Custom Dashboards, both self-service cross-phase/cross-subject mashups and the phase-2 B2B authored/pushed capability — unchanged from v1's §9, still real ideas, still not part of this build.

**Deferred, needs a deliberate decision before design starts, not silent assumption**:
- Full sharing mechanics (§16).
- Parent-to-parent sharing specifically, and the roadmap's parked "parents" decision generally (§3).
- Parent view itself, once picked up — child/school-scoped, with subject as an important nested comparison axis (corrected from v1, §3).

**Likely to follow the same pattern once this ships, not yet started**:
- SMT, Finance, and Admissions standard views. Each is expected to need more than the single Teacher-view pattern (rolls, feeder schools, and social context alongside academic results, per the original scoping discussion) — and each may get its own distinctive extra feature the way Recruitment and Meetings are for Teacher view, not just the four repeating cards.

**Comments on datasets** (§12) — unchanged from v1, still flagged, not designed, not part of any role's view yet.

---

## 18. Verification tasks — for build, not for further discussion

These are real-data checks, not design decisions, and should be confirmed by Claude Code during the build rather than assumed:

- Confirm the four-card content mapping (Candidates/Results/Context/Rankings, and their KS2 equivalents) against the real backend, per v1's original open item.
- **Whether independent junior/preps have real KS2 data** — never actually checked in this design round (unlike special schools, which was verified directly). Don't assume either way.
- Confirm the qualification-type-comparability logic already built is sufficient to gate School Context's and Results' add-lists correctly for every real subject/qualification combination, not just the common cases.
