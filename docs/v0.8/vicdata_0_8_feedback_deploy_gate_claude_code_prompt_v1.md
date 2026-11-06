# VicData 0.8 — Feedback closes on the live site, not on merge (plus F-22 and F-23)

Claude Code prompt for the app repo (`~/dev/vicdata_public`), app database `lnhulykjlxmoneappnsp`. Written 6 Nov 2026 from Guy's decision the same day. **Run after Guy has deployed `6bddb6d` on Render** (see "Before this round").

## What went wrong (investigated 6 Nov)

Guy's feedback this morning, F-22 to F-24 on the two Admissions dashboards, reported changes marked done that weren't on screen.

- **Admissions feedback round 1** (F-12 to F-21) was merged to `main` on 30 Oct as `6bddb6d`. Its report gave five steps: 1 merge, 2 Render deploy, 3 republish the two Admissions dashboards, 4 mark F-12 to F-21 done, 5 check on the live site.
- **Steps 1, 3 and 4 ran; steps 2 and 5 did not.**
  - The republish went live on 31 Oct at 04:10, and the items were marked done at 04:28.
  - Every feedback item from 29 Oct to 6 Nov records `app_version` `030d546fef79`. That is the 19 Oct commit, so Render never deployed `6bddb6d`.
  - `6bddb6d` builds clean (checked 6 Nov), so the code didn't block the deploy. Either the deploy was never triggered or auto-deploy is off. Guy is checking Render's Events tab.
  - Because the republish ran first, the live rails carried the new views on the old code. The report itself warned this would show "This view isn't drawn here yet".
- **`docs/FEEDBACK.md` already says** an item closes "when the fix is deployed (merged to `main`, Render deployed)". Nothing enforces it: the mark-done SQL in the report sets `resolved_commit` from the local `HEAD`, whatever is live.
- **Scope was narrowed and nobody saw it:**
  - F-17 ("in all table views the featured school's row needs to be coloured") was done "in every product" except SMT, the Data View, the public page and some group tables (OPEN_QUESTIONS 22 to 26). Guy's F-22 asks again for **all** table and rank views.
  - F-15 (local shape in place of "Your school") was built for an 11+ intake. At 16+ the local set is still the nearest primaries, ages 4 to 10, which is Guy's F-23.
  - Neither narrowing became an open item, so both read as done.
- **Already done in the database (Claude, 6 Nov):** F-12 to F-21 were reopened to `planned`. Each has `planned_version` = "deploy 6bddb6d", keeps `resolved_commit` `6bddb6d` and `resolved_at` null, and carries a triage note. F-1 to F-11 stay done: their commits (`41c4d26`, `030d546`) are in the live build.

## Before this round (Guy)

1. On Render, deploy `main` (`6bddb6d`) and wait for "Deploy live". Then check **Settings → Build & Deploy → Auto-Deploy**, and say in the report whether it was on.
2. Give one feedback item (or "Looks good") anywhere, and confirm it records `app_version` `6bddb6d…`.
3. Check the report's step 5 on the live site.
   - F-24 should then be fixed, and the rivals table should be tinted (half of F-22).
   - Each of F-12 to F-21 that looks right gets a "Looks good" on its view.

## Decisions (Guy, 6 Nov)

### 1. A status between "planned" and "done"

- **The statuses become:** new → triaged → planned → **fixed** → **deployed** → done, or won't do.
  - **fixed:** merged to `main`, with `resolved_commit`. This is what the report's "mark done" step sets from now on.
  - **deployed:** the live build contains `resolved_commit`. This is set **automatically** (item 2), stamped `deployed_at` and `deployed_build`.
  - **done:** checked on the live site (item 4).
- **Migration** on `feedback_items`:
  - widen the status check;
  - add `deployed_at` and `deployed_build`;
  - add the new columns to `feedback_for_triage` at the end, so its existing columns are untouched.
- **The inbox** gets filters and bulk actions for the new statuses.
- **The feedback icon's colours:** yellow stays until done, so the author sees a fix as still open until it's checked.
- **Backfill** in the same migration, safe to run twice: F-12 to F-21 move from `planned`, `planned_version` "deploy 6bddb6d", to `fixed` with `resolved_commit` `6bddb6d`.

### 2. The app knows which commits are live

- **At build time,** write the commit list to a generated file in `src/generated/`: `git rev-list --max-count=1000 HEAD`, as 12-character shas.
  - Check whether Render's checkout has enough history for this. If it's shallow, find another way, e.g. a `git fetch --deepen` in the build command or a committed list. Say which you chose, and test it on a real Render build.
  - A build with no list must say so (`commits: null`), not pretend.
- **`GET /api/version`,** outside the access gate like `/api/health`, returns `{ commit, built_at }`. The repo is public, so the commit isn't a secret. Leave `/api/health` as it is.
- **A table `app_builds`:** `commit` (primary key), `first_seen_at`, `commits text[]`.
  - The server upserts its own row once per process, on its first feedback insert or inbox load, through a server-only path.
  - RLS: platform admins read; nobody writes from the client.
- **Promotion:** when the server records a new build, move every `fixed` item whose `resolved_commit` is in that build's `commits` to `deployed`, stamping `deployed_at` and `deployed_build`.
  - This runs in the same server-only path.
  - It's idempotent, and it logs how many items moved.
- **A view `feedback_deploy_gaps`** for Claude and the inbox, listing items that claim more than the live build has:
  - `deployed` or `done` items whose `resolved_commit` isn't in the newest `app_builds` row's `commits`;
  - `fixed` items older than 48 hours that haven't been deployed.

  Show the count as a banner in the inbox. On 6 Nov's data it would have listed F-12 to F-21. Test that case in PGlite.

### 3. The order of Guy's commands is enforced, not just listed

- **`scripts/dashboards-seed-sql.ts`** (the republish) refuses to run unless the live `/api/version` commit contains the local `HEAD`.
  - It reads the live URL from an env var or a flag, and has no default that could point at the wrong site.
  - `--force` overrides the check, and prints why it's unsafe.
- **The "set fixed" command** in reports, replacing "mark done", also checks the project ref. It only sets `fixed`, never `deployed` or `done`.
- **Every future report's "Guy's commands"** follows this template, in order:
  1. migrations;
  2. merge and push;
  3. Render deploy;
  4. wait until `/api/version` shows the merge;
  5. republish, if any;
  6. set fixed;
  7. live check.

  Put the template in `docs/FEEDBACK.md`, and add a rule test that checks the next report against it.

### 4. "Done" means checked on the live site

- **An item moves from `deployed` to `done`** in either of two ways:
  - a platform admin's **"Looks good" on the same view and school** after `deployed_at`, automatically;
  - the inbox action **"Checked live"**, with the date stamped.
- **Coverage** keeps counting a "Looks good" as checked.

### 5. Scope narrowed in triage becomes an open item

- **When a proposed fix covers less than the author asked for,** the triage must say so. The signs are words like "all", "every" or "each"; `applies_to = similar_views`; or a fix that only covers one phase or entry age.
  - Write a triage-note line beginning **"Not covered:"**, listing the views, products or cases left out.
  - Raise **a linked follow-up item** for each one: type as the original, `triage_note` naming the parent F-number, status `triaged`.
  - It stays visible as open work and never reads as done.
- **Add this to "Proposing a triage" in `docs/FEEDBACK.md`.** Link a follow-up to its parent with a new `follows_up uuid` column (nullable, like `duplicate_of`), and show it in the inbox.
- **Apply it backwards once:** raise follow-ups for F-17's exclusions (OPEN_QUESTIONS 22 to 26) and for F-15 at 16+. Link F-22 and F-23 to them, or treat F-22 and F-23 as those follow-ups, and say which.

### 6. F-22: the focus school highlighted in every table and rank view

Guy: "ALL table / rank views the focus school should be highlit."

- **First, an inventory** of every table or rank view that has school rows, in:
  - Teacher;
  - SMT;
  - Admissions;
  - the group dashboards and group home;
  - the Data View (Rankings, Graphs' tables, the deep dive);
  - custom and member dashboards;
  - meeting slides;
  - the public school page.

  For each, record whether it tints the focus row today, and with which token.
- **Then tint every one,** with the round 1 tokens (`--row-featured-*`, through `FEATURED_ROW_BG`).
  - Where a product has no token yet (the Data View, the public page, Teacher KS2), add one, in light and dark, with the same contrast checks as F-17 (text 11:1 or better, muted text 6.3:1 or better).
  - For group views listing every member: tint the school picked, if there is one; if there is none, say so in the inventory.
- **A rule test, R-FEATURED-ROW-EVERYWHERE:** every table or rank component that takes a focus URN sets `data-featured-row` on that row. It flags any table component in `src` that renders school rows without the attribute.

### 7. F-23: the local shape at a 16+ intake covers ages 4 to 15

- **Today,** at 16+, `views-api.ts` builds the local set from the nearest primaries (or a saved list), so `ShapeAndSize` can only draw ages 4 to 10.
- **At 16+,** the local shape covers ages 4 to 15. The set is the nearest primaries **and** the nearest schools teaching ages 11 to 15. Propose how many of each, and how the current comparison set fits (its schools are the feeders a year below entry, at age 15). Log the call in OPEN_QUESTIONS.
- **The feeder cards** beside it, at 16+: the set's schools at age 15, each over ages 4 to 15 and in the set's order, as F-19 does.
- **The (i) text and the "All pupils aged…" line** name the ages and both kinds of school.
- **Check 11+ and 4+ intakes too,** and say what each covers.
- **Test cases:** Leighton Park, viewed at 16+ and at 11+.

## Tests

- **R-FEEDBACK-STATUSES:** fixed → deployed → done in PGlite. The icon stays yellow until done. The backfill moves F-12 to F-21 to `fixed` once, and running it again changes nothing.
- **R-FEEDBACK-PROMOTE:** a new `app_builds` row whose `commits` contain an item's `resolved_commit` moves it to `deployed`; a build without that commit leaves it `fixed`.
- **R-FEEDBACK-DEPLOY-GAPS:** the 6 Nov case (done at `6bddb6d`, live build `030d546`) is listed; once the build has `6bddb6d` it isn't.
- **R-FEEDBACK-LIVE-CHECK:** a "Looks good" on the same view and school after `deployed_at` closes the item; one before `deployed_at`, or on another school, doesn't.
- **R-REPUBLISH-GUARD:** the republish script exits non-zero when the live commit doesn't contain `HEAD`. Mock `/api/version` for this.
- **R-FEATURED-ROW-EVERYWHERE,** as in item 6.
- **R-LOCAL-SHAPE-16:** Leighton Park at 16+ draws ages 4 to 15; at 11+ it is unchanged from round 1.

## Ground rules

- **Branch `v0.8-feedback-deploy-gate` from current `main`, fetched over HTTPS.** Commit this prompt first. Work in a worktree if the checkout is in use.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness.

  **Allowed differences:** the featured-row tint on the newly tinted tables; F-23's local shape and cards at 16+. Figures never change.
- **No database writes.** Migrations are written and tested in PGlite; Guy applies them.
- **Never put a server key in client code.** Stage files by name. Push over HTTPS.
- **Log calls** under "2026-11-06 — feedback deploy gate" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/feedback_deploy_gate_report_v1.md`. Include:
- what happened with round 1, in a few lines;
- Render's auto-deploy setting as found;
- the statuses and the promotion;
- how the commit list is built on Render;
- `/api/version`, `app_builds` and `feedback_deploy_gaps`;
- the republish guard;
- the closing rule;
- the scope rule and the follow-ups it raised;
- the F-22 inventory, before and after (screenshots, light and dark);
- F-23 at 16+ and 11+ (screenshots);
- **Guy's commands, in the new template's order.** The live check includes reading `feedback_deploy_gaps` and seeing it empty.

**Merge only after Guy has applied the migrations.** Use the usual merge command (`git merge --no-ff v0.8-feedback-deploy-gate`, `npm run build`, push over HTTPS). If the push is refused, give Guy the command.
