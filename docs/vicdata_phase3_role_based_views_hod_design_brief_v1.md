# VicData — Phase 3: Role-Based Views — Heads of Department / Teachers (v1)
*Companion to `vicdata_phase3_membership_onboarding_spec_v1.md` §5 (Account and role model), which flagged full role-by-role view design and heads-of-department subject-scoping as deliberately deferred. This brief starts resolving both, working from a concrete three-screen Head of Department wireframe (`VicData.co.uk Head of Dept.pdf`). Draft for review, capturing a discussion — several items are explicitly logged as open rather than resolved, and some structural questions were deliberately left unsettled to be worked out dashboard-by-dashboard rather than as an upfront rule.*

---

## 1. Purpose and scope

This is the key design phase for how different users actually see the platform, as distinct from the data/ingestion architecture already built. It starts from one concrete question: given four initial roles, what does each one's *standard* view look like — and specifically, what does the Head of Department / teacher view look like, since it's the one being designed first and the pattern it establishes is meant to generalise to the others.

---

## 2. Two-tier view model (now three)

**Advanced view** — the build done so far (rolls, academic results, comparator sets, rankings, the full topic-by-topic work reflected across the other phase-3 docs). Not the default. A power-user tier a school's own admin can grant to a user who can cope with it.

**Standard view** — new, role-scoped, deliberately simplified dashboards, one shape per role. **All paid.** This is what this brief is about.

**Default/free view** — the platform's existing free-tier experience, built on roll data. Sits below the paid standard views. To be revisited and simplified using whatever principles prove out in this design phase, once the standard-view work is done — not designed in this brief, explicitly parked.

This reframes several existing phase-3 docs: content already built under the "advanced" umbrella may get reused/re-sliced inside standard views (see §6), and most of the underlying data views needed for standard dashboards are believed to already exist in the advanced build — this phase is largely a re-presentation/simplification layer, not new backend work, with two flagged exceptions (see §6).

---

## 3. Roles

### Initial batch (this phase)

- **Head / governors**
- **Admissions**
- **Heads of department** (= the teacher view — see §5)
- **Finance**

Head/governors and finance may end up sharing a view/template — raised but not designed; revisit when we get to that pair.

### Folded, not forgotten

The earlier membership spec (§5 there) listed **director of studies** as a fifth role, distinct from heads of department. Resolved for now: DoS is being folded into head/governors/senior management, because "director of studies" is an independent-school-specific title — state schools have year-group leaders instead, not a DoS role at all. Revisit properly when the head/governors/finance view gets designed.

### Sector-aware labelling

Because sector (state/independent) is known at signup, role *display labels* should come from a language file keyed by role + sector, rather than one fixed label per role. This matters beyond DoS/year-group-leader: the underlying academic-results data is deliberately sector-blind, but role naming on top of it isn't, and this is cheap to design for now versus retrofitting later.

### Identity vs. role

A person enters their own name and job title as free text — profile display only, not structural. **Role** is selected from the platform's fixed vocabulary separately, and role (not job title) is what drives which view and dataset someone gets.

### Later batches, not this one

- **Parent view** — "your child/children's schools: performance in context" and "your school searches" (per child). Will reuse the subject-picker mechanism from §5 (e.g. narrowing to the GCSEs/A-levels a specific child is actually taking). **Note**: the platform roadmap (§12) explicitly parked "parents" as needing a deliberate, separate future decision, specifically because of model-honesty/over-reading risk — see §10 below, where this resurfaced directly.
- **B2B view** — suppliers/consultants/journalists, overview-level. Also the role that would carry the phase-2 authored/pushed custom-dashboard capability (§9).
- **School-group/MAT view** — all schools in a group, at once.

### Primary vs. secondary — a real branch, not a smaller version

Everything in §5–§8 below describes a **secondary-school** pattern (subject/department scoping). At **state primary** schools, all teachers and leaders look at every academic result — there's no subject to narrow to, and "School Context" (my subject vs other subjects) doesn't apply. Primary gets its own onboarding flow and its own card set, not a stripped-down variant of the secondary HoD one. Not yet designed — parked.

**Independent junior schools and preps are a further, more absolute case, not a variant of the above**: these school types have no secondary-phase academic data at all (no GCSE/Post-16 year groups exist there), so unlike state primary — which still has whole-school KS2 data for everyone to see — there's no academic-results view of any kind to build. **Resolved**: only the HoD/teacher (academic) role is excluded at this school type. Head/governors, admissions, and finance all still apply — finance in particular doesn't depend on academic data the way HoD does, so there was no reason to exclude it; that earlier draft's wording was just an incidental slip, not a considered decision.

**Special schools — checked against real ingested data, not assumed.** Special schools are already a confirmed, shipped part of the platform for roll/census purposes (1,498 open schools, a genuine fourth map sector alongside State/Independent/FE — "in scope... if real classifiable roll data exists, it's relevant"). That's a different pipeline from the performance-table data the HoD academic-results view depends on, so this was queried directly against the platform's own live database rather than assumed. Of the 1,498 open special schools:

| Key stage | Schools with usable data | Coverage | Rows | Years |
|---|---|---|---|---|
| KS4 (`academic_headline_snapshot`) | 1,046 | 70% | 3,261 | 2021–2024 |
| KS2 (`dfe_ks2_attainment` via `canonical_facts`) | 360 | 24% | 10,013 | 2022–2024 |
| KS5 (`academic_headline_snapshot`) | 3 | 0.2% | 7 | 2021–2024 |

**Resolved, on real evidence**: special schools are a genuine, viable case for the KS4-based HoD/academic-results view — 70% coverage is a real majority, easily enough to build for. KS2 is a partial case — a meaningful minority (24%) have usable domain data, consistent with many special schools either not covering primary-age pupils or falling under DfE's small-cohort suppression thresholds; whatever primary-facing view eventually gets built needs to degrade gracefully for the schools that don't have it, the same "not every school has every dataset" pattern already handled elsewhere on the platform. KS5 is, in practice, not a case at all — 0.2% coverage means Post-16/A-level-equivalent data is negligible for this school type, consistent with sixth forms being rare at special schools; this is a fact about the data, not a design decision to exclude them.

**Two follow-on filtering rules, prompted by this check:**

1. **Zero-candidate schools should be excluded outright, not just deprioritised.** Some schools currently appear in candidate/results views with zero candidates — hospital schools are the clear example — which is a data artefact, not a real result to compare against. This is a general data-quality floor, not special-schools-specific: wherever a school shows up with zero candidates in a given dataset, it shouldn't appear at all in that dataset's cards, comparators, or rankings.
2. **Special schools should be a sector-visibility default, not a hard inclusion/exclusion.** Viewed from a mainstream school (state/independent secondary), special schools aren't a meaningful peer group and should be filtered out of comparator sets and rankings by default. Viewed from a special school itself, other special schools are the real peer group and should appear by default. Either way, this is a *default*, not a wall: in the advanced view, a mainstream user should still be able to opt in and add special schools to their comparator set manually (e.g. a MAT running both school types together).

---

## 4. Heads of Department = the teacher view

The HoD standard view is also what an ordinary teacher in that department sees — anyone teaching in a department, not only its head.

**Deliberately flat, no permission split.** Every individual's subject selection is personal to them, not owned by the HoD and inherited by others. A teacher who only teaches two or three of the department's subjects can narrow to just those. This was considered against the existing Comparator Set/Feeder Set personal-vs-shared pattern (rolls spec §5/§6) and rejected for subject-scoping specifically — that mechanism is for saved sets used to compare *against other schools*, not for scoping one's own view of one's own school. (The same pattern resurfaces as a plausible fit for a different problem — sharing whole custom dashboards — see §10.)

**"Department" is not a stored platform entity.** The platform's real structural unit is the fixed subject-family taxonomy already built for academic results (the same grouping behind categories like "Arts, Media & Design" in the School Context pie — see §6). What a school or person calls their "department" is informal and up to them; the picker suggests subjects from the family a person arrives through as a starting point, but lets them search and add from any family, so a personal list can legitimately span categories (e.g. a "Performing Arts" department might combine subjects the platform's own taxonomy separates).

**Shared component.** The same "pick your subjects" picker is intended to be reused for the parent view (§3), not built as HoD-specific.

---

## 5. Standard dashboard structure (from the wireframe)

Three screens reviewed: a home screen, an onboarding modal, and a built-out dashboard section.

**Repeating structure per phase** (GCSEs, Post-16 Qualifications): four cards — **Candidates**, **Results**, **School Context**, **Rankings**.

**Non-repeating modules**: **Recruitment** (an Applicants card — performance/scale of applicants' current school), and **Your Custom Dashboards** — a small number of free "build your own" slots per person (see §9 for why this needs to be more flexible than a small fixed number).

**Provisional mapping of the four cards against what's already built** (needs confirming against the real backend, not assumed):

| Card | Likely provenance |
|---|---|
| Candidates | New — a bar chart of candidate numbers across the department's own subjects, with % change. Nothing in the advanced view currently slices "candidates" this way (by subject, within one department, at one school). |
| Results | Likely a re-sliced cut of existing academic-results data (attainment score + trend), re-presented as "my department's subjects side by side" rather than "my subject over time." |
| School Context | New — the department's share of total entries vs. other subject areas in the same school (pie). Nothing currently computes "how big is my department relative to the rest of the school." |
| Rankings | Likely reuses the existing comparator-set/rankings machinery from the advanced view, pre-scoped to the person's subjects and defaulted to a geographic comparator set instead of a manually built one. |

**Pricing**: confirmed — this entire standard view (all four cards, every role) is paid, not free tier.

---

## 6. Onboarding — stepped, not a single modal

Purpose is explicitly twofold:

a) **Focus what's shown** — the subject-picker mechanism (§4).
b) **Start introducing concepts — "ways of seeing"** — the onboarding sequence is a teaching moment, not just a settings form. It should establish, through the structure itself, that "how many" (Candidates), "how well" (Results), "relative to my own school" (School Context), and "relative to other schools" (Rankings) are genuinely different questions worth asking separately — consistent with the design-philosophy lineage already in the platform roadmap (Playfair/Nightingale, making statistics legible to non-specialists).

So onboarding is a **stepped walkthrough of four steps, one per card type** (Candidates, Results, School Context, Rankings) — not the single confirm-your-subjects modal shown in the wireframe.

**For the first build**: only the Candidates step is fully specced — the subject-confirmation mechanism from the wireframe (§4). The other three ship as placeholders (heading + a "next" arrow only), deliberately, rather than filled in quickly just to complete the shell. **This is genuinely open and needs real care, not a quick fill-in**: what real data and what one line of explanation earns each of Results, School Context, and Rankings its own "way of seeing" moment.

**Still open**: is the walkthrough shown once on first login, or reachable again later (e.g. from settings, or when someone's subjects change)?

---

## 7. Card interactions (post-onboarding dashboard)

**Simplified default card content**: each card starts with just one map/rank/graph, plus text and a small number of key figures — not the fuller multi-series treatment shown in the wireframe's built-out screen. This is deliberate: a lighter default is both less overwhelming and a genuine incentive to interact — the card visibly has more behind it, which is itself a second, in-situ pass at teaching the "ways of seeing" idea (the default view type is an implicit statement of "this is the most useful lens for this question," and switching it teaches there are others).

**Expand to a focused view.** Any of the four cards can expand into a single focused view — the same view a person effectively reaches mid-onboarding. Behaves like an overlay in the existing advanced dashboard (stays open until closed, not a page navigation). Needs to work well specifically at mobile sizes, not just "be responsive" generally.

**Within the focused view**: switch how the data is shown, and adjust scope (focus narrower / widen).

- View types (map / graph / rank) are not a fixed menu offered (with some options greyed out) on every card — which ones are meaningful follows from what's actually being compared. A within-school department comparison has no geography, so Map is genuinely irrelevant there, not just deprioritised.
- "Rank" and "table" appear to be the same underlying sortable/ordered mechanism, rendered differently depending on what's being ordered — e.g. a subject's candidate numbers across several years as a sortable table is mechanically the same as a leaderboard-style rank, just ordering years instead of peers.
- **Deliberately not formalised into a general rule right now** — we're refining each dashboard as it's built rather than designing a universal view-type/axis system upfront. Worth keeping the pattern in mind, but not a spec item yet.

**Universal export.** Every map, graph, and ranking — not only Rankings' Map/Graphs/Rankings tabs — gets full-screen view and PDF/print export, for presentations. This generalises an item already in the platform roadmap (§5 there): presentation-ready export for board packs was flagged as a low-cost, high-perceived-value paid feature worth building early.

**Saved state.** Whatever view a person leaves a card in (chart type, scope) persists to their profile, so they return to the same place next time. The same interaction data doubles as usage telemetry (what users are actually doing).

**Colour**: the priority right now is super consistency across the whole project, not solving the exact palette/semantics up front. Two deliberate escape valves: a unified colour redesign pass at the end, and a per-user override on the account page (which also functions as a free colourblind-accessibility option if built as a genuine palette swap).

**Light/dark theme**: the reviewed wireframe mixed light and dark screens inconsistently — not the intent. Needs a proper toggle, set alongside any colour override on the account page, **defaulting to dark**. Two things worth deciding alongside the toggle itself, not after: (1) both palettes need to be designed together from the outset — a dark-first design with light bolted on later (or vice versa) is usually where dataviz colour contrast quietly breaks; (2) the universal PDF/print export above should very likely default to a light, print-safe rendering regardless of the viewer's on-screen theme — a dark-mode board-pack PDF is awkward to print or project in a lit room, even where dark is the right on-screen default.

---

## 8. Comments on datasets (flagged, not designed)

Idea: admissions teams and leaders being able to add comments/annotations directly on a dataset or chart — turning a number into something that accumulates institutional context over time (e.g. "roll dropped here because a feeder school closed"), useful for governance and board-pack use. Named roles suggest this is aimed at governance-level use rather than a universal card feature. Open for later: visibility scope (author-only, senior-team, MAT-wide), and how it interacts with the export/PDF feature in §7 (do comments appear in an exported board-pack PDF?).

---

## 9. Custom dashboards

A small fixed number of "build your own" slots (as shown in the wireframe) is too limited once someone is fluent with the standard views — the real need is genuine flexibility, split into two distinct mechanisms:

### Self-service (this phase)

Built by the account holder, for themselves. Three flavours, the third being the general case:

a) **Cross-phase mashups** — e.g. comparing KS2 Maths with GCSE with A-Level in a through-school. Flagged caveat: this isn't just plotting three series on one chart — KS2, GCSE, and Post-16 measure genuinely different things on different scales (the project already has separate "what is measured" briefings for each of the three, precisely because they don't share a common axis). A trajectory view across phases needs a normalised/indexed treatment to be honestly comparable, not a shared raw axis — read those three briefings together before this specific mashup gets designed.
b) **Cross-subject mashups** — e.g. three A-level subject choices compared side by side. Same phase, same scale — structurally simpler than (a), closer to what the existing comparator/rankings machinery already supports.
c) **Free-form** — just exploring, no prescribed template. The base case; (a) and (b) are specific instances of it.

### Authored and pushed (phase 2, explicitly deferred)

A consultant (or more generally, any **B2B account**) creates a custom view and pushes/assigns it to a specific school-side user — e.g. Victoria Consultancy building something for a senior leadership or admissions contact. Generalised beyond Victoria Consultancy specifically: this should be modelled as a capability of the B2B role type from the start, even though it isn't built until phase 2, since other B2B users (suppliers, other consultants, journalists) would plausibly want the same mechanism. Structurally distinct from the self-service case: someone outside the school's own role hierarchy creates content that appears in another person's account.

**Custom views must be named** — a basic requirement of both making them ownable and (per §10) shareable. Implies some minimal validation (uniqueness? default vs. required custom names?) and is also the first point at which model-honesty applies to user-generated content, not just platform-authored framing — a provocative or alarmist name on a shareable view is a real thing to consider once sharing is in the mix.

---

## 10. Sharing views

Idea: users sharing custom views with each other, "like playlists." Genuinely distinct from both custom-dashboard mechanisms in §9 — not self-service-for-yourself, and not an asymmetric author-pushes-to-assigned-recipient B2B relationship, but peer-to-peer and potentially discoverable.

**Open fork**: does sharing mean sending a live, evolving view that updates as the original author keeps tweaking it (follow/subscribe), or a copy the recipient then owns and can diverge from (duplicate)? These behave very differently and haven't been decided.

**A relevant existing precedent**: within-school sharing (e.g. a head sharing a governor-ready view with the whole senior team) may just be the existing Comparator/Feeder Set shared-vs-personal pattern (admin-owned, school-wide) applied to full custom dashboards, rather than a new mechanism — worth checking before designing something new. (This is a different conclusion from §4, where the same pattern was checked and rejected for subject-scoping specifically.)

**Low privacy risk, structurally**: because nothing on this platform is ever pupil-level data, a shared view is just a saved configuration (subjects, comparator set, chart type) — nothing personal is ever in it, which is a genuinely favourable property for a sharing feature to have.

### Parent-to-parent sharing — flagged as a real tension, not a simple growth win

Raised as a potentially viral, audience-building mechanic: a parent builds a view and shares it with other parents. **This runs directly into a risk the roadmap already identified and deliberately parked.** The membership onboarding spec's parent-safety section exists precisely because the platform's legibility-focused design makes school data *more* readable to a parent than raw DfE data ever was, and because a parent over-reading a school's numbers as "is my child's place at risk" was named as a genuine, non-hypothetical risk. The existing mitigations (a school's own trend line always woven into multi-line context, never standalone; no red/down-arrow styling; framing designed to "survive a screenshot") were all built around platform-authored pages. A parent-created, parent-shared custom view is a harder version of the same problem — not a static image losing its caption, but a live, re-shareable object that could strip out exactly the framing the rest of the platform enforces by design, if the custom-dashboard builder allows it. "My kid's school's roll is dropping," isolated and forwarded in a parent group, is close to the platform's worst-case scenario.

**Two things need to happen before this is designed, not after**: (1) the roadmap's own "parents: parked, needs a deliberate separate decision" item needs to actually be revisited on purpose — this conversation has already drifted into assuming parents are in scope (reusing the subject-picker for them in §3) without that decision being consciously made; (2) if pursued, the safe-framing rules need to be enforced structurally in the sharing/custom-view mechanism itself, not applied as a default style a user could remove.

---

## 11. Design texture — obvious and pleasurable

*Added at Guy's prompt to think beyond decluttering. Not yet discussed/agreed — for reaction, not treated as decided.*

- **Obviousness comes from radical consistency, not more explanation.** Whatever the final card pattern is, it should be pixel-identical in position, icon, and colour language everywhere it appears — every subject, every topic, every role — so nobody has to relearn "where's the trend information" moving between contexts.
- **Keep questions as card headers.** "How are pupils at Acland Burghley performing in GCSE Art & Design exams?" as literal card copy, already present in the wireframe, tells someone what they'll learn before they open it. Worth treating as a hard rule everywhere, not incidental to this one card.
- **Never show a bare number without a comparison anchor** — the UX expression of the model-honesty principle already governing the data itself; an unanchored number is where both confusion and (per §10) misreading creep in.
- **Protect and extend the onboarding live-count moment.** Ticking a subject and watching "84 candidates" appear (already in the wireframe) turns configuration into discovery rather than paperwork — the platform's best existing pleasurable mechanic. Worth deliberately building more onboarding steps around the same live-feedback pattern rather than treating it as incidental.
- **Let the brand breathe a little at the edges, even with the dashboard staying serious.** The roadmap's firm line (wit in the brand layer, plain and serious in the working dashboard) is right for the data itself, but there's room for small personality in the non-data moments — an empty custom-dashboard slot, a first-time milestone, a chart-type icon that gestures at Nightingale's coxcomb or Playfair's original bar chart — without compromising the boardroom seriousness of the data itself.
- **Ownable surfaces build the pleasure, not decoration.** Named custom views, remembered state, a personal subject list — already functional requirements — are also what make the tool feel built for the individual rather than generic software with a name badge on it.

---

## 12. Internal role/school switch (build & QA tool)

The account view gets a **role switch** and a **school switch**, letting an internal account view the platform as if logged in as any role at any real school, without provisioning a genuine account for every combination.

This directly serves the testing gap identified when reviewing build-readiness: verifying the four-card mapping, subject taxonomy, and sector-label system (§3) across a real spread of schools — large vs. small, state vs. independent, GCSE-only vs. through-school — without needing a real login for each one.

**Resolved**: no paid/unpaid toggle needed — the switcher works from Guy's own already-entitled login, not a simulated account state. The unpaid-HoD experience (§5's pricing note) remains a separate, undesigned question, just not one this tool needs to answer.

**Resolved**: this is a genuine role, not a personal hack — a **system admin** role, held by Guy and shareable with future internal team members. Deliberately named to keep it distinct from the existing, unrelated **school admin** concept already in the account model (§5 of the membership spec — an account holder can create school-level admins who manage members and shared saved sets at *that school*). System admin sits outside the school hierarchy entirely and isn't scoped to any one school; school admin is a per-school role scoped to that school's own members. The naming needs to stay this precise wherever it's built, not just in this brief, since "admin" alone is already taken.

**Safety note**: as a "become someone else" mechanism, it must stay strictly read/preview — never able to see or mutate another real user's actual saved custom dashboards, comments, or saved state once those features exist.

---

## 13. Open items

- Head/governors/finance shared-view shape — not designed yet.
- ~~Zero-candidate school exclusion and the special-schools sector-visibility default (§3) — both agreed in principle; needs implementing consistently everywhere an entity list gets built (comparator sets, rankings, and any onboarding candidate-count logic), and confirming which establishment types (e.g. hospital schools) actually surface as zero-candidate today, rather than assuming hospital schools is the only real case.~~ **Resolved and shipped** — see `vicdata_phase3_special_schools_zero_candidate_filtering_build_report_v1.md`. Zero-candidate exclusion implemented in `stagesPresent()` (the single chokepoint the comparator-widen route, dashboard card, and data view all use), on a "has a real candidate count or a real headline measure" test rather than a naive zero/null check — the real zero-candidate population turned out to be newly-opened schools without a Year 11 cohort yet, not hospital schools (hospital schools/PRUs/AP have no `academic_headline_snapshot` rows at all, so were never the mechanism). Special-schools sector-visibility default was already live and confirmed correct on real schools (Harmood: 29/30 special comparators; Haverstock: 0/30), with the mainstream opt-in override intact.
- DoS → head/governors/senior-management folding, and the sector-label language file's actual content — decided in principle, not yet specified.
- Primary school's own onboarding flow and card set — not designed yet.
- Confirm the four-card content mapping in §5 against the real backend rather than the provisional guess given.
- **Onboarding content for the Results, School Context, and Rankings steps (§6)** — structure resolved (four steps, one per card type), but only Candidates is specced; the other three are placeholders in the first build and need genuine, careful design, not a quick fill-in.
- Onboarding repeatability (§6) — shown once on first login only, or reachable again later?
- Usage-telemetry/saved-state data (§7) is a new personal-data category (identified staff behavioural data) not yet accounted for in the platform's GDPR/data-protection section (roadmap §7). Lower stakes than pupil data, but real — needs folding into the privacy policy/lawful-basis work already flagged there as launch-blocking.
- Comments on datasets (§8) — visibility scope and interaction with PDF export not decided.
- Sharing mechanism (§10) — follow-vs-copy fork not decided; whether within-school sharing simply reuses the Comparator/Feeder Set pattern not confirmed.
- **The parent-sharing decision (§10) is the most consequential open item in this brief** — needs the roadmap's parked "parents" decision revisited deliberately, not assumed by default through reuse of the subject-picker.
- Design texture ideas (§11) — not yet reacted to.
- The unpaid-HoD experience (§5, §12) — still nobody's designed what a non-paying user actually sees; no longer expected to be answered via the switcher.
- System admin role (§12) — resolved as a real role distinct from school admin, not yet specified beyond the switcher capability itself (what else, if anything, a system admin can do).

**Deliberately deferred, not forgotten:**

- View-type-per-comparison-axis rules (§7) — noticed as a pattern (across-schools / within-school-across-subjects / one-subject-across-time each implying different natural view types), explicitly not being formalised now.
- Card functionality beyond the four discussed here — flagged directly: the eventual dashboard's cards will carry more functionality than covered in this brief.
- Default/free view (built on roll data) — to be revisited and simplified once this standard-view work is done (§2).
