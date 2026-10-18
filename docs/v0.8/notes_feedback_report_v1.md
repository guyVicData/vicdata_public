# VicData 0.8: notes on every view, captions into the (i), and a feedback system

This is the report on `docs/v0.8/vicdata_0_8_notes_feedback_claude_code_prompt_v1.md`, built on branch `v0.8-notes-feedback` from `main` at `f4814ac`. The calls I made are logged in `docs/OPEN_QUESTIONS.md` under "2026-10-18 — notes and feedback".

**Nothing has been written to any database.** The two migrations are written and tested in PGlite, for Guy to apply (§9). The merge waits until they are applied and one feedback item has made the round trip on the live database.

## 1. What changed, in one screen

**On every panel:**
- **(i) · note · feedback** at the bottom left; **flag · ⋯** at the bottom right.
- The **speech-bubble caption button is gone**. Its text is the **(i)'s first line, "What this shows"**, above the sources and "How it is calculated". Captions that only repeated the (i) are dropped.
- The header keeps full screen and the collapse slot only.

**Notes and feedback:**
- **A private note on every view**, not every panel. The icon is coloured (one shared token) when the view has a note.
- **A feedback icon on every view**, for platform admins for now. It is yellow when the viewer has open feedback on the view, green after "Looks good", and monochrome otherwise.
- The icon opens a **feedback window outside the panel**. On a desktop it docks right and the page gives it room; on a phone it is a bottom sheet. It works over full screen too, and stays open after Send.
- Each item records what was on screen. Its **Open** link reopens that view.

**New pages and files:**
- **`/platform/feedback`**: the inbox, with filters, triage, bulk status changes, Copy as Markdown and Coverage.
- **`feedback_for_triage`** and **`feedback_coverage`**: views for Claude, read-only.
- **`docs/FEEDBACK.md`**: the workflow.

## 2. Every caption: where its text went, or why it was dropped

The full table, view by view, is in `docs/v0.8/notes_feedback_caption_inventory.md`.

**Where the text went:** each view's caption moved to the top of its (i), as "What this shows". Full screen and "Print this graph" print it as "What this shows: …". Dynamic captions ("Mathematics has grown the most…") are computed as before and appear the same way.

**What was dropped:** only captions that said nothing the (i) didn't already say. Each drop has a comment in the code naming where its words already are.

| Product | Kept (moved into the (i)) | Dropped (only repeated the (i)) |
|---|---|---|
| SMT | 33 views | **O-FLAGS** (the method's steps give the rule), **A-BANDS** (the body and the method say it), **C-PROJECTION** (its generated method says both lines); also the not-ready or district state of P-AREA, C-MAP and C-BIRTHS ×3 |
| Groups | 17 views, plus the "this source is undated" line wherever it applies | the reading sentence on the 10 views whose method has the READING step (O-NOW, S-NOW, A-NOW, P-NOW, P-SHAPE, O-ROLL, O-RESULTS, A-TREND, A-POST16, P-ROLL); **S-TABLE**'s "missing are listed" |
| Admissions | 19 views, including the 4 judgement calls kept to be strict (P-MAP, P-TABLE, M-DONUT, M-MAP) | **M-NOW**, **P-FUNNEL**, **P-PIPELINE**, **M-BARS**, **M-TABLE** |
| Teacher | every computed sentence and empty-state line | the geography % change caveat (`pointsEligibleCaveat`, which the method states under "Left out") |
| Meetings and others | (none had a footer caption) | — |

Unchanged: the always-visible line under some panels (Admissions' LA context, the subject explorer link, Teacher's answer lines), which never was the caption button.

**Rules updated for the change:**
- R-SMT-NOTES and R-METHOD-PRESENT now name the "What this shows" line.
- R-SMT-VIEW-RESERVED says the band text is the body (no longer also the caption).
- The rule test's comment is updated.
- `docs/catalogue/*.md` is regenerated; only `rules.md` changed.

## 3. The footer on every product

Screenshots are in `docs/v0.8/notes_feedback_screenshots/`. Desktop is 1440 × 900; phone is 390 × 844 (the 358 px card).

| Product | Desktop light | Desktop dark | Phone light | Phone dark | Phone full screen |
|---|---|---|---|---|---|
| Teacher (GCSE, View as Teacher at Leighton Park) | `footer_teacher_desktop_light.png` | `…_desktop_dark.png` | `…_phone_light.png` | `…_phone_dark.png` | `…_phone_fullscreen.png` |
| SMT (View as SMT at Leighton Park) | `footer_smt_desktop_light.png` | `…` | `…` | `…` | `…` |
| Admissions (Market share, View as Admissions at The Chase) | `footer_admissions_desktop_light.png` | `…` | `…` | `…` | `…` |
| Groups (head office of Harris, no group account) | `footer_groups_desktop_light.png` | `…` | `…` | `…` | `…` |

**The layout, the same everywhere** (`src/components/shell/CardBox.tsx`, `PanelFooter.tsx`, `PanelIconRow.tsx`):
- Bottom left: the (i), the note, feedback, then a panel's own leading control (Trend's "Trend line").
- Bottom right: any flag, then the ⋯ menu. The menu now opens upward from the footer.
- In full screen, the footer has feedback and the menu, and the side rail keeps the note. In focus mode the footer also has the (i).

**The footer also appears on:**
- custom and member dashboards;
- meeting slides: feedback only, since their notes stay the slot's own (§4);
- the phone layouts.

**Without it:** KS2's boxes and Teacher's empty states, which have no rail, and the Data View, which doesn't use the shared footer. Neither has a caption button any more.

## 4. Note keys

| Where | `teacher_view_notes.school_urn` | `chart_key` |
|---|---|---|
| A view on any dashboard (Teacher, SMT, Admissions, custom, member) | the school URN; in View as, the state key `{urn}~trial~{role}` (as every per-user row) | `view:{dashboard id}:{panel id}:{view instance id}` |
| A view on a group dashboard | `grp:{group id}`; in View as `grp:{group id}~trial~head_office` | the same |
| A meeting slide (unchanged, left on its own) | the school URN | `meeting:{meeting id}:{view id}` |
| View as' saved sets and rankings (untouched) | `{urn}~trial~{role}~sets` | `set:{id}`, `ranking:{id}` |

- **Ids:** the dashboard id is the config's slug (e.g. `vicdata.smt.academic`). The panel and instance ids are the config's (e.g. `vicdata.smt.academic.c2.now`, `vicdata.smt.academic.c2.now/DV-SMT-A-SUBJECTS`).
- **The unflagged Teacher page** (no config renderer) maps its cards to the same ids through the code config's legacy keys, so a note is the same note under either renderer.
- **No schema change**; RLS is unchanged (`profile_id = auth.uid()`).
- **Notes are read once per page** (`ViewSurfaceProvider`).
- **A peek is read-only**: the pencil shows, disabled.
- **Migration `20261117090000`** deletes the 3 old per-panel notes. They are listed in its header, and §9 shows the read to run before applying it. It never touches the rows above, and a second run deletes nothing.

## 5. Feedback: table, setting, RLS and views (migration `20261117100000`)

**The setting:**
- `app_settings` holds one row per setting. `feedback_audience` starts at `"admins"`.
- `feedback_beta_testers` lists the named testers the `beta` setting lets in.
- `feedback_audience()` and `feedback_allowed()` are definer functions: `admins` means platform admins; `beta` adds the testers; `all` means anyone signed in. An unknown value counts as `admins`.
- Platform admins can read both tables. Nobody writes them through the API; Guy changes the setting in SQL.

**The items, `feedback_items`:**
- **Its number is F-{number}:** a generated identity. A refused insert uses up a number, so numbers can have gaps.
- **Recorded:**
  - who and when: `created_at`, `author_id`, `view_as`, `role`;
  - what was looked at: `product`, school (`school_urn`, `school_name`) or group (`group_id`, `group_ref`, `group_name`), the dashboard (`dashboard_id`, `dashboard_name`, `dashboard_version_id`: the published version drawn, or null for the code copy), the panel (`panel_id`, `panel_name`) and the view (`view_instance_id`, `dataview_id`, `view_label`, `view_key`);
  - the page: `state` (jsonb: subject, level, set, year, phase, filters and pills, per product), `page_path`, `page_query`, `app_version` (Render's commit), `device`, `viewport_width`, `theme`;
  - what the author said: `body`, `looks_good`, `kinds`, `importance`, `scope`, `applies_to`, `saw`, `expected`, `where_in_view`.
- **No screenshots.**
- **Triage fields:** `type`, `priority`, `status` (new, triaged, planned, done, won't do), `planned_version`, `resolved_commit`, `resolved_at`, `wont_do_reason`, `duplicate_of`, `triage_note`, `triaged_by`, `triaged_at`.
- **Checks:** an item needs text or "Looks good"; a school or group; chips from the allowed lists; and `duplicate_of` can't point at the item itself.

**RLS and triggers:**

| Action | Who |
|---|---|
| insert | `author_id = auth.uid()` and `feedback_allowed()`. A trigger makes the caller the author and starts every item as `new` with no triage. |
| select | the author's own items, plus every item for platform admins |
| update | platform admins only. A trigger refuses a change to anything but the triage fields, even through SQL, stamps who triaged and when, and stamps `resolved_at` when an item is marked done. |
| delete | nobody (no policy, no grant) |
| anon | nothing |

**The views** (`security_invoker`, so the caller's own RLS applies):
- **`feedback_for_triage`:** every field, with `ref` (F-12), the date and time in London, the author's name, `school_or_group`, the duplicate's F-number and `is_open`. The author's name comes through `feedback_author_name()`, which names only the caller themselves, for a platform admin anyone, or for the database's own role anyone.
- **`feedback_coverage`:** for each dashboard × view × school or group, the state (open beats looks good), the last "Looks good" and the last open item, with counts.

**The routes:**

| Route | Who | Does |
|---|---|---|
| `GET /api/feedback` | the person themselves | whether they may give feedback, and their own items: these drive the icons and the window's list |
| `POST /api/feedback` | the person themselves | sends one item, as the caller, so RLS decides; the server adds the app version |
| `GET` / `PATCH /api/platform/feedback` | platform admins only (anyone else gets "not found") | the inbox and the triage, with bulk changes |

The routes never count as usage.

**The icon's colours** (`feedbackColour`, `src/lib/view-ref.ts`):
- **Yellow:** the viewer has open feedback on this view, at any school. "Open" means more than a bare "Looks good", and not done or won't do.
- **Green:** a "Looks good" at this school, not yet done, and nothing open.
- **Yellow wins** when both apply.
- **Monochrome:** once every item on the view is done.

**The window** (`src/components/feedback/FeedbackWindow.tsx`):
- **What it holds:** the person's items on this view (F-number, date, school, status), then the form. The chips follow Guy's list.
- **Sending:** Send keeps it open and empty, with "Sent as F-12". Esc inside it, or ✕, closes it.
- **Desktop:** docked right. The page and any full screen give it its room, so the view is never covered. Dragging the header floats it, and it can then be resized; "Dock" puts it back.
- **Phone:** a bottom sheet, half the screen, as wide as the screen. The handle pulls it to 85% and back to half. The view is scrolled into the space above it.

## 6. What Open restores

The Open link is the recorded page and address, looked at through a **peek** (`?lookAs={school or group}&as={role}&peek=1`): read-only, never the View as cookie, never usage. It adds `fbPanel` and `fbView`: that panel opens, its rail switches to that view, and it is scrolled into sight and outlined for a moment. It also adds `fb=F-12`: a small banner shows the recorded state beside the page's, marking any value that differs.

| Product | Restored by the address | Shown in the banner only |
|---|---|---|
| Teacher | school and role (peek), dashboard (path), panel and view, a comparison set recorded as `?set=` (with its subject) | the subject otherwise, the Results pill, Compare against, a saved or ranking set, the year |
| SMT | school and role, dashboard, panel and view, level and subject area (`level`, `area`), Context's area and radius (`near`, `km`), a set recorded as `?set=` | a saved set, the pills, the year |
| Admissions | school and role, dashboard (`view=`), entry point (`entry`), panel and view | the day/boarding, pupils and sector filters, the rivals list, the year |
| Groups | group and role, dashboard, reading, compare, focus and school, panel and view | the weighting, the year |
| Custom dashboards | dashboard, school and role, panel and view | the subject, the pills, the year |
| Meetings | the meeting | the slide and view, the pinned settings |

In the browser tests, the item given in View as SMT at Leighton Park, on Academic with "Arts, Media & Design" chosen, reopens the same way: as SMT at Leighton Park, GCSE, that area, the large panel on that view, with the banner. No recorded value differed (`feedback_open_restores.png`).

## 7. The inbox, `/platform/feedback`

It is for platform admins only; anyone else gets "not found". It is linked from Platform.

- **Items:**
  - newest first;
  - **filters** by status (open statuses by default), type, priority, product, dashboard, school or group, and author, plus a search that also takes an F-number, and "hide bare Looks good".
  - **Each row opens** to everything recorded, an **"Open the view as it was"** button, and the triage form: type, priority, status with a planned version, commit or reason; duplicate of (by F-number); triage note.
  - **Tick rows** for a **bulk status change**, or **Copy as Markdown** (the ticked items, or all shown). Each item's Markdown carries its Open link.
- **Coverage:** every view of every catalogue dashboard (Teacher, SMT, Admissions), with a chosen school or group, marked looks good, open or unseen. Group dashboards, custom dashboards and meetings appear once they have feedback.

## 8. `docs/FEEDBACK.md`

It explains:
- who can give feedback (the setting);
- what an item holds;
- how Claude reads new items (two read-only queries on the views, after the project-ref check);
- how to propose a triage, which Guy confirms in the inbox;
- how to link items to the to-do list by F-number, using Copy as Markdown;
- how to close an item with the commit once the fix is deployed;
- the Coverage tab, for proofing.

## 9. What the privacy page should say about feedback (for the 0.12 static pages)

- **Who sees it.** Feedback is read by VicData's team (platform admins) only. It is never shown to your school, your colleagues or your group's head office.
- **What it records**, besides your words and the chips you choose: which page, dashboard, panel and view you were looking at; the settings on screen (subject, level, comparison set, filters); the page's address; the time; phone or desktop; light or dark theme; and the app version. It records no screenshot and nothing else from your screen.
- **It is separate from private notes.** Notes are yours alone; VicData's team can't read them.
- **It isn't usage.** Giving feedback is never counted in usage figures.
- **Retention and deletion.** Items are kept to track fixes. You can't edit an item once sent, but you can ask VicData to delete it. **This needs Guy's call:** the retention period, and how a deletion request is handled.

## 10. Checks and parity

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors (the 2 old warnings, `PeerTrendChart.tsx` and `SchoolMap.tsx`) |
| `next build` | clean |
| Unit (`src/**/*.test.ts`, `--test-force-exit`) | **508 / 508** (499 before + 9 new) |
| Catalogue unit tests | **77 / 77** (one test updated: it checked the retired per-panel note key, and now checks the per-view key and the legacy column keys the mapping still uses) |
| Rule tests (`catalogue-rule-tests.ts`, real data, read-only) | **107 PASS, 0 FAIL** (MANUAL 15, NONE 19, SUPERSEDED 4) |
| PGlite `v08_notes_feedback_pglite.mjs` | **39 / 39**: R-NOTES-MIGRATION, R-FEEDBACK-AUDIENCE, R-FEEDBACK-RLS, R-FEEDBACK-COVERAGE, and the notes' RLS half of R-NOTE-PER-VIEW |
| All 21 PGlite suites | all pass: `v06_rls`, `v07_admissions_rls`, `v08_usage_log`, `v08_groups_r1` 102/102, `v08_view_as_editing` 44/44, `v08_view_as_fixes` 20/20, and the three PostGIS suites (`PGLITE_DIR`, PGlite 0.5.5) among them |
| Browser (`docs/v0.8/audit_scripts/notes_feedback/notes_feedback.mjs`) | **34 / 34** on the final build. Earlier runs failed on test-side issues (Teacher's onboarding in the stub, three selectors, the (i)'s lazily loaded method) and on two real ones, fixed: a "Looks good" marked done kept the icon green, and the phone sheet took the page's width (the page itself overflows a 390 px phone by 45 px, which this round doesn't touch), not the screen's. |

**The new unit tests** (`src/lib/notes-feedback.test.ts`, 9):
- R-FOOTER-LAYOUT and R-CAPTION-IN-INFO, on server renders;
- R-NOTE-PER-VIEW;
- R-FEEDBACK-COLOURS;
- R-FEEDBACK-CONTEXT: the payload and the Open link;
- R-FEEDBACK-AUDIENCE: the real `/api/feedback` route against a stand-in Supabase.

**A bug the tests caught:** `feedbackMissing` read an RLS refusal (whose message names `feedback_items`) as "the migration isn't applied" (503). It now matches by error code only, and a refused item gets 403.

**Browser tests:** the same stub identity as the View as fixes round, plus in-memory stand-ins for the notes, onboarding and preference rows and for the feedback routes. Nothing is written. They cover:
- R-FOOTER-LAYOUT: 4 products, desktop and phone, the 358 px card and phone full screen;
- R-CAPTION-IN-INFO: SMT Overview, Admissions Market share, Teacher GCSE Results, a group view;
- R-NOTE-PER-VIEW;
- R-FEEDBACK-WINDOW: desktop, phone and full screen, open after Send, Esc;
- R-FEEDBACK-COLOURS;
- R-FEEDBACK-CONTEXT: every field, and Open;
- R-FEEDBACK-AUDIENCE: no icon;
- usage: none.

**Parity against `main` (`f4814ac`): no figure changed.** Every difference is one of the allowed changes: the footer, the header icons, and the caption moving into the (i). The fixtures were byte-identical between the two trees in every harness, and nothing was written to any database.

| Harness | Pairs | Identical | Allowed changes only | Noise | Unexpected | Failed |
|---|---|---|---|---|---|---|
| Teacher (panel views) | 2,875 | 0 | 2,875 | 8 PNG | 0 | 0 |
| Public page SSR (137625, 117037) | 2 | 2 | — | 0 | 0 | 0 |
| SMT dashboards and homes | 156 HTML + 156 PNG | 8 PNG | the rest | 0 | 0 | 0 |
| SMT group sets | 84 + 84 | 0 | all | 0 | 0 | 0 |
| SMT subjects | 16 cells | 16 | — | 0 | 0 | 0 |
| Admissions | 328 HTML + 328 PNG, 48 JSON | 48 JSON | 328 + 328 | 0 | 0 | 0 |
| Groups dashboards (fixtures) | 88 + 88 | 0 | all | 0 | 0 | 0 |
| Data View | 60 files | 60 | — | 0 | 0 | 0 |

**Teacher, how "allowed only" was confirmed:**
- **The panel text** is the same once the footer's own tokens are taken out. On 1,546 Trends panels, the only change is that "Trend line" now sits after the (i).
- **The (i)** is exactly "What this shows" + main's caption + main's (i) text. The one exception is the 46 views whose dropped caption is the geography caveat; their (i) is otherwise unchanged.
- **There is no caption control.**
- **The pictures:** 2,867 of the 2,875 change only in the header icon band and the footer band.

**SMT, Admissions and groups:** the HTML was compared with the footer and header-icon buttons, the (i) popover and the caption lines taken out.
- **What is identical:** every page's text, chart SVG and table (156/156, 84/84, 328/328, 88/88).
- **The pictures:** none changed size, and at most 0.43% of pixels differ. All of the change is in the header icon slot or the footer.
- **Knock-ons of the icon row losing a slot:**
  - Admissions' Pipeline header chips sit about one slot further right.
  - A truncated header line on the SMT and group phone pages shows a few more characters.
  - Flags sit left of the footer's menu.

**Noise:** 8 Teacher pictures differ inside the figure area: six maps at 390 px, and the Post-16 bands sortable table at 1280 px dark (two pairs).
- **Same content:** the text is equal, and no shift of up to ±4/±6 px reproduces either image.
- **What it is:** every glyph edge in the panel, the title included, is re-drawn a fraction of a pixel off. That is the same content at a sub-pixel offset: the panel's fractional position after the footer and header change.
- **The base is stable:** main's own shots match its two earlier runs exactly.

**Also seen:**
- **One unanswered request per branch page:** the new `/api/feedback` read, which the Teacher harness's stub doesn't answer. Members never see the icon either way.
- **One branch-side error:** the known `SchoolMap` unmounted-map race, in a file this branch doesn't touch, seen before on either side.
- **Edits during the run:** the parity bundles were built while I was still changing three files on the feedback path: the phone sheet width, the done-items colour rule, and `docs/FEEDBACK.md`. None of them touches a figure, and members never see the feedback icon.

## 11. Guy's commands, in order

**1. Look at what the notes migration will delete** (read-only). Expect the 3 old notes: 100053 `ks4:results:Biology`, 100053 `ks5:results` and 137625 `ks4:candidates`.
```
cd ~/dev/vicdata_public_notes && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked "select school_urn, chart_key, updated_at::date from teacher_view_notes where school_urn !~ '~sets\$' and chart_key !~ '^(view|meeting|set|ranking):' order by 1, 2"
```

**2. Apply both migrations, record them, and check.** Both are safe to run twice.
```
cd ~/dev/vicdata_public_notes && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261117090000_v08_notes_per_view.sql && supabase db query --linked -f supabase/migrations/20261117100000_v08_feedback.sql && supabase migration repair --status applied 20261117090000 20261117100000 --linked && supabase db query --linked "select (select count(*) from teacher_view_notes where school_urn !~ '~sets\$' and chart_key !~ '^(view|meeting|set|ranking):') as old_notes_left, (select value #>> '{}' from app_settings where key = 'feedback_audience') as audience, (select count(*) from feedback_items) as items, (select count(*) from feedback_for_triage) as triage_rows, (select count(*) from feedback_coverage) as coverage_rows"
```
Expect `0 | admins | 0 | 0 | 0`.

**3. The round trip on the live database, before merging.** Run the branch locally against the live database, signed in as yourself:
```
cd ~/dev/vicdata_public_notes && npm run dev
```
Open `http://localhost:3000`, sign in, and use View as → Leighton Park → SMT → Academic. Choose a subject area. Click a view's feedback icon (the speech bubble with "!"), write one line, and Send. The icon turns yellow. Then read it back:
```
cd ~/dev/vicdata_public_notes && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked "select ref, created_london, author_name, view_as, role, product, dashboard_name, panel_name, view_label, school_or_group, state, page_path, page_query, app_version, device, theme, body, status from feedback_for_triage order by created_at desc limit 3"
```
Tell me when it's there, and I'll check it read-only. You can leave the item, or mark it "won't do" in the inbox as a test.

**4. Merge** (only after steps 2 and 3):
```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-notes-feedback -m "0.8 Notes on every view, captions into the (i), and a feedback system" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```
If the push is refused, push the branch with `git push https://github.com/guyVicData/vicdata_public.git v0.8-notes-feedback` and tell me; I'll give you the commands from there.

**5. Deploy on Render** (manual deploy of `main`). Then on the live site:
- every panel's footer reads (i) · pencil · feedback … ⋯, with no speech bubble;
- the (i) opens on "What this shows";
- a note on one view of a rail isn't on the other views;
- feedback round-trips, and the inbox at `/platform/feedback` shows it.
