# VicData Phase 3 (VicData Public) — Claude Code Build Brief

**Read all three specs first — they hold every resolved decision this brief bounds. Don't duplicate effort re-deciding anything already settled there:**
- `docs/vicdata_phase3_school_rolls_topic_spec_v1.md`
- `docs/vicdata_phase3_state_of_school_page_spec_v1.md`
- `docs/vicdata_phase3_membership_onboarding_spec_v1.md`

Repo: **VicData Public** (new, separate from the ingest repo and from VicDash — deliberate repo separation, not yet shared code, per the roadmap discussion; see membership spec for the reasoning).

**Precondition — confirm before starting**: the two ingest-repo fixes below (boarding mapping, GIAS field mapping) should already be done as a separate pre-build step. If they aren't, stop and flag rather than building around partial data.

---

## Goal

Build the **complete product as currently spec'd, minus Stripe** — everything across all three specs, working end-to-end, sitting fully behind the gates below until Guy explicitly releases it. The point of this build is to have something real to demonstrate, test, and refine privately, so that "going live" later is genuinely just switching gates off, not a further build event.

**In scope because it's spec'd, regardless of free/paid tier**: school search; the State of the School public page; the school-rolls topic in full, both free (current-state snapshots) and paid (trends, shape stability, market share, Feeder Set, Comparator Set) content; the complete membership/account system (signup, verification, the `check-school` two-branch join flow, account holder/admin roles, role-based views, the personal-vs-shared saved-set caps, tier logic).

**Stripe is explicitly held for now** — see below. Everything else is in scope.

**Out of scope because it isn't spec'd yet, not by sequencing choice**: academic results, social context, destinations — none of these have a spec to build from. Also out of scope: devolved nations (Scotland/Wales/NI), fee-data scraping, presentation/PDF export, full home-page brand/design treatment (a separate design pass) — none of these are blocked on anything, they simply haven't been designed yet.

## Stripe — held, not built this round

**Do not wire in Stripe at all this round** — no checkout, no webhook, no live or test-mode calls. This is a deliberate hold, not a readiness gap; revisit as its own later piece of work.

**But the tier-gating logic it would normally drive still needs to exist and be testable.** Build a member's tier (individual / school, and the account-holder/admin/role structure) as a directly settable field — a dev/seed-data toggle or equivalent — so the free/paid content-gating logic, the role-based view scoping, and the 2nd-individual-member upsell warning can all be built and properly tested without any payment plumbing behind them. Don't skip building the gating itself just because Stripe isn't there to drive it, and don't build a fake "Subscribe" button that goes nowhere — just make tier state directly settable for testing.

## Infrastructure setup

- **New, separate Supabase project** — not the existing ingest-repo project. Same Supabase account, genuinely different project: its own schema for accounts, memberships, roles, saved sets, and a search-optimized copy of school reference data (pulled via Phase 1's live API, never a direct shared table). Deliberate isolation from Phase 1's ingest/admin schema, which has no public attack surface today — Phase 3 will, so it shouldn't share a database with something that doesn't.
- **Render**: new Web Service (not Static Site — middleware/route handlers need a running Node process), Node 20 or 22 LTS pinned via `.nvmrc`/`.node-version`, Starter tier or above (avoid Free's cold-start spin-down during active testing). Try CLI/API-based setup first, using whatever Render and Supabase credentials are already authenticated in this environment, before falling back to anything requiring manual dashboard access.
- **Domain**: `vicdata.co.uk` is available and unused by the ingest site — point it at the new Render service now, while the access gate is still on. No reason to delay behind a temporary `onrender.com` URL first. DNS record changes at the registrar may need doing outside this session if no API/CLI access is available there.

## Checkpoint 0 — mandatory, before any feature work starts

**Hard stop, not a "welcome to pause here" — do not proceed into search, page-building, or membership work until every item below is verified with actual evidence, not just "done."** Getting this wrong and building for hours on top of it is far more expensive to unwind than a short pause here.

- **GitHub**: confirm the repo is correctly connected, a real commit can be pushed and pulled, and `.gitignore` actually excludes `.env`/secrets — check this by attempting a trivial test commit, not by assuming the config is right.
- **Supabase**: confirm the new project is genuinely separate from the ingest repo's (different project ref), a real connection from the app succeeds (a basic test query, not just "credentials entered"), and the three key values (URL, anon key, service-role key) are each correctly retrieved.
- **Render**: confirm the service is a Web Service (not Static Site), builds and deploys successfully end-to-end with a minimal placeholder page before loading in the full build, and is reachable at its `onrender.com` URL. Confirm the domain is pointed correctly if that step has been reached.
- **`.env`**: confirm every required variable is present and loading correctly — `ALLOW_INDEXING=false`, the access-gate credentials, all three Supabase values — and confirm the `NEXT_PUBLIC_`-prefixed vs. server-only split is correct (nothing secret is accidentally client-exposed).
- **Report each of these explicitly with the evidence**, not a summary claim — e.g. "test commit pushed and pulled successfully," "test query against the new Supabase project returned X," "Render build succeeded, placeholder page returns 200 at [URL]," "`.env` confirmed gitignored, all required keys present." Only proceed to the rest of the build once this checkpoint is actually confirmed, not assumed.

## Pre-build step — ingest repo, separate from this one

Two fixes this build's data depends on, done **before** this brief starts, in the ingest repo (not here):
1. Boarding data needs a new helper added to `dfe_school_census.py`'s own mapping dict (confirmed: `source_field_mappings` has no effect on this source at all — don't attempt that path).
2. GIAS's confirmed-present fields (location: Easting/Northing, MSOA/LSOA; attributes: phase, boarding, age range, size) need mapping into `school_entities`.

If starting this brief and either fix isn't actually done yet, stop and flag rather than building around partial data or guessing at a workaround.

## Launch gating — nothing publicly reachable or indexable until explicitly released

**Hard requirement, not a preference — and more consequential than a features checklist, given the company isn't legally formed and no bank account exists yet.** This isn't "wait until the build is polished" — it's "nothing here should be usable by a stranger or findable by a search engine until Guy says otherwise, independent of how complete the code is."

**Two separate mechanisms, protecting against different things, released at different times:**

- **Indexing gate** (`ALLOW_INDEXING` env var, default `false`): drives `robots.txt` (disallow-all when false) and a site-wide `noindex` meta tag. Stops search engines from crawling/indexing. Does **not** stop a human with the direct URL from viewing or using content.
- **Access gate** (password protection, on by default): stops anyone without the password from reaching the site at all. **Build this as Next.js middleware doing Basic Auth** — deliberately platform-agnostic (works identically on Render or Vercel, hosting platform not yet decided), rather than relying on any platform-specific feature. Note: **not** `.htaccess` — whichever platform this ends up on, it isn't Apache, so `.htaccess` has no effect regardless of what's in the file.

**Three real phases this should support**, not just one on/off switch:
1. **Active build and private testing** (where this sits now) — both gates on. Nobody outside the team sees or uses anything.
2. **Private beta** (if wanted, later) — access gate off (real invited users can browse/use via direct link), indexing gate stays on.
3. **Public launch** (after the company and bank account exist, Stripe is actually built and wired, and Guy explicitly says go) — both off, sitemap submitted.

Concretely:
- **Default-deny for both gates, via environment config**, not manual per-page toggles — flipping phases should be a small number of deliberate config changes, not hunting down scattered flags.
- **Sitemap generation can exist, but submission to Google Search Console is a separate, manual step** — don't auto-submit as part of any deploy pipeline.
- **Preview/staging deployments need the same protection as production** — don't assume an unlinked preview URL is safe by obscurity, on whichever platform this ends up on.
- **Acceptance check includes verifying both gates** — indexing and access — before anything else is checked.

This is a standing rule for the whole VicData Public repo, not just this build.

## Reuse strategy — from the Club ISS investigation (membership spec §3)

**Search:**
- Port the algorithm shape, not the query: debounce (300ms, min 2 characters), full-text-search-first with a suffix retry ("school"/"college" appended if under 3 results), `ilike` substring fallback, dedup. Live-as-you-type dropdown, not submit-then-results.
- Do not reuse Club ISS's actual query — it's bound to `search_vector`/`search_text` columns that don't exist on `school_entities`. Build fresh: town/postcode pulled from GIAS (confirmed available), a proper `search_vector`/GIN index on `school_entities` itself.
- Build two things from the start that Club ISS's version lacks (confirmed real gaps, worse at VicData's 52,419-school scale than Club ISS's 1,786): real relevance ranking (`ts_rank`/`ts_rank_cd` with `setweight()`, name matches weighted above town/postcode), and `pg_trgm` trigram fuzzy matching alongside FTS for typo tolerance.
- Reuse the "can't find your school?" pattern (manual entry → pending record → admin email) for cases search doesn't surface — working precedent from Club ISS, not a new design.

**Membership (Stripe portions of the Club ISS audit held for later, per above):**
- Do **not** reuse Club ISS's membership data model — no singular account-holder concept exists there (`is_admin` is a plain shared boolean, any number of people can hold it simultaneously), no personal-vs-shared cap split, no handoff mechanism. Build VicData's actual model fresh per the membership spec §5: singular account holder (auto-assigned, deliberate-handoff reassignment only), separate admin tier, personal caps (3, Comparator Set) vs. shared/unlimited.
- Fix, don't inherit, two confirmed Club-ISS bugs, even though it's the account-model shape being reused rather than Stripe itself: don't hardcode the member-invite cap as a bare constant like `MAX_FULL_MEMBERS = 5` — make sure frontend and backend agree on who can remove members (Club ISS shows a "Remove" button to everyone, silently failing for non-admins — a real, live inconsistency, not a pattern to copy).

## In scope — everything across all three specs, minus Stripe

**School search** — against `school_entities`, per the reuse strategy above.

**State of the School page**, per school:
- Current roll (total + by age band)
- Current shape classification (single-year snapshot, headcount-based, age-band axis — not year-group; rule per rolls spec §4, bucket-transition method as a starting reference)
- Current gender split, with the single-sex suppression principle applied as a **documentation discipline now** (log any arithmetic inconsistency without a causal hypothesis) — the proportion-based *display* suppression is a flagged to-do, not required yet, but the documentation discipline is not optional
- Current boarding split
- "Surrounding schools" nearest-20 stat, excluding special schools (`establishment_type_group = 'Special schools'`) and PRU/AP (substring match on `establishment_type` — the "Secure units" edge case is unresolved, don't let it silently break the filter)
- Visible "coming soon" placeholders for academic, social context, and destinations sections

**School-rolls topic in full**, both tiers:
- Free: everything above, plus regional/national/local shape and trend-free context data via Phase 1's live hosted API (do not import ingest code directly into this repo)
- Paid: historical roll trends, shape stability trajectory, gender/boarding trends, market share, Feeder Set (adaptive target-count search, per entry point, sector-split, self-curated), Comparator Set (attribute-filter-first, geography-optional except the "local rivals" configuration, personal cap of 3 + unlimited shared), ranks, peer group trends

**Full membership and account system:**
- Signup and verification (GIAS website-domain auto-match, manual fallback)
- `check-school` two-branch join flow (first-member verification path vs. request-to-join-existing path)
- Account holder (singular, auto-assigned, deliberate-handoff reassignment) and admin (separate, multiple allowed) roles
- Role list: head/governor, admissions, finance, director of studies, heads of department — kept as genuinely separate roles, not reconciled
- Role-based access as real scoping (some content hidden per role, e.g. academic hidden from admissions once that topic exists) — architecture should support this even though full role-by-role scoping isn't finalised
- Individual and school membership tiers (as directly-settable state, per the Stripe hold above); the individual-to-institutional tier change (no new linking mechanic needed, per membership spec §5); the 2nd-individual-member upsell warning (non-blocking, targets both the joiner and the account holder)

**Handling for the confirmed 6th-form/FE census gap**: the 502 FE-corporation institutions have no roll data and should degrade gracefully (skip and backfill to a 21st candidate, or show fewer than 20 — Claude Code's call, log the choice to `OPEN_QUESTIONS.md`), not error or silently misrepresent.

## Explicitly out of scope (not sequencing — genuinely unspec'd or deliberately held)

- Academic results, social context, destinations topics.
- Devolved nations (Scotland/Wales/NI).
- Fee-data scraping.
- Presentation/PDF export (the VicDash pattern — `window.print()` + `@media print` — is a good reference for whenever this does get built).
- Full home-page brand/design treatment — minimal shell sufficient to link into search is fine for now; the real design pass is separate.
- **All of Stripe** — held deliberately this round, see above.

## Working mode

Work through this build without stopping for approval on implementation details. If you hit a genuine product/architecture decision not already resolved across the three specs, log it to `docs/OPEN_QUESTIONS.md` (create if needed) with your reasoning and the default you're proceeding with, rather than blocking. Given the scope here, natural internal checkpoints are welcome (e.g. search + State of the School page, then rolls' paid content, then membership/roles) — stop at each and summarise, rather than one single giant handoff at the very end.

## Acceptance check before calling this done

**First, and non-negotiable**: confirm both gates actually work — `robots.txt` disallows all, `noindex` renders site-wide, the access gate (middleware Basic Auth) blocks an unauthenticated request, preview deployments are equally protected. Nothing else in this checklist matters if this one is wrong.

Then, for a real sample of schools spanning state/independent, primary/senior, and at least one of the confirmed 6th-form/FE edge cases (a converted academy-status sixth-form college, and one of the 502 genuine FE-corporation institutions): search finds them correctly, ranked sensibly, typo-tolerant; each school's State of the School page renders correctly; a full signup-through-verification-through-account-holder-assignment flow works end to end for a first-member school; a second signup at the same school correctly triggers the request-to-join path and the upsell warning (using directly-set tier state, no Stripe involved); a Comparator Set can be built, saved, and hits its cap at 3 personal sets; a Feeder Set candidate search and confirmation flow works for at least one senior school and one entry point.
