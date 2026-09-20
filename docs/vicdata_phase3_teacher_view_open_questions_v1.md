# Teacher view build — running log of judgment calls

Per the build prompt's operating mode: every point where the brief did not fully spell
out an answer, the most reasonable call consistent with its stated principles was made,
logged here, and the build continued. This is a running log appended to during the
build, not written at the end.

Principles used to resolve these, from the brief: natural-language-question headings
(§14), radical visual consistency (§14), comparisons-and-context everywhere (§14),
mobile-first and full-screen (§7), per-dataset onboarding as the unlock mechanism (§5),
never show a bare number without an anchor, and never fabricate — show only what is
honestly real.

---

## Q1. The real role vocabulary does not match the brief's

**Found:** the live constraint is
`role in ('head_governor','admissions','finance','director_of_studies','head_of_department')`.
The brief (§3) asks for Teacher, HOD, SMT, Finance, Admissions. So three of the brief's
five already exist under different names, `teacher` and `smt` do not exist at all, and
two live values (`head_governor`, `director_of_studies`) are not in the brief's list —
though §3 explicitly folds both into SMT.

**Decided:** migrate to the brief's canonical vocabulary outright
(`teacher`, `hod`, `smt`, `finance`, `admissions`) rather than keeping the old values
alongside as aliases.

**Why:** checked first — there is exactly one membership row in the whole database and
its role is NULL, so no real data uses the old vocabulary and a clean migration costs
nothing. Carrying five dead legacy values forward would leave the next person guessing
which set is canonical. §3's folding instructions are encoded as comments in the
migration so the mapping is not lost.

## Q2. Should `role` have a database default?

**Decided:** yes, `default 'teacher'`.

**Why:** §3 makes Teacher "the default, self-selected role ... no role picker needed for
the common case", and calls zero-friction default central to growth. A database default
means an individual joining alone is a Teacher without any code path having to remember
to set it. Admin-granted roles (§3) are an explicit upgrade from that baseline.

## Q3. `role` currently gates nothing

**Found:** `role` is written at join and rendered on the account page. Nothing reads it
to decide what a user sees; `is_admin` is the only real gate today.

**Decided:** treat "role drives the view" (§3) as something this build must establish
rather than something it can confirm, and add a single shared resolver the rest of the
build gates on, rather than scattering role checks.

**Why:** the prompt asks to "confirm role, not job title, is what the rest of this build
gates on". It is not true yet, so confirming it would be false; building it is the
honest reading.

## Q4. Sector-aware role labels — how far to take it now

**Decided:** implement the keyed-by-role-plus-sector lookup §3 asks for, but populate it
only where a real sector difference exists today (Director of Studies folding into SMT
is the independent-sector case §3 names). Every other label is sector-neutral for now.

**Why:** §3 wants the mechanism in place because "sector is known at signup and
DoS/year-group-leader isn't the only place this matters". Building the mechanism but
inventing sector-specific wording nobody asked for would be fabricating copy.

## Q5. "Current data" needs a national reference year, not a per-school one

**Decided:** `availableTeacherPhases()` takes the current period per phase as an argument
rather than deriving it from the school's own latest year.

**Why:** §5 says a tile requires data "not just historically, but in the most recent
available year". Deriving from the school's own rows would make a school whose last data
is 2022 look current against itself, which is exactly the case being excluded. Checked
against production: all three phases currently publish to 2024, and 385 KS4 plus 187 KS5
schools have data but nothing current — so this rule is load-bearing, not theoretical.

## Q6. KS2 "Roll" — a real trap in the census field names

**Found:** the census carries both `full_time_male_aged_10` and
`full_time_male_year_group_10`. §5 asks for "the age-10/Year 6 cohort". Year group 10 is
the GCSE year, not Year 6 — reading the wrong one would silently put a secondary cohort
on a primary card.

**Decided:** reuse the existing `populationAtAge(profile, HEADLINE_AGE.ks2)`, which
already resolves age 10 from the age breakdown, rather than writing a new lookup.

**Why:** §18 asks to confirm the card mapping against the real backend; it confirmed the
helper already exists and already takes the correct field. Rebuilding it would have been
a second, drifting copy with a live chance of picking the wrong one.

## Q7. §18 task 3 — comparability coverage, with one real edge

**Found:** all 37 distinct real KS5 qualification strings classify into a bucket, zero
unclassified. But `A level` and `Applied general` as RAW strings fall into "other",
because the rule matches `GCE A level` exactly. Those are DfE's 2020 cohort-level labels,
a different file layout with no grade detail at all.

**Decided:** leave it. Those rows cannot be scored regardless (no grades), so "other" —
which never carries a points figure — is the honest destination. Flagged rather than
"fixed", because making the rule match them would imply 2020 can be scored when it cannot.

**Note:** T Level does not appear among the 37 because it lives in its own source
(`dfe_tlevel_results`); it is classified separately and correctly.

## Q8. Blocked: schema changes could not be applied

Not a judgment call — recorded here so the log is complete. Applying DDL to
`vicdata-public` was blocked by the environment during this build, so the Phase 1 role
migration is written and committed but NOT applied, and every phase requiring new tables
(saved state, Recruitment, Meetings, notes) could not be built or verified. Read access
was unaffected, so all real-data verification in this round is genuine.

## Q9. `normaliseRole()`'s legacy branch is now dead — strip or keep?

**Verified first:** the constraint now reads
`role = ANY (ARRAY['teacher','hod','smt','finance','admissions'])`, the default is
`'teacher'`, and the single membership row reads `teacher`. So no new write can produce
`head_governor`, `director_of_studies` or `head_of_department`.

**Decided:** keep the function, keep its NULL handling, and keep the legacy map — but
re-comment the map as unreachable-in-normal-operation rather than leaving it looking like
live logic.

**Why:** two separate things were tangled here. The NULL branch is genuinely still
reachable: a CHECK constraint passes on NULL, so `role` can still be explicitly set to
NULL, and `normaliseRole(null) -> teacher` is the rule that makes Teacher the baseline.
The three legacy string branches are genuinely dead. Deleting them costs nothing today,
but they are the only executable record of §3's folding rules, and they would bridge a
restore from a backup taken before the migration. Six lines, honestly labelled, beat a
silent gap if that ever happens.

## Q10. What a school with zero available phases sees

**The gap:** Phase 2 verification found an independent junior/prep has no available phase
at all — confirmed zero KS2 data (0 of 1,588 open independents), and no KS4/KS5 access.
St Paul's Cathedral School is a live example. The brief does not say what that teacher's
home screen shows.

**Decided:** a genuine, explanatory empty state, not a blank screen and not a fabricated
or greyed-out tile. It says plainly which phases the platform covers, states that DfE
publishes no KS2 results for independent schools and no accessible KS4/KS5 data for this
school, and points at what the platform genuinely does hold for them (roll and context
data). It never implies the data is coming, because for this school type it is not.

**Why:** §5 is explicit that there is no third "locked/teaser" state, so a greyed tile
would contradict it. The standing discipline is that an absence must be explained rather
than rendered as a gap. And the cause here is structural, not a coverage gap that a
future ingest fixes, so "not yet" wording would be untrue.

## Q11. Shape of the persistence schema

**Decided:** seven small creator-only tables rather than one generic key/value store;
onboarding modelled as "a row exists" rather than a boolean column.

**Why:** §5 says completing a walkthrough is literally what unlocks a phase, so presence
of a row IS the state — a boolean would need a separate "unset" meaning. Separate tables
keep Recruitment's `candidate_name`, the only personal-data field on the platform (§10),
isolated in one place with its own retention column, rather than buried inside a shared
JSON blob where it could not be found or purged reliably.

## Q10a. CORRECTION to Q10 — the empty state is smaller than I made it

**Corrected mid-build by Guy.** My Q10 answer treated "no available phase" as a design
problem needing an explanatory dashboard. It is not. Teacher view is subject-exam-data
only. An independent junior/prep sits no public exams at that stage and has confirmed
zero KS2 data, so there will never be exam data for this school type to show here. It is
Teacher view not applying to the school, not a gap in it.

**Two things my first version got wrong:**

1. It was too elaborate — three paragraphs building an experience around an absence that
   needs one honest line.
2. Its "in the meantime" phrasing implied the data was coming. It is not, and "no data
   yet" or "coming soon" would both be untrue.

**Also added:** the original risked implying the platform holds nothing for this school.
It does — SMT, Finance and Admissions views are built on rolls, feeder schools and
catchment context, none of which depend on exam data, and this school type has all of
them. Those views are not part of this build, but the empty state now says plainly that
this is a "someone here should be on a different role" case rather than a dead end.

## Q12. The nearest-neighbour pool is geographic only, so rankings needed phase filtering at BOTH ends

**Decided:** filter the neighbour pool by the phases that actually sit the stage, at KS4
and KS5 as well as KS2 -- `KS4_KS5_PHASES = Secondary, All-through, 16 plus, Middle
deemed secondary`, alongside the existing `KS2_PHASES`.

**Why:** `school_nearest_neighbours` is a pure distance table. I had filtered it for KS2
(where "the nearest 10 primaries" is explicitly what §5 asks for) but left the KS4/KS5
path filtering on `status` alone, on the assumption that a secondary's nearest schools
would be broadly secondary. That assumption was wrong, and only real data showed it:
**Haverstock School's ten nearest schools contain zero secondaries** -- five Primary and
five "Not applicable" independent preps -- so its Rankings card ranked it "position 1 of
2" against a comparator set that was almost entirely primary schools. Technically true,
completely useless, and worse than showing nothing because it looks like a real result.

This was caught by running the real card against a real school, not by reading the code,
where it looks correct: the KS2 branch has an obvious filter and the KS4 branch has an
obvious `status` check, and nothing about the shape of it suggests a problem.

**After the fix, verified against live data:**

| School | Stage | Neighbours | Phases | With a real figure | Rank |
|---|---|---|---|---|---|
| Haverstock School (100049) | KS4 | 10 | Secondary x10 | 11 of 11 | 10th of 11, A8 41.5 |
| Haverstock School (100049) | KS5 | 10 | Secondary x10 | 10 of 11 | 6th of 10, APS 32.52 |
| St Peter's Methodist Primary (118707) | KS2 | 10 | Primary x10 | 10 of 11 | 5th of 10, RWM 63% |

The two neighbours with no figure are correct, not gaps: **St Stephen's Infant School**
takes no KS2 tests, and **Lift Beacon High** has no A-level cohort. Both stay visible in
the comparator list without a fabricated number.

**Also changed:** `fetchNearestSchools` now takes a 100-row slice like
`fetchNearestPrimaries` rather than 60, for the same reason -- once the pool is filtered,
the tenth real secondary can sit well down the geographic list in a primary-dense area.

## Q13. KS2 does not live in `academic_headline_snapshot`, and my first verification of it was wrong

**Logged as a correction to my own testing, not a code change.**

My first attempt to verify KS2 rankings reported "0 neighbours with data" for St Peter's
Methodist Primary and I nearly recorded it as a real gap. It was not. I had verified
through `academic_headline_lookup`, which is **KS4/KS5 only and returns 0 rows for KS2** --
KS2 comes from `canonical_facts` via the generic `reference_data_lookup` RPC with
`source_id='dfe_ks2_attainment'`. The route was never affected: it goes through
`fetchAcademicProfiles`, which already reads KS2 from the right place.

A second flaw in the same test: I had invented the measure keys rather than using
`HEADLINE_MEASURE`, so every stage silently scored null. The real keys are
`attainment8_average` (KS4), `A level::aps_per_entry` (KS5) and
`Reading, writing and maths::expected_standard_pupil_percent` (KS2).

**Why it is worth recording:** both flaws produced a clean, plausible, entirely wrong
"no data" result. A verification harness that reaches for a data source or a measure key
of its own rather than the one the code under test uses is not verifying that code, and
it fails in the direction that looks like a finding.

## Q14. Creator-only visibility, actually exercised by a non-owning account

**Asked for explicitly:** confirm the RLS-enforced creator-only visibility on
Recruitment/Meetings/Notes was exercised by a second, non-owning account and seen to
return nothing -- not assumed from the policy definition.

**Done, with one caveat stated up front.** There is exactly **one profile on the whole
project**, so a genuine second account does not exist to log in as. I did not create one:
that would put a real auth user into a production project purely for a test. Instead the
second account is impersonated at the SQL level by setting
`request.jwt.claims->>'sub'` to a uid that owns nothing, which is the same value
`auth.uid()` reads for a real signed-in user, so the policies are evaluated by exactly
the code path a real second login takes. The whole test ran inside a transaction that was
rolled back.

**The control matters more than the result.** "B sees 0 rows" is worthless on its own --
it is equally consistent with the impersonation silently failing, or the tables being
empty. So account A, the real owner, was run through the identical queries first:

| Actor | onboarding | preferences | notes | jobs | candidates (PII) | meetings | slides |
|---|---|---|---|---|---|---|---|
| A (owner) | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| B (non-owner) | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| anon (logged out) | 0 | -- | 0 | -- | 0 | -- | -- |

Writes as B were tested too, because read-blocking alone is not creator-only:

- `UPDATE teacher_view_notes SET body='TAMPERED'` -- **0 rows changed**
- `DELETE FROM recruitment_candidates` -- **0 rows deleted**
- `INSERT` a note with `profile_id` set to A's uid -- **refused**: "new row violates
  row-level security policy for table teacher_view_notes" (the `WITH CHECK` half doing
  its job; without it B could plant rows into A's view)

Data was re-checked outside the transaction afterwards: 1 note, 0 tampered, 0 forged, 1
candidate. Nothing was altered.

**The two tables I most expected to fail did not.** `recruitment_candidates` and
`meeting_slides` own no `profile_id` of their own -- they are protected only by a
subquery back to the parent (`job_id IN (SELECT ... WHERE profile_id = auth.uid())`).
That indirection is the classic place a creator-only guarantee leaks. Both returned 0.
`recruitment_candidates` is the one that matters most: `candidate_name` is the only
personal-data field on the platform (§10).

**What this does and does not prove.** It proves the policies themselves hold for reads,
writes, deletes and forged inserts, including through parent-table indirection. It does
not exercise the real login flow, session handling or the UI. It would also be void if
any Teacher view code reached the database with the service role, which bypasses RLS
entirely -- so that was checked rather than assumed: both API routes
(`/api/teacher/dashboard`, `/api/teacher/phases`) construct their client with
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and the caller's own `Authorization` header, and
`teacher-view-data.ts` uses the browser client. There is no service-role path in Teacher
view, so RLS is load-bearing on every route, which is what makes the result above
describe production rather than a lab.

## Q15. "Light/dark theme: a proper toggle, defaulting to dark" -- scoped to Teacher view, not the site

**Decided:** build the toggle, default it to dark, and scope the override to Teacher
view's own subtree rather than to `<html>`.

**Why:** §7's sentence sits in a Teacher view brief, in a section about Teacher view card
interactions. Taken literally at site level it would change the public product's default
appearance for every existing visitor -- a visible change to pages this build was never
asked to touch, and not something to do as a side effect of a dashboard round.

**What made scoping possible.** Tailwind v4's stock `dark:` variant is media-query-only,
so before this round there was no mechanism anywhere on the site to override the system
setting. The usual recipe is to redefine the variant as attribute-only, but that would
have been the silent site-wide change described above: every existing `dark:` class would
stop answering `prefers-color-scheme` until some new script set an attribute. So the
variant in `globals.css` now answers to **both** -- the media query as before, plus a
`data-theme` attribute that acts as a local override in either direction. Verified in the
compiled CSS rather than assumed: 154 attribute branches, 154 light-escape guards and 70
media branches are emitted, so system preference still drives every page that does not
opt in.

**Print.** §7 also wants export to render light "regardless of on-screen theme". CSS
cannot un-apply a utility, so a `@media print` block could not undo `dark:` classes on a
themed subtree. The attribute is the only honest lever: `beforeprint` swaps the subtree to
light and `afterprint` restores it, on top of the existing Data View print stylesheet
rather than as a second export mechanism.

**Flagged for Guy:** if the intent really was a site-wide dark default, that is now a
one-line change (move the attribute to `<html>` and seed it) -- but it should be a
deliberate decision about the public site, not a by-product of this round.

## Q16. Trend views are gated per subject, and that gate bites unevenly on real data

**Not a decision so much as a finding worth recording**, because it looks like a bug the
first time you see it.

§9 offers a trend view "once 3+ years of data exist". Implemented as a real count of
periods that genuinely carry a figure for that subject in that bucket -- not periods that
merely have a row. The consequence on live data at Haverstock School (100049):

- **Candidate numbers**: entries are published from 2021, so trends are offered widely.
- **Results, BTec subjects**: points only exist from **2023**, so a BTec subject has two
  years and is correctly offered **no** results trend.
- **Results, A-level subjects**: 13 of 29 have 3+ years of points; the other 16 do not.

So two subjects sitting next to each other on the same card can legitimately offer
different menus. My own first test ticked Arabic and Art and Design -- alphabetically
first, and both sparse -- saw zero results trends, and looked like a blanket failure.
It was not: ticking Biology and Mathematics produces 9. The gate discriminates per
subject, which is the intended behaviour and the honest one.

## Q17. "Both schools genuinely have data for" needed three attempts to get right

**Decided:** a phase appears in a candidate comparison only if there is at least one year
where **both** schools carry a real figure, and the comparison is anchored on the latest
such year.

**Why it took three goes.** §10 says the comparison uses "whichever measurable phases
(KS4/KS5) both schools genuinely have data for". Two weaker readings both looked right in
code and both failed against Haverstock School vs The Camden School for Girls:

1. **"Both sides have rows."** Wrong: DfE suppresses figures for small entry counts while
   the rows themselves remain. Arabic at KS4 produced a full comparison table of "--"
   against "--", with a points row reading `undefined`.
2. **"Both sides have a figure in some year."** Still wrong: the headline figures are read
   at the latest period, and Camden's Arabic figures stop before Haverstock's do, so the
   table passed the gate and then rendered blank headline rows anyway.
3. **"Both sides have a figure in the same year, and that year is the anchor."** Correct.

**After the fix, on live data:**

| Subject | KS4 | KS5 |
|---|---|---|
| Biology | shown -- entries 21 v 30, points 6.1 v 7.7 | shown -- entries 14 v 36, points 31.0 v 41.7 |
| Mathematics | dropped -- no shared year | shown -- entries 24 v 117, points 36.8 v 45.3 |
| Arabic | narrowed to 2022-23 -- entries 3 v 1, points honestly "--" | dropped -- no shared year |

Arabic at KS4 is the interesting survivor: the entries comparison is real (3 against 1)
and the points genuinely are suppressed at those numbers, so "--" is the true answer
rather than a failure. The row earns its place; the fabricated version of it did not.

**The general lesson, which is not specific to recruitment:** "has rows" is not "has
data", and a gate written against row counts will pass exactly the cases where a figure
is missing, because suppression removes values and leaves rows behind.

## Q18. Design texture, and the one part of it I could not verify

§14's principles were applied as implementation rather than as intent:

**Natural-language questions as headings.** §14 raises this to "a fundamental,
load-bearing principle" and names the places it must reach: "every card, every onboarding
step, every item in School Context's comparison menu, Recruitment, Meetings". The cards
and onboarding already complied; the comparison menu and the two standalone features did
not. An axis now carries a question-builder rather than a noun phrase, so the menu reads
"How is Biology doing against the other subjects in its category?" instead of "Biology --
vs other subjects in the same category", and the trend variant asks its own question
("... year on year?") rather than wearing a suffix. Recruitment and Meetings are titled by
what they answer, including on their home tiles.

**Radical visual consistency, made structural.** Three lists used the tick gesture --
subjects you teach, views to pin, slides to add -- as three separate blocks of lookalike
markup. That is precisely how "pixel-identical" stops being true without anyone noticing:
one list gets a padding change and nothing catches it. They are now one `TickList`
component, so the consistency is enforced by structure rather than by discipline. The
right-hand figure is part of the pattern rather than a caller's extra, following §14's
"comparisons and context, everywhere" -- a thing you are about to pick should say how big
it is while you are picking it.

**Mobile-first and full-screen -- verified structurally, NOT visually.** The browser
tooling was unavailable for this entire build, so I could not open these pages at 320px or
on a projector, and I am not going to claim I did. What I did check is structural and
real: no fixed pixel widths anywhere in the Teacher view tree, every multi-column grid
collapses to one column below `sm`, wide content sits in its own overflow container, and
the print path forces the light palette through the theme attribute rather than hoping CSS
can unwind it. That is necessary but not sufficient -- **the "feels considered at both
size extremes" half of §14 remains genuinely unverified and needs a real device and a real
projector.**

## Q19. The account page's Teacher View link is not school-scoped the way its sibling is

**Logged, not fixed, deliberately.** The per-membership card now renders "Open Teacher
View" above "Open Advanced Dashboard". The second is scoped explicitly
(`/schools/${account.school_urn}/data`); the first is plain `/teacher`, which resolves the
school from the caller's own membership rather than from a URN.

Correct today, because a profile only ever has one membership -- the testing switcher
deletes every existing row before inserting the new one, so "which school" is never
ambiguous. It would be wrong the day multi-school membership exists: the card is rendered
per membership, so two cards would both link to the same Teacher view.

**Why it was not scoped now:** `/teacher` is not the only page that resolves school this
way. `/teacher/[phase]`, `/teacher/recruitment` and `/teacher/meetings` all run the same
`maybeSingle()` membership query, so adding `?school=` to the entry point alone would be
cosmetic -- the first click through to a phase dashboard would resolve the single
membership again regardless. Doing it properly means threading a school through four
routes, which is more than this round asked for.

## Q20. Two pre-existing lint errors in the account page, untouched

`src/app/account/page.tsx` has two `react-hooks/set-state-in-effect` errors, at the
`load()` call in its main effect and at one other effect further down. **They pre-date
this round** -- confirmed by running eslint against the unmodified file at HEAD before my
change, which reported the same two -- and they are the same class of issue already fixed
in the Teacher view files. Left alone because this round is scoped to the school-scoping
bug and one link change, and the fix belongs with whoever next works in that file.

## Q21. The bugfix brief's row counts were slightly off, and the compiler found two call sites it did not list

Two small corrections, neither changing the fix:

1. The brief describes "the one existing row" in each of `teacher_view_onboarding` and
   `teacher_view_notes`. There were **two** in each (onboarding: ks4 and ks5; notes:
   `ks4:results:Biology` and `ks5:results`). All four resolved to the same school via the
   profile's approved membership, so the backfill covered them and nothing was dropped.
2. The brief lists the call sites as being in `src/app/teacher/[phase]/page.tsx`. Two more
   existed and would have kept the bug alive: `src/app/teacher/page.tsx` and
   `src/app/teacher/meetings/page.tsx` both call `fetchOnboardedPhases`. The type checker
   surfaced them the moment the signature changed, which is the argument for changing the
   signature rather than adding an optional parameter with a default -- an optional
   `schoolUrn` would have compiled cleanly and left both sites silently unscoped.

## Q22. The preview route could not use the sign-in path the brief assumed, because this app has neither half of it

**The brief's step 3** says to generate a magic link and "redirect straight into the app's
existing callback handler, so the browser ends up in a completely normal, real session".
Neither piece of that exists here, and the second one is not a gap that could be filled
cheaply:

1. **There is no callback handler.** The app's only sign-in is
   `supabase.auth.signInWithPassword` in `src/app/login/page.tsx`. No OTP, no magic link,
   no OAuth, no `/auth/callback` route.
2. **Sessions are not in cookies.** `src/lib/supabase.ts` uses plain
   `@supabase/supabase-js`, not `@supabase/ssr`, so the browser client persists its session
   to **localStorage**. A server route cannot write localStorage, so no cookie this route
   sets could ever become a Supabase session, however it were shaped. This rules the
   obvious implementation out rather than making it awkward.

**What it does instead, which is still the app's own mechanism and not a parallel one:**
`createClient` leaves `detectSessionInUrl` at its default of `true`, so the existing
browser client already knows how to complete a sign-in from tokens in the URL fragment.
The route therefore asks the Admin API for a real magic link and redirects to it; Supabase
verifies its own one-time token and bounces back to our origin with the tokens in the
fragment, where the app's existing client picks them up. Nothing bespoke is minted or
stored, and no new auth path exists for real users.

Verified as a real chain rather than assumed, against a live server:
`/api/testing/preview-session?token=...` -> 302 to Supabase `/auth/v1/verify` -> 303 back
to `/teacher#access_token=...&refresh_token=...&type=magiclink`. That access token was then
presented to `/auth/v1/user` and came back as `preview-agent@vicdata.co.uk`, role
`authenticated`, and under RLS it reads exactly one approved membership.

**Consequence worth knowing:** the fragment never reaches the server, which is why the gate
cookie must be set on the first redirect, before handing off to Supabase.

## Q23. The preview redirect target must be on Supabase's redirect allow-list

`generateLink` is given `redirectTo: <origin><redirect path>`, and Supabase refuses to
redirect anywhere not on the project's Auth redirect allow-list. `http://localhost:3010`
worked during testing because Supabase permits localhost by default. **`https://vicdata.co.uk/*`
must be present in the project's Auth "Redirect URLs" before this works on the deployed
site** -- otherwise the route will look correct, the link will generate, and Supabase will
silently bounce to the project's Site URL instead. Flagged because the failure is quiet and
would read as a bug in this route.

## Q24. Gate-bypass cookie stores a hash, not the token

Minor, but a deliberate choice rather than an oversight. The cookie only needs to satisfy
the Basic Auth gate, whereas `PREVIEW_ACCESS_TOKEN` also mints sessions. The cookie
therefore carries `SHA-256(token)`, so a stolen cookie can get past the gate but cannot
call the route to sign in as anyone. Verified live: a forged cookie value returns 401 while
the real one returns 200, and the cookie does not contain the raw token.

## Q25. The production redirect bug was the Supabase Site URL fallback, not only the request origin -- and Q23 is NOT fully handled

**The fix asked for is right and is done**: the magic-link origin now comes from a new
required env var, `PREVIEW_ACCESS_SITE_URL`, instead of `request.nextUrl.origin`, and the
route 404s if it is missing like the other three. Deriving an absolute URL from the
incoming request was never safe behind Render and Cloudflare.

**But the stated mechanism does not fit the evidence, and the difference is actionable.**
The prompt says the failure was `request.nextUrl.origin` resolving to the container's
internal address, and explicitly rules out the allow-list: "not the Supabase redirect
allow-list (Q23, already handled)". Probing the real project says otherwise:

| `redirectTo` requested | what Supabase returned |
|---|---|
| `https://vicdata.co.uk/teacher` | honoured |
| `https://vicdata.co.uk/account` | honoured |
| `https://vicdata.co.uk/` | honoured |
| `http://localhost:3010/teacher` | honoured (localhost is permitted by default) |
| `https://vicdata.co.uk/teacher/ks5` | **substituted -> `http://localhost:3000`** |
| `https://totally-not-allowed.example.com/x` | **substituted -> `http://localhost:3000`** |

Two facts follow. First, **`http://localhost:3000` is this project's Auth Site URL**, which
Supabase silently substitutes whenever a `redirect_to` is not allow-listed -- it does not
error. Second, the allow-list matches **one path segment but not two**, i.e. a `/*` pattern
rather than `/**`.

**Why that rules out the stated mechanism:** the observed production value was
`redirect_to=http://localhost:3000`, with **no path**. Anything built as
`${origin}${redirectPath}` necessarily carries `/teacher`. And a container origin of
`http://localhost:3000` would have been *honoured* with its path, since localhost is
permitted by default. A bare, path-less Site URL is only producible by the substitution
path -- so in production the constructed URL was some other non-allow-listed origin (a
`*.onrender.com` or internal address) and Supabase replaced it wholesale.

**Three things to set, not one:**

1. `PREVIEW_ACCESS_SITE_URL=https://vicdata.co.uk` in Render, alongside the other three.
2. **Supabase Auth Site URL** -> `https://vicdata.co.uk`. It is still `http://localhost:3000`,
   which makes every unmatched auth redirect on the project land on a dead address, not
   just this route's.
3. **Add `https://vicdata.co.uk/**`** to the Auth redirect allow-list. Without the double
   star, `?redirect=/teacher/ks5` and every other nested path silently falls back.

**Also added, slightly beyond the literal scope of "just the origin" -- flagged so it can
be vetoed:** the route now compares the `redirect_to` in the link Supabase actually issued
against the one it asked for, and 404s with an explanatory log line if they differ. The
whole reason this bug survived a round of live testing is that the substitution is silent
and the resulting link looks valid; refusing to hand out a link that goes somewhere other
than intended converts that into an honest failure. Verified live: the allow-listed path
still 302s, `/teacher/ks5` now 404s and logs the exact cause.
