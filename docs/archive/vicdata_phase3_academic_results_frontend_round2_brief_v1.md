# Brief: Academic Results front end, round 2 — family/subject depth, perf fix, go-live prep

Overnight round. Builds directly on top of round 1's own, still-uncommitted working
tree (`vicdata_public/docs/vicdata_phase3_academic_results_frontend_build_report_v1.md`)
— don't re-do anything that report already covers, and don't assume its claims without
checking, same discipline as every round before it. This brief has four parts: a quick
perf fix (A), the two depth levels round 1 explicitly deferred (B, C), and an
investigation-only go-live readiness check (D) — not a deploy.

## Read this first

- `vicdata_phase3_academic_results_frontend_build_report_v1.md` (round 1's own report,
  already in `docs/`) — read this in full, especially its own "Explicitly NOT built"
  section, which is this brief's real starting point.
- `src/lib/academic-data-view.ts` — the real data layer round 1 built. Every constant
  (`HEADLINE_MEASURE`, `GRADE_BAND_MEASURE`, `TREND_BASELINE_PERIOD`, etc) and helper
  this round needs already has a sibling in this file — extend it, don't fork a second
  data layer.
- `vicdata_phase3_academic_results_frontend_spec_v1.md` §3b/§3c (Map depth), §4
  (Graphs section 4), §6 (subject-level table) — the real spec sections this round
  builds, unchanged from when they were written.
- `vicdata_phase3_academic_results_summary_wordings_v1.md` §6, §7, §10 — real candidate
  wording for the family/subject breakdown, the subject table, and small-cohort
  suppression.
- The real, live comparator-set/Map/Graphs code round 1 already built
  (`AcademicMapView.tsx`, `AcademicGraphsView.tsx`, `AcademicDataView.tsx`) — this round
  extends these components with a drill-down, it doesn't replace them.

## Part A — fix the free-page census double-fetch (quick, do this first)

Real, confirmed inefficiency from round 1's own review: `fetchAcademicProfiles` always
fetches `ageGenderCounts` via `fetchCensusFactsBatched` — a second, separate network
round-trip to `vicdata` — but `AcademicSnapshotCard` (the free page's only consumer)
never reads that field at all; it exists purely for the paid Map's circle sizing. Every
free-tier School page view (the highest-traffic page on the site) currently pays for
that round-trip for nothing.

Fix: give `fetchAcademicProfiles` an option (e.g. `{ includePopulation?: boolean }`,
default `true` to keep the Data View's own call sites unchanged) that skips the
`fetchCensusFactsBatched` call and returns an empty `ageGenderCounts` map when `false`.
Update the free snapshot card's call site in `src/app/schools/[urn]/page.tsx` to pass
`includePopulation: false`. Confirm via a real request (not just `tsc`) that the free
page's academic fetch no longer issues that second call.

## Part B — family-level Map (§3b) and Graphs section 4 (§4)

Needs a category (subject family) drill-down control — the same pattern the existing
Phase → individual-age filter already uses elsewhere in this codebase (an expand
arrow, same pill/button styling), reading the real 8 families from `subject_families`.

- **Map**: once a family is selected, circle size = `entries_total` for that family at
  that school (`AcademicFamilyYear.entriesTotal`, already in the data layer from round
  1 — no new fetch needed for this part). Colour: trend in `avgPointScore` since the
  stage's baseline year (grade-band colour mode stays headline-only, per the original
  brief's own explicit deferral — don't build it here either, that needs a genuinely
  new aggregation this round doesn't add).
- **Graphs section 4**: entries-share donut (this school's own mix across families,
  the active stage/year), a bar chart of `avgPointScore` across the ticked comparator
  set for the selected family, and a trend line of the school's own family score since
  baseline. Low-coverage families (`pointsCoveragePercent` low — Health & Care,
  Enterprise & Applied Studies, per round 1's own backend finding) show entries-share
  and entries count normally; only withhold the point-score figure, with the honest
  wording already drafted (summary-wordings doc §6) — don't invent a substitute number.

Data layer: `ks4Families`/`ks5Families` are already fetched and shaped in
`academic-data-view.ts` — this part is UI, not a new data need, for the school's own
target profile. The ticked-set bar chart needs family data for every ticked/added URN
too — already true today for the whole Overview section (`fetchAcademicProfiles` is
already called for the full URN set), confirm this rather than assuming a second fetch
is needed.

## Part C — subject-level Map (§3c) and the subject-level table (§6)

The one piece of this topic that needs a genuinely new fetch: raw
`dfe_ks4_subject_entries`/`dfe_ks5_subject_results`/`dfe_ks5_subject_results_historic`
facts via the existing `reference_data_lookup` RPC (`lookupReferenceData`, already
imported in `academic-data-view.ts` for KS2) — there is no precomputed subject-level
table, by design (only the family rollup was built). Check the real breakdown-string
shape of these three sources directly before writing any grouping code — don't assume
they match `academic_subject_family_rollup`'s own shape.

- **Map**: same mechanism as family level, one level finer — circle size = entries for
  the one selected subject, colour = trend in average point score (or grade-band, same
  deferred status as family level).
- **Subject-level table (inside Graphs' Overview, once drilled to one subject)**:
  subject name, entries, average grade/point score, and — KS5 only — value-added with
  the same confidence-interval framing discipline used everywhere else in this topic
  (never a bare score; if the real ingested value-added fields don't carry a usable CI
  at subject level, say so and show the point figure honestly flagged rather than
  fabricating an interval).

**Judgement call — decide with real evidence, don't guess**: the minimum-N threshold
for small-cohort suppression (topic spec §6, spec §6/§9, summary-wordings §7/§10 — open
since the very first brief). Look at the real distribution of subject-level entry
counts in the actual ingested `dfe_ks4_subject_entries`/`dfe_ks5_subject_results` data
— what does the real long tail of small-cohort subjects actually look like at a typical
school — and propose a specific N grounded in that, with the reasoning written down.
Don't default to a round number picked without looking.

## Part D — go-live readiness check (investigation only — do not deploy)

The goal beyond this brief is genuinely shipping Academic Results to production. This
part is about knowing exactly what that requires, not doing it yet:

- In `vicdata`: confirm directly (e.g. `supabase migration list` against the linked
  hosted project, or equivalent) which of this topic's migrations — the two aggregation
  tables, the three new RPCs, this round's own — are and aren't yet applied to the
  hosted database. Do not apply any of them. Just report the real, current gap.
- In `vicdata_public`: confirm how this repo's hosted deploy actually happens (a
  git-push-triggered platform deploy, a manual build step, something else — check
  real config, e.g. `vercel.json`/CI config/README, don't assume) and confirm the
  hosted environment already has `VICDATA_API_URL`/`VICDATA_ANON_KEY` pointing at the
  same `vicdata` hosted project the new RPCs would be applied to (round 1's own testing
  explicitly avoided reading these hosted values — this check should too: confirm
  *that the variables exist and are set*, never print or log their real values).
- List, in the report, the exact real steps — in order — that taking this live would
  require (commit → push → apply pending migrations to hosted `vicdata` → confirm
  `vicdata_public`'s deploy picks up the new code → smoke-test against hosted). This is
  a checklist for a human decision, not something to execute.

## Explicitly out of scope, still

- `academic_geography_lookup` (LA/region/national) — only wire it in if Part B or C's
  own real UI work surfaces a genuine, concrete need for it (e.g. a national-average
  reference line actually gets added to a chart) — don't invent a use for it just
  because it exists. If nothing in this round calls for it, say so again, don't force
  it.
- Region/Nation-scale Academic Rankings (Part C of the RPC bridge brief) — still a
  separate, later round.
- Print/PDF export for the Academic tab.
- Vocational/BTEC point-score conversion.

## Verification

Same discipline as every round: `tsc --noEmit` and `eslint` on every changed file, and
real end-to-end testing against the actual local dev server and local Supabase stack —
not type-checking alone. Check directly at the start of this round whether a
Claude-in-Chrome (or other browser) connection is available this session; if it is, use
it to get a real, visual click-through of the family/subject drill-down (round 1 was
never able to do this and said so plainly) — if it isn't, keep using `curl`/API-level
testing and say so plainly again, the way round 1 did, rather than implying a browser
test that didn't happen.

## Deliverable

Same report shape as every prior round, covering all four parts above, including the
minimum-N reasoning with real numbers, the go-live checklist, and anything genuinely
ambiguous written up rather than guessed. Confirm nothing was written to hosted/
production and no existing Rolls or round-1 Academic behaviour regressed.

Do not commit or push, and do not touch hosted/production in any way (Part D is
read-only investigation) — build and test locally, write up the report, and stop
there. Guy and Claude (the other assistant) will review the real diff together and
decide on committing and the actual go-live steps from Part D's checklist.
