# VicData — Phase 3: Membership & Onboarding Spec (v1)
*Phase 3 of the platform build. Companion to `vicdata_phase3_school_rolls_topic_spec_v1.md` and `vicdata_phase3_state_of_school_page_spec_v1.md`. Covers the home page, school search, the join flow, and the account/role model. Draft for review; a small number of items are explicitly logged as open rather than resolved.*

---

## 1. Purpose and scope

Everything upstream of and around the topic content already spec'd: how someone arrives, finds their school, joins, and what role/account structure they land in once they have. Builds directly on the two-axis tiering principle from the rolls spec (§2 there) — several decisions here follow from it rather than being independent choices.

**Explicitly not in scope here:** the topic content itself (rolls, and future academic/social/destinations topics — see their own specs); Phase 2 (VicDash, separate build); pricing mechanics beyond what's needed to describe the account model (exact price points remain a roadmap open item).

---

## 2. Home page and public-facing framing

**Governing constraint**: this is the one place in the product where brand plays — the roadmap draws a firm line that Victoriana wit and tone concentrate in the brand layer (home page, illustration, tone of voice), while the working dashboard itself stays plain, honest, and serious throughout. The home page is deliberately doing more brand work than anywhere else in the site, not less.

**Most real traffic won't land here.** The growth strategy is built on ~24,000 individually indexed school pages winning organic search directly — a head googling their own school plus "catchment" lands on that school's State of the School page, not the home page. This reframes the home page's actual job: brand anchor for visitors arriving with intent (direct visits, word of mouth), not the primary conversion funnel most SaaS home pages are built to be.

**"For professionals, not parents"** carries through as a tone principle from the comparator/ranks work into home-page copy itself — this is where a visitor first calibrates who the product is for.

**Needs to read as its own thing**, distinct from Victoria Consultancy — the legal/brand separation already decided in the roadmap only means something if the home page actually establishes it visually and tonally.

### Parent-safety framing — resolved via the tiering split, not via gating

A real, worked-through tension: the design philosophy behind this whole product (Playfair, Nightingale — making statistics legible to non-specialists) is exactly what makes it more accessible to an audience it wasn't built for than raw DfE spreadsheets ever were. A well-designed chart is more findable and more parseable by a parent than a CSV column ever was. This isn't a side effect to fully engineer away — it's close to inherent in doing the design work well.

**Resolved approach: "solved by framing," not full school-domain gating.** Full gating was considered and rejected — it would walk back the core organic-search growth engine the whole roadmap is built on, and that's a business-model-level cost, not a UX setting. Instead:

- The two-axis tiering split (rolls spec §2) already does real protective work here, not by design intent but as a consequence: a school's own trend line — the content most likely to read as "my child's place is at risk" — is already paid/verified-only. What's open is current-state snapshots, which are structurally harder to misread as alarming ("450 pupils, shape: pyramid" states something, it doesn't imply a direction).
- **A school's own line, when shown at all on the free tier, is always woven into a multi-line regional/national context chart — never presented standalone.** Same visual weight as its neighbours, no callout box, no red/down-arrow styling picking it out. This is the house rule for every future topic, not a rolls-specific exception — every topic will face the identical "does the free tier get one school-specific line woven into context, or none at all" question, and the answer is locked in as "woven in, never standalone."
- Plain-language captions under every open chart, stating what the number does and doesn't mean — not left to be inferred from clean design.
- **Framing needs to survive a screenshot, not just live as page furniture.** A shared/screenshotted chart typically loses its caption — anything designed to be shareable (a real, additive distribution lever, not something to avoid) needs its safe framing baked into the image itself, not placed around it in the surrounding UI.
- **The paywall prompt itself needs the same no-alarm discipline.** Easy to miss: whatever teaser sits in front of a paid, school-specific chart is still visible to any anonymous visitor, including a parent. "See what's changing at [School]" manufactures exactly the anxiety being avoided elsewhere; "Detailed roll history is available to verified school staff" states the same fact without the hook.
- Free is a **strong starting default, not an absolute floor** — a specific current-state fact can still be deliberately held back for reasons unrelated to misreading risk (competitive value to other schools, or working better as a paid conversion hook), decided per-item as each topic's content becomes real.

---

## 3. School search

**Real precedent checked before designing from scratch** — Club ISS already built and runs a working school finder; investigated directly (architecture, matching logic, data completeness) rather than assumed.

### What ports cleanly

The algorithm shape has no Club-ISS-specific coupling: 300ms debounce, minimum 2 characters, full-text-search-first with a suffix retry ("+school"/"+college" appended if fewer than 3 results), `ilike` substring fallback, dedup, cap results. Frontend pattern: live-as-you-type dropdown, not submit-then-results.

Also directly reusable as patterns, not just the search algorithm:
- **The "can't find your school?" manual-entry fallback**, which creates a pending record and emails an admin — a working, real implementation of the manual-verification-fallback principle already agreed (§4).
- **The `/api/check-school` pattern** as the fork point once someone commits to joining (§4) — not part of search itself, but the natural next step after it.

### What needs building fresh, not ported

The actual query is tightly bound to Club ISS's own schema (`search_vector`/`search_text` columns) which don't exist on `school_entities` at all. Needs: town/postcode pulled in from GIAS (already confirmed available in earlier data checks) and a proper `search_vector`/GIN index built on `school_entities` itself — real work, not a port.

### Two real gaps in Club ISS's implementation, worth fixing rather than copying — VicData's scale makes both bite harder

At Club ISS's 1,786 schools, these mostly got away with it. At VicData's 52,419, they won't:

- **No relevance ranking at all** — results return in whatever order Postgres happens to give back, capped at a fixed number. **Resolved: build real ranking from the start** — `ts_rank`/`ts_rank_cd` with `setweight()`, name matches weighted above town/postcode matches.
- **No typo tolerance** — whole-word-only FTS structurally can't catch a misspelled name, which sits uncomfortably next to "getting this right is absolutely key." **Resolved: add `pg_trgm` trigram similarity alongside FTS from the start**, not deferred to a later version.
- Same-name-same-town collisions are also under-disambiguated in the current result-row design (name / town·postcode·boarding-day) — worth a stronger third field in VicData's version given the larger dataset makes collisions more likely, not less. Not yet resolved to a specific field.

### Side finding, not actionable now

Club ISS's table already carries thin real Scotland/Wales/NI rows (87/78/14) — not usable as VicData data directly, but a concrete reference point for the devolved-nations expansion already flagged as a future direction.

---

## 4. The join flow

**Search is stateless and carries no membership semantics.** Someone can search and view any school's page without any account action at all — pure identification, fully separate from what happens next.

**`check-school` is the fork point**, firing only once someone commits to actually joining a specific school — not part of search itself. Two genuinely different branches:

| | No approved member yet at this school | Already has an approved member |
|---|---|---|
| **What this means** | This person is potentially the first from their school on the platform | This person is requesting to join an existing school presence |
| **Flow** | Verification fires (auto-match against GIAS's published school website domain; manual fallback for the rest — decided some months prior to this session) | Routes to the existing account holder/admin for approval, not a verification flow |
| **Resulting role** | Auto-assigned account holder (§5) | Ordinary member, pending approval |

**Email capture: resolved as fully open, non-blocking.** The core growth engine depends on Google being able to crawl and rank real, visible content — an email wall between a search result and the actual page breaks that. Given the two-axis tiering split now makes a meaningful amount of school-specific content free (current-state snapshots), this matters more than it did under the old single-axis rule. Resolved approach: **optional, non-blocking prompt** alongside visible content (e.g. "get catchment alerts for this school") rather than a wall in front of it — preserves indexability while still offering a lead-capture path for engaged visitors.

---

## 5. Account and role model

### Account holder

- **Always singular** — one person at a time, never duplicated or shared simultaneously. Reallocatable to a different single person, but the concept itself doesn't split.
- **Billing stays exclusively here** — resolved directly by the singularity of the role; no separate "billing owner" needed as a distinct concept from account holder.
- **Auto-assigned**, not a deliberate claim step — whoever is the first verified member at a school becomes account holder immediately, no extra friction at signup.
- **Reassignment: deliberate handoff, always** — initiated by the current holder specifically, who chooses a recipient (existing member or a new invite); the recipient confirms/accepts, transfer completes. Applies uniformly, including correcting a wrong initial auto-assignment — no separate lighter-weight self-claim path. **Known edge case, not yet resolved**: this assumes a cooperative current holder. If the wrong person auto-claimed and doesn't respond or isn't aware there's an issue, there's no self-serve fix — that becomes a support-mediated case, not something the product handles on its own.

### Admin (distinct from account holder)

The account holder can create other admins — a genuinely separate, lesser tier: real management capability (add/remove members, create and manage school-shared saved sets) but **not** the billing/account-holder role itself. Multiple admins can exist simultaneously (unlike account holder, which cannot).

### Roles and views

Confirmed roles: **head/governor, admissions, finance, director of studies, and heads of department** — the last two are genuinely separate from each other, not a naming reconciliation of the same thing (the OPML's "heads of department" and the roadmap's "director of studies" both stay, as different roles).

**Real architectural implication, flagged not fully resolved**: role-based views are not simply different *framings* of the same underlying data (the roadmap's original description) — some content is genuinely **hidden** from some roles entirely (e.g. academic-results views not shown to admissions). This is a real access-control layer, not just a UI emphasis layer, and needs to be designed as such when role-scoping is properly specced — worth flagging now so it isn't defaulted into the lighter "same data, different framing" version by accident later.

**Heads of department is structurally different from the other roles** — director of studies/finance/admissions are naturally one person each; heads of department could be many per school (one per subject), and would want subject-scoped views once the academic-results topic exists with subject-level granularity. Not solved now — flagged as a real shape difference in how role management needs to work, deliberately deferred until academic results is spec'd.

### Personal vs. shared saved sets (Comparator Set / Feeder Set — full mechanism detail in rolls spec §5/§6)

| | Comparator Set | Feeder Set |
|---|---|---|
| Personal (per individual member) | Up to 3, editable | Not really applicable — one real answer per entry point, not multiple personal variants |
| Shared (school-wide, admin-owned) | Unlimited | The canonical shared set per entry point |
| Exception | — | Admissions may want a personal exploratory "wider pool" layer alongside the one canonical shared set |

### Individual-to-institutional funnel — resolved as a side effect, not a new mechanic

The roadmap named this funnel as a real growth lever (an individual member becomes the internal champion who drives a school-wide upgrade) but never specified its mechanics. **Resolved**: the tier/billing change itself needs no new infrastructure. An individual signing up at a school with no existing members is, by the account-holder auto-assign rule above, already the account holder from the moment they join — on an individual-paid tier, but already correctly linked to that school as its account holder. "Upgrading to school-wide" is simply a tier/billing change on an account that already exists and is already in the right place, not a new handoff or linking process.

**Account-holder handoff is a separate, decoupled step**, not part of the tier change itself — the person who drove adoption (say, a director of studies) isn't necessarily who should hold billing once it's a real institutional subscription. If a handoff is wanted at this point, it's the same deliberate-handoff mechanism as any other reassignment (above), not a funnel-specific variant.

**New: proactive school-membership upsell warning.** Fires when a school reaches a **second** individual member — a sharp, quantifiable trigger, not a soft nudge: two individual memberships (~£4-6/mo each) already meets or exceeds the £10/month school-wide cap that covers *unlimited* roles, so the suggestion is frequently an objectively better deal at exactly that point, not just a vague upsell. **Targets both** the second person joining and the existing account holder. **Non-blocking** — both can proceed as individuals if they choose; the warning informs, it doesn't gate.

---

## 6. Open items

**Action item for Guy, not resolvable from this side**: does an existing "current state of the school" report structure already exist from your own consultancy work? If so, worth reading directly before the State of the School page's section-by-section shape gets designed further from first principles — same "check the real precedent" discipline that paid off for school search.

**Claude Code checks, batched for later** (cross-referenced in rolls spec §10, not duplicated here):
- `source_field_mappings` empty for `source_id = 'dfe_school_census'` — deliberate or a gap.
- GIAS's non-mainstream establishment categories (which values to exclude from the "nearest 20" search), and whether standalone 6th-form/FE colleges appear in DfE census roll data at all vs. only in post-16 performance tables.

**Build note, not a discussion item**: `school_entities` needs town, postcode, and a proper `search_vector`/GIN index built before the search port (§3) is actually buildable — follows directly from the Club ISS findings, not a new decision.

**Deliberately deferred, not forgotten**:
- Full role-by-role access scoping (which topics/views are visible to which roles) — flagged in §5 as a real access-control question, not yet designed.
- Heads-of-department subject-scoping mechanics — waits on the academic-results topic existing.
