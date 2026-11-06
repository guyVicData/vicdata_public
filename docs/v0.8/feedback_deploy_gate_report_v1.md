# VicData 0.8: feedback closes on the live site, not on merge (plus F-22 and F-23)

The round for `docs/v0.8/vicdata_0_8_feedback_deploy_gate_claude_code_prompt_v1.md`, on branch `v0.8-feedback-deploy-gate`, from `main` at `48ab37a` (`6bddb6d` plus one docs commit), fetched over HTTPS on 6 Nov 2026.

- **Before starting:** `6bddb6d` was live. Two feedback items at 10:44 and 10:46 on 6 Nov record `app_version` `6bddb6dbe91e`, so "Before this round" step 2 holds.
- **Every call** is in `docs/OPEN_QUESTIONS.md`, under "2026-11-06 — feedback deploy gate".
- **Nothing was written to any database.** The session read `feedback_for_triage` and the migration list on the app database, and public reference data for F-22 and F-23. The migration is written and tested in PGlite, and **not applied**.
- **The work was split three ways,** each in its own worktree and branch:
  - the deploy gate (items 1 to 5): this session;
  - F-22: `v0.8-fdg-f22`;
  - F-23: `v0.8-fdg-f23`.

  Both F-branches are merged into this branch.

## What happened with round 1

- Round 1 of the Admissions feedback (F-12 to F-21) was merged on 30 Oct as `6bddb6d`.
- Its report's republish and "mark done" ran on 31 Oct. Render's deploy did not: every item until 6 Nov records `030d546`, the 19 Oct build.
- **Auto-deploy was on** ("On Commit", for `main`; Guy, 6 Nov), so the push of `6bddb6d` on 30 Oct did start a deploy.
- **Render Events, 30–31 Oct:** the auto-deploy of `6bddb6d` started on 30 Oct at 09:16 and **failed at build** ("Exited with status 1 while building your code"). The live site stayed on `030d546` until Guy deployed the same commit by hand on 6 Nov, which built fine.
- **The cause is unknown.** Render's logs for 30 Oct have expired. "Why the 30 Oct build may have failed", below, closes off what it could have been.
- So the new views went live on code that couldn't draw them. Ten items read as done, and nothing showed the gap.
- `docs/FEEDBACK.md` already said an item closes when deployed, but nothing checked it.
- Two scope cuts didn't become open items either:
  - F-17's tint skipped SMT, the Data View, the public page, Teacher KS2 and the groups' member tables.
  - F-15 was built for 11+ only.
- Guy deployed `6bddb6d` on 6 Nov, before this round.

## Render's auto-deploy setting

**On, "On Commit", for `main`** (Guy, 6 Nov). So step 2 (merge and push) starts the deploy by itself.
- **The template's step 3** now reads "Render deploys main on its own (auto-deploy, On Commit); if no deploy starts within 5 minutes, deploy by hand" (`docs/FEEDBACK.md`).
- **The rule test needed no change beyond the step's label:** `scripts/report-template.ts` matches "Render … deploy".
- **Step 4 (wait until `/api/version` shows the merge) stays.** It is what the republish guard checks, and it catches a deploy that didn't happen, as on 30 Oct.

## Why the 30 Oct build may have failed

The same commit failed on 30 Oct and built on 6 Nov, so the cause was something outside the code. Render's logs are gone, so this section checks what a build depends on, and makes sure this round adds no new way to fail.

**1. This round's new build step can't fail the build.** `scripts/write-build-info.mjs` makes up to two network calls: a `git fetch --deepen` if the clone is shallow, then GitHub's commits API.
- **Each call is capped:**
  - the git fetch has a 20 s timeout, with no prompt for credentials;
  - GitHub's API has 8 s a page and 20 s in all.
- **Any error ends in `commits: null` and exit 0.** That covers a step, `git rev-list`, and the file write itself.
- **The test** (`src/lib/feedback-deploy-gate.test.ts`, "R-BUILD-INFO: git fetch and GitHub's API both failing") simulates both calls failing, and checks that each case exits 0:

| Case | Result |
|---|---|
| depth-1 clone, the deepen to a dead remote, then the API answering 500 | exit 0, `commits: null`, the commit still known |
| no `.git`, and an API that never answers | exit 0, `commits: null`, in about 8 s |
| the output folder can't be created | exit 0, "failed (…)" logged |

  It passes, along with the file's other 8 tests (9 / 9).

**2. `next build` reads no database and no data service.**
- **The 102 static pages** (`○`) are client shells. All 102 rendered in 208 ms, and their server components hold no data call:
  - `/`, `/dashboards`, `/dashboards/new`, `/sources` and `/teacher/meetings`;
  - `/sitemap.xml` (it returns `[]`) and `/robots.txt`;
  - the rest are `"use client"`.
- **Every page that reads data is dynamic** (`ƒ`), and reads at request time:
  - `/schools/[urn]` (force-dynamic) and `/schools/[urn]/data`;
  - `/dashboards/[id]` and its edit page;
  - `/sets/[id]`, `/join/[urn]`, `/teacher/[phase]` and `/teacher/meetings/[id]`;
  - the 66 `/api` routes.
- **No `generateStaticParams`, and no fetch or client created at module load.**
- **So a build can't fail because the data didn't match the code.** That includes new code against older published dashboards, as on 30 Oct before the republish. That mismatch shows only at runtime, as "This view isn't drawn here yet", and the republish guard now orders it.

**But the build does depend on one network service: Google Fonts.** `next/font/google` (Geist and Geist Mono in `src/app/layout.tsx`; Newsreader and IBM Plex Sans on `/schools/[urn]`) downloads the fonts during `next build`. If that download fails, the build fails.
- **It happened here.** Two of 19 clean builds today (`.next` removed first) failed this way, with exit 1 and "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font' … next/font/google queries have exactly one entry". Both came early, on this branch, while the parity run was building two other trees at the same time.
- **It isn't the code.** The other 17 passed: 10 on this branch and 7 on `6bddb6d`, including 6 / 6 in a row on each, with nothing changed between them.
- **It fits Render's 30 Oct failure:** exit 1 while building, a commit that later built fine, and no code to blame. It can't be proved without the log.

**Proposed fix, not built this round:**
- **Self-host the four fonts with `next/font/local`:** commit their `.woff2` files under `src/fonts/` (Geist and Geist Mono are also in the `geist` npm package), so the build makes no font request.
- **It should be its own small change with a pixel parity run.** The faces should be identical, but the subsets and `font-display` settings need matching.
- **Until then, a font failure is a one-off.** "Redeploy" on Render, as Guy did on 6 Nov, builds the same commit.

**3. The build's memory.** A clean `npm run build` here (macOS, Apple silicon, Next 16.3 with Turbopack, 9 workers):
- **Largest single process:** 1.80 GB at peak (`/usr/bin/time -l`, maximum resident set size 1,801,469,952 bytes).
- **All the build's processes together:** about 1.6 GB at peak, sampled every 0.25 s, so a short spike could be missed.
- **About 13 s wall time.**

Render's build memory limit isn't visible from here. The 6 Nov build of the same code succeeded on Render, so the limit is above what that build needed. Linux builds can differ in memory, and Render may run fewer workers. **Guy:** if the plan's build machine is 2 GB, that is close; Render's build log shows "out of memory" or "Killed" when that happens.

**4. If an auto-deploy fails again:** `docs/FEEDBACK.md`, under the commands template, now says: "If the auto-deploy fails, Render emails Guy (notifications on); the inbox's gaps banner shows any item still fixed 48 hours after merge."

## The statuses and the promotion

**The statuses:** new → triaged → planned → **fixed** → **deployed** → done, or won't do. The migration is `supabase/migrations/20261119090000_v08_feedback_deploy_gate.sql`.

| Status | Means | Set by |
|---|---|---|
| fixed | merged to `main`, with `resolved_commit` (and `resolved_at`) | the report's "set fixed" step (`scripts/feedback-set-fixed.sh`), or the inbox's "Set ticked to: Fixed" with the commit |
| deployed | the live build holds `resolved_commit`; stamped `deployed_at` and `deployed_build` | **the server only** (`record_app_build`). The update trigger refuses it from anyone else, and the inbox doesn't offer it. |
| done | checked on the live site; stamped `checked_live_at` | a platform admin's "Looks good" on the same view and school at or after `deployed_at`, or the inbox's "Checked live" |

- **Open until done.** Fixed and deployed are still open, so the author's icon stays yellow until the fix is checked. `is_open` and `isOpenFeedback` already treated anything short of done as open, and the tests now pin that for the two new statuses.
- **The promotion:** when the server records a build, every fixed item whose commit that build holds moves to deployed.
  - The commits are matched by prefix either way, never under 7 characters, because round 1 wrote 7-character commits and the build lists 12.
  - It is idempotent, and it logs how many items moved (`raise log`, and the server's `[app-build]` line).
  - A promotion isn't anyone's triage: `triaged_by` and `triaged_at` are kept.
- **The new columns:**
  - on `feedback_items`: `deployed_at`, `deployed_build`, `checked_live_at` and `follows_up`;
  - on `feedback_for_triage`: the same, plus `follows_up_ref`, appended at the end so the existing columns keep their places.
- **The backfill** (safe to run twice) moves F-12 to F-21 from planned ("deploy 6bddb6d") to **fixed** at `6bddb6d`, with `resolved_at` on 30 Oct.
  - That's nine items: F-15 is done since 6 Nov (checked live at 11+), so it is left alone.
  - The first time the new build records itself, they move to deployed, because its history holds `6bddb6d`.

## How the commit list is built on Render

**`npm run build` now runs `scripts/write-build-info.mjs` before `next build`.** It writes `src/generated/build-info.json`, which isn't committed (`.gitignore`). The file holds the commit, when it was built, and `git rev-list --max-count=1000 HEAD` as 12-character shas.

**Whether Render's clone is shallow isn't known from here, so the script handles both cases, in order:**
1. **git:** if the clone is shallow, it first runs `git fetch --deepen=1000` against the public HTTPS remote. A list that is still shallow and short of 1,000 isn't trusted.
2. **GitHub's public commits API** for the build's commit, with no token (the repo is public).
3. **`commits: null`:** the build says it has no list, rather than pretend.

It never fails the build (timeouts and error handling below, in "Why the 30 Oct build may have failed"). It prints which source it used, so Render's build log answers the question: look for `[build-info] … commit(s) listed from git` (or `from github`).

**Tested here:**

| Checkout | Result |
|---|---|
| this worktree | 778 commits, from git |
| `git clone --depth 1` from GitHub (`6bddb6d`) | shallow, deepened to 771, from git |
| the same with `.git` removed, `RENDER_GIT_COMMIT` set | 771 commits, from GitHub's API |
| no `.git`, no variable | `commit: null, commits: null` |

**Not yet tested on a real Render build:** it can't be until this merges. Step 3 below says what to read in the build log.

## `/api/version`, `app_builds` and `feedback_deploy_gaps`

- **`GET /api/version`:** outside the access gate (`src/proxy.ts`'s matcher), like `/api/health`, which is unchanged.
  - It returns `{ commit, built_at, commits }`, where `commits` is the **count** the build lists (null if none), so the Render check can be read from outside. The list itself stays on the server.
  - Sent with `Cache-Control: no-store`.
  - Checked on a local `next start` of this branch:
    - `/api/version` answered 200 with `{"commit":"aa750a643815",…,"commits":778}`;
    - `/api/health` answered 200;
    - `/teacher` and `/api/platform/feedback` still answered 401.
  - Live today, `https://vicdata.co.uk/api/version` answers 401, because the route isn't deployed yet.
- **`app_builds`:** `commit` (primary key), `first_seen_at`, `last_seen_at`, `built_at`, `commits text[]`.
  - Platform admins read it. Nobody writes it from a client: there is no insert, update or delete grant.
  - `record_app_build()` is executable by the service role only.
  - The server calls it once per process, through `src/lib/app-build-server.ts`, with `SUPABASE_SERVICE_ROLE_KEY`. A unit test checks that no client file reaches either.
  - It is called before the first feedback insert (so a "Looks good" sees items already promoted) and on the inbox's first load. A failure (before the migration, say) retries after 10 minutes.
- **`last_seen_at` (a call):** the live build is the row a server last started as. A Render rollback then reads correctly.
- **`feedback_deploy_gaps`:** the items claiming more than the live build has:
  - deployed or done at a commit the newest build doesn't hold;
  - fixed for over 48 hours without being deployed.

  The inbox shows a banner with the count and the F-numbers, and a "Show them" filter. With none, it says so in one quiet line, "Deploy gaps: 0 · live build <commit>", once a build is recorded.
  - On 6 Nov's data (done at `6bddb6d`, live `030d546`) it lists F-12 to F-21.
  - Once the build holds `6bddb6d`, it lists none.
  - A rollback brings the gap back.

**The inbox, rendered.** The real inbox, with the Supabase client and the API stubbed with 6 Nov-shaped items, was rendered in headless Chrome with the built CSS. The screenshots are in `docs/v0.8/feedback_deploy_gate_screenshots/inbox/`.
- **`inbox_gap_dark.png`:** the banner reads "1 item claims more than the live build (030d546) has: F-12 (fixed, not deployed after 48 hours)", with "Show them".
- **`inbox_no_gaps_dark.png`:** it reads "Deploy gaps: 0 · live build a77ae82".
- **The status column:** "Fixed (6bddb6d)", "Deployed (in a77ae82, 2026-11-07)", and "follows up F-17" under F-22.
- **The status chips:** they include Fixed and Deployed, and the default shows every open status.
- **"Set ticked to":** it offers every status but Deployed.
- **"Checked live":** disabled with only a fixed item ticked; "Checked live (1)" with a deployed one.
- **The detail:** it shows Status and Follows up, and the hint "It moves to Deployed by itself…".

Light theme wasn't shot. The inbox uses the Teacher theme tokens, as before.

## Who can set "deployed", and every new object's grants

**"Only the server sets deployed" holds at the database**, not only in the app:
- **`record_app_build()`** is `SECURITY DEFINER` with `search_path = public`. `EXECUTE` is revoked from `public`, `anon` and `authenticated`, and granted to `service_role` only (the role the server's key acts as).
- **The update trigger refuses `deployed`** unless the change comes from inside `record_app_build` (the session flag `vicdata.feedback_auto`) **and** the current role isn't `anon` or `authenticated`. The trigger function isn't a definer, so a client's update runs as its own role. So even a client that set the flag itself is refused; inside `record_app_build` the role is the function's owner.
- **`fixed` and every other triage field:** a non-admin's update reaches no row (RLS: `feedback_items_update_admin`), and the trigger refuses it too. A platform admin's client can set `fixed`, which is the inbox's job, but not `deployed`.
- **`app_builds`:** no client can write it (no insert, update or delete grant), and only platform admins read it.

**In PGlite** (`supabase/tests/v08_feedback_deploy_gate_pglite.mjs`, **56 checks, 56 pass**; 11 of them on permissions):

| Case | Result |
|---|---|
| anon calls `record_app_build()` | refused |
| an authenticated non-admin calls `record_app_build()` | refused |
| a platform admin's client calls `record_app_build()` | refused |
| a platform admin's client sets `status = 'deployed'` | refused |
| the same, with the server's flag set in its own session | refused (the role check) |
| a non-admin client sets `fixed` or `deployed` | no row reached; the item unchanged |
| the server role, through `record_app_build()` | moves a fixed item to deployed |
| a client inserts into `app_builds` | refused |
| a member reads `app_builds` or `feedback_deploy_gaps` | no rows |
| the grants, `SECURITY DEFINER`, `search_path` and `security_invoker` below | as listed |

**The advisor's checks, object by object** (RLS on, no anon grants, views `security_invoker`, a fixed `search_path` on every function):

| Object | Kind | RLS / security | anon | authenticated | service_role |
|---|---|---|---|---|---|
| `app_builds` | table | RLS on; one policy: select where `is_platform_admin()` | none (revoked) | select only (RLS: admins) | default (bypasses RLS; used only through the function) |
| `feedback_deploy_gaps` | view | `security_invoker = true` (the caller's RLS on `feedback_items` and `app_builds`: admins only) | none (revoked) | select | default |
| `feedback_for_triage` (re-created, columns appended) | view | `security_invoker = true`, as before | none (revoked) | select | default |
| `feedback_items` (4 columns added) | table | RLS on, policies unchanged | none, as before | select, insert, update (RLS and the triggers decide) | default |
| `record_app_build(text, text[], timestamptz)` | function | `SECURITY DEFINER`, `search_path = public` | no execute | no execute | execute |
| `feedback_items_live_check()` | trigger function | `SECURITY DEFINER` (it closes other items by rule), `search_path = public` | no execute | no execute | default |
| `build_has_commit(text, text, text[])` | function | invoker, immutable, reads no table, `search_path = public` | no execute | execute (the view needs it) | execute |
| `feedback_items_on_insert()`, `feedback_items_on_update()`, `feedback_items_triage_columns()` (re-created) | (trigger) functions | invoker, `search_path = public` (`triage_columns` gained it this round) | as before | as before | as before |

## The gap between the migration and the deploy

Once the migration is applied, nine items read `fixed` (F-12 to F-14 and F-16 to F-21), and F-22, F-23 and F-26 gain their follow-up links. Meanwhile the live build is still `6bddb6d`, which doesn't know `fixed`. **Checked by running the live build's own code** (`6bddb6d`, in a throwaway worktree) on a `fixed` item:
- **Nothing crashes.**
- **The status label is blank:** `FEEDBACK_STATUS_LABEL["fixed"]` is undefined, and React draws nothing. This affects the inbox row, the item's detail and the author's own list in the feedback window.
- **The inbox's default filter** (new, triaged, planned) **hides the nine items.** Clearing the status chips shows them.
- **"Copy as Markdown"** heads them "F-12 · undefined".
- **The feedback icon stays yellow** for their author. That's correct: they are open.
- **Saving a `fixed` item's triage in the old inbox is refused** ("Unknown status.", HTTP 400), and nothing is written.
- **The old server never records a build,** so nothing is promoted until the new build is live.

**So the order is safe, but the inbox reads oddly until the deploy.** Do step 2 straight after step 1 (the push starts the deploy), and don't triage in the inbox in between.

## The republish guard

**`scripts/dashboards-seed-sql.ts` prints nothing, and exits 3, unless the live `/api/version` commit holds the local HEAD:** HEAD must be the live commit or one of its ancestors.
- **The live address** comes from `--live <url>` or `VICDATA_LIVE_URL`. There's no default.
- **It also refuses when:**
  - there's no address;
  - the live build names no commit;
  - the live commit isn't in the checkout (fetch first).
- **`--force`** skips the check and prints why that's unsafe.
- **The tests that pass `--force`:** the two PGlite tests and the catalogue unit test that run the script, because their SQL only ever reaches WASM Postgres.

**`scripts/feedback-set-fixed.sh <commit> F-…`** replaces the old "mark done" SQL. It:
- checks that the project ref is `lnhulykjlxmoneappnsp`;
- checks that the commit is on GitHub's `main` (fetched over HTTPS);
- only moves items that are new, triaged or planned;
- only ever sets fixed.

Without the project link it refuses, which was checked in this worktree.

**The report template:** `docs/FEEDBACK.md` now has a section "Guy's commands" with the seven steps. `scripts/report-template.ts` checks a report against it, and R-REPORT-COMMANDS-ORDER runs that check on every report first committed on or after 6 Nov, and on any not yet committed. This report is the first; it passes.

## The closing rule

**An item moves from deployed to done in one of two ways:**
- **Automatically:** a platform admin gives "Looks good" on the same view (or page) and school, at or after `deployed_at`. This is an `after insert` trigger. It stamps `checked_live_at` with the Looks good's own time.
- **By hand:** the inbox's **"Checked live"** button acts on the ticked deployed items, and the date is stamped.

**It stays deployed** when the Looks good came before the deploy, was on another school, or came from a member, or when the new item isn't a Looks good. Coverage still counts a Looks good as checked.

**At or after, not strictly after (a call):** PGlite's clock moves in millisecond steps, and a check in the same instant flaked the test.

## The scope rule and the follow-ups it raised

**`docs/FEEDBACK.md`, "Proposing a triage", now says:**
- When a fix covers less than the author asked, the triage adds a **"Not covered:"** line to its note.
- The signs are "all", "every" or "each"; `applies_to = similar_views`; or a fix for one phase or one entry age only.
- Each case left out gets a **follow-up item**: same type, `follows_up` set to the parent, a note naming it, status triaged.

**In the inbox:**
- the row says "follows up F-17";
- the detail shows "Follows up" and the parent's "Follow-ups";
- the triage form has a "Follows up" field;
- Markdown copies carry it.

**Applied backwards once, in the migration:** F-22 and F-23 (with F-26) **are** the follow-ups, rather than new items. They ask for exactly what was left out.
- F-17's note gains "Not covered: SMT tables, the Data View…, the public school page, Teacher KS2, the groups' per-member tables… Follow-up: F-22." F-22 follows up F-17, and moves from new to triaged.
- F-15's note gains "Not covered: the 16+ intake… Follow-up: F-23 (with F-26)." F-23 and F-26 follow up F-15.
- No item is created, and every update is guarded, so a second run changes nothing.

## F-22: the focus school in every table and rank view

Guy: "ALL table / rank views the focus school should be highlit." F-17 (round 1) tinted Admissions' rivals table, Teacher's three tables and the groups' "against" and Schools tables, and nothing else. This is every table or rank view with school rows, before and after.

**The rule:** a table or ranked list of schools tints the focus school's row with its product's token and marks it `data-featured-row`. One helper does both: `featuredRow(on)` in `src/components/shell/accent.ts`. On a group's views the focus is the school picked; with none picked, no member row is tinted. Bar charts aren't rank views here. Their focus bar is already coloured and its name bold (see the calls in OPEN_QUESTIONS).

**Two new tokens.** The F-17 checks pass for every token: text 11:1 or better in both themes, and muted text at least 6.3:1 on the light tint.

| Token | Light | Dark | Text, light / dark | Muted, light / dark |
|---|---|---|---|---|
| `--row-featured-ks2` (new; Teacher KS2 has no accent) | #eeeef0 | #2a2a2e | 15.4 / 12.8 | 6.4 / 5.1 |
| `--row-featured-dataview` (new; on `:root`, since the Data View is outside `#teacher-root` and follows the system theme) | #fef2f2 | #220a0a | 16.4 / 16.1 | 7.1 / 7.3 |
| `--row-featured-admissions` (F-17) | #d7f7fc | #163940 | 15.8 / 11.1 | 6.5 / 4.4 |
| `--row-featured-gcse` (F-17) | #daf7ed | #1a392f | 15.8 / 11.2 | 6.5 / 4.5 |
| `--row-featured-post16`, `-smt` (F-17) | #efeafe | #312b43 | 15.2 / 12.1 | 6.29 / 4.8 |
| `--row-featured-groups` (F-17) | #feebdc | #412c1d | 15.4 / 11.7 | 6.4 / 4.7 |

- **The Data View's token is the red it already drew**, now as a token: red-50 light, and red-950 at 40% over the dark page.
- **On its focus row, the rank number's muted grey is one step darker:** neutral-600 light and neutral-400 dark. Neutral-500 was 4.3:1 on the light tint.
- **Muted contrast in dark is under 6.3:1 for every F-17 token, as before.** F-17's 6.3:1 was measured in light only.

**The inventory.** "Before" is the state at `8f6e8b7` (main plus this round's prompt).

| Product | View (component) | Before | After |
|---|---|---|---|
| Teacher (GCSE, Post-16) | Ranking table (`SchoolRankingTable`) | tinted, `-gcse` / `-post16` | the same, now marked |
| Teacher (GCSE, Post-16) | Sortable table (`SortTable`) | tinted, `-gcse` / `-post16` | the same, now marked |
| Teacher (GCSE, Post-16) | Change table, year table (`SeriesViews`; years down, the focus is a column) | tinted, `-gcse` / `-post16` | the same, now marked |
| Teacher KS2 | whichever of the three tables KS2 draws (the root now names its token) | neutral fallback (grey accent at 14%) | `--row-featured-ks2` |
| Teacher KS2 | nearest primaries list | the school isn't in it | no change |
| SMT | every table (roll, bands, market, mix, scorecard, subjects, value added, entry points, leaving at 16, births) | rows are years, measures, subjects or qualifications, not schools | none to tint |
| Admissions | Rivals table (`RivalsTable`) | tinted, `-admissions` (F-17) | the same |
| Admissions | Rivals ranked by size (`RankedBars`) | `--adm-tint` (the accent at 14% / 12%) | `--row-featured-admissions`, marked |
| Admissions | The rivals' results (`AcademicNumbers`) | `--adm-tint` | `--row-featured-admissions`, marked |
| Admissions | Feeder table | the feeders only, never the school | no change |
| Admissions | Rivals' momentum | the rivals only | no change |
| Groups | Against others (`AgainstOthers`) | the group's row, `-groups` (F-17) | the same |
| Groups | Every school (`SchoolsTable`) | the school picked, `-groups` (F-17) | the same |
| Groups | Schools ranked (`SchoolsRanked`) | the school picked, `--adm-tint` | `--row-featured-groups`, marked |
| Groups | Value added (A-level and Progress 8 tables) | no tint | the school picked |
| Groups | Year 12 against Year 11 (`LeavingAt16`) | no tint | the school picked |
| Groups | Each school's share of its area (`MarketShare`) | no tint | the school picked |
| Groups | Children around each school (`ProjectionPerSchool`) | no tint | the school picked |
| Groups | Joined and left (`JoinedLeft`) | no tint | the school picked |
| Groups | Shapes (cards) | the school picked, `--adm-tint` | unchanged: a chart |
| Group home | each group's member list | nothing is picked | none |
| Data View | Rankings: current roll, growth or decline (`RankTable`) | red-50 / red-950 at 40% (classes), red left border | `--row-featured-dataview`, border kept, marked |
| Data View | Rankings: rank over time (`ComparisonOverTimeTable`) | the same classes | the token, marked |
| Data View | Rankings at region or nation scale (`LargeSetMetricRanking`) | red-50 / red-950 at 30% | the token (dark one step deeper, as the other tables), marked |
| Data View | Academic Rankings: the three tables | as Rankings | as Rankings |
| Data View | The deep dive: "Every real school … ranked" | red-50 / red-950 at 40% | the token, marked |
| Data View | Graphs | no tables; its bar charts colour the school's bar | unchanged (a chart) |
| Saved set (`/sets/[id]`) | Roll-size rank | no tint ("(this school)" only) | `--row-featured-dataview`, marked |
| Custom and member dashboards | Teacher's tables (`TeacherDashboard`, the phase's token) | as Teacher | as Teacher, KS2 included |
| Meeting slides | Teacher slides (embed, the phase's token) | as Teacher | as Teacher |
| Meeting slides | SMT slides | `smtVars` | the same |
| Meeting slides | Admissions slides | fell back to the meeting's rose at 14% (the preview names no token) | `--row-featured-admissions` on the slot |
| Public school page | — | no table or rank view has the school's row: its nearest-schools list leaves it out, the roll chart already colours it, and a consortium's member list has no focus | none to tint; no token added |

**The test:**
- **R-FEATURED-ROW-EVERYWHERE** (`src/lib/featured-row-scan.ts`; unit test `src/lib/featured-row.test.ts`; rule runner `featuredRowEverywhere`).
- **What it checks:**
  - every focus table marks its row;
  - every `<tr>`, `<div>` or `<li>` keyed by a school's URN anywhere in `src` is marked, or is listed in `NO_FOCUS_ROWS` with a reason.

  At this round's end that is 18 rows marked and 22 listed.
- **What fails it:**
  - a new table of schools without the mark;
  - a stale entry in the list.

**Screenshots** are in `docs/v0.8/feedback_deploy_gate_screenshots/f22/`, as `{before|after}_{view}_{light|dark}.png`.
- **How they were made:** the real components server-rendered on real read-only data, with each tree's own built CSS, in headless Chrome:
  - Admissions at Leighton Park, 11+;
  - the groups from the ingest fixtures (Harris, a school picked);
  - the Data View's Rankings, for Leighton Park against Admissions' 10 nearest rivals.
- **What they show:**
  - `adm_ranked_bars` and `adm_academic_numbers`: the cyan token in place of the 14% accent;
  - `grp_schools_ranked`: the groups token;
  - `grp_leaving_at16`: newly tinted;
  - `dv_rankings`: the same red, now the token.
- **Not shot:** Teacher's tables (only the mark is new; pixels unchanged) and the deep dive drawer (it opens on a click).

## F-23 (with F-26): the local shape at 16+ and 11+

**Ages 11 to 15, not 4 to 15.** The prompt says 4–15, but the triage note on F-23 and F-26 (6 Nov, later than the prompt) makes them one request. F-26 refines F-23: "needs to show ages 11-15 in the feeder schools and in the feeders area". So at 16+ the local shape and the feeder cards both cover ages 11–15, and primaries aren't counted at 16+. That makes F-26 done by the same change.

**What changed at 16+** (`views-api.ts` `shapeView`, `ShapeAndSize.tsx`):
- **The set:** the current feeder set a year below entry (age 15), with the school left out. These are the same schools as the feeder cards beside it: the 10 nearest state secondaries (`DEFAULT_SECONDARIES`, 11–16 schools first), or a saved rung list or feeder lists. Before, the set was the youngest rung's 15 nearest primaries, ages 4–10.
- **What it counts:** ages 11–15 only, so a secondary's sixth form doesn't shape "the area you recruit from". The classifier runs on that summed profile.
- **The cards:** the set's schools at age 15, in the set's order, each with a row per age 11–15 (age 15 highlighted). Each card's shape label and XS–XL size are unchanged.
- **The words:**
  - the caption reads "All pupils aged 11–15 in the 10 nearest secondaries (schools teaching 11 to 15), together." (with a saved list: "the N schools on your saved list");
  - the cards say "A row per age, 11–15";
  - the (i) text (`methods-admissions.ts`) names the 16+ set and ages.

**Leighton Park (110110):**

| Intake | Local shape | Cards |
|---|---|---|
| 16+ (new) | **Tube**: 8,037 pupils aged 11–15 in 10 secondaries (Maiden Erlegh School in Reading, Oakbank, Maiden Erlegh Chiltern Edge, Gillotts, Langtree, Frogmore, Sandhurst, The Hurst, Bohunt Farnborough, Calthorpe Park) | the same 10 at age 15, 5 rows each |
| 11+ (unchanged) | Funnel: the 15 nearest primaries, drawn over ages 4–10 | the same 15 at age 10, 7 rows each |
| 4+ (unchanged) | Funnel: the same 15 primaries, drawn at age 4 only; the caption reads "aged 4–4" | the 15 at age 4, 1 row each |

**Not changed, noted:**
- **4+:** "aged 4–4" could read "aged 4".
- **Custom ages from 12+ to 15+:** these still draw the primaries' local shape beside age-below secondary cards. Nobody has raised either; both are in OPEN_QUESTIONS.

**Test: R-LOCAL-SHAPE-16** (new rule, `admLocalShape16`; real data, read-only). It passes:

> 16+ ages=11-15, 16+ schools=10, 16+ cards=10x5, 11+ ages=4-10, 11+ schools=15, 11+ cards=15x7

At 16+ it checks:
- `localShape.ages` is [11, 15];
- the set is the pipeline's age-15 set without the school, and the cards are those schools in that order;
- the bars are ages 11–15 and every card has 5 rows;
- the caption is as above.

At 11+ it checks round 1's output: no ages, the youngest rung's 15 primaries, bars 4–10, 7-row cards, round 1's caption.

**Checks (branch `v0.8-fdg-f23`):**
- **tsc:** clean (after `next typegen`).
- **eslint:** 0 errors. The 3 warnings are in files this change doesn't touch.
- **`next build`:** clean.
- **Unit tests:** 536 / 536 (`src/**/*.test.ts`, each file on its own).
- **Catalogue unit tests:** 77 / 77.
- **Rule tests:** 128 PASS, 0 FAIL (MANUAL 15, NONE 19, SUPERSEDED 6).
- **Catalogue docs:** regenerated (168 rules).

**Parity (Admissions, every view, DOM):** base `8f6e8b7` against the branch. Each tree rendered every Admissions view with its own code (`AdmissionsEveryView`, as the rule tests render it, at width 900) over live data, read-only. The schools were 110110, 137625 and 117037, at 4+, 11+ and 16+.
- **4+ and 11+:** all 6 pairs byte-identical.
- **16+:** all 3 pairs differ, in 38 hunks each, and every hunk is inside Pipelines' Shape and size (the local shape and its feeder cards). That is the allowed difference. The data each route returns is identical apart from `shape.localShape` and `shape.localProfile`, so figures are unchanged.
- **Pixels:** not run, because no classes or CSS changed and the 4+ and 11+ markup is identical.

**Screenshots:** in `docs/v0.8/feedback_deploy_gate_screenshots/f23/`. They come from the Admissions preview harness, fed with Leighton Park fixtures from the branch: `leighton_park_16p_light.png`, `leighton_park_16p_dark.png`, `leighton_park_11p_light.png`, `leighton_park_11p_dark.png`.

## Tests

On the merged branch (`7a6c4b0`, with F-22 and F-23 in), in this worktree:

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors; 3 warnings, all older than this round (`PeerTrendChart.tsx`, `SchoolMap.tsx`, an unused `n` in `v08_admissions_fb1_republish_pglite.mjs`) |
| `npm run build` | clean; `[build-info] 791 commit(s) listed from git` |
| unit tests (`src/**/*.test.ts`, each file on its own) | 550 / 550 in 67 files (549, plus the build-step failure test) |
| catalogue unit tests | 77 / 77 |
| rule tests (all) | 135 PASS, 0 FAIL, 0 ERROR (15 MANUAL, 19 NONE, 6 SUPERSEDED) |
| PGlite (all 23 suites, each as its header says) | 23 / 23 exit 0; this round's: 56 / 56 |
| usage-log tests | in the above (`v08_usage_log_pglite`, the usage unit tests): pass |

**This round's rules, all PASS:**
- the feedback gate: R-FEEDBACK-STATUSES, R-FEEDBACK-PROMOTE, R-FEEDBACK-DEPLOY-GAPS, R-FEEDBACK-LIVE-CHECK;
- the commands: R-REPUBLISH-GUARD, R-REPORT-COMMANDS-ORDER (it checked this report);
- F-22: R-FEATURED-ROW-EVERYWHERE (18 rows marked, 22 listed with a reason);
- F-23: R-LOCAL-SHAPE-16.

The catalogue docs (`docs/catalogue/*.md`) are regenerated: 175 rules.

## Parity

**Parity against `8f6e8b7` (`main` at `48ab37a` plus the prompt, the same code as live `6bddb6d`): nothing unexpected.** The branch was `dcdf04a` (F-22 and F-23 merged).

- **Setup:** both trees were detached worktrees in the session scratchpad, each with its own cloned `node_modules`. Each harness was copied there and pointed at the two worktrees. `~/dev/vicdata_public` was never touched.
- **Fixtures:** each tree captured its own, through its own route functions, from the live data, read-only. Where both trees' fixtures came out byte-identical, that says the data side didn't move.

| Harness | Pairs | Identical | Allowed | Noise | Unexpected | Failed |
|---|---|---|---|---|---|---|
| Teacher walker, all 7 case sets (PNG + words) | 2,875 | 2,875 | 0 | 0 | 0 | 0 (286 / 286 runs) |
| Teacher public-page SSR (137625, 117037) | 2 | 2 | — | — | 0 | 0 |
| Admissions, per view (PNG and DOM), 4 schools | 468 | 392 | 76 (64 F-22, 12 F-23) | 0 | 0 | 0 (128 page loads, 0 errors) |
| SMT pages (PNG and DOM) | 152 | 146 | 0 | 6 PNG (map antialiasing; identical on recheck) | 0 | 0 |
| Groups dashboards (PNG and DOM), nothing picked | 96 | 84 | 12 (markup only) | 0 | 0 | 0 |
| Groups dashboards, a member school picked | 88 | 52 | 36 (F-22) | 0 | 0 | 0 |
| Data View (Academic graphs, rankings, snapshot), light and dark | 24 | 16 | 8 (F-22) | 0 | 0 | 0 |

**Teacher:**
- The fixtures were 10/10 byte-identical between the trees.
- Every pair was identical in pixels and words. F-22 changes Teacher only by adding `data-featured-row` to rows that were already tinted, and the walker compares pixels and words, not markup.
- KS2's new neutral token isn't in the walker's cases: it has no KS2 case set.
- Both trees log the same `__unstubbed` requests (the same files on each side). These are ranking side requests the harness doesn't answer, as in earlier runs.
- **The import graph:**
  - the Data View's client graph holds F-22's changes (`AcademicRankingsView`, `RankingsView`, `SubjectDeepDiveDrawer`, `DataViewShell`, `accent.ts`) and `view-ref.ts` (the new statuses);
  - its API graph holds the feedback routes, `build-info.ts` and `app-build-server.ts`;
  - the public page's graph has no changed file.

**Admissions** (Leighton Park, The Chase, 117037 and 115786, at their entry points, both themes, 1440 and 390, every rail step of both dashboards):
- **Fixtures:** they differ only in the Shape view's `localShape` (new `ages` and `kind` fields everywhere, and at 16+ the new set, shape and 11–15 profile). That is F-23. Nothing else in any route's answer changed.
- **64 pairs (F-22):** Market share's Ranked bars and Academic numbers. The school's row gains `data-featured-row` and the Admissions token, in place of `bg-[var(--adm-tint)]`, and is set bold. The words are equal.
- **12 pairs (F-23):** Pipelines at 16+, step 6 (Shape and size).
  - The local shape reads Tube, "11–15", "10 secondaries (schools teaching 11 to 15)", in place of the primaries' funnel or pyramid over ages 4–10/11.
  - The feeder cards have rows for ages 15 to 11.
  - Every changed token is inside the Shape and size section.
- **Nothing else moved:** 11+ and 4+ are identical apart from F-22's rows, and the rivals table (F-17) is unchanged.

**SMT** (The Chase and Leighton Park, Overview, Academic, Pupils, Context and the home, both themes, 1440 and 390, every rail view):
- The fixtures were byte-identical between the trees, and every DOM was identical.
- Six PNGs on Context (Leighton Park in both themes, The Chase in dark) differed by one channel step on up to 52 pixels around the map. Rechecked twice: identical on the first recheck. On the second, the base tree differed from itself between runs. That is antialiasing noise.
- SMT has no table of schools, so F-22 doesn't change it.
- **The harness, updated:** its committed `cap.mts` and `index.html` predated SMT round 4's catchment. `buildContext` now takes the level and catchment, and the page fetches `/api/smt/catchment` and `/api/smt/context/map`. Both were updated to the current routes, with the default level and the default catchment, before the run.

**Groups** (Harris and Dukes, Overview, Schools, Academic, Pupils and the home, both themes, 1440 and 390, every rail view):
- The fixtures were byte-identical (the fixture switch on).
- **Nothing picked:** 12 Academic DOMs differ only by a trailing space dropped from a row's class string (F-22's `featuredRow()` refactor). Their pixels are identical.
- **A member school picked** (`?school=`: Harris Academy Bermondsey, Devonshire House):
  - every PNG that differs has a newly tinted row (`data-featured-row`, the groups token) in its DOM, on Overview, Academic and Pupils;
  - the words are equal in all 88 pairs;
  - the pairs where the tinted row is in the DOM but the pixels are equal have it off-screen (a phone tab not shown).
- The harness (`groups_r3_preview`'s `index_dashboards.html`) gained `?bundle`, `?css` and `?fx` per tree, and `harness.tsx` takes the Academic and Pupils dashboards. The run used a walker adapted from `smtpar.mjs`.

**Data View** (`year_rehearsal`'s `harness_dv.tsx` on the Teacher fixtures of The Chase and 100053 at KS4; graphs, rankings and the public page's academic snapshot; 1440 and 390; light and dark by `prefers-color-scheme`):
- Graphs and the snapshot are identical.
- **Rankings differ only on the focus row.**
  - Light: the rank number (x 170–185) is one shade darker, neutral-500 → neutral-600.
  - Dark: the rank number is neutral-500 → neutral-400, and the row's red moves from red-950 at 40% over the page to the token `#220a0a`, a difference of at most 1/255.
  - The words are equal.
- **Harness wrapper:** the harness wraps the views as `DataViewShell` does (`--row-featured: var(--row-featured-dataview)`). Without it, the branch row falls back to the neutral grey, because the shell is what names the token.
- **Its body background:** the committed harness had a white body. It was removed so dark mode draws on the app's own dark page.

**Not covered:**
- **The Data View's other rank views:** its main Rankings view, the large-set rankings and the deep-dive drawer have no harness here. The source scan (R-FEATURED-ROW-EVERYWHERE) covers them, and they are in the import graph above.
- **Elsewhere:** Teacher KS2, meeting slides and custom dashboards aren't drawn by any harness.
- **The feedback inbox and statuses:** no harness draws them.

**After `dcdf04a`,** the branch only added the inbox's "Deploy gaps: 0" line, the build-info step's error handling, the migration's `search_path` lines, docs and tests. No harness draws any of these, and none changes a dashboard view.

## Guy's commands, in order

These follow the template (`docs/FEEDBACK.md`, "Guy's commands"). The branch `v0.8-feedback-deploy-gate` is local, not pushed: `~/dev/vicdata_public` shares the repository with this round's worktree, so it is there already. The live site is **`https://vicdata.co.uk`**: its `/api/health` answers past the gate.

**1. Apply the migration** (it writes; the project-ref check comes first). Run it from `~/dev/vicdata_public`:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-feedback-deploy-gate:supabase/migrations/20261119090000_v08_feedback_deploy_gate.sql > /tmp/fdg.sql && supabase db query --linked -f /tmp/fdg.sql && supabase migration repair --status applied 20261119090000 --linked && supabase db query --linked "select ref, status, resolved_commit, follows_up_ref from feedback_for_triage where number between 12 and 26 order by number"
```

Expect:
- F-12 to F-14 and F-16 to F-21 **fixed** at `6bddb6d`;
- F-15 and F-24 done; F-25 (a bare Looks good) new;
- F-22 **triaged**, following up F-17;
- F-23 and F-26 triaged, following up F-15.

**Then go straight to step 2.** Until the deploy, the old inbox shows the nine with a blank status and hides them by default. See "The gap between the migration and the deploy".

**2. Merge and push** (the push starts the Render deploy). From `~/dev/vicdata_public` on a clean `main`:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-feedback-deploy-gate -m "0.8 Feedback deploy gate: feedback closes on the live site; F-22 the focus row in every table; F-23 the local shape at 16+" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand. In the build log, read the `[build-info]` lines:
- **"listed from git":** Render's checkout has the history (deepened or not);
- **"listed from github":** it used GitHub's API;
- **"no commit list":** tell me, and I'll add a committed list.

**4. Wait until /api/version shows the merge commit.**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

Expect `{"commit":"<the merge>","built_at":…,"commits":…}`, with `commits` about 800. If it reads `null`, the build had no list (step 3).

**5. Republish:** none this round. No published dashboard changed: `src/catalogue/dashboards` is untouched. F-22 and F-23 are component and route code, and the (i) text is the catalogue's methods, which the code draws. (Had it been needed, `scripts/dashboards-seed-sql.ts --live https://vicdata.co.uk --only …` now refuses until step 4 holds.)

**6. Set fixed** for F-22 and F-26, with the merge commit (it writes). From the same checkout, at the merge:

```
cd ~/dev/vicdata_public && scripts/feedback-set-fixed.sh "$(git rev-parse --short=12 HEAD)" F-22 F-26
```

**F-23** is the same request as F-26 (the 6 Nov note), so it stays triaged under this command. Add `F-23` to the command if you want both to close together.

**7. Live check.**
1. **Load `/platform/feedback` once.** That records the build: F-12 to F-14, F-16 to F-21, F-22 and F-26 read **Deployed**, and the gaps line reads "Deploy gaps: 0 · live build <the merge>".
2. **Read the gaps,** and expect no rows:

   ```
   cd ~/dev/vicdata_public && supabase db query --linked "select ref, status, gap from feedback_deploy_gaps order by number"
   ```
3. **Give "Looks good" on each fixed view.** Each one closes its item automatically. View as Leighton Park, Admissions:
   - **Pipelines, at 11+:**
     - F-12: Entry over time (ticks and the middle label);
     - F-13: Why did our intake change?;
     - F-14: the feeder map's blue dot;
     - F-16: the entry table and girls and boys.
   - **Pipelines, at 16+:** F-26: Shape and size, ages 11–15 in the local shape and the cards.
   - **Market share, at 11+:**
     - F-17: the rivals table's tinted row;
     - F-18: momentum's scope line;
     - F-19: the rivals' shapes;
     - F-20: the roll and its full screen;
     - F-21: the share of Years 7–11.
   - **Market share, at 16+:** F-22: the rivals table, with Leighton Park tinted. The other newly tinted tables are in the F-22 inventory above: Admissions' ranked bars and rivals' results, the group lists with a school picked, the Data View's rankings, a saved set's rank.
4. **Check that they closed:**

   ```
   cd ~/dev/vicdata_public && supabase db query --linked "select ref, status, deployed_build, checked_live_at::date from feedback_for_triage where number between 12 and 26 order by number"
   ```

   Each view you checked reads **done**. One you leave unchecked stays deployed (open), which is right.
