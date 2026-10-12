# VicData 0.7 — Admissions round 2b (the three follow-ups) report

Branch `v0.7-admissions-r2b`, from `main` (`85ac4e6`). Prompt: `docs/v0.7/vicdata_0_7_admissions_round2b_followups_claude_code_prompt_v1.md`. The E1 migration is written and tested, **not applied**. Calls are logged under "2026-10-12 — 0.7 admissions r2b" in `docs/OPEN_QUESTIONS.md`.

**Parity: clean.**

- **Teacher, with no `set` parameter:** 2,875 / 2,875 pairs identical against `main`.
- **The Data View:** none of its modules changed.
- **The public page:** its server render is byte-identical for 137625 and 117037.
- **Selftest:** the planted change was caught.

The summary is in `audit_scripts/parity_harness/r2b_SUMMARY.txt`.

| Item | Commit | What |
|---|---|---|
| E1 | `a36f855` | The School-Admin may edit setup and the lists, as an audited override: the migration, the RLS test, and the page (setup, "changed by", People's history). |
| E2 | `274fd3d` | Teacher's subject dashboard reads `?set=` (and `&subject=`). Admissions' Strengths links pass the rivals, the stage and the subject area. |
| E3 | `8950c34` | The undercount note on past LA and England pool-trend years. |
| report | (this) | This report, the screenshots, the logged calls. |

## E1 — the School-Admin override on lists

### The migration: `supabase/migrations/20261108090000_v07_admissions_r2b_school_admin_override.sql`
1. **The write policies.** `admissions_lists_write` and `admissions_entry_points_write` become `is_admissions_lead_of(school_account_id) or is_school_admin_or_holder(school_account_id)`, for both `using` and `with check`. The lead's rights are unchanged. A row still can't be moved to another school.
2. **`updated_by_kind`** (`lead` / `school_admin`) on both tables. The existing stamp trigger sets it from who is writing; the client can't set it. It's how the lead's screen can say "Changed by School-Admin …", because only the School-Admin reads the audit log.
3. **The audit trigger** (`audit_admissions_override`, after insert/update/delete on both tables). A write by anyone but the lead logs `admissions_lists_override` or `admissions_entry_points_override` to `platform_audit_log`, through round 1's `log_admissions_action`, scoped to the school:
   - **Who:** `actor_profile_id`.
   - **What:** `detail`, holding `op`, the entry point, and for a list its kind, rung and id, the fields changed, and the URNs added and removed.
   - **Not recorded:** an update that changes nothing.
4. **`admissions_can_edit_lists(school_account_id)`**: the lead or the School-Admin. The page uses it to decide whether to open setup for a School-Admin. Anon can't call it.

It doesn't depend on D1 and is safe to re-run.

**Before and after the apply.** Before it's applied, the RPC doesn't exist, so the page keeps round 1's rule: setup is read-only for a School-Admin, with the reason. The lists route reads `updated_by_kind` only if the column exists. After the apply, both switch on with no deploy in between.

### The page
- **Setup and the list editors** open for a School-Admin without the flag, both from the ± by the entry points and from the rivals chip. Saving goes through the same route and the database decides who may save. The first-visit setup still opens by itself only for the lead.
- **The note above the dashboard** for a School-Admin now reads: *"You can change setup and the lists as an override: each change shows as yours and is recorded in People's history."*
- **"Last changed by"** becomes **"Changed by School-Admin [name], [date]"** for a row whose last write was an override. Otherwise it still reads "Last changed by [name], [date]".
- **People → Admissions → History** lists the override rows, for example *"12 Oct 2026: School-Admin Jane Smith changed the 11+ day feeders (+1, −1) · override"*. It also shows "added the 16+ entry point", "removed the …" and "reordered …".
- **The route's refusal message** now reads "Only the Admissions lead or the School-Admin can change this."

### RLS test: **111 checks, all pass** (round 1's 84, plus 27 new)
`supabase/tests/v07_admissions_rls_pglite.mjs` (output in `.out`). Round 1's checks run first, unchanged, on round 1's rules. Then the test applies D1 and r2b and adds a "2b" section:

- **The School-Admin writes:**
  - updates a list, and the row is stamped `updated_by` = the School-Admin, `updated_by_kind` = `school_admin`;
  - the audit row has the actor, the school, `op: update`, the kind and entry point, `changed: [members]`, and the added and removed URNs;
  - a second School-Admin creates a list, and the client can't claim `updated_by_kind: 'lead'`;
  - inserts and deletes are audited;
  - writes and re-orders an entry point, which is audited;
  - a no-op update isn't audited.
- **The lead is unaffected:** the lead still writes, stamped `lead`, with no audit rows.
- **Still refused:** an Admissions member without the flag, SMT (which still shares) and a teacher on a share can't insert, update or delete lists or entry points.
- **No access across schools:**
  - this School-Admin can't insert, update or delete the other school's lists or entry points, or move a list there;
  - the other school's lead can't write here;
  - the other school's lead's own writes aren't overrides.
- **The audit log:** the School-Admin reads the override rows; the lead and other schools don't.
- **`admissions_can_edit_lists`** is true for the lead and both School-Admins, and false for Admissions, SMT, teachers and the other school. Anon is refused, and members can't call the internal helper.
- **The service role:** a service-role write is stamped with no user and isn't audited.
- **Re-running** the migration over itself is safe.

D1's own test still passes (12/12).

### Apply (after merging; `&&` chain, project-ref check, no `exit`)
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261108090000_v07_admissions_r2b_school_admin_override.sql && supabase migration repair --status applied 20261108090000 --linked
```
If D1 (`20261107090000`) isn't applied yet, apply it first with round 2's command. The two don't depend on each other, but that keeps the history in order.

## E2 — "Open in the subject explorer with these rivals"

### Teacher (`src/components/dashboard-config/TeacherDashboard.tsx`, `src/lib/teacher-view-linked-set.ts`)
- **`?set=<urn>,<urn>,…`:**
  - at most 30 URNs, each a 6-digit URN; anything else is ignored, and duplicates are dropped;
  - Comparisons opens on them as the chooser's **unsaved custom set**, `{ kind: "urns", label: "Admissions rivals" }`. That is the same path a custom set takes from the chooser, so the ranking, figures and views are the same: `/api/teacher/chooser-set`, then the comparator profiles.
- **Nothing is saved.** The set overlays the two settings Comparisons reads (`set:rankings`, `chooser:rankings`), and is never written to them.
- **Changing the set** in the chooser drops it, and takes `set` (and `subject`) out of the address.
- **Reloading** keeps it while the parameter is in the address.
- **`&subject=<name>`** focuses that subject, if the school has one by that name. If it isn't ticked, it is ticked for this visit only. A logged call: if the teacher then ticks another subject, the page saves the tick list it has, which includes the linked subject.
- **With no `set`** the overlay is `null` and the page reads exactly what it read before.

### Admissions
- **Strengths and weaknesses:**
  - each subject area links to `/teacher/ks4` or `/teacher/ks5` (the stage, from the entry point) with `?set=<the rivals>&subject=<the area>`;
  - the footer link reads **"Open in the subject explorer with these rivals →"**;
  - the hint reads "Click a subject area to open it in the subject explorer with these rivals."
- **The Academic panel's** short "subject explorer →" passes the rivals too, with the full wording as its title.
- **What's passed:** the rivals without the school, the first 30.

### Parity: Teacher with no `set` parameter
The full rebuilt harness ran against `main` (`85ac4e6`), in 1,310 s.

- **Fixtures:** 10/10 byte-identical between the trees.
- **The Teacher walker:** **2,875 pairs, 2,875 identical**, 0 noise, 0 unexpected, 0 on one side only. Across the sets: c5_0 588, c5_1 576, c5_2 552, c5_3 590, the rankings 268 + 229, and the saved set 72.
- **The import graph:**
  - the Data View and public page graphs, and their API routes, contain **no changed file**;
  - the Teacher graph contains `TeacherDashboard.tsx`, the new `teacher-view-linked-set.ts`, and Admissions files that the Teacher home and People import. With no parameter they draw identically, as the walker shows.
- **Public school page SSR:** 137625 IDENTICAL (64,747 bytes); 117037 IDENTICAL (73,399 bytes); 62 replay hits, 0 misses.
- **Negative control:** OK; the planted change was caught.
- **Error files:** a few phone cases log the same harness rejection ("parameter 1 is not of type 'Element'") at the same code point on **both** sides. Which cases it hits varies from run to run, as in round 2's runs. Their pairs are identical.

### Screenshots with the parameter (`admissions_r2b_screenshots/`)
These are drawn in the parity harness's Teacher bundle with a stubbed sign-in. The rivals are each school's default Admissions rivals, as the Strengths link passes them. The set is resolved by the same server functions `/api/teacher/chooser-set` uses for `{ kind: "urns" }`, with the rivals' real per-school rows.

| File | What |
|---|---|
| `chase_ks4_history_set_{dark,light}.png` | The Chase, GCSE, `?set=` (10 rivals) and `&subject=History`. History is in focus, and Comparisons reads **"Compared against: Admissions rivals"**. |
| `chase_ks4_history_set_ranked_{dark,light}.png` | The Chase's Comparisons, ranked: "Results by school in the admissions rivals". The Chase is 2nd of 6. Only 5 of the 10 rivals enter GCSE History: three are preps with no GCSE, and two report no GCSE History rows. |
| `kings_ks5_maths_set_{dark,light}.png` | King's Worcester, Post-16, `?set=` (10 rivals) and `&subject=Mathematics`. A level Maths is in focus, and Comparisons is on "Admissions rivals". |
| `kings_ks5_maths_set_ranked_{dark,light}.png` | King's Comparisons, ranked: all 10 rivals have A level Maths, and King's is 5th on 41.7. |

## E3 — the undercount note

- **The wording**, in `ADMISSIONS_NOTES.areaUndercount` (`src/catalogue/notes.ts`): *"Earlier years count only schools still open, so they slightly undercount."*
- **When it shows.** Under the pool-trend chart (`DV-ADM-P-POOL-INDEXED`) and its table (`DV-ADM-P-POOL-TABLE`), only when a past year is drawn. The route says when: `poolTrends.pastAreaYears` holds the years before the latest that have an LA or England value. Nothing is worked out in the browser.
- **More years needed no change.** The panel already drew every year it was given. With your backfill (2019–2025), the "held for one year only" note no longer shows and this one does.
- **Checked against your backfill.** R-ADM-VIEW-TRENDS (The Chase, 11+, age 10):
  - `areaYears` = 2019–2025;
  - `pastAreaYears` = 2019–2024;
  - England in 2019 = 761,380, the sum of the nine regions (there are no England rows, as you said);
  - the LA's 2025 value is unchanged (6,694).

## Checks
- **tsc:** clean.
- **eslint:** 0 errors; the same 2 warnings that are already on main.
- **build:** clean.
- **Unit tests** (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`): **390 pass**, 0 fail. That is 387, plus 3 for `?set=` (parsing and limits, the custom set and the subject match, and dropping the parameter).
- **Rule tests:** PASS 49, FAIL 0, ERROR 0. R-ADM-VIEW-TRENDS now also checks the past years and England.
- **RLS:** 111 / 111, as above. D1: 12 / 12.
- **Parity:** as above.

## Click-through for you (after Render's "Deploy live" and the E1 apply)
1. **As the School-Admin (not lead), at a school with Admissions:**
   - `/teacher/admissions`: the note says you can change setup as an override;
   - press ± by the entry points: setup opens, editable;
   - change the 11+ day feeders and save. The step's foot reads "Changed by School-Admin [you], [today]".
2. **People → Admissions → History:** "School-Admin [you] changed the 11+ day feeders (+n, −n) · override".
3. **As the lead:** the same list reads "Changed by School-Admin …". Save it yourself: it reads "Last changed by [you]" and no new history row appears.
4. **As an Admissions member without the flag, or SMT:** setup is still read-only.
5. **Market share, 11+ (or 16+), Strengths and weaknesses:**
   - click a subject area (e.g. History). The subject dashboard opens with that subject in focus and Comparisons on "Admissions rivals";
   - open the comparator chooser and pick anything: the address loses `set=`, and reloading keeps your choice.
6. **Pipelines, the pool-trend panel** (11+): the LA and England lines run from 2019/20, with the undercount note under the chart. The table view shows the same note.
