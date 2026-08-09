# VicData — Backlog: Deferred Items With No Other Home (v1)
*Items that are genuinely decided-as-deferred (not forgotten, not blocking anything current) but don't belong in any existing doc. `vicdata_phase3_going_live_notes_v1.md` covers VicData Public's own pre-launch checklist — don't duplicate those items here. This doc is for everything else with nowhere else to live.*

---

## VicData Public — resolved since the first build pass (2026-08-07, continued)

- ~~Precomputed aggregate/sync job~~ — **done**: `scripts/sync-roll-aggregates.ts`, writing into a new `roll_aggregates` table. Historical trends, market share, ranks, peer trends, and free-tier regional/national context are now all live on real data.
- ~~"Local rivals" Comparator Set variant~~ — **done**: now genuinely reuses Feeder Set's adaptive-radius mechanism, not a separate simplified implementation.
- **Feeder Set intake-size target-count scaling — built, but the core formula is flagged by Claude Code itself as having no empirical basis.** The cohort-progression intake-size estimator exists and is reasoned through (age→entry-point mapping, range-not-point-estimate presentation, a zero-quirk guard, keeping negative values as real signal) — but the actual target-count formula is explicitly called a placeholder, not validated engineering. Full breakdown in the ingest/vicdata_public `OPEN_QUESTIONS.md`. **Worth Guy's direct review before trusting this number in front of real users**, same category of item as the single-sex suppression threshold below — a provisional piece that needs empirical validation against real data, not just code that runs without error.

## VicData Public — deferred during the first build pass, found 2026-08-07

All three items originally logged here are now resolved — see the entry above. Kept as a historical record of what the first build pass deliberately deferred and why, not a live to-do list anymore.

## VicData Public — search, found during review 2026-08-08

- **GIAS town-field data quality**: 349 schools have a county name (ends "-shire," or a bare county like "Surrey"/"Kent") rather than a real town in `school_entities.town`, sourced directly from GIAS. Currently mitigated at the search layer (per-word `ilike` fallback rescues these), not fixed at the data source. Worth a proper fix upstream if `town` is ever surfaced directly to users (e.g. on the State of the School page) rather than just used internally for search matching.
- **Structural search fragility, broader than any single bug**: mandatory AND-conjunction in the FTS stage fails outright whenever a user's query includes any word not literally present in a school's indexed text — the county/town issue above is one measurable manifestation of this, not the full extent of it. A deeper rework (e.g. relaxing to "most terms match" rather than strict AND) would be a bigger, separately-risky change — worth a dedicated look, not a quick patch.

## Future data sources — confirmed need, real candidate found, not yet actioned

- **ILR (Individualised Learner Record) — for topping off rolls data with genuine FE-corporation institutions.** Confirmed: raw ILR is not public; genuine FE colleges/sixth-form colleges report roll data through it, not school census (structural split, not a data gap); their exam results already appear correctly in DfE's KS5 performance tables. **A specific real candidate file has been found**: "Underlying data – Under 19 learner participation by provision type (in development)" on DfE's Explore Education Statistics platform — same publishing platform as school census, provider-level, 56MB CSV, covering the right age range. **Explicitly labelled "in development" by DfE itself** — their newest, least mature data product for this purpose, not a stable equivalent to school census. A full investigation prompt (download the file + its metadata doc, check actual column structure, provider-ID matching to GIAS/URN, coverage of genuine FE-corporation institutions specifically, data-quality signals) is ready to send when this gets picked up — deliberately not sent yet, per Guy's call to keep momentum on the current rebuild rather than open a second investigation thread mid-flight.
- **ISC membership flag** — may already exist in a related repo (`isc_membership` table in club-iss's Supabase project, ~1,785-row member file) — worth checking reuse before sourcing fresh.
- **GIAS governance/ownership info** — genuinely unconfirmed whether GIAS carries this cleanly for independent schools; academies likely have trust/federation fields.

## Ingest repo — small, flagged, not investigated

- **Actor/permission gap in `source_field_mappings`' drift-flagging path** when a mapping is registered from a raw script rather than through `admin_app.py`'s authenticated session. Hit once during the town/postcode extension, worked around, not investigated further — worth a proper look at some point, low priority.

## Ingest repo — after the current VicData Public build

- **Era 2 live promotion decision for boarding data.** The historical backfill (2019–2025/26) is fully in and verified against real schools — nothing here blocks VicData Public. But whether/how boarding data flows through *ongoing* census updates going forward is a separate, bigger first-time decision that hasn't been made yet. Confirm this doesn't quietly mean boarding data goes stale after the current backfilled years.
- **Backfill fragility, logged in the ingest repo's `OPEN_QUESTIONS.md`, flagged-not-fixed**: the single-transaction insert+promote design (caused two lost multi-hour runs during the boarding backfill before the real fix was found) and unbatched multi-million-row `finalize_promotion` statements. Worth fixing properly before the next large-scale backfill — academic results, whenever that topic is spec'd, will very likely need one at similar scale to this 27M-row one.

## Future Phase 3 topics — not yet spec'd, sequencing already discussed

Per Guy's own stated priority order: membership/onboarding and rolls first (done), then academic results (needs its own large ingest first), then social context, with these genuinely open beyond that:

- **Destinations** (university, training, employment) — a real fourth topic, not a sub-item of anything already spec'd. Good data understood to exist.
- **School budgets** — useful specifically for state-school governors.
- **Fee data** — wanted, but flagged as likely needing a large-scale custom scrape, a genuinely different engineering problem from the registry-pattern public bulk sources used everywhere else so far.
- **Devolved nations** (Scotland, Wales, Northern Ireland) — a jurisdiction axis, not a topic axis; cuts across every existing and future topic rather than being one more item on the list. `jurisdiction` schema field already reserves these values, so the architecture has room, but no work has started.

## Guy's own action item, still open

- Check whether an existing "current state of the school" report structure already exists from his own consultancy work, to reference before the State of the School page's section-by-section shape gets refined further (also logged in the membership/onboarding spec §6 — kept here too since it's easy to lose track of an action item that lives only inside a spec doc's footnotes).
