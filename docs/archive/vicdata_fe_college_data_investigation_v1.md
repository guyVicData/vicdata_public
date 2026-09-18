# VicData — FE / Sixth-Form College Roll Data: Investigation Findings & Ingest Plan (v1)
*Desk research completed 2026-08-21, from Explore Education Statistics / GOV.UK pages directly, not yet verified against actual downloaded files or real match rates against `school_entities`. That verification is the first step of the build prompt at the end of this doc — same discipline as every other data source in this project (confirmed live, not assumed). Picks up the backlog item flagged 2026-08-07: "ILR — for topping off rolls data with genuine FE-corporation institutions," which named one candidate file and deliberately didn't investigate it further at the time.*

---

## 1. The gap this addresses

The ~502 genuine FE-corporation institutions (further education colleges, HE institutions, sixth-form centres, special post-16) have zero DfE school census facts — a structural split, not a data gap in the existing pipeline: these institutions report through the Individualised Learner Record (ILR), not school census, so `dfe_school_census.py` will never see them no matter how it's extended. This is the confirmed root cause of the Worcester Sixth Form College gap surfaced in Task 3 of the review log (no surrounding-schools section at all) and the reason the rolls spec (§4) flags the nearest-20 mechanism as needing to decide how to handle a candidate with no roll data. GIAS lists these institutions regardless — identification/location was never blocked, only roll-figure availability.

Sixth-form colleges that converted to academy/free-school status are **not** part of this gap — they're legally schools and already covered by census (35/42 and 35/36 respectively, per rolls spec §10 item 7). This investigation is specifically about the ~502 genuine FE-corporation institutions.

---

## 2. What's actually out there — three real candidates, none a clean match to school census

### Candidate A: "16-18 participation and enrolments" (FE Provider Dashboard data) — best conceptual fit, worst maturity

Published for the first time in the DfE "Further education and skills" 2024/25 release, as explicit **"official statistics in development"** — DfE's own words: published "to support the testing phase of a FE Provider Dashboard for colleges and larger local authority FE providers in receipt of £1m or more," and "data presented is as recorded on the ILR and may not represent an accurate estimate of activity by providers at this stage."

This is the direct successor to the backlog's flagged candidate ("Under 19 learner participation by provision type (in development)"), same ILR-sourced, same-shaped "in development" status, now live rather than hypothetical.

Two real limits worth being honest about before committing to it:
- **No historical depth** — first published this release cycle, so there's no multi-year backfill sitting behind it the way census has. "Back to 2019" is not achievable through this file alone.
- **Coverage scoped to larger providers** ("£1m or more" in FE funding) — smaller genuine FE-corporation institutions may not appear in it at all. Needs checking against the real ~502-institution list, not assumed.

### Candidate B: KS5 "16-18 institution level" performance data — most mature, but measures a different thing

**Accredited official statistics** (not in development), per-institution with a `school_urn` field, includes `pupil_count`/`pupil_trigger_count` fields. The consolidated download covers academic years 2020/21–2023/24 (4 years); DfE also publishes each academic year as its own release page going back further (a 2019/20 release page exists), which may extend real per-year archives closer to 2019 if pulled individually rather than from the single consolidated file — not yet confirmed.

**The real catch**: these counts are cohort sizes for specific KS5 qualification-type cohorts (A level cohort, applied general cohort, tech level cohort, etc.) measured at the **end** of 16-18 study — a leaver/cohort count, not a point-in-time snapshot of everyone currently enrolled across all ages the way census's roll-by-age is. It answers "how big was this year's leaving cohort" rather than "how many 16/17/18/19-year-olds are here right now." Structurally closer to what the rolls spec already does for market share/intake estimation than to a true roll figure.

### Candidate C: "Education and training providers - detailed enrolments" — right shape of history, wrong metric, discontinued

Provider-level with UKPRN, genuinely time-series (2016/17–2021/22, six years, closer to the 2019 target than either of the above) — but **discontinued** (last published January 2022, explicitly flagged "not the latest data" on the live page, superseded by Candidate A's approach) and an **aim-level enrolment count**, not a headcount: "learners undertaking more than one course will appear only once in the grand total" is true for participation-style files but this specific "detailed enrolments" file counts enrolments at aim level, meaning a learner studying multiple courses can be counted more than once. Age breakdown at provider level not yet confirmed — needs checking against the real file, not assumed from the page description.

### What this rules out as a clean win

There is no single existing public DfE/ILR-derived dataset that gives a per-institution, point-in-time, age-banded headcount running back to 2019 the way school census does for schools. Getting "current and historic back to 2019" genuinely means blending sources with different shapes and different confidence levels, not finding one file and mapping it the way GIAS/census fields were mapped.

---

## 3. Recommended approach — layered, honestly labelled, not a single clean pipe

Rather than holding out for one source that matches census's shape (it doesn't exist), or silently picking one imperfect source and presenting it as equivalent to census roll data (which would break this project's own "ranges not point estimates" / "honest degrade over a padded but wrong pool" discipline that's been applied everywhere else):

1. **Current-year figure**: Candidate A (the in-development ILR participation file), clearly flagged in the UI and in `known_limitations` as provisional/DfE-experimental — consistent with how this project already handles the intake-size estimator and the boarding-threshold numbers. Filtered to genuine FE-corporation URNs/UKPRNs only.
2. **Historical trend, as far back as it goes**: Candidate C (2016/17–2021/22) for years it covers, bridged to Candidate A for the most recent year(s) once real column-level checking confirms whether Candidate C's aim-level counts can be reasonably deduplicated to a learner-level age-banded figure, or whether they need to be shown as a structurally different metric with its own label rather than merged into the same "roll" series as census data.
3. **Do not use Candidate B (KS5 cohort counts) as a stand-in for "roll."** It measures something real and useful (leaving-cohort size) but conflating it with census's whole-institution roll-by-age would be exactly the kind of silent misrepresentation this project has consistently avoided elsewhere (the 6th-form/FE skip-and-backfill "honest degrade" precedent, the intake estimator's explicit range-not-point framing). Worth ingesting separately, later, as its own metric alongside the academic-results topic it naturally belongs to — not as a rolls-data patch.
4. **Where none of this clears the bar**: for the smallest genuine FE-corporation institutions (per Candidate A's "£1m+" funding-size scoping), the honest fallback is showing the same degrade this project already applies elsewhere — GIAS identification/location always available, roll figure shown as unavailable rather than guessed at.

This is a genuine product/architecture decision, not fully resolvable from desk research alone — flagged explicitly in §5 below rather than defaulted silently.

**Spot-check on Worcester Sixth Form College (URN 144888, the confirmed gap case from the review log)**: it has a genuine, findable UKRLP provider record, confirming the UKPRN crosswalk path is real for at least this institution — worth scaling to the full ~502 list, not assuming. It also has a live "absence and pupil population" page on `compare-school-performance.service.gov.uk`, keyed directly by its existing URN with **no UKPRN crosswalk needed at all** — a lead worth Claude Code checking directly: is this page backed by a bulk-downloadable dataset (in which case it may be a cleaner win than any of the three candidates above, since it stays URN-keyed the same way census data already is), or is it web-only with no underlying file (in which case it's off the table — this project has already deliberately held fee data at arm's length specifically because bespoke scraping is a different, riskier engineering problem from the registry-pattern public bulk sources used everywhere else, and the same discipline should apply here).

---

## 4. Linking to `school_entities` — UKPRN↔URN matching, not yet confirmed

FE/skills data is keyed by **UKPRN** (UK Provider Reference Number), not URN. Two real questions for Claude Code to confirm against actual data, not assume:

- **Does GIAS's own extract carry a UKPRN field for FE-corporation establishment types?** If so, this is a direct, in-house crosswalk with no external dependency — check this first, same as the website-field and town/postcode extensions were confirmed present before building around them.
- **If not**, the UK Register of Learning Providers (UKRLP, `ukrlp.education.gov.uk`) is the standard public UKPRN registry and is the fallback matching path — would need a name/postcode-based join against the ~502 target institutions specifically, verified school-by-school the way every other extension in this project has been (Leighton Park/Woldingham/Charterhouse-style spot checks, scaled to the FE-corporation population).

---

## 5. Update schedule

The core "Further education and skills" release (which Candidate A's supporting files ride alongside) follows a confirmed DfE cadence: **quarterly in-year updates (January, March, July) plus a final full-year release each November**, based on ILR data (final/R14 ILR only in the November release — the only one of the four that's a complete account of the academic year). This gives a clean, real anchor for `refresh_type`/`expected_window` on this source, matching the pattern the roadmap already uses for other sources (weekly digest, status banner, alert-on-overdue).

**Recommendation**: sync annually off the November final release (matches the R14/complete-data point, and matches the once-a-year cadence this project already uses for DfE census), not the quarterly in-year updates — those are explicitly partial/cumulative-to-date figures, not comparable point-in-time snapshots. Candidate A's own update cadence specifically (whether it rides the same four-release schedule or its own separate one, since it's a newer "in development" product) needs confirming directly rather than assumed from the parent release's methodology page, which didn't mention it.

---

## 6. Decisions — resolved by Guy, 2026-08-21

**Decision 1 — ship now, flagged provisional.** Candidate A's current-year figure ships as soon as it's built, clearly flagged in-app as DfE's own "in development"/experimental data, rather than waiting for it to mature out of that status. Same precedent as the intake estimator and boarding threshold.

**Decision 2 — rough parity, not a hard 2019 floor.** Historic trend takes whatever honest history is really available (realistically 2016/17–2021/22 via Candidate C, plus the current year via Candidate A), clearly labelled by source/metric rather than presented as one continuous series. "Back to 2019, as we have for schools" was the goal stated going in, not a hard requirement once the real data landscape turned out shallower and messier than census's.

**Decision 3 — KS5 leaving-cohort size stays out of rolls entirely, deferred to academic results.** Guy's own framing: "KS5 numbers we do when we start doing academic comparisons — leave for now as a different metric." Confirms the investigation doc's own original lean (§3 point 3) — Candidate B is not folded into the rolls topic even as a labelled interim stand-in. For now, FE-corporation institution pages show the honest gap on any roll figure Candidate A/C don't cover, consistent with the surrounding-schools skip-and-backfill precedent. KS5 cohort size becomes its own metric under the academic-results topic once that's spec'd — not part of this build.

---

## 7. Ready-to-send investigation + build prompt for Claude Code

```
FE/sixth-form college roll data — real gap, confirmed structural (not a mapping
oversight): the ~502 genuine FE-corporation institutions report through ILR, not
school census, so they will never appear via dfe_school_census.py no matter how
it's extended.

Desk research (not yet verified against real files) has identified three DfE/
Explore-Education-Statistics candidates — full writeup in
docs/vicdata_fe_college_data_investigation_v1.md. Guy has already made the three
open product calls in that doc's §6 — build to these, don't re-litigate them:
- Ship the current-year figure as soon as it's built, clearly flagged as DfE's
  own "in development"/experimental data — don't wait for it to mature.
- Historic trend takes whatever honest history is really available (rough
  parity with schools' 2019 depth, not a hard floor) — label it clearly by
  source/metric rather than presenting one continuous series if the sources
  don't actually agree in shape.
- KS5 leaving-cohort size (Candidate B) is explicitly OUT of this build —
  deferred to the academic-results topic later, not used as an interim rolls
  stand-in even with a relabel. Where current/historic figures don't cover an
  institution, show the honest gap (identified via GIAS, roll unavailable),
  same precedent as the surrounding-schools skip-and-backfill.

Before building anything:

1. First, check whether compare-school-performance.service.gov.uk's "absence
   and pupil population" page (confirmed live for Worcester Sixth Form
   College, URN 144888, no UKPRN crosswalk needed) is backed by a bulk-
   downloadable dataset. If it is, this may be a cleaner win than any of the
   three candidates below, since it stays URN-keyed. If it's web-only with no
   underlying file, rule it out — same "no bespoke scraping" discipline
   already applied to fee data — and proceed with the three candidates.

2. Download the real files for all three candidates and confirm their actual
   column structure against the desk-research summary in that doc — do not
   trust the summary uncritically, verify it the way every other source in
   this project has been verified against real data:
   - "16-18 participation and enrolments" (FE Provider Dashboard, in
     development, 2024/25 release) — confirm real age-band columns, real
     UKPRN coverage, and whether the "£1m+ provider" scoping actually excludes
     any of our ~502 target institutions.
   - "Education and training providers - detailed enrolments" (2016/17–
     2021/22, discontinued Jan 2022) — confirm whether it carries any age
     breakdown at all, and get a real read on how badly the aim-level
     multiple-counting distorts a would-be headcount for a genuine FE college
     (spot-check a handful of real institutions' aim-count vs their expected
     headcount, if any independent figure exists to compare against).
   - "16 to 18 institution level" performance data (accredited, cohort-based)
     — confirm real per-year archive depth (does pulling each year's own
     release page get meaningfully closer to 2019 than the 4-year consolidated
     download?).

3. Confirm the UKPRN↔URN matching path: check whether GIAS's own extract
   already carries a UKPRN field for FE-corporation establishment types
   (check this first, it may remove an entire external-dependency step, same
   pattern as the Easting/Northing/MSOA/LSOA finding). If not, test a UKRLP-
   based join against the real ~502-institution list and report a real match
   rate, not an assumed one.

4. Report back with actual findings before writing any ingest code — column
   structures, real coverage/match rates, and which of the three "open
   decisions for Guy" in the investigation doc's §6 this changes or confirms.
   This is genuinely new engineering on a data source this project hasn't
   touched before, not a data check — same discipline as the cohort-
   progression intake estimator got.

5. Once the approach is confirmed (not before), build: new source module
   (parallel to dfe_school_census.py, not inside it — different source,
   different key, different cadence), field-mapping registration, a
   known_limitations entry flagging provisional/experimental status
   explicitly, and the sync-schedule wiring (annual, anchored to the November
   final release per the investigation doc's §5) with its own
   refresh_type/expected_window so it shows up in the existing weekly-digest/
   status-banner mechanism rather than being a silent one-off script.

Verify against real institutions before calling this done — Worcester Sixth
Form College specifically (the confirmed gap case from the review log), plus
a handful of others spanning different sizes, since the "£1m+" provider
scoping may mean small institutions behave differently from large ones.
```

---

## 9. Outcome — built and verified, 2026-08-21

Claude Code ran the §7 prompt end to end. As reported back (not yet independently re-verified by this session — full detail lives in `ingest/sources/dfe_fe_participation.py`'s module docstring and a new `OPEN_QUESTIONS.md` entry in the `vicdata` ingest repo, both worth reading directly rather than trusting this summary alone):

- **The `compare-school-performance.service.gov.uk` lead (step 1 of the prompt) is ruled out.** Its bulk download turned out to be the same school-census data `dfe_school_census.py` already ingests (no FE-corporation rows in it), and the individual page showed "not available" on every field for a real FE-corporation institution. The service is also being retired this autumn, closing it off regardless.
- **Candidate A has more history than this doc assumed**: the real underlying file covers 2022/23–2025/26, not just the current year. §2's "no historical depth" claim was wrong — a correction to this doc, not just new information.
- **Candidate C is dead, confirmed against the real file and DfE's own data-guidance documentation — not merely "wrong metric," wrong population.** This doc's §2 assumed Candidate C covered the right learners (16-18/19) and just measured them the wrong way (course-enrolments, not headcount). That assumption was wrong. The real file (`fes-et-provider-enrolments-202122-q4.csv`) has no age field at all, and DfE's own data-guidance for it states its content summary as "Adult (19+) Education and Training... provider breakdowns" — the file structurally excludes under-19 learners from the start. No amount of deduplicating enrolments to a headcount would make it usable, because the rows never described the right people. **Real consequence for Decision 2**: the "2016/17–2021/22 via Candidate C, bridged to current year via Candidate A" plan in §3/§6 doesn't survive this — there is no bridge. The only real historic depth available is Candidate A's own multi-year file, 2022/23–2025/26 (four years, confirmed in the previous update), standing alone. "Rough parity, not a hard 2019 floor" (Decision 2) still holds as the right call — it just resolves to a shorter run than assumed when that decision was made.
- **UKPRN↔URN matching (§4) resolved the good way**: GIAS's own extract already carries UKPRN for FE-corporation establishment types, now mapped (`gias.py` + a `school_entities.ukprn` migration), 99.2% filled. No UKRLP dependency needed — exactly the outcome hoped for, matching the Easting/Northing/MSOA precedent.
- **Build completed**: new source module, source-registry entry, wired into `run_ingest.py` and `admin/actions.py` (Fetch now + Promote), matching the established admin-app pattern used for every other source.
- **Verification**: run inside a rolled-back transaction against the hosted DB and the live EES API — 20,223 facts, 352 real institutions (ranging from Oldham College down to ~80-pupil Inclusion Hampshire). Rollback confirmed clean.
- **Production status, confirmed: NOT live.** Built and verified correct; nothing deployed. On the hosted DB right now: `school_entities.ukprn` doesn't exist yet (migration not applied), the `dfe_fe_participation` `source_registry` row isn't applied (seed.sql isn't auto-applied to hosted), and there are zero `canonical_facts` rows for this source. Four concrete steps remain, in order: (1) apply the `school_entities.ukprn` migration to the hosted DB; (2) re-ingest/promote GIAS for real so `ukprn` actually backfills from a live pull (the `gias.py` mapping change is code-only until this runs); (3) apply the `dfe_fe_participation` `source_registry` seed row to hosted; (4) run the actual Fetch + Promote for `dfe_fe_participation` itself, which is what writes the 20,223 facts into `canonical_facts_current`.

## 10. Deployment — steps 1–3 done for real, 2026-08-21 (step 4 held at Review, not promoted)

**1. Migration applied.** `school_entities.ukprn` column + index confirmed live on `vicdata-production` (ref `hrqrbvrrhlidpoybezhs`), verified via direct query before and after.

**Real gap surfaced, not fixed, worth Guy's attention separately from this build**: `supabase migration list` shows zero of 58 local migration files as applied on the remote tracking table, even though the live schema clearly already has most of them. The hosted DB's schema was evidently built by some path other than `supabase db push` at some point, so the CLI's own bookkeeping is out of sync with reality — the same issue the review log's 2026-08-09 migration entry hit at 21 migrations, now confirmed at 58. Claude Code applied only the one target migration's SQL directly rather than risk a blind `supabase db push` replaying all 58 and breaking on ones creating already-existing objects. This is now a recurring, growing landmine — every future migration needs the same manual workaround until the tracking table itself is repaired (e.g. `supabase migration repair` marking the already-applied ones as applied). Worth raising in priority, not leaving as a passive backlog line — the risk compounds with every migration added.

**2. GIAS re-ingested for real.** One real snag: hit the RLS gap already logged in the ingest repo's `OPEN_QUESTIONS.md` (2026-07-31) — `flag_snapshot()` needs `auth.uid()`, which a raw service-role connection doesn't have, so it crashed instead of flagging the new UKPRN mapping. Worked around via the documented path (registering the mapping through the real admin-authenticated session), then re-ran clean. Result: 52,489 schools, 2,785 groups. Real UKPRN fill rate against the fresh hosted data: 500/505 (99.0%) for the target population — Further education 208/208, Higher education institutions 129/129, Sixth form centres 13/14, and the special-post-16 category close behind. (505 vs. the 502/504 figures used earlier this doc — real live drift in GIAS between this morning and now, not a bug.)

**3. `dfe_fe_participation` `source_registry` row applied, committed.**

**4. Fetch run, deliberately held at Review — not promoted.** Snapshot `57f4625a-bc14-4516-a9e7-327838876c50`. **20,223 facts across 352 institutions**, period range 2022–2025 (matches Candidate A's confirmed real coverage). Spans large FE colleges (Harlow College, TEC Partnership, Bolton College, Preston College) down to 4-fact specialist providers with mostly-suppressed cells (Chadsgrove Educational Trust, Routes4Life, Condover College, Trinity Post 16 Solutions, Future Finders Employability College) — a plausible real spread, not a population dominated by one institution size.

**The snapshot is flagged for mapping review — normal first-run behaviour, not an error.** Reason from the DB: this source's 8 real columns (`academic_year`, `ukprn`, `age_youth_adult`, `characteristic`, `apprenticeship`-related, `tailored_learning`, `community_learning`) haven't had any mapping reviewed yet — the same "Confirm mapping" step every source hits once.

**Real caveat, flagged clearly rather than left implicit: `promotable()` doesn't actually gate on that flag.** This is the same unfixed gap logged in `OPEN_QUESTIONS.md` (2026-07-26): `finalize_promotion` doesn't check mapping-drift state before promoting. The Promote button itself will not stop anyone from promoting past an unreviewed mapping — this only stays safe because a human reviews first, not because the system enforces it.

**One thing worth confirming explicitly in that review, not assumed from the sample output**: the raw source carries an `age_youth_adult` column, meaning the underlying file itself may contain both under-19 and adult rows, not a youth-only extract. The sample facts above are labelled "under-19 E&T," which is reassuring, but that should be confirmed as a real, checked filter in the field mapping — not taken on faith — given the whole point of this build was avoiding exactly the population-mismatch problem that killed Candidate C.

**Status as of this entry**: built, deployed up through Review, deliberately not promoted. Promoting is a real decision for Guy, not a default — see the mapping-review and age-filter checks above before it happens.

## 11. The mapping review caught a real bug, 2026-08-21 — snapshot discarded, not promoted

The "confirm the mapping, specifically verify the age filter" review (§10's own recommendation) did exactly the job it was for. Findings, checked against the real archived file and real code, not assumed:

**All 8 column mappings are correct.** Verified individually against real sample rows — `period_raw`, `entity_key`/UKPRN, `characteristic` (correctly drops 19 of 22 real characteristic values, keeps only Total/Male/Female), `apprenticeships`, `education_and_training`, `tailored_learning`, `community_learning` all check out.

**The age filter does not exist, and it's a real, confirmed problem, not a labelling artifact.** `age_youth_adult` has three real raw values — `Under 19`, `19+`, `Total` — and `_AGE_BAND_NORM` maps all three, excludes none. Of the 20,223 facts in the snapshot: only 5,386 (26.6%) are `under_19`; 7,279 (36.0%) are genuine adult `19_plus` data (e.g. City Lit, a well-known London adult-education institute, shows 21,960 for `education_and_training_19_plus_total` in 2025 — a real number with no place in a sixth-form/FE-college roll); the remaining 37.4% are `total` (youth+adult combined).

**Good news buried in the bad news**: where the under-19 figure does exist, it's genuinely accurate. Independently checked against real Ofsted figures — Harlow College (our data 2,450→2,720 across 2022–2024) vs Ofsted's reported 2,585 learners on 16-19 study programmes; TEC Partnership (our data 3,830→4,200) vs Ofsted's reported 3,968 (2020) and 4,189 (2024). Same order of magnitude, sensible trend, real match. The core pipeline and the under-19 figure itself are sound — this is a scope/filter bug, not a data-quality bug.

**A second, smaller finding worth keeping**: some institutions inside the target ~505-institution population (specifically "Special post 16 institution" GIAS type) are, in reality, genuinely adult-only providers — Chadsgrove Educational Trust Specialist College (age 19–25, complex medical needs) and Condover College (age 18–25, SEND) both spot-checked as real adult-only providers via independent sources, correctly showing zero `under_19` facts. That's accurate, not a bug — once the age filter exists, these institutions will honestly show no under-19 roll data, the same "honest gap" precedent used everywhere else in this project, rather than silently displaying adult numbers as if they were a roll.

**Snapshot 57f4625a-bc14-4516-a9e7-327838876c50 was correctly left unpromoted** — `validation_status: flagged`, `promoted: False`, no further changes made. It will need to be discarded and re-ingested once the filter is fixed, since 74% of its current rows are out of scope.

**Decision, 2026-08-21**: keep the 19+/adult data rather than discard it, routed to a genuinely separate, clearly-labelled source rather than merged with the under-19 rolls source. Real implication worth being explicit about: adult FE participation (City Lit and similar) sits outside anything currently spec'd for VicData Public — the product is built around school leadership, and adult-education institutes don't have "school leadership" as an audience the way FE-corporation sixth-form colleges do. This isn't a new UI section or topic — it's captured and correctly separated at the data layer, logged as a future-topic candidate (same category as ISC membership, GIAS governance data, and the other "confirmed need, not yet actioned" backlog items), not built into the product this round.

## 12. Closed out — both sources live and verified, 2026-08-21

The split was built and verified cleanly, nothing assumed:

- **`dfe_fe_participation`** (under-19, the original FE-corporation rolls gap): re-ingested to exactly 5,386 facts — a precise subset match of the earlier count, confirming the fix changed nothing except scope. Zero non-`under_19` rows. Harlow College and TEC Partnership still match the independently-verified Ofsted figures. Chadsgrove Educational Trust and Condover College now correctly show **no rows at all** — the honest-gap outcome the whole fix was for, not adult data mislabelled as roll. Mapping confirmed through the real app flow, promoted. **Live: 5,386 rows in `canonical_facts_current`.**
- **`dfe_fe_participation_adult`** (new, separate source): 14,837 facts = 7,279 (`19_plus`) + 7,558 (`total`) exactly — a clean, lossless split, no loss or duplication against the original 19+/total counts. City Lit's 2025 figure confirmed exactly (21,960). Mapping confirmed, promoted. **Live: 14,837 rows in `canonical_facts_current`.** Not wired into any product feature — logged in the roadmap's "confirmed need, not yet actioned" backlog category alongside ISC membership and GIAS governance data.
- **The full incident is logged in `OPEN_QUESTIONS.md`**: the bug, the exact 74% out-of-scope figure, the City Lit/Chadsgrove/Condover evidence, the split decision and reasoning.
- **One small open item the split itself surfaced, left genuinely open rather than guessed at**: whether Higher Education Institutions belong in the adult source's scope at all — not resolved, not urgent, worth a look whenever that source gets touched again.

**The gap this doc opened with is closed**, correctly scoped: the ~505 genuine FE-corporation institutions now have real, independently-verified under-19 roll data flowing through the same admin Fetch/Review/Promote pipeline as every other source in this project, current year live, historic depth honestly limited to 2022–2025 (not 2019, per Decision 2), clearly flagged as DfE's own "in development" data per Decision 1.

**Two things from this thread still genuinely open, not resolved by this build**:
1. Worcester Sixth Form College's original "no surrounding schools" bug (review log, Task 3) — misdiagnosed as this FE-corporation gap; it's actually an academy with census coverage, so something else is wrong there. Separate, still open.
2. The migration-tracking drift (58 local migrations showing unapplied on the remote tracking table, despite most being live) — sidestepped again during this build, not fixed. Growing, worth a dedicated look before it bites on a migration nobody catches by hand.

## 13. Both follow-ups closed out, 2026-08-21

**Migration drift — genuinely repaired, root cause found, not just patched again.** Real cause: `git ls-files` tracked only 26 of 56 real migration files — 30 were never committed to git at all. Combined with this project's own two deployments earlier today (both direct SQL, never `db push`), the pattern is clear: this project's actual deployment mechanism has always been direct SQL execution against the hosted DB, with the `.sql` files serving mainly as documentation. `db push` — the only path that writes to the CLI's own tracking table — was simply never used, so the tracking table was never going to reflect reality no matter how correct the live schema was.

All 56 migrations independently verified against the live schema before any repair — not a blanket "mark everything applied": 44 passed an automated per-migration schema check; 2 automated-check failures turned out to be false positives on closer reading (a temp-table rename, an index later intentionally replaced by a different confirmed migration — both hand-verified against real end-state); 3 function-defining migrations verified by pulling the live function body via `pg_get_functiondef` and diffing word-for-word, including confirming a real grant revocation; 10 pure data/content migrations each verified with a targeted query. Zero genuine gaps found. Repaired via `supabase migration repair --status applied --linked` in 4 checked batches. Confirmed clean: `supabase migration list` shows no mismatches, `supabase db push --dry-run --linked` reports "Remote database is up to date." Logged in `OPEN_QUESTIONS.md`, including a reminder to run `db push` after future direct-SQL deployments so this doesn't quietly restart.

**Open question, not yet confirmed**: 30 of the 56 real migration files were found to have never been committed to git at all. The tracking-table repair fixes the *bookkeeping* problem; it's not yet confirmed whether those 30 files themselves got committed — if not, the repo itself still doesn't reflect the real live schema, and those files exist only locally.

**Worcester Sixth Form College — the original bug is already fixed, but investigating it surfaced something bigger.** GIAS conversion history confirmed directly: the old sixth-form-college URN closed 2019-03-31; URN 144888 (academy 16-19 converter) opened 2019-04-01 — a genuine URN reissue on conversion, confirming the hypothesis from the investigation prompt. The old URN has no hidden data. Census data for URN 144888 does exist (480 rows) but only for 2019–2021 — not current — and appears to have been added by an unrelated 2026-08-06 data promotion, after the original review log finding was made; the review log's "no data" finding was accurate at the time, not a misdiagnosis of the app. The actual application bug (surrounding-schools bailing out when the target has no roll data) is already fixed in `vicdata_public/src/app/schools/[urn]/page.tsx`, confirmed by reading the real code and its dated comment — nothing left to fix there.

**The bigger, real finding**: the rolls spec §10 item 7 claim of "8 remaining timing-gap exceptions, all converted 2023-2025" does not hold up against real data. Worcester converted in 2019, nowhere near that window — and checking the wider population found 32 of the other academy-16-19-converter institutions show the same pattern. This is a substantially wider, previously undercounted data gap than what's currently documented in the rolls spec, plausibly (not proven) connected to the same ILR/FE-participation reporting shift surfaced during the FE-college work. Logged in the ingest repo's `OPEN_QUESTIONS.md`, flagged for whoever next touches the rolls spec or `dfe_school_census` — not fixed or edited into `vicdata_public` this pass, deliberately out of this session's scope.

## 14. Both loose ends properly closed, 2026-08-21

**Part A — git.** Confirmed and fixed for real: 26/56 migration files were tracked before, 56/56 after. The 30 missing files staged and committed in an isolated commit (`62c71db`), nothing else bundled in. `git status --short supabase/migrations/` returns clean.

**Part B — the sixth-form-college census gap, fully scoped, not approximated.** Real numbers, 81 institutions checked directly, not sampled:

| Establishment type | Total | Fully current | Stale | Zero data |
|---|---|---|---|---|
| Academy 16-19 converter | 42 | 3 | 32 | 7 |
| Free schools 16 to 19 | 39 (spec said 36) | 31 | 6 | 2 |

**The rolls spec's old "35/42 covered" framing had it backwards** — only 3 of 42 Academy 16-19 converters are actually current; 32 (the majority of the whole type) stop at 2021 **regardless of conversion date** — one institution converted in 2012 and still stops in 2021. This reframes the finding: it's not a "recent conversion, census hasn't caught up" timing gap for most of these — it's a structural reporting-channel issue affecting the whole establishment type. The genuinely narrow timing gap is real but smaller than thought: 7 institutions (not 8 — Durham Sixth Form Centre was wrongly bundled into the original count; it's actually fully current) with zero data, all genuinely 2024–2025 conversions.

**Real corroboration for the reporting-shift theory**: checked directly against `dfe_fe_participation`'s real source file (not `canonical_facts_current`, which structurally excludes academies by design) — 42 of the 47 gap institutions (89%) have real, plausible, smoothly-trending FE-participation data for exactly their missing census years (e.g. Worcester: 1,690 → 1,750 → 1,760 → 1,780 across 2022/23–2025/26). Strong evidence these institutions are genuinely reporting through ILR/FE channels rather than school census, structurally, not just lagging.

**Not wired in — reported as a real, available option, left for Guy**, exactly as instructed. This is a materially different case from the adult-FE-data decision earlier: these are the right population (genuine sixth-form/FE-aged pupils, institutions already shown on live State of School pages), just arriving through an unexpected channel — a real backfill candidate, not a scope mismatch. Still a real decision, not a default: whether to backfill these specific institutions' current-roll figure from FE-participation data (clearly labelled by source, not silently blended, same discipline as everything else here), or leave them on the honest stale-data degrade now that its display bug is fixed.

**One real display bug found and fixed** (authorized under "fix what's genuinely broken"): `vicdata_public`'s State of the School page showed stale data (up to 5 years old, for the 32 affected institutions) under a bold "Current roll" header, true year only in a small caption — misleading, since bolded "Current roll" next to 2021 data reads as current when it's up to 5 years stale. Confirmed the only occurrence of that string in the codebase, fixed, typechecked clean (`npx tsc --noEmit`, zero errors project-wide). The honest-gap logic itself was untouched.

**Rolls spec corrected** — §10 item 7 and its §4 duplicate in `vicdata_public/docs/vicdata_phase3_school_rolls_topic_spec_v1.md`, replaced with the real table and findings above. **Logged in `OPEN_QUESTIONS.md`.**

**Open, not yet actioned**: the two `vicdata_public` edits (the display-bug fix, the rolls-spec correction) are uncommitted — correctly left that way, since committing into a sibling repo wasn't part of Part A's authorized git scope. `git status` there shows exactly those two files, nothing else.

**Real decision still open for Guy**: whether to backfill these 42 institutions' current-roll figure from FE-participation data, clearly source-labelled, or leave the honest stale-data degrade in place now that the misleading "Current roll" label is fixed.

## 15. Backfill scoped, nothing built, 2026-08-21

**Part A follow-up**: the two `vicdata_public` edits reviewed and committed (`1cbbecc`), clean.

**Part B — scoping report, real numbers, nothing live touched.**

**Precise opportunity**: of the 39 institutions that actually need a backfill (32 stale + 7 zero-census), 37 have real, usable FE-participation data — only Hills Road and Franklin Sixth Form College (both opened autumn 2025) remain gapped regardless, genuinely too new for any source yet.

**Independently validated, not just internally consistent**: no overlapping year exists between census (stops 2021) and FE-participation (starts 2022/23), so same-institution same-year cross-validation wasn't possible — a real, honestly-flagged limit. Substituted with an independent real-world check instead: Worcester Sixth Form College's real current enrolment is reported around 1,750 across multiple real sources; the FE-participation figure is 1,780 — a 1.7% match, strong validation the ILR data reflects reality.

**A clean, mutually-reinforcing signal for the reporting-channel-shift theory**: the 3 institutions with full current census coverage (One Sixth Form College, Melton Vale, Durham Sixth Form Centre) have **zero** FE-participation data at all. Institutions reporting through census don't appear in ILR, and vice versa — not just correlated with staleness, structurally mutually exclusive.

**Honest scope of what a backfill would actually fix**: total roll + male/female split only, confirmed against real full rows for 3 institutions. No age-band breakdown exists in this source at all (no single-year-of-age split), so boarding split and shape classification cannot be computed from it and would stay stuck at the stale census year regardless. This is a headline-number fix, not full parity with census-sourced schools.

**Where the exclusion lives, confirmed by reading the real code**: academy rows are filtered out at parse/validate time inside `ingest()`, not a promotion-time flag — they never become `canonical_facts` rows at all. Surfacing this needs either widening the existing source (which would merge two structurally different populations into one `source_id` — the same silent-conflation risk avoided everywhere else in this project) or a third, separately-registered source mirroring yesterday's adult-participation split. **This is a full build, the same size as the adult-participation source** — new module, migration, registry entry, real verification — not a small tweak.

**Design proposed, not built**: two separate cards, never merged into one number or graph. "DfE school census — 480 pupils, 2021/22" (unchanged, already live) alongside a new "FE participation data (ILR) — 1,780 learners, 2025/26 — DfE's own experimental 'in development' statistics, a different measure (participants across the year, not a single-day headcount)" with a `known_limitations` link. No shared chart, no shared "roll" label, no arithmetic combining the two.

**Status**: scoped and validated, nothing built or live-changed. Real go/no-go decision for Guy — see chat.

**Decision, 2026-08-21**: build it now, two-card design approved as proposed.

## 16. Third source built and verified — pending Promote only, 2026-08-21

**Ingest (`vicdata`)**: `dfe_fe_participation_academy.py` built, reusing the shared fetch/discovery functions rather than duplicating them — third member of the source family. Scoped to Academy 16-19 converter / Free schools 16 to 19, under-19 only, total + male/female breakdown only, matching the confirmed real limits of what this data can provide.

Real Fetch run: **468 facts, 42 distinct institutions (37 Academy 16-19 converters + 5 Free schools 16-19)** — matches the scoping investigation's numbers exactly, no drift. Confirmed no padding for later-opening institutions (Imperial College London Mathematics School genuinely has 3 years of data, not 4; Richard Collyer genuinely has 1) — checked directly, not assumed. Edge cases confirmed by direct query: the 3 already-current institutions show zero facts (clean non-overlap), Hills Road and Franklin show zero facts (too new for either source). Four institutions spot-checked against yesterday's scoping numbers — no drift. Mapping confirmed through the real admin action. **Stopped at Review — `promoted: false`, `validation_status: 'flagged'` — nothing live yet.**

**Display (`vicdata_public`)**: two-card design built exactly as approved. Existing "Roll" card untouched. New "FE participation data (ILR)" card is a separate section, own label, own caveat text, no shared chart, no arithmetic combining the two numbers. Shown by a computed rule (`ilrSnapshot !== null && (!roll || roll.period < CURRENT_CENSUS_PERIOD)`) evaluated at render time — no static list to maintain, so this adapts automatically if census ever catches up for one of these institutions later, per the original requirement. Whole project typechecks and lints clean.

**Commits, correctly scoped per repo**: `vicdata_public` — Part A's two files isolated (`1cbbecc`), the new card isolated separately (`2035344`). `vicdata` — the three-source family + wiring + registry, deliberately separated from unrelated pre-existing uncommitted changes already sitting in that repo (`.env.example`, `.gitignore`, an admin/queries file) that were not part of this build (`a6caf41`).

**Status: built and verified, nothing live.** The `dfe_fe_participation_academy` snapshot is sitting in Review on the hosted DB — Promote is the one remaining step. See chat for Guy's call on it.

## 17. Promoted, confirmed live on a real page, and one structural finding worth correcting the record on — 2026-08-23

**Promoted**: `dfe_fe_participation_academy` — 468 rows genuinely live in `canonical_facts_current`, 42 institutions, `validation_status: 'passed'`.

**Real live-page check surfaced something the design assumption got wrong.** Fetched Worcester's actual page over HTTP. The ILR card renders correctly — exact match to the DB. But the census "Roll" card doesn't show a number at all — it shows the pre-existing, untouched "No DfE census roll data available" message. Chased rather than waved off: Worcester's 480 census rows exist, but **every one of them is genuinely zero,** across all breakdowns and all three years (2019–2021) — not "480 pupils," a placeholder. `buildRollSnapshot` (existing code, already built for exactly this — it name-checks Reigate College as a known real all-zero case) correctly returns null rather than show a false "0 pupils." Checked 5 more of the 42 (Reigate College, Solihull, Rochdale, Oldham, Woking) — same all-zero pattern in every one. **This looks like a structural characteristic of this whole establishment type's census backfill, not a Worcester quirk** — plausibly the same administrative-placeholder-row effect underlying the rest of this investigation. Negative case checked too: Eton College (outside the 42) shows no ILR card, no false positive.

**Correction to this doc's own §15/§16 framing**: the design was described (accurately, at the time) as pairing a "stale-but-real" census card against a fresh ILR card — e.g. "DfE school census — 480 pupils, 2021/22." That framing is not accurate for most of these 42 institutions. In practice it's usually the ILR card next to the pre-existing honest "no data" notice, not two numbers side by side. **The display logic itself is unaffected and correct either way** — the card-visibility rule already handles a null roll correctly — this is a documentation correction, not a bug.

**Closing state, all three sources live and verified**:

| Source | Live rows | Institutions | Promoted |
|---|---|---|---|
| `dfe_fe_participation` | 5,386 | 312 | 2026-08-21 |
| `dfe_fe_participation_adult` | 14,837 | 352 | 2026-08-21 |
| `dfe_fe_participation_academy` | 468 | 42 | 2026-08-23 |

**New open item for the future, not urgent**: why this establishment type's census backfill produced all-zero placeholder rows at scale, rather than either real data or no rows at all — worth a proper look whenever `dfe_school_census` or the rolls spec gets touched again, not tonight.

This closes the FE/sixth-form college data thread this doc was opened for, plus both follow-up threads (migration drift, Worcester) that came out of it.

**A genuinely important correction, not a footnote**: this doc's own spot-check institution, Worcester Sixth Form College (URN 144888) — the confirmed example used throughout the review log's Task 3 findings and this doc's own §3 — **turned out to be an academy, not a genuine FE-corporation institution, and is already fully covered by census.** The underlying gap claim (the ~502/504 genuine FE-corporation institutions) still held once re-verified against the real list, so the FE ingest work itself isn't undermined — but it means Worcester's original "no surrounding schools section" bug (review log, Task 3, Objective 5) was very likely misdiagnosed. If Worcester has census data, the nearest-20 gating-on-target-school-having-roll-data logic shouldn't have skipped it — that's a real, separate, still-open bug worth a fresh look, not one this FE ingest work resolves.

**A new scoping call Claude Code made and logged, not resolved by this doc's §6**: Higher Education Institutions are excluded from this source's target population (real universities barely appear in ILR data — expected, they report through HESA instead). "Sixth form centres" showed zero matches in the real data, flagged as unexplained rather than investigated further — worth a look at some point, not urgent.

---

## 18. FE institutions built onto the live map, promoted decision — 2026-08-27

Separate from this doc's original ingest scope, but directly downstream of it: `vicdata_public`'s map (`schools-in-bounds`) structurally excluded all 382 FE-corporation/sixth-form/special-post-16/HE/Welsh institutions — `sectorTag()` returned null for them by design. Guy decided to surface them rather than leave the gap, using the sources this doc's ingest work already made live.

**Built and verified, then committed and deployed the same day:**

- **Scope filter**: a precise `establishment_type` allowlist (`FE_INSTITUTION_TYPES` in `typology.ts`), not the broader `establishment_type_group` — confirmed the group-level filter would have wrongly swept in 1,576 ordinary Welsh schools plus overseas/offshore/secure-unit institutions.
- **New "FE" sector**: its own fuchsia colour, wired through the sector filter chips, colour key, and pill rendering everywhere `SectorTag` is used — genuinely separate from State/Independent, not folded into either.
- **Roll data, single-sourced per institution, never blended**: `dfe_fe_participation` (under-19) → `dfe_fe_participation_adult` (19+, last resort) for the FE-corporation types already in this doc's crosswalk, plus `dfe_fe_participation_academy` extended to the existing State-sector academy/free-school rows this doc's §14/§15/§16 scoped and built. Each URN's figure is tracked via a `rollSource` field so provenance is always explicit, never merged across sources.
- **Visible marker distinction, not just a tooltip note**: ILR-sourced dots get a thick dashed outline over a solid fill; genuine no-data dots (null after every fallback — mainly the 14 sixth-form centres, which structurally report under a parent institution's URN and can never get their own figure) render hollow with a finer dash at fixed radius. Both carry an explicit popup/focus-card caveat, with sixth-form centres getting the specific "reports via a parent institution" reason.
- **Verified against real institutions**: Ealing, Hammersmith and West London College (URN 130408, real ILR figure, correct dashed-outline dot); Harrow Collegiate (URN 135469, genuine sixth-form centre, correct hollow no-data dot with the parent-institution caveat); Leighton Park unchanged (no regression). At scale, a 181-school central London viewport check found 43 real FE institutions, 14 correctly ILR-sourced, 29 correctly honest no-data, zero non-FE rows mismarked.
- **One incidental fix caught and made along the way**: `surrounding-summary.ts` prose was lowercasing "FE" to "fe" — special-cased to stay uppercase.

**Committed and deployed, 2026-08-27**: bundled with the Post-16 taxonomy narrowing from earlier the same session (see the rolls-spec-adjacent taxonomy work logged separately) into one commit, `31cead6` — "Narrow Post 16 to standalone institutions; add FE sector to the map," pushed to `main`. Production build (`next build`, Turbopack) succeeded clean, all 18 routes generated. Deploy confirmed the strong way — polling vicdata.co.uk's live API until the new `fe` field appeared in its response, not just trusting Render's dashboard status. Live smoke test on vicdata.co.uk itself confirmed all three verification cases match what was checked locally: Ealing/Hammersmith/West London College showing `sector: "FE"`, `totalRoll: 1950`, `rollSource: "ilr"`; Harrow Collegiate showing `sector: "FE"`, `totalRoll: null`, `rollSource: null`; Leighton Park's pills and surrounding-schools prose unchanged, confirming the Post-16 narrowing shipped with no regression.

This closes the loop this doc's ingest work opened: the FE/sixth-form roll data isn't just live in the database, it's now visible on the product's own map, honestly labelled by source down to the individual marker.

---

## 19. New thread, 2026-09-06 (session continuation): pie-chart 0% + blank FE pages — real content still not wired to the page body

Guy, reviewing the live site: FE colleges have a real roll size on the map (§18's work), but (a) every LA-composition pie chart on every page shows FE at ~0%, and (b) FE colleges' own pages are completely blank — no text, no graphs. Two related but distinct gaps, both traced directly against the current repo (`main` @ `7240512`, confirmed current).

**Root cause of (a), confirmed by reading `la-sector-composition.ts`**: the pie chart never uses any of the three live ILR sources at all — it counts pupils from GIAS's own `schools.number_of_pupils` field, and any row with a null `number_of_pupils` is excluded entirely from both the schools-count and pupils-count (not treated as zero). FE colleges almost certainly have this field mostly empty in GIAS (FE institutions report enrolment through ILR, not GIAS's pupil-count snapshot) — real fill rate not yet confirmed empirically, flagged as step 1 of the prompt below.

**Root cause of (b), confirmed by reading `page.tsx`**: nearly everything on the page (narrative, ShapeCard, PhaseBreakdownCard, the pie chart itself, PaidTrendsSection) is gated on `roll` (DfE census) existing, which FE colleges structurally never have (§1 above). The one card built for exactly this situation, `IlrParticipationCard`, is wired to the wrong population — it only fires for `dfe_fe_participation_academy` (Academy 16-19/Free School 16-19, **State** sector by `sectorTag()`, not FE). A genuine FE-sector school's own ILR total (`dfe_fe_participation` under-19, falling back to `dfe_fe_participation_adult`) is already fetched in `page.tsx` today as `viewedIlrTotal` — but only to size that school's own map dot. It is never rendered as page content, despite the data already being live, verified, and one query away.

**Real, already-answered part of question (b)**: no fresh characterization needed for "what fields exist" — §15 above already established this definitively: **total + male/female split only**. No age-band breakdown, no boarding data exist in any of the three ILR sources, by design (confirmed against real rows in August), so shape classification/phase breakdown/boarding cards can never be built from this data regardless of what's wired up. What *is* real and currently unused: `dfe_fe_participation_adult` (14,837 rows, 352 institutions, promoted and verified back in August) has never been wired into any product feature at all — a second, honest, separately-labelled stat sitting unused.

**Guy's decisions, 2026-09-06**: build both the under-19 and (separately labelled, never blended) 19+ figures on FE-sector pages; make the pie-chart fix LA-wide (batch ILR lookup across every FE-sector row in the composition query, not just the viewed school) rather than a narrower per-school patch; send the full characterize+build prompt now rather than waiting on a separate characterization-only round, bundling the one real empirical unknown (real `number_of_pupils` fill rate for FE-sector rows) as step 1.

**Design call made, not yet confirmed by Claude Code's own data**: the pie-chart ILR fallback should use **under-19 total only**, not the adult total. The chart's job is comparing sector footprint among the LA's school-age population (State/Independent are both child counts) — pulling in FE's adult participants would inflate its slice in a way that isn't a like-for-like comparison, the same kind of silent measurement-blend this project has avoided everywhere else (the map's own ILR-vs-census marker distinction, the two-card FE-page design, the under-19/adult source split itself). A row with neither `number_of_pupils` nor a real under-19 ILR figure stays honestly excluded, same as today.

**Real ceiling, already known, not something the build should try to fix**: of ~505 FE-sector institutions, only ~312 have real under-19 ILR data. Sixth-form centres (14 of them) report activity under a parent institution's own URN and can never get their own figure (confirmed, Harrow Collegiate is the named example). Higher Education Institutions/Miscellaneous/Welsh establishment are never in the ILR crosswalk at all. These will stay honestly blank after this build — not a regression, the same permanent gap this doc has documented since §9.

**Prompt sent, 2026-09-06**, in three parts: (1) characterize `number_of_pupils` fill rate for FE-sector rows, and check whether the adult source has a real male/female breakdown available (currently unparsed if so); (2) build FE-sector page cards — reuse/extend `buildIlrParticipationSnapshot()` against `dfe_fe_participation` for genuine FE-sector schools (a render path additive to the existing Academy 16-19 usage, not a replacement), plus the adult total as a second labelled stat; (3) build the pie-chart LA-wide under-19-only ILR fallback in `computeLaSectorComposition()`, reusing `fe-participation-roll.ts`'s existing batch-lookup pattern, with a visible sourcing note on the FE slice. Verification named: Ealing/Hammersmith/West London College (real data, used throughout this doc), Harrow Collegiate (confirmed zero, should stay zero), one real LA's pie chart before/after. Report requested to lead with step 1's real numbers — if `number_of_pupils` fill rate turns out to already be high, that would mean the 0% pattern has a different real cause, worth surfacing before building step 3's fallback rather than after.

## 20. Report received and independently verified, 2026-09-06 — one arithmetic loose end before push

Report came back via a rendered artifact (`98e6229a-1b70-48cd-8cd7-a5c4ab0e6aab`, "FE College Data Report"), read directly from the saved local file (not the framework-JS-only `Artifact action:"read"` head) — same discipline as every prior round. **Nothing committed yet** — this round is still sitting as local uncommitted changes, Claude Code is waiting on a push decision, so this verification is against the report's own numbers and this doc's established anchors, not a `git pull` (there's nothing new on `main` to pull).

**Step 1 findings — the premise held, cleanly:**
- `number_of_pupils` fill rate for FE-sector rows: **flat 0.0%**, all 2,156 open schools across all six `FE_ESTABLISHMENT_TYPES`, table sums correctly (1,576+154+129+208+75+14 = 2,156). Not "varies by type" as this doc's §19 speculated — uniform structural zero. Contrasted against a 1,000-row Academy sample at 94.1% filled, consistent with the old "~89% whole-table average" comment being dominated by mainstream schools. This confirms step 3's fallback is fixing the real cause, not a guess.
- `dfe_fe_participation_adult` male/female split: **real, confirmed against live rows**, not total-only as `fe-participation-roll.ts` had assumed. Breakdown vocabulary confirmed: `{provision_type}_{age_segment}_{sex}`, `age_segment` ∈ {19_plus, total_all_ages}, `sex` ∈ {total, male, female} — same shape as the under-19 source, one prefix apart.

**Step 2 verified against three real named schools:**
- Ealing, Hammersmith and West London College (URN 130408): both cards render — 1,950 under-19 (820 girls/1,130 boys, sums correctly) and 9,690 adult (7,020 female/2,670 male, sums correctly). Under-19 figure matches this doc's own §16 anchor (1,950) exactly.
- City Lit (URN 130401): correctly adult-only, no false under-19 card. Adult figures given as 15,380 female / 6,570 male / **21,960 total** — **the male+female sum is 21,950, ten short of the stated 21,960 total.** The 21,960 figure itself matches this doc's own §11/§12 anchor exactly, so the total is right; the discrepancy sits in the male/female breakdown shown alongside it. Worth a quick check before push — if the live `IlrParticipationCard` renders all three numbers together, a visible 10-person gap between the total and its own stated split would be a real, user-visible inconsistency, not just a rounding artifact in a report. Could be a transcription slip in the report, or could mean the source carries a small third `sex` bucket (e.g. "not known") the parser correctly excludes from male/female but that also shouldn't be silently absent from a total-equals-parts caption if one exists.
- Harrow Collegiate (URN 135469): correctly renders nothing — confirmed zero facts across `dfe_fe_participation`/`_adult`/`_academy` alike, matching §18's established zero-data anchor.

**Step 3 verified on Hammersmith and Fulham, viewed from The London Oratory School:** before/after donut arithmetic checks out exactly — before: State 76.3% (19,327/25,330) + Independent 23.7% (6,003/25,330) = 100%, FE excluded entirely; after: State 70.8% + Independent 22.0% + FE 7.1% (1,950/27,280) = 100%, State/Independent's own pupil counts byte-identical before/after (19,327/6,003, confirmed not touched by the fallback). `feIlrFallbackSchoolCount` = 1, correctly surfaced in a real rendered RollCard caption naming the source. /sources page updated to "one of three" sources.

**One small non-blocking mismatch**: Guy's pasted chat summary said "clean across all six touched files"; the artifact's own footer lists seven (`la-sector-composition.ts`, `ilr-participation-data.ts`, `fe-participation-roll.ts` (import only), `page.tsx`, `RollCard.tsx`, `SmallCards.tsx`, `sources/page.tsx`) — almost certainly the usual chat-relay garbling (as with Round 19's "frier.ts" truncation), not a real discrepancy, since the footer itself is internally consistent.

**Status: verified, one real arithmetic loose end (City Lit's male/female split summing 10 short of its own stated total) flagged to Guy before push. Not yet pushed.**

## 21. City Lit discrepancy explained, fixed, committed and pushed — 2026-09-06

Real root cause, not a bug and not a hidden third `sex` bucket: DfE rounds every ILR-participation figure — total, male, female alike — independently to the nearest 10 for disclosure control. Confirmed live: every value across all three sources (`dfe_fe_participation`, `_adult`, `_academy`) is a multiple of 10. Because each figure is rounded on its own, a sex-split doesn't always sum to its own published total — City Lit's real raw 2025 rows genuinely are 15,380 / 6,570 / 21,960; the numbers in the earlier report were correct, they just don't add up, because the source itself doesn't. This affects ~22–29% of institutions across all three sources, including the pre-existing `dfe_fe_participation_academy` card that's been live since 2026-08-23 (§17) — a pre-existing, unnoticed cosmetic quirk this round's scrutiny surfaced, not something this round introduced.

**Fix, verified in the real committed code** (`git pull --ff-only` to `803eff1` on `main`, read directly — not from a report): `IlrParticipationCard` (`SmallCards.tsx`) now shows a small note — "DfE rounds each figure to the nearest 10 independently, so this split may not sum exactly to the total above." — gated on `girls !== null && boys !== null && girls + boys !== total`, so it only ever appears on the minority of cards that actually diverge. Confirmed by reading the real conditional and its dated code comment directly, which independently states the same ~22–29% figure and the same City Lit example. Ealing/Hammersmith's two cards (which do sum) correctly show no note.

**Also re-confirmed directly in the pushed code, not just re-trusted from the prior report**: `computeLaSectorComposition()`'s pie-chart fallback (`la-sector-composition.ts`) still imports and uses only `under19Totals` from `fe-participation-roll.ts` — the adult total is never touched by this path, matching the under-19-only design call from §19/§20.

**Commit `803eff1`, "Show real FE-sector content and fix pie-chart 0% for FE colleges," on `main`**: 6 files changed (+209/−51) — `page.tsx`, `sources/page.tsx`, `RollCard.tsx`, `SmallCards.tsx`, `ilr-participation-data.ts`, `la-sector-composition.ts` — matching the artifact report's own file list exactly (the "six" vs "seven" mismatch flagged in §20 turns out to be moot: the live commit touches exactly six files, `fe-participation-roll.ts` was import-only and never itself modified).

**A live-page fetch to visually confirm the rendered note wasn't possible from this session** — `vicdata.co.uk` is behind HTTP basic auth on this network, expected for a pre-launch site — but the code-level verification (the real committed conditional, its logic, and its dated comment matching the reported numbers exactly) is conclusive on its own.

**Status: this round is fully closed.** Both original gaps (pie-chart 0%, blank FE pages) are live on `main`, the one loose end from §20 is explained (a real, pre-existing, harmless DfE disclosure-control rounding artifact, not a bug) and given a small honest UI note rather than silently left to look wrong. Nothing further outstanding from this thread.
