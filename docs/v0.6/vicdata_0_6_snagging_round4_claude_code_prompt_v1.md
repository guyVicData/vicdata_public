# VicData 0.6, snagging round 4: view titles that don't stick, Context's rail and its compare set, broken Comparisons

Claude Code build prompt. Three problems from Guy reviewing GCSE History at The Chase (URN 137625), Average points, on live.

**Process, as round 3:**
1. Make a branch `v0.6-snag4` from `main`, one commit per item (01, 02, 03), with tsc, eslint, `next build` and all tests clean on each.
2. When every check passes, **merge into `main` and push** (Render deploys).
3. Stop before merging only if a database migration is needed, and leave it for Guy.

Ground rules as in 0.6:
- **Pixel-perfect**, existing components and tokens, **both themes**.
- **Log judgement calls** under "2026-10-04 — 0.6 snagging round 4" in `docs/OPEN_QUESTIONS.md`.
- **Members' pages must not change** apart from what an item says. Run the parity harness before merging.

**Do item 03 first:** it's a live bug.

---

## 03 — Comparisons is broken at The Chase (do this first)

**What Guy sees**, GCSE · History · The Chase (137625) · Average points · Comparisons:

| View | What it shows |
|---|---|
| Map | "No location is recorded for this school, so there is no map to draw." |
| Graph | "Results by school in the 10 nearest schools — No published figures for this comparison." |
| Ranking | No other schools listed, and no result for The Chase itself. |

**The data isn't the problem:** I checked the live database. `schools` has 137625 open, with easting, northing and `location_point` all set.

**Things that are unusual about Guy's setup** (check each one):
- **Two approved memberships, one profile:** Guy is a member of both **Acland Burghley (100053)** and **The Chase (137625)**. The S3b fix 2 made pages and 31 API routes load "the signed-in person's own membership". With two, check which one each Comparisons fetch resolves to:
  - the URN sent to the comparisons, rankings, location and nearest-schools routes;
  - the comparator set (10 nearest) resolved for which school;
  - whether any route answers for 100053 while the page shows 137625, or rejects the request.

  The code even says this would be wrong "the day multi-school membership exists". That day is here, at least for Guy.
- **Trial mode:** his most recent Teacher-view state is `137625~trial~teacher`, so he may have been in a "Try VicData as Teacher at The Chase" trial. Check that no data fetch is sent `stateUrn()` / a trial key instead of the real URN. Also check that Comparisons' saved comparator set (the round 2 trial rule: "no comparator-set saving in a trial") doesn't leave the set empty or unresolved in a trial.
- **A round 3 regression:** the Results-pill filtering and the host now obeying the config. Check that Comparisons' views, defaults and data requests are unchanged for points.

**Steps:**
1. **Reproduce** headless against live data in four contexts:
   - Guy's own account at 137625;
   - Guy's own account at 100053 (Acland, which should work);
   - a trial at 137625 as Teacher;
   - a single-membership test user at 137625.

   Record every Comparisons request and response.
2. **Fix the root cause**, not just the symptom.
3. **The general rule** wherever a page or route resolves "my membership":
   - the school being shown decides which membership is used, and it must be one of the caller's approved memberships;
   - a platform admin in a trial or look-as uses the trial's school, with the admin's platform rights;
   - never "the first row".
4. **Regression tests:**
   - two memberships, showing either school;
   - a trial at a school Guy isn't a member of (e.g. Croydon College 130432): every Comparisons view at both schools draws.

**Check across all four columns, not just Comparisons:** at 137625 History, every panel in Column 1 Results, Context and Comparisons, Current and Trends, must draw for Average points, Grade 4+, Grade bands and Grade counts. Do the same for one Post-16 subject.

---

## 01 — View titles changed in the editor don't show on the page

**Guy:** *"We need to check the mechanisms for changing titles. They save in the edit view but don't show when Edit is turned off."*

This looks like the same pattern as round 3's figures: Customise saves a choice on the view instance, but the page never reads it. Round 1 fixed panel *renames*. This is the **view's** title (Customise's title with placeholder chips, and any title edit in the rail icon menu).

1. **Fix titles end to end.** The view instance's title override is used everywhere the view's title appears:
   - the panel header;
   - fullscreen;
   - Export (print);
   - Copy this view (dashboard and meeting);
   - meeting slots;
   - the rail icon's tooltip;
   - Pick and History previews.

   Placeholders (subject, category, school, year, measure, compare set) are resolved for the member's own context. With no override, today's resolved titles and their fallbacks are unchanged.
2. **Audit every Customise field the same way:** number type, years, look, title, roll forward, and round 3's figures.
   - Make a table: field → saved where → honoured on the Teacher page? → on `/dashboards/[id]`? → in meeting slots?
   - Each field must either **work everywhere** or **not be offered**. A field that isn't wired yet is shown dotted with the tag "Coming soon", never silently saved and ignored.
   - Wire up whatever is reasonable this round, and log the rest.
3. **Edit mode and the page draw from the same config:** with Edit on, what the editor previews is exactly what the page will show after Publish. With Edit off, the page shows the published version. If a change shows in the editor but not on the page after Publish, that's this bug. Add a headless test per Customise field:
   1. edit it;
   2. publish;
   3. switch Edit off;
   4. assert the page shows it.

---

## 02 — Column 2 (Context): the rail should follow the "Compare against" set

**Guy:** *"In Column 2 (Context), the rail of icons shows all data views. It isn't responding to what's shown in that compared-to set."*

The Context pill offers three sets: **[Category] subjects** (`category`), **All subjects** (`whole`) and **Selected subjects** (`selected`). The rail shows every Context view whichever is picked.

**First find out what the pre-0.6 hand-coded page did** (the flag-off code path in `ColumnPanels` / `SubjectPanels`, or `main` before the v0.6 merge). Did Context's rail, opening view or disabled views change with Compare against?
- **If it did,** the config renderer must do exactly the same. Restore it and prove it with parity runs for each compare set.
- **If it didn't,** Guy is asking for new behaviour. Build the mechanism with defaults that change nothing, so he can then set which views belong to which set in the editor himself.

**The mechanism: generalise round 3's Results-pill filtering into one "variant" mechanism**, not a second copy:
- **The axes**, each with its own set of states:
  - `results` on Results dashboards (exists);
  - `compareAgainst` on Context (new);
  - Comparisons' comparator kind (ranking set vs. chosen schools), if the host already varies views by it (e.g. Number tiles only for a ranking set). Include it only if it's already a real distinction in the host.
- **Defaults:** a dataview declares the states it's offered on per axis, as the catalogue default.
- **Overrides:** a view instance can override, never beyond what the dataview can draw.
- **Default view:** a panel can have a default view per state.
- **The host** shows the instances that apply to the current state of every axis that applies to that panel.
- **The editor:**
  - **Pills:** Context gets its own **Compare against** pill in the editor. It's the same `PillMenu` and labels as the page, opening on the page's current state. It sits beside the Results pill (at the right of the Candidates/Results band, as round 3 placed it).
  - **Show all views** dims what doesn't apply to *any* of the current pill states.
  - **The view menu's "Show on…"** lists each relevant axis as its own short checklist (Results measures; Compare against sets).
  - **Make this the default for…** names the current state(s), e.g. "for Grade counts · Selected subjects", when both apply.

**Checks:**
- **Unit tests:**
  - effective states per axis;
  - two axes at once (Context on a Results dashboard: results × compareAgainst);
  - defaults per state;
  - configs without the new fields give today's rails.
- **Parity:** every compare set × the four Results measures at Acland Burghley (100053) GCSE and King's Worcester (117037) Post-16, plus Candidates. Members' pages must be identical to before unless the pre-0.6 behaviour was being restored, in which case they must match the pre-0.6 page. Report which.
- **Screenshots:** the editor with both pills, and Show on… with two axes.

---

## Finish

1. Write `docs/v0.6/snag4_report_v1.md`, with:
   - **item 03:** the root cause, which contexts were broken, and the fix;
   - **item 01:** the Customise audit table;
   - **item 02:** what the pre-0.6 page did, and the axis/state table;
   - parity results;
   - screenshots in `docs/v0.6/snag4_screenshots/`;
   - a short click-through for Guy that starts with GCSE History at The Chase, Average points, every Comparisons view.
2. Merge and push:
   ```
   git checkout main && git pull && git merge --no-ff v0.6-snag4 -m "0.6 snagging round 4" && npm run build && git push
   ```
3. Tell Guy to wait for Render's "Deploy live".
