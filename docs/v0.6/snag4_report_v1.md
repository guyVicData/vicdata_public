# VicData 0.6, snagging round 4: report

Branch `v0.6-snag4`, from `main` (1c5cc06), **merged into `main` and pushed**. No database migration was needed.

| Commit | Item |
|---|---|
| `e690a4f` | A: one "View as" control in the nav, across tabs |
| `a609a1c` | B: View as behaves exactly like a real member (fixes Comparisons in a trial) |
| `85d123b` | C: one `viewAs` module, one path |
| `f016321` | 01: view titles set in the editor show on the page, plus the Customise audit |
| `1177a21` | 02: Context's rail can follow Compare against (one variant mechanism; the defaults change nothing) |

**Checks on every commit:** tsc, eslint (changed files) and `next build` clean, and tests passing (193 at the end). PGlite: the new view-as test passes 25/25, and the round 2 trials test still passes.

## Why Comparisons broke only in a trial at The Chase

**Root cause:** two routes Comparisons calls only let in approved members, with no platform-admin fallback: `/api/data-view/academic-schools` (route.ts:25-41 at 1c5cc06) and `/api/teacher/saved-comparator-sets`. The `teacher/*` routes have had that fallback since S1.

In a trial Guy isn't a member of The Chase, so both answered 403:
1. The page got no comparator profiles (TeacherDashboard.tsx:546 set them to empty).
2. So the map found no location for the school (RankingsMap.tsx:66: "No location is recorded…").
3. History's figures are built from those profiles, so the graph said "No published figures…" and the ranking was empty.
4. "10 nearest" still resolved, through `chooser-set`, which does have the fallback; that's why the title read correctly.

**Ruled out:** the URN (the real 137625 was sent), the 10-nearest list (checked on live data) and the location data. Reproduced headlessly through the real routes on live data: View as got 403 and a member got 200.

**Fixed in B:** every membership-gated route that Comparisons, the chooser and Recruitment call now lets a platform admin in after the member check.

**The brief's grounding, corrected:** live, Guy's platform-admin profile has **one** approved membership, Acland Burghley (100053). The Chase's only member is another profile, so "as Guy, The Chase works" must have been that other login. The two-membership case was still tested (10/10), and it found a real member bug, now fixed: with two approved memberships the page said "Teacher view is available to verified school staff".

## View as: what was merged and removed (A, B, C)

- **One control:** a **View as** pill in the top nav, platform admins only.
  - At rest it reads "Viewing as: you ▾"; in View as, "Teacher · The Chase ▾", with People's role colour.
  - Its popover is the same component as the `/account` card: school search, roles, Start fresh, Recently viewed as, Back to me.
  - Platform's "Look at it as…" opens it pre-filled. `?peek=1` stays, for the Catalogue's frames only.
- **Wording:** "Trying VicData as" becomes "Viewing as", and "Exit" becomes "Back to me", everywhere.
- **Across tabs:** a session cookie, so View as lasts across tabs until Back to me or the browser closes. A new tab shows the banner from first paint. Platform admin is re-checked on every page and route.
- **One module:** `trial.ts`, `look-as.ts` and `teacher-route-access.ts` became `src/lib/view-as.ts`, and TryAsCard became one ViewAs component.
  - The bare `?lookAs=&as=` pair no longer starts anything.
  - The editor's separate look-as path is gone.
  - The log action is `view_as` with `{role, fresh}`.
- **The same as a real member,** except where personal state is saved (under the trial key) and no school-wide writes:
  - a trial can now save its own comparator sets. They're kept privately under the trial key, never shared with the school or seen by Guy as himself;
  - a School-Admin view can open People and Teams read-only ("View as: read-only" on saves).
- **The naming gap stays** (`trial_contexts`, `trial_key`, `~trial~`), so no migration was needed.

**Fidelity test:** headless, through the real route handlers, on live reference data, comparing View as with a stubbed real single-membership member. Each school/role covered the role home, Meetings, Recruitment, and GCSE and Post-16 at Candidates, every Results measure, every Context set and every Comparisons set, with the Current and Trends rows and every Comparisons view.

| School / role | Pairs | Identical |
|---|---|---|
| The Chase (137625) · Teacher | 77 | 77 |
| The Chase · SMT | 77 | 77 |
| Croydon College (130432) · Admissions | 77 | 77 (after a rerun of two 3×6 px timing flickers) |
| Acland Burghley (100053) · School-Admin | 77 | 77 |

- No route answered 4xx, and nothing was written to Guy's own rows or the school's.
- School-Admin read-only and set isolation: 20/20.
- Two memberships: 10/10.

## 01 — view titles, and the Customise audit

**Titles:** a view's own title from the editor now shows everywhere the view's title appears:
- the panel, and fullscreen (so print too);
- Copy this view, and meeting slots, which used to show raw `[brackets]`;
- the editor's previews, including History's Preview, and the rail tooltip.

Placeholders fill for each member's own context. With no override, today's titles are unchanged.

**Customise audit (final state).** Every field is saved on the view instance; Numbers, Years and Look by choosing which view.

| Field | Teacher page | `/dashboards/[id]` | Meeting slots |
|---|---|---|---|
| Numbers | ✓ | ✓ | ✓ |
| Years: single / trend | ✓ | ✓ | ✓ |
| Years: "from" year | Coming soon | Coming soon | Coming soon |
| Look | ✓ | ✓ | ✓ |
| Title | ✓ (now wired) | ✓ (now wired) | ✓ (now wired) |
| Roll forward | Coming soon (a dashboard always shows the latest year) | Coming soon | ✓ |
| Figures (round 3) | ✓ | ✓ | ✓ (now wired) |

Also fixed: on a dashboard, Customise used to let a Current panel's view become a trend view. That was saved and then silently dropped from the page; Customise now offers only views the panel can draw.

**Headless test per field** (edit, publish, Edit off, check the page):
- the title, on the page and in fullscreen;
- Look → Table opens on Sortable table;
- Numbers → Market share opens on the donut;
- a hidden figure is gone;
- the "Coming soon" fields are confirmed dotted.

## 02 — Context's rail and Compare against

**What the pre-0.6 page did:** it **never** changed Context's rail, opening view or disabled views with Compare against (checked at 5597757). Only the data, the labels and the Trend card's "focus vs group" for All subjects changed. So this is new behaviour, built so the defaults change nothing.

**One variant mechanism** (`src/catalogue/variants.ts`; round 3's Results filtering now sits on it):

| Axis | States | Applies to | Catalogue default |
|---|---|---|---|
| `results` | Average points / Grade 4+ / Grade bands / Grade counts | every panel on a Results dashboard | round 3's, unchanged |
| `compareAgainst` | category / whole / selected | Context panels | all three, for every view |
| `comparator` | chosen schools / ranking set | Comparisons panels | Number tiles: ranking only. Map, Trend map, Change map: schools only (as the host already does). The rest: both |

**In the editor:**
- Context gets its own **Compare against** pill beside the Results pill;
- **Show all views** dims what's not in the current state;
- **Show on…** has one checklist per axis;
- the default row reads e.g. **Make this the default for Grade counts · Selected subjects**.

**Headless walk-through:** in the editor, Trend table was narrowed to Selected subjects and made the default for Grade counts · Selected subjects, then published. On the page, Selected subjects opened on Trend table, and All subjects had no Trend table.

## Parity (members' pages)

All runs: renderer on, seeded published versions, 1280px, both themes, Current and Trends, against `main` at 1c5cc06.
- **A–C:** 40 pixel pairs and 20 rail dumps identical. The member home, GCSE, Meetings, Recruitment, People, Teams and `/account` were identical too (42/42).
- **After 01:** 40 pairs identical.
- **After 02:** every compare set × the four Results measures, plus Candidates, at Acland Burghley GCSE and King's Worcester Post-16: 120 pairs identical, and rails identical. This is "identical to before", not a restore of pre-0.6 behaviour.

Charts that measured themselves mid-layout were re-shot one at a time and matched, as in earlier rounds.

## Screenshots (`docs/v0.6/snag4_screenshots/`, light and dark)

- **A:**
  - the nav pill: `A-pill-rest-teacher`, `A-pill-rest-site`, `A-pill-viewas`;
  - `A-popover`, `A-banner`, `A-viewas-home`;
  - a second tab: `A-second-tab-first-paint`, `A-second-tab`;
  - `A-account-card`.
- **B:**
  - The Chase in View as: `B-chase-history-{page,map,graph,ranking}-viewas`;
  - `B-rootcause-before-viewas-dark` (the bug, before the fix);
  - `B-people-readonly`, `B-teams-readonly`.
- **01:** `01-title-on-page`, `01-title-fullscreen`, `01-customise-coming-soon`.
- **02:** `02-editor-both-pills`, `02-show-on-two-axes`.

## Logged

`docs/OPEN_QUESTIONS.md`, "2026-10-04 — 0.6 snagging round 4". The main calls:
- a cookie across tabs;
- a trial's comparator sets kept as Guy's own private notes rows under the trial key (a proper table later would be cleaner, but it needs a migration);
- School-Admin View as is read-only for shared data;
- a title override counts only when it differs from the template;
- the "Coming soon" fields;
- the comparator axis follows the page, with no pill;
- new editor views are tagged for Results only, never for a Compare against set.

## Click-through for Guy (after "Deploy live")

1. In the nav pill, pick **The Chase as Teacher**. Open GCSE · History · Average points, and try every Comparisons view (map, graph, ranking).
2. Switch to **SMT**, and open a second tab: the banner shows there too.
3. Turn **Edit** on, change a view's title in Customise, then **Preview draft** and **Publish**. With Edit off, the title shows on the page and in fullscreen.
4. In Context, switch **Compare against** and watch the rail. It's unchanged by default. In the editor, use Show on… to give a view to one set only, publish, and watch it follow the pill.
5. **Back to me**, then restore the original version from History and publish.
