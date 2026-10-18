# VicData 0.8 — Panel footers, notes on every view, and a feedback system

Claude Code prompt for the app repo (`~/dev/vicdata_public`), app database `lnhulykjlxmoneappnsp`. Written 18 Oct 2026 from Guy's decisions the same day. **Run before Guy's 0.85 site review:** the feedback system is the tool he'll use for it.

## What's there now (read 18 Oct)

- **The panel footer** (`src/components/shell/PanelFooter.tsx`, used by `RailPanel` and Teacher's `CardBox`) holds three things:
  1. **(i)** `SourceNote`: sources, plus "How it is calculated".
  2. **The speech bubble** `CaptionNote`, "What this shows": a caption written in code, per view (`src/catalogue/notes.ts` and the dashboards' `captionOf` and caption text). It isn't a note. Many captions have grown into method text that repeats the (i), e.g. SMT Overview's "XS to XL: this school's pupils in each phase…".
  3. **The pencil:** the private note (`fetchNotes` and `saveNote` in `src/lib/teacher-view-data.ts`, table `teacher_view_notes`, keyed by profile, school and `chart_key`). It's on Teacher panels and meeting slides only, and keyed **per panel**, so all views in a panel share one note.
- **The three-dots menu** sits in the top icon row on many panels, left of full screen. The footer's right-hand side holds the "flag" on some views.
- `teacher_view_notes` holds **3 notes** (2 people, September 2026). The same table also carries View as' comparison sets, under `~sets` keys. **Those must not be touched.**

## Decisions (Guy, 18 Oct)

### 1. Retire the captions; their text moves into the (i)

- Remove `CaptionNote` and the speech-bubble button **everywhere**: Teacher, SMT, Admissions, groups, Data View, meetings, the editor's preview, the phone layouts.
- **Each view's caption text goes to the top of its (i),** as a short "What this shows" line, above the sources and "How it is calculated".
  - Where the caption only repeats what the (i) already says, drop it, and list it.
  - Dynamic captions (e.g. "Mathematics has grown the most…") keep being computed and appear in the (i) the same way.
- "Print this graph" and fullscreen, which print the caption today, print the (i)'s "What this shows" line instead.
- Retire or update every rule that names the caption (search `caption`, `visibleCaption`, `CaptionNote`, `captionOf` and the rules catalogue), and regenerate `docs/catalogue/*.md`.

### 2. The footer layout, on every panel

- **Bottom left:** (i), then the note, then feedback (item 4).
- **Bottom right:** the three-dots menu, moved down from the top icon row. Any "flag" sits just left of it.
- **The top icon row** keeps full screen (and the reserved collapse slot) only.
- The same on phone: check the 358 px card and fullscreen.

### 3. Private notes on every view

- **A member's note attaches to one view in a panel's rail, at their school.** It's simple on purpose; Guy will extend notes later.
  - The key: dashboard (stable id or slug), panel id, the view instance's id, school.
  - Every view in every rail has the note control: Teacher, SMT, Admissions, the group dashboards, custom VicData and member dashboards. Also the Data View's views, if they use the shared footer; if they don't, list them.
- **The note icon is in colour when a note exists, and monochrome when not.** One shared token, in light and dark.
- Notes stay private to their author, under the same RLS as today (`profile_id = auth.uid()`).
- In View as, notes keep going under the trial key, as now.
- **Meeting slides' notes** keep working. Map their keys to the new scheme, or leave them on their own; say which.
- **Delete the 3 existing notes** (Guy). That's a migration that deletes `teacher_view_notes` rows that are notes, by key pattern. It must never delete the `~sets` rows View as uses. List what it will delete before it runs, and make it safe to run twice.

### 4. Feedback: the start of a feedback system

**Purpose:** Guy (later beta testers, then all users) gives feedback on any view as he goes. Each item carries enough context that whoever triages can find exactly what it's about. Claude reads the items, proposes a triage, and turns them into the to-do list. Over time, items are triaged into fixes, feature requests and so on, and closed when shipped.

- **The icon:** a **separate feedback icon** on every view in every rail, next to the note, distinct from it (e.g. a speech bubble with "!", now the caption bubble is gone).
  - **During build and pre-launch it changes colour** (below).
  - Its popover lists that person's items on the view (date, school, status), above a box to add a new one.
- **The colours (Guy, 18 Oct):**
  - **yellow:** the viewer has open feedback on this view;
  - **green:** the viewer has marked it "Looks good", and has no open feedback on it;
  - **monochrome:** neither.

  If both apply, yellow wins.
- **The form sits outside the panel (Guy):** a feedback window that **doesn't cover the view**, so the data stays visible while writing.
  - **Desktop:** a floating window that can be dragged and resized, docked to the right by default, and stays open while scrolling. Its header names the view it's about.
  - **Phone:** a bottom sheet that can be pulled down to half height.
  - It works in fullscreen too.
  - It stays tied to the view it was opened from. "Send" keeps it open, emptied, for the next item; Esc or ✕ closes it.
- **Entry fields (Guy, 18 Oct).** All optional one-tap chips, except that an item needs text or "Looks good":
  - **What kind** (tick any): wrong figure · wording or label · layout or look · something missing · broken or slow · idea or feature · question · **looks good**;
  - **"Looks good" alone, with no text,** is a valid item: it records the view as checked at that school, and turns the icon green;
  - **how much it matters:** before the demo · should fix · nice to have;
  - **scope:** this school only · every school · not sure;
  - **applies to:** this view only · all similar views;
  - **for "wrong figure":** two short boxes, "I see…" and "I expected…";
  - **where in the view** (optional): the title, figure, chart, table, legend, (i) text, or pills and chips.

  The author's chips are hints. The triage fields below are set separately, when Guy confirms a triage, so both are kept.
- **Recorded automatically, as well:**
  - **the app version:** the deployed commit, e.g. from Render's `RENDER_GIT_COMMIT` exposed at build time, or a build id;
  - **phone or desktop** (viewport width);
  - **light or dark theme.**
- **Coverage, for proofing:**
  - a `feedback_coverage` view: for each dashboard × view × school, the latest state (looks good, open, or none), with dates;
  - a coverage tab in the inbox, so Guy can see which views on which dashboards and schools he has checked, and which are unseen.
- **Who can give feedback:** one setting, read by the server, with three values:
  - `admins`: platform admins only. **Now.**
  - `beta`: platform admins plus named beta testers (0.14).
  - `all`: every signed-in member (launch).

  A non-admin never sees the icon while the setting is `admins`.
- **Each item records automatically:**
  - **date and time;**
  - **the author,** and whether in View as;
  - **what was being looked at:** the school or group; the role viewed as; the product and dashboard (id, name, published version id); the panel and the view (instance id, dataview id, label);
  - **the state:** the subject, level, comparison set, year, phase and any filters or pills;
  - **the page address** (path and query);
  - **the text.**

  **No screenshots** (Guy).
- **Triage fields** (platform admins only):
  - **type:** fix, data question, wording, design, feature request, praise, other;
  - **priority:** high, normal, low;
  - **status:** new → triaged → planned (with `planned_version`, e.g. "0.85") → done (with `resolved_commit` and date) → or won't do (with a reason);
  - **links:** `duplicate_of` another item, and a triage note.

  Each item gets a short human number, e.g. **F-12**.
- **Reopen the exact view:** each item has an **Open** link that goes to the page and restores the recorded state, wherever the page can take it in the address (school or View as, dashboard, panel, view, level, subject, set). Where some state can't be restored that way, open the page and show the recorded state in a small banner. List which pieces restore and which don't.
- **An inbox page for platform admins** (`/platform/feedback`):
  - filters by status, type, priority, product, dashboard, school and author;
  - the newest first;
  - open, triage, mark as duplicate, bulk status changes;
  - "Copy as Markdown" for a selection.
- **For Claude** (reading the app database read-only):
  - the views `feedback_for_triage` and `feedback_coverage`;
  - `feedback_for_triage` with readable names (dashboard name, panel name, view label, school or group name, author name, date and time) and every field above;
  - `docs/FEEDBACK.md`, explaining the workflow: how to read new items, propose triage, link items to the to-do list by F-number, and close them with the commit once a fix is deployed.
- **Privacy:**
  - members' feedback is read only by platform admins, never by their school or group;
  - it's separate from private notes;
  - it's never counted as usage;
  - say in the report what the privacy page should add about feedback (for the 0.12 static pages).
- **Storage:** a new table (e.g. `feedback_items`) in the app database, by migration, with RLS:
  - insert: the setting allows the author, and `author = auth.uid()`;
  - select: the author's own items, plus all items for platform admins;
  - update of the triage fields: platform admins only;
  - authors can't edit an item once sent. They add another.

## Tests

- **R-FOOTER-LAYOUT:** every panel has (i), note and feedback bottom left and the menu bottom right; no caption control anywhere; on phone too.
- **R-CAPTION-IN-INFO:** for a sample of views (SMT Overview, Admissions Market share, Teacher GCSE Results, a group view), the old caption's text, or its listed reason for dropping, is in the (i).
- **R-NOTE-PER-VIEW:** two views in one rail hold different notes; the icon colours only on the view with a note; another member can't read it; in View as the note goes under the trial key.
- **R-NOTES-MIGRATION:** in PGlite, the 3 notes are deleted and `~sets` rows are untouched; running it twice does nothing more.
- **R-FEEDBACK-CONTEXT:** an item given in View as SMT at Leighton Park, on the Academic dashboard with a subject area chosen, records every field above, and its Open link restores that state.
- **R-FEEDBACK-AUDIENCE:** with the setting at `admins`, a non-admin sees no icon and the server refuses their insert.
- **R-FEEDBACK-COLOURS:** the icon is yellow after feedback is given, green after "Looks good" alone, yellow when both apply, and monochrome once every item on the view is done.
- **R-FEEDBACK-WINDOW:** the form opens outside the panel, without covering the view (desktop, phone and fullscreen), and stays open after Send.
- **R-FEEDBACK-COVERAGE:** `feedback_coverage` reflects a "Looks good" and an open item on two views at two schools.
- **R-FEEDBACK-RLS:** a member reads only their own items; only platform admins update the triage fields.

## Ground rules

- **Branch `v0.8-notes-feedback` from current `main`, fetched over HTTPS.** Commit this prompt first. Work in a worktree if the checkout is in use.
- **These must be clean:**
  - tsc, eslint and build;
  - the unit, rule, RLS and usage-log tests;
  - every parity harness.

  **Allowed differences:** the caption controls removed and their text in the (i); the footer layout; the note and feedback icons. Figures never change.
- **No database writes.** The migrations (the feedback table, view and setting, and the notes deletion) are written and tested in PGlite, and Guy applies them.
- **Never put a server key in client code.** Stage files by name. Push over HTTPS.
- **Log calls** under "2026-10-xx — notes and feedback" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/notes_feedback_report_v1.md`. Include:
- every caption, where its text went or why it was dropped;
- the footer on every product (screenshots, light and dark, desktop and phone);
- the note keys;
- the feedback table, view, RLS and setting;
- what Open restores;
- the inbox;
- `docs/FEEDBACK.md`;
- **Guy's commands, in order:** the migrations, then the merge, then the Render deploy.

**Merge only after Guy has applied the migrations** and the feedback round-trip has been tried on the live database (give one item, read it back through `feedback_for_triage`):

```
git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-notes-feedback -m "0.8 Notes on every view, captions into the (i), and a feedback system" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

If the push is refused, give Guy the command.
