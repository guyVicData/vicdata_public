# VicData 0.6, snagging round 4: one "View as" mechanism (fixes Comparisons in trials), view titles that stick, Context's rail follows its compare set

Claude Code build prompt. This replaces the earlier separate round 4 and round 5 prompts: one round, five commits.

**Process:**
1. Make a branch `v0.6-snag4` from `main`, one commit per item, **in this order: A, B, C, 01, 02**, with tsc, eslint, `next build` and all tests clean on each.
2. When every check passes, **merge into `main` and push** (Render deploys).
3. Stop before merging only if a database migration is needed. Write it, test it on PGlite, and leave it for Guy.

Ground rules as in 0.6:
- **Pixel-perfect**, existing components and tokens, **both themes**.
- **Log judgement calls** under "2026-10-04 — 0.6 snagging round 4" in `docs/OPEN_QUESTIONS.md`.
- **Members' pages must not change** apart from what an item says. Run the parity harness before merging.

**Guy:** *"Can we shift to a single change-view mechanism? The trial mechanism is more powerful for editing different roles."*

## The live bug that started this (Guy confirmed the cause)

At **The Chase (137625), GCSE · History · Average points**, Comparisons was broken **only inside a "Try VicData as Teacher at The Chase" trial**:

| View | What it showed |
|---|---|
| Map | "No location is recorded for this school, so there is no map to draw." |
| Graph | "Results by school in the 10 nearest schools — No published figures for this comparison." |
| Ranking | No schools, and no result for The Chase. |

As Guy's own account, the same page draws correctly. `schools` has 137625 with easting, northing and `location_point` set, so the data is fine.

**Suspects:**
- how a trial resolves Comparisons' comparator set: round 2's "no comparator-set saving in a trial" may leave "10 nearest" empty or unresolved;
- any Comparisons request sent `stateUrn()` / the trial key, or an empty URN, instead of the real one.

**Find the root cause, and record it in the report.** Then item B makes this whole class of bug impossible.

**Also check:** Guy has two approved memberships (Acland Burghley 100053 and The Chase 137625). Every page and route must resolve membership by the school being shown, never "the first row". It isn't the cause of what he saw, but test it.

---

## Background: today there are four ways for Guy to see a school as someone

1. His own memberships: he's a member of Acland Burghley (100053) and The Chase (137625).
2. Platform's "Look at it as…", which round 2 made start a trial, plus `&peek=1` read-only for the Catalogue.
3. The **Try VicData as…** card on `/account`.
4. The Edit switch, which works in either.

They behave differently: Comparisons broke only inside a trial (above).

## Goal

**One mechanism, "View as"**, built on the round 2 trial. It's how Guy sees and edits VicData as any role at any school.

---

## A — One "View as" control, always to hand (platform admin only)

**The pill:**
- A compact **View as** pill in the top nav bar, before the account link, for platform admins only.
- **At rest** it reads **"Viewing as: you"**.
- **During a trial** it reads **"Teacher · The Chase ▾"**, with the role chip colour from People.
- **Clicking it** opens a popover (the existing `PillMenu`/popover shell) with exactly what the `/account` card has today:
  - school search (site-wide; name or URN);
  - role chips (Teacher · SMT · Admissions · School-Admin);
  - Start fresh;
  - Recently tried (last 5, one click each);
  - **Back to me**.

**Where else it appears:**
- **On `/account`,** the card stays as the same component (one source of truth) for anyone who goes there.
- **Platform's "Look at it as…"** opens View as with that school and role filled in.
- **`peek`** stays internal to the Catalogue's parity frames only and is never offered in the UI.

**The banner** stays as it is: *Viewing as Teacher at The Chase · Edit · Preview draft · Change · Start fresh · Back to me*. Rename "Trying VicData as" to **"Viewing as"** and "Exit" to **"Back to me"** everywhere, including logs and the round 2 strings.

**Across tabs:**
- View as **lasts across tabs in this browser** until Back to me. Today it lives in one tab only, and Guy wants to work across tabs. Keep the choice in sessionStorage or a cookie, whichever fits the existing trial plumbing, and log which you chose.
- A tab opened while viewing as someone shows the banner straight away. There must never be a page in view-as mode without the banner.

**Edit:** the Edit switch and banner Edit work identically in view-as mode and as Guy. Edits are always made as Guy, with the view-as school and role as the preview, as in round 2.

---

## B — A trial behaves exactly like a real member (full fidelity)

Fix the Comparisons bug above at its root, then make it impossible for the two to drift apart.

**One rule:** in view-as mode, the page and every data route get **the same inputs a real single-membership member of that school and role would get**:
- the real URN;
- the same default comparator lists, such as 10 nearest;
- the same phase gating;
- the same role offers and the same home page.

The only things that differ:
- **Where personal state is saved:** under the trial key.
- **No school-wide writes:** nothing touches People, Teams, school dashboards, shared sets, sign-in events or counts.

**Lift the round 2 limits that make a trial less real:**
- **Comparator sets:** a trial can **save its own comparator sets**, stored under the trial key and never shared with the school. Round 2 disallowed this.
- **A School-Admin trial** can open People and Teams **read-only**, with a clear "View as: read-only" note on save buttons. It still can't write the school's data.

**Fidelity test** (headless, live data):
- **Compare** view-as against a real single-membership test user with the same school and role. Every panel, every Results measure and every Compare-against set should be **pixel-identical**.
- **Pages:** the role home page, GCSE and Post-16 dashboards, Meetings and Recruitment.
- **Schools:** The Chase (137625) as Teacher and SMT, Croydon College (130432) as Admissions, and Acland Burghley (100053) as School-Admin.

**Two memberships:** Guy's real memberships at two schools must also resolve by the school being shown. Add a test.

---

## C — Tidy up so there's only one path

- **Remove the separate code paths** for look-as and trial where they duplicate each other. One `viewAs` module (built from `src/lib/trial.ts` and `src/lib/look-as.ts`) answers three questions:
  - Which school and role is this page for?
  - Where does personal state go?
  - Is this caller allowed?

  Confirm platform admin server-side, as now.
- **Logging:** keep `log_platform_action('view_as', urn, {role, fresh})`, renamed from `try_as`. Old log rows stay as they are.
- **Database:** if it's only a rename, keep the existing tables and columns (`trial_contexts`, `trial_key`) rather than migrating. Log the naming gap.

---

### View as: checks

- **Unit and PGlite tests:**
  - only a platform admin can enter view-as;
  - view-as state never lands in Guy's own rows or the school's;
  - comparator sets saved in view-as are invisible to the school and to Guy-as-himself.
- **The fidelity test above.**
- **Parity for members:** unchanged.
- **Screenshots:**
  - the nav pill at rest and in view-as mode;
  - the popover;
  - the banner;
  - a second tab opened during view-as.

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
   - the trial Comparisons root cause;
   - what was merged and removed for View as;
   - the fidelity results;
   - the Customise audit table (01);
   - what the pre-0.6 page did with Context's rail, and the axis/state table (02);
   - parity results;
   - screenshots in `docs/v0.6/snag4_screenshots/`;
   - logged calls.
2. Include a click-through for Guy:
   1. In the nav pill, pick **The Chase as Teacher**, then GCSE · History · Average points · every Comparisons view.
   2. Switch to SMT, and open a second tab.
   3. Turn Edit on, change a view's title, Preview draft, Publish. With Edit off, the title shows.
   4. In Context, switch Compare against and watch the rail.
   5. Choose Back to me, and restore the original from History.
3. Merge and push:
   ```
   git checkout main && git pull && git merge --no-ff v0.6-snag4 -m "0.6 snagging round 4" && npm run build && git push
   ```
4. Tell Guy to wait for Render's "Deploy live".
