# VicData — Phase 3: "State of the School" Public Page Spec (v1)
*Phase 3 of the platform build. Companion to `vicdata_phase3_school_rolls_topic_spec_v1.md` — this page is the direct product of that spec's §2 tiering reframe (two-axis: subject × time). Draft for review; most content sections are structurally placeholder until their source topics are built.*

---

## 1. What this page is, and why it exists

The free, public, per-school landing page — the actual page a search result lands someone on. Cross-topic **current-state** facts only (roll size, shape, academic snapshot, social context snapshot, destinations snapshot), never trend lines. Trend analysis, comparative features, and anything requiring school-domain verification live one level in, on each topic's own paid deep-dive page.

**Origin**: this page didn't exist as a concept until the school-rolls tiering principle was reworked from a single axis ("about the world is free, about you is paid") to two axes (subject × time). The old rule couldn't offer a free page genuinely *about* the specific school someone searched for — only generic regional context next to it. The new rule's free "current state of this school" cell is what makes this page possible.

**Direct precedent**: Guy's own consultancy reports already open with a "current state of the school" section before any trend analysis — this page is that same idea, generalised to public/free and built from public data rather than MIS data. Worth checking the actual structure of that existing report section directly (see open questions, §5) rather than designing the shape of "current state" from scratch.

---

## 2. Governing content rule

**Snapshot facts only, as a strong starting default — not an absolute rule.** The reasoning that makes snapshots generally free (low misreading risk, good for search indexability) applied specifically to the categories already spec'd in the rolls topic. It doesn't automatically extend to every future current-state fact — a given snapshot can still be deliberately held back for an unrelated reason (competitive value to other schools, or working better as a paid conversion hook), decided per-item as each section actually gets built, not assumed free by default just because it's a snapshot. No trend lines or historical charts on this page regardless.

Applies uniformly across every topic section below, not just rolls. This is also the page most likely to be seen by an anonymous visitor including a parent (per the home-page/search-safety discussion) — current-state facts were specifically judged harder to misread as alarming than a trend line, which is part of why this rule exists, not just a growth-funnel convenience.

Each section links through to that topic's own paid page for the trend/historical version, once that topic is built.

---

## 3. Content sections

| Section | Data source | Status | Notes |
|---|---|---|---|
| Current roll (total + by age band) | DfE census, latest year | **Buildable now** | Per rolls spec §3 |
| Current shape classification | DfE census, reshaped (rolls spec §4) | Blocked on classifier build | Single-year snapshot only — this is the free half of the shape typology work already spec'd |
| Current gender split | DfE census, latest year | **Buildable now** | Per rolls spec §3; single-sex suppression principle (rolls spec §8) applies here directly, since this is the exact page an anonymous visitor could reach |
| Current boarding split | DfE census, latest year | **Buildable now**, pending field mapping (rolls spec §10) | |
| Academic snapshot (e.g. "X pupils take A-level maths") | DfE performance tables | **Blocked** — academic results topic not yet spec'd or ingested (explicitly deferred in Phase 1 scope) | Placeholder section until that topic's build |
| Social context snapshot | IMD / house prices / GDHI | **Blocked** — social context topic not yet spec'd; IMD not yet ingested, house prices/GDHI only partially generalised | Placeholder section |
| Destinations snapshot | Not yet identified | **Blocked** — destinations isn't one of the three named Phase 3 topics at all; a genuine fourth topic, not yet scoped | Placeholder section |
| Surrounding schools — size/shape context | Nearest 20 schools, matched by age band/phase and sector (state/independent); DfE census aggregate over that list. Deliberately simple, no adaptive radius, no member curation — see rolls spec §4 | **Buildable now** for schools DfE census covers; standalone 6th-form/FE colleges likely have a roll-data gap here (see rolls spec §4) even though they should appear as candidates | Genuinely separate from the member-tier "local rivals" Comparator Set (rolls spec §6), not a shared mechanism |

**Real, buildable-today scope**: only the rolls section. Everything else is either blocked on an unbuilt topic or an open scoping question. Worth being explicit about this rather than implying the page is closer to complete than it is — this spec describes the page's shape and rule, not a ready-to-build backlog.

---

## 4. Relationship to topic-specific pages

This page is the free landing point; it does not replace each topic's own page. A visitor arriving here who wants the trend/historical/comparative version of anything shown gets routed to that topic's paid page (school-domain verification required, per the onboarding work — see companion thread). The rolls spec's own topic page still exists and still holds everything tagged Paid in its tables; this page only ever shows the Free-tagged rows, pulled together across topics rather than siloed by topic.

---

## 5. Open questions

1. **Does an existing "current state of the school" report structure already exist** from Guy's own consultancy work? If so, worth reading directly before designing this page's actual section-by-section shape from first principles — same "check the real precedent" discipline used for the Club ISS school finder.
2. **Sequencing — resolved**: ship now, rolls-only, with visible "coming soon" placeholders for academic/social/destinations sections rather than waiting for a second topic to be built.
