# VicData 0.6 — Scope & brief: User roles, Dataset chooser, Dashboard editor (v1)

*Source: Guy's brief "Stage 0.6 builds — 3 NEW components" (Fri 2 Oct 2026). This document scopes it against what's already real in `vicdata_public`, settles the shared object model all three components hang off, lists the decisions still open, and sets out the four-step process: **(1) wireframe → (2) overnight branch build → (3) test → (4) merge.***

*Codebase claims below come from earlier briefs and build reports, not from a fresh read of the repo. Round 8 showed that briefs can get this wrong (notes and Meetings were both already built). So every "exists today" claim here is something Stage 0 of the build checks first, not a fact to build on.*

---

## 0. The one architectural move that 0.6 actually is

All three components depend on one change that isn't on Guy's list: **a dashboard stops being React code and becomes data.**

Today each Teacher dashboard is hand-built: `page.tsx` wires `CandidatesPanels` / `SubjectPanels` / `ComparisonsPanels` into `DashboardGrid`. Each panel's views are a local enum switched in a `body`, and the rail comes from the `actions` array in a `PanelRender`. Nothing about that layout can be edited, copied or assigned without a code change.

0.6 needs:

1. **A dashboard config format**: versioned JSON describing layout, rows, panels and dataviews, stored in Supabase.
2. **A dataview registry**: every existing view (bar chart, ranked list, trend map, donut, number tiles…) wrapped as a registered entry with a declared parameter contract and declared capabilities.
3. **One generic renderer**: config + registry → the dashboard you see today.

Once that exists:
- The **editor** is a UI that writes config.
- The **dataset chooser** is a faceted filter over the registry's declared capabilities.
- **Roles** decide who can read and write which configs.
- **Meetings** are the same config with a fixed 16:9, non-scrolling slide layout (§7).

**This is also the biggest risk in 0.6.** Re-expressing the four live dashboards as config has to reproduce them exactly. They carry a lot of hard-won detail: titles, qualification gating, comparator wiring, fallbacks, min counts. Section 6 covers how the build protects that.

---

## 1. Object model and glossary

From the outside in:

| Object | What it is | Today's nearest equivalent |
|---|---|---|
| **Dashboard group** | Dashboards linked together. Generates the top-bar view switcher (e.g. Candidates ⇄ Results). | The Candidates/Results toggle in the shared control bar |
| **Dashboard** | Name, colour, icon, kind (`dashboard` \| `presentation`), owner scope, layout, rows | One of the 4 Teacher dashboards |
| **Layout** | Column grid (1–4 tracks, optionally unequal), column headers, accordion behaviour | `DashboardGrid`'s grid template |
| **Column header** | Title, icon, *default* data source, *default* compared-to set. Panels below it inherit these. | Column heads (Candidates / Context / Comparisons) plus their pills |
| **Row** | Named, accordion, 1–4 cells (spans allowed), **Time** setting: latest year / over time / either. Default open. Unlimited rows; dashboards scroll | Current (latest year) / Trends (over time) |
| **Panel** | A cell. Inherits the column's data source and compared-to unless overridden. Holds an ordered list of dataviews shown via the rail. | One `PanelRender` (e.g. Column 2 × Trends) |
| **Dataview** | One registry entry plus its parameters, title template and rail icon. Can also be a **placeholder** (§4.6a) | One item in the action rail |
| **Slide** (meetings only) | Title, speaker notes, auto or chosen layout, up to 6 slots; each slot holds one fully pinned dataview, with no inheritance | A Meetings slide |

**Inheritance rule (the "apples with apples" default):** Column header (data, focus, compare) and row (time) → Panel → Dataview. The full matching rule and the edge cases (spans, column changes, area-keyed data, phase per column) are in `vicdata_0_6_add_a_view_combinations_v1.md`. Each level shows its own setting, marked *inherited* or *overridden*. Overriding is always allowed, and that's how you put apples next to oranges.

---

## 2. Component A — User roles

### Roles

| Scope | Role | Can |
|---|---|---|
| Platform | **Super-admin** (Guy) | Everything. Edits VicData-defined dashboards, assigns dashboards to roles, per-school toggles (subsumes the VC Sets toggle), the existing role/school preview switch |
| School | **School-Admin** | Sets up the school's users. Assigns roles (several per person). Creates and manages teams (groups/departments). Shares dashboards with teams |
| School | **SMT** | Role-assigned dashboards + own custom views |
| School | **Teacher** | Role-assigned dashboards + own custom views. Still the self-select default on join |
| School | **Admissions** | Role-assigned dashboards + own custom views |

### What this round settles (carried from `user_roles_multi_role_and_parent_context_notes_v1`)

- **Roles become a set per person per school** (Decision 1 from that note, already agreed). Head + teaches Maths = SMT + Teacher. 0.6 does the schema migration from a single value to a set.
- **Super-admin becomes a real platform-scoped role** in the RLS layer. Today every RLS helper is school-scoped (`is_admin_of_school_account` etc.). The comparator-chooser round worked around the VC Sets toggle with a service-role path, and the internal "system admin" preview switch is a separate path again. 0.6 replaces both with one checkable `is_platform_admin()`, audited, and with no school able to reach it.
- **Teams** generalise the 1.1 "departments" design (Teacher view brief §4). They are many-to-many, per school and School-Admin managed. "All staff" and "SMT" can exist as system teams derived from roles, alongside named teams (Maths dept, Year 11 team…). In 0.6 teams are a sharing target only. HOD rename/roster is not part of this round.
- **Parent context stays out**, and so does the hard wall in Decision 3 of that note. Nothing in 0.6 may build a school-admin query path that could later reach a person's non-employment activity.

### Screens

- School-Admin **People**: list, role chips (multi), invite, remove.
- School-Admin **Teams**: create, rename, delete, members.
- Super-admin **Platform**: school list → per-school toggles; role assignment for VicData dashboards (that part sits in the editor's Assign dialog, §4.6).

---

## 3. Component B — Dataset chooser

### The principle (Guy's, restated as a build rule)

**It's a chooser, not a stats package.** Every option a user can reach must lead to at least one registered dataview. The chooser is a stepped, faceted filter over the registry. At each step, options that can't lead to a registered view are never offered. Where nothing at all is built, Pick shows its empty state (loosen a choice / Ask for this view / super-admin placeholder, §4.6a). When a new view is coded, it gets registered and the chooser offers it automatically.

### Registry entry (contract)

```
id, label, railIcon,
component,                      // the existing React view, wrapped
supports: {
  data:        [...],           // rolls | academic.results | academic.candidates | social.births
  focus:       [...],           // school-keyed data: school | subject_area | custom_area | subject | my_subjects · area-keyed data: around_school | la | region | national
  comparedTo:  [...] | null,
  numberType:  [...],           // counts: totals | pct_change | market_share | index100 · averages: points | change_points · rates: rate | change_pp
  dateMode:    [...],           // single | trend (matched against the row's Time)
  viewType:    one of numerical | donut | graph | map | ranking | table
},
params: typed contract (what the component needs: subject, category, set, years…),
defaultTitle: template with placeholders,
requires: e.g. "3+ years" for trend, qualification-type comparability
```

### The flow: usually one step (revised 3 Oct, after wireframe review)

Guy: "The easier it is the better." The six steps are now **three, and most users see only the last one**, because every panel already inherits data, focus and compared-to from its column.

**"Add a view" opens on step 3**, with the column's choices shown in one summary line and a "Change" link.

- **Step 3: Pick a view.** A list of *ready-made* dataviews from the catalogue that match the current choices. Each card has:
  - a dark mini thumbnail;
  - the title, already resolved, e.g. "Maths (General) points against 10 nearest schools, since 2021/22";
  - a meta line, e.g. "Graph · change since 2021/22 · on GCSE Results".

  **Familiar views first** (Guy, 3 Oct: many users will just re-bundle views they already know). Order:
  1. **Familiar:** views that sit in the matching panel of a default VicData dashboard;
  2. other views on VicData dashboards;
  3. **Also fits:** everything else that matches.

  Each familiar card says where it lives ("on GCSE Results, Comparisons").

  A second tab, **Browse VicData dashboards**, shows those dashboards as a mini map, so people can pick views from where they already know them. It doesn't filter by the column's settings: anything taken from there that doesn't match the column comes in marked "overridden", as with Copy this view.

  Pick one, then **Add to panel**: the title fills in by itself. This covers most use.
- **Customise** (only if wanted) is a single screen that replaces old steps 4–6 plus the preview, borrowing the comparator chooser's "adjust ranking" screen. It has:
  - a live preview;
  - three filter boxes: **Numbers**, **Years** and **Look**;
  - the title with placeholders.

  Options that don't apply to the measure stay dotted and can't be picked (e.g. count-only types for an average). Touching anything **forks it into a custom view**, the same mechanism and banner as a ranking forking into a custom ranking set. "Back to ready-made" undoes it.
- **Steps 1–2, only via "Change":**
  - **These screens carry many options, so they're visually grouped** (Guy, 3 Oct):
    - Step 1 shows data families as cards. Only the picked family opens, with one decision per band: phase → measure → which result.
    - Step 2 has two numbered blocks: (1) which part of school, with the subject's follow / always choice nested beneath; (2) compare with something, a switch, opening into sub-bands for other schools, averages and other subjects. Other schools shows only the current set plus "Choose other schools…", not the whole comparator list.
  - **Step 1: Data.** In VicData terms, with Results sub-measures as the existing pill.
  - **Step 2: Focus.** Two chip rows (in school / beyond school), plus a **"Compare with something" tickbox**, unticked by default. Ticking opens the compare choices inline: other schools, averages, other subjects here.
  - **Sub-screens appear only when chosen.** These are 2a (subject picker), 2b (custom area) and the comparator chooser, opened by picking a dotted chip.

**Roll forward**: on by default, so a view's "latest" year moves when new data lands. Turning it off pins the year.

**Pruning rule unchanged**: nothing is offered unless a registered dataview exists for it. The Pick list *is* the registry, filtered.

**Style**: same visual language as the existing pickers (comparator chooser hub/adjust, onboarding subject picker), reusing their components; phone width first.

---

## 4. Component C — Dashboard editor

v1 user: **super-admin only.** The model and permissions are built for School-Admin and user editing from day one; only the UI entry point is gated.

### 4.1 Editor chrome
A **discrete, collapsible top menu**, visible only to super-admin: Edit · Save · Save as · Rename · Delete · Assign · Exit edit. In edit mode, every layout element gets hover affordances (add, rename, copy, delete, move). Out of edit mode, the dashboard looks exactly as it does to any user.

### 4.2 Dashboard settings
- Name.
- Colour from the standard keys (GCSE, Post-16, …), with an override.
- Kind: `dashboard` or `presentation` (meetings, §7.5).
- **Linked dashboards**: join a group. Group order sets the top-bar switcher order (Candidates ⇄ Results).

### 4.3 Layout
- **Presets** shown as icons (wireframe these): 1 · 2 equal · 3 equal (today's) · 4 equal · 2:1 · 1:2 · 1:1:2.
- **Custom**: set the number of columns, then rows.
- **Accordion behaviour**, set per layout: *auto-close others* (one row open at a time) or *independent*.
- **Column headers**: title, icon, default data source, default compared-to. Sources and compared-to are chosen with the dataset chooser's steps 1–3.

### 4.4 Rows
- Add a row with 1–4 cells and spans, picked from the same email/CMS-style structure icons.
- Name, rename, copy, delete, move up/down.
- Accordion default: open.
- **Time**: latest year / over time / either. This filters what "Add a view" offers in that row. Current and Trends default to the first two; a new row defaults to either.
- Unlimited rows; the dashboard scrolls (§7.2).

### 4.5 Panels
- Create, name, edit, delete, move.
- A panel inherits its data source and compared-to from the column it sits in, with an inherited/overridden badge. Users can add, edit or override.

### 4.6 Dataviews
- Add, edit or delete via the dataset chooser.
- Reorder in the rail.
- **Move to another panel** on the same dashboard.
- **Copy to another dashboard or meeting**: see **Copy this view**, §7.4. It replaces the two disabled Export options round 8 shipped.

### 4.6a Placeholders (added 3 Oct: skeleton → code → refine)
Where Pick has nothing, super-admin can **add a placeholder**: a description, a rough shape and notes, saved with the panel's exact context. It shows as a dashed "Planned" panel, visible only to super-admin. **Export planned views** turns all of a dashboard's placeholders, plus users' "Ask for this view" requests, into a list that becomes the next Claude Code brief. When a new `draft` view matches a placeholder's context, the panel shows **Ready to swap in**. Full flow: `vicdata_0_6_add_a_view_combinations_v1.md` §6.

### 4.7 Save, ownership and sharing
| Who | Can save to | Visible to |
|---|---|---|
| Super-admin | VicData dashboards | Assigned **roles** (all schools) |
| School-Admin | School dashboards | Assigned **teams** at that school |
| Any user | Own custom views | Self only |

"Save as" always creates a new dashboard and never overwrites. Assigned dashboards are **live**: recipients see edits. A user who wants to change one does Save as, which makes a personal copy (see D5).

### 4.8 Versions and drafts (added 3 Oct)
A dashboard's config is small JSON, so versions cost almost nothing. This follows the same immutable-snapshot principle as ingest.

- **Every Save makes a new version.** Versions are never overwritten. Each records who, when, an optional label ("before Trends pass") and a generated change summary ("Added *Maths points vs 10 nearest* to Comparisons · Trends; renamed row").
- **Drafts vs published:**
  - Editing works on a **draft**, autosaved as you go.
  - People a dashboard is assigned or shared to see only the **published** version until you press Save (publish).
  - So you can rework a live VicData dashboard without teachers seeing it half-done.
- **History panel** in the editor bar: a list of versions, with these actions on each:
  - **Preview** (read-only, real data);
  - **Restore** (creates a new version, so restoring is itself undoable);
  - **Compare with current** (the change summary).
- **Applies to meetings too**, and to placeholder panels.
- **Separate from view changes in code:** dataview and rule changes still go through the catalogue changelog. A dashboard version records *which* views it holds, not their code.
- **Retention:** VicData and school dashboards keep every version; personal ones keep the last 30.

### 4.9 Icons and the library
- Each dashboard and meeting gets a **coloured icon** made from one of three sources: a dataview thumbnail, an icon from the standard set, or an uploaded image (see D8).
- New **Dashboards** and **Meetings** library pages (meetings with an Archive tab): an icon grid, filterable by colour/phase and by owner (VicData / School / Mine).

### 4.10 Role home pages (added 3 Oct)
SMT and Admissions get home pages like Teacher's. Every role home has the same four kinds of tile:
- **key dashboards** for that role: Teacher has GCSE and Post-16; SMT and Admissions get theirs once they're built after 0.6, via skeleton → code → refine;
- **Dashboards** (the library);
- **Recruitment**;
- **Meetings** (showing the next one).

**The role switch appears only for people a School-Admin has given more than one role** (e.g. SMT + Teacher, because they manage and teach). Single-role users never see it and can't reach other roles' homes. This is the "lens switcher" from the multi-role decision.

**SMT reaches academic data top-down** (Guy, 3 Oct): from whole-school overviews, down through subject areas, to individual subject performance. That's the opposite of Teacher's subject-first route. It shapes SMT's key dashboards, which are built after 0.6. Until SMT and Admissions key dashboards exist, their homes show an empty "key dashboards" tile. Which dashboards appear as key tiles is set by "Key VicData dashboard" in Assign (§4.7).

### 4.11 Navigation
The existing home → phase tile → onboarding → dashboard path (≈4 steps) is kept **only for VicData-defined key dashboards**. School-shared and personal dashboards are reached from the library pages, not added to home-screen navigation.

---

## 5. Make the 4 Teacher dashboards editable

GCSE Candidates · GCSE Results · Post-16 Candidates · Post-16 Results become four VicData-owned dashboard configs in two linked groups (GCSE, Post-16). Each group's switcher replaces today's Candidates/Results toggle.

Things the config must carry that are easy to miss:
- the Results sub-measure pill (APS / Grade 4+ / bands / counts)
- Context's compare-against pill (category default)
- Comparisons' compared-against set
- view titles and their fallbacks
- the Current/Trends row tags ("Current" + "Data 2024/25")
- qualification-type gating
- Post-16's AS/AEA exclusions and min-count rules
- the column-row alignment spacer
- notes keys (`chart_key`)
- per-user `teacher_view_preferences` state
- each row's Time (Current = latest year, Trends = over time)
- Column 1's "against the wider system" views, seeded as a marked panel override (combinations doc F2), until your Trends pass moves them

Existing personal notes and preferences must still resolve after the switch. That needs either a key-mapping layer or a one-off migration of `chart_key` values. Stage 0 decides which and logs it.

---

## 6. How the build protects the live dashboards

- **Branch only** (`v0.6`). Nothing reaches `main` until Step 4.
- The config renderer lives **behind a flag**: a route param or env flag, e.g. `?renderer=config`. The existing hand-coded dashboards keep serving by default throughout, including on the branch.
- **Parity check on the Catalogue page** (super-admin): it renders every registered view for a chosen school, subject and state, alongside the hand-coded panel, so the two can be compared. Step 3 testing walks this. It replaces the separate parity route first proposed.
- The hand-coded components are **wrapped, not rewritten**. Registry entries call the existing view components with params. Where a view's logic is tangled into its panel's local state, the build extracts the minimum needed and logs each extraction.
- The flag flips only at Step 4, after parity sign-off. The old path stays in the code for one release as a fallback.

---

## 7. Meetings, the panel unit, fullscreen and copy-to (revised 3 Oct)

### 7.1 The panel unit: one size everywhere
Guy: "panels should be the same size in all contexts — keeps the pixel perfect idea."

- **One panel unit:** today's real panel, about 385 × 256 at desktop, 24 px gaps (S0 confirms the exact numbers from `DashboardGrid`).
- It's the same unit in dashboards, meeting slides, the Pick preview (scaled thumbnail at the same 1.5 : 1 shape) and the copy-to slot map.
- **Spans are whole multiples of the unit** (2 wide; 2 × 2), never a free size.
- On phone, a panel is full width at the same height.
- Views are designed once, at the unit size; nothing is re-laid-out per context.

### 7.2 Dashboards scroll; meetings don't
- **Custom dashboards scroll vertically, with as many rows as the user wants.** Columns are capped at 4; rows aren't.
- **Meeting slides are fixed 16:9 and never scroll.** Three units across and two down fits a 1280 × 720 slide exactly, with room for a title, so a slide is literally a 3 × 2 dashboard grid.

### 7.3 Fullscreen is automatic
Every panel gets fullscreen from the renderer for free: no per-view work. Fullscreen is the *same panel instance* enlarged, so it carries everything assigned to it:
- data, measure, focus, comparison and time;
- the active rail view;
- the subject chip;
- title and placeholders.

Changing the rail view in fullscreen changes the panel too. The Stage 02 full-screen boards (Round 10) are the layout reference.

### 7.4 Copy to a dashboard or meeting
The Export menu's "Copy to custom dashboard" and "Copy to a presentation" become one **Copy this view** dialog. It's the quickest way to build: collect views you already like.
- **Destination:** New dashboard / any dashboard you can edit / New meeting / any meeting.
- **Slot:** a mini map of the destination. You can:
  - add the view to an existing panel's rail;
  - drop it in an empty slot;
  - put it in a new row.
- **Fit check:** if the slot's column matches the view's settings, it follows the column from then on; if not, it keeps its own settings and shows "overridden".
- **New dashboard from a view:** the view's settings become column 1's.
- **To a meeting:** pick the meeting, then the slide (or a new one). The view goes into the next free slot and **the slide re-arranges itself**: 1 view full, 2 side by side, 3 across, up to 3 × 2. Send a graph, then a map, to the same slide and you get a two-column slide with no layout step. There's no fit check, because meeting slots have nothing to inherit (§7.5). The last-used meeting is pre-picked, so collecting many views is quick.
- **Actions:** "Copy and stay" or "Copy and open".

### 7.5 Meetings: now in 0.6
A meeting is a dashboard of `kind: "presentation"`. It has a name and a meeting date; it archives itself after that date (below). It holds **slides**. A slide's layout is **automatic by default**: it follows the number of views sent to it. You can also choose one of these by hand:
- 1 unit + text;
- 2 units + text;
- 3 across;
- 3 × 2;
- 2 × 2 span + 1.

Each slide also has a title and speaker notes.

- **A slot holds one specific view, literally** (Guy, 3 Oct). There are no columns, rows or panels and no rail of alternative views, so nothing to inherit. The view is fully pinned:
  - every setting is resolved: `[subject]` becomes "Maths (General)", the comparison set becomes its named set;
  - the year is pinned to the moment it was added ("as of 2024/25"), with a per-view option to keep it live.
- **Filling a slot:** "Copy to meeting" from any panel (the main route), "Add a view" (picks from your dashboards' views, or runs the chooser from step 1, since there's no column to pre-fill it), or a text box.
- **What still applies:** the slot is the standard panel size, and fullscreen and titles work as everywhere else.
- **Feel before spec:** rejigging slides has to be playful. The canvas's Meeting playground board is a working prototype for trying it out: click to swap, move between slides, auto/manual layouts, editable and suggested titles, shuffle, undo. S7's prompt is written from whatever you settle on there. The real build adds drag-and-drop.
- **Dated, then archived automatically** (Guy, 3 Oct):
  - every meeting has a date; the day after it, the meeting moves to **Archive** on its own;
  - archived meetings are read-only but can still be presented and exported, and the archive is **unlimited**;
  - suggested: **"Reuse for next meeting"** on an archived one copies it with a new date, with an option to move its pinned views on to the latest data (useful for termly governor meetings);
  - the old delete-by date is dropped for meetings, since archive replaces it and meetings hold no personal data (Recruitment keeps its delete-by, which protects candidate names).
- **Present:** 1-up fullscreen slides. **Grid view:** today's overview. **Export PDF.**
- **Sharing:** Assign/share works exactly as for dashboards.
- **Today's Meetings** (its page, two tables, `addSlide()`) are **migrated** into presentation configs in S7. S0 maps the tables; the old page is retired after parity. This answers D6.

## 7a. Things that would otherwise be missed (added 3 Oct)

Each item has a default the build uses unless Guy says otherwise.

| # | Gap | Default |
|---|---|---|
| G1 | **Core dashboard updates are upgrades** (Guy, 3 Oct) | Once live, publishing a new version of a VicData dashboard is treated like a system software upgrade, and per-user state **degrades sensibly**. Notes and open/closed rows are kept wherever their panel still exists. Any panel whose layout or view set changed comes back at the **new default**: no attempt to map old settings onto a changed layout. Suggested: a dismissible "Updated — what's changed" line on first visit, written from the version's change summary. Per-user state is stored separately from the dashboard (extends `teacher_view_preferences`), keyed by stable panel and view IDs |
| G2 | **Notes attach to the view** (Guy, 3 Oct) | Keyed on the view instance's ID; S3 maps existing notes across; copying a view doesn't copy its private notes. **0.7:** a home-page hub listing all your notes and flags, each linking straight to its dashboard and panel |
| G3 | **Speed with unlimited rows.** Many panels each fetching would be slow (earlier LA queries already timed out) | One batched fetch per dashboard, de-duplicated by measure and context. Collapsed rows load when opened. One error boundary per panel, so a failing view shows its own error and never blanks the dashboard |
| G4 | **Phone layout for custom dashboards.** 4 columns can't sit side by side | On phone, columns become a tab strip (one column at a time); rows stack inside it with the same accordion. This is the existing phone pattern, generalised |
| G5 | **Dashboards across schools.** VicData dashboards render for any school; a personal one may reference school-specific things | A config stores *relative* references ("10 nearest", "my subjects", "this LA"), resolved per school. Named saved sets and custom areas are school-specific: at another school they show "Set not available here — pick one" |
| G6 | **Deleting something a dashboard uses** (a saved set, custom area or dashboard group) | Delete warns "Used by 3 dashboards". Affected panels show a clear fix-it state, never a silent wrong figure |
| G7 | **Standard elements on every view, everywhere** (Guy, 3 Oct) | The renderer always attaches the standard set: title, source citation (from the measure card), note, export, fullscreen. That includes meeting slides, "in case anyone asks". No view or context can drop them |
| G8 | **Undo while editing** (separate from versions) | Ordinary undo/redo for the last 30 edit actions in the editor and meeting slides |
| G9 | **Limits** (Guy, 3 Oct) | Personal dashboards: **super-admin unlimited, School-Admin 20, everyone else 5**. VicData and school-shared dashboards don't count. **Meetings:** the same caps apply to upcoming meetings only; archived meetings are unlimited and don't count |
| G10 | **Whole-dashboard print/PDF** | Reuse the existing print path; rows print in order with panels at unit size; collapsed rows are left out unless "print all" is ticked |
| G11 | **Which views people use**, to steer what gets built next | Simple counts only (view ID × dashboard × count per week, no person IDs), shown to super-admin on the Catalogue page. This is a new data category, so it needs a privacy-notice line before launch |
| G13 | **Login activity for School-Admins** (Guy, 3 Oct: "store it, don't develop yet") | S1 records a sign-in event per member per school: membership, school, timestamp. A Supabase auth last-sign-in isn't enough, because it isn't per school. **No screen in 0.6.** Kept 12 months. Parent-context sessions are never recorded against an employing school (the hard wall). This is staff activity data, so it needs a privacy-notice line before any School-Admin screen shows it |
| G12 | **Light theme.** The chooser was drawn light, the dashboards dark | Every new screen is built for both themes from the start, as the dashboards already are |

**0.7 (decided):** the notes and flags hub on the home page (G2).

Deliberately left for later: dashboard search in the library, templates beyond "Copy a dashboard", sharing outside the school, tier gating.

## 8. Out of scope for 0.6

- School-Admin and user **editor UI**. The model and RLS support them; only super-admin gets the editor.
- HOD rename/roster, department-vs-department comparison.
- Parent context, cross-school contexts.
- New dataviews. 0.6 registers only views that already exist. Rolls and Births are registered as **measures** (no views); their views come in the next round, built against placeholders.
- Warning-flag badges, further Stage 02 full-screen design refinements (fullscreen itself is automatic in 0.6, §7.3), and the open Teacher view snag list. These carry on separately.
- Usage analytics beyond G11's simple anonymous counts.
- The notes and flags hub (0.7).

---

## 9. Decisions for Guy

**All recommended defaults accepted by Guy, 3 Oct** (D1, D3, D5, D8, D10 here; A1–A9 in the combinations doc; C1, C2, C4 and C8 in the catalogue doc; G1–G12 in §7a). The build treats them as decided. Further open decisions: `vicdata_0_6_add_a_view_combinations_v1.md` §5 (A1–A9) and `vicdata_0_6_view_catalogue_and_offer_design_v1.md` §6 (C1, C2, C4, C8; C3, C5, C6 and C7 decided).

| # | Decision | Recommended default |
|---|---|---|
| D1 | Your role list drops **HOD** and **Finance**. Retire them, or keep them hidden? | Keep both in the DB enum (no data loss, no re-classification later) but hide them from 0.6 UI |
| D2 | Where is **phase** chosen? | **Revised:** per column, in step 1's Data. The dashboard only pre-fills it, because one dashboard can mix GCSE and Post-16 (combinations doc A7) |
| D3 | What does **"Custom area"** under Focus mean? | A user-picked group of subjects (today's Context "Selected subjects"), *not* a custom geography. Please confirm |
| D4 | A cell that **spans two columns**: which column header does it inherit from? | **Revised:** if the columns match, there's nothing to ask. If they differ, ask once, with the left-most pre-picked (combinations doc A5) |
| D5 | Assigned dashboards: do recipients get a **live** dashboard or a **copy**? | Live for assigned; Save as = personal copy (settles §16 sharing for dashboards only) |
| D6 | Presentations vs **Meetings** | **Decided:** Meetings is built in 0.6 (S7); today's meetings are migrated and the old page retired |
| D7 | **One overnight build or two?** | **Two nights**, one branch: S0–S3, then S4–S7 (§11) |
| D8 | **Uploaded image** icons need a Supabase Storage bucket plus RLS | Include it, with a super-admin-only upload in 0.6. Thumbnail and icon-set options for everyone |
| D9 | **Rolls and births** | **Decided:** registered as measures in 0.6; views built next round via placeholders (§4.6a) |
| D10 | Accordion "**auto close**": per layout (your brief) or per row? | Per layout, as written. Rows only set default open or closed |

---

## 10. Step 1 — Wireframes (complete, 3 Oct)

All screens are on the Design canvas "VicData 0.6 — Dashboard editor & dataset chooser" (31 boards), exported to `docs/wireframes/v0.6/` for the build:
- **Start a dashboard:** library; new dashboard (4 steps).
- **Add a view:**
  - Pick, including Pick for an Either row with data-gap tags;
  - Customise;
  - the empty state with placeholder;
  - steps 1–2 and the sub-screens.
- **Edit:**
  - the editor;
  - row settings;
  - column-data change;
  - spanning panel question;
  - History, with draft vs live;
  - skeleton with planned panels;
  - Assign;
  - icon;
  - Copy this view (to a dashboard, and to a meeting).
- **Meetings:** editor; playground (working prototype); archive.
- **Homes and admin:** role home (SMT lens); School-Admin People and Teams; super-admin schools.
- **Phone:** custom dashboard as column tabs.

**After the build, expect fast iteration in real use** (Guy, 3 Oct). Meetings and dashboard editing in particular will be tuned as they're used in Guy's own workflow, so the build should favour easy-to-change UI over polish.

## 11. Step 2 — Overnight build plan (for the Claude Code prompt)

**Branch** `v0.6`. Each stage = its own commit, with `tsc --noEmit` / `eslint` / production build clean before the next stage. Push the branch (for a preview deploy). **Never merge or push to `main`.**

**Decisions get logged, not asked:** every judgement call goes to `docs/OPEN_QUESTIONS.md` in the existing format, and the build carries on.

**Stop only for:**
- an RLS or schema change that would alter who can see or edit **existing** data (saved sets, notes, preferences, memberships)
- anything that would change what the **default (unflagged)** live dashboards render
- a destructive or irreversible migration
- a registry wrap that can't be done without changing an existing view's behaviour

The stages:

*Revised 3 Oct after `vicdata_0_6_view_catalogue_and_offer_design_v1.md`: S0 produces the four-layer catalogue (rules / measures / renderers / dataviews) and flags every rule that is enforced only inside a panel component as **must lift**. S2 lifts those rules into the measure fetch layer before wrapping any view, and if a lift would change a figure, that is a stop. The in-app Catalogue page replaces the separate parity route. The chooser's Customise screen takes its Numbers options from the measure's honest number types.*

- **S0 — Audit (read-only, writes a doc).** Covers:
  - An inventory of every view in the three panel components for both phases, as a table: view, panel, data, focus, compare, number type, date mode, view type, params, title logic. This becomes the registry seed.
  - Roles/RLS inventory.
  - The Meetings tables and how they map to presentation configs.
  - Where Data View rolls/births components live (D9).
  - The `chart_key` / preferences mapping plan.
  - Every "exists today" claim in this brief, confirmed or corrected.
- **S1 — Roles.** Covers:
  - Role set per membership (migration from single value, backfill).
  - `is_platform_admin()`, with the VC Sets toggle and preview switch moved onto it.
  - Teams tables + RLS.
  - School-Admin People/Teams screens.
  - Sign-in event recording per member per school (G13), storage only.
- **S2 — Config + registry + renderer.** Includes an immutable `dashboard_versions` table, with drafts separate from published. Also registers the **Rolls and Births measures** (cards, rules, fetch; no views), so Admissions and SMT skeletons can be set up straight after 0.6. Covers:
  - Tables: dashboards, groups, assignments.
  - The config JSON schema with a `schema_version`.
  - Registry entries wrapping the S0 inventory.
  - The generic renderer behind the flag.
- **S3 — Seed the 4 Teacher dashboards as config.** Includes the Catalogue-page parity check and the notes/preferences mapping onto stable view IDs. Self-check parity for one independent and one state school, both phases, and name them in the build report.
- **S4 — Dataset chooser:** Pick (opens there), Customise, empty state, steps 1–2 with sub-screens; matching rule per the combinations doc §2.
- **S5 — Editor** (super-admin): versions, drafts and the history panel (the version table itself in S2); chrome, settings, layout, rows (including the Time setting), panels, dataview move/copy, save/save as/rename/delete, assign; **placeholders, Export planned views, Ready-to-swap matching**; the Pick empty state.
- **S6 — Icons + library pages + linked-dashboard switcher + Copy this view + role home pages** (Teacher, SMT, Admissions, with the lens switcher).
- **S7 — Meetings:** presentation kind, slide layouts from the panel unit, slide editor, Present / Grid / PDF, migration of existing meetings. Fullscreen-for-every-panel lands in S2's renderer.

**Size, honestly:** S0–S7 is more than one night. Plan two: night one S0–S3 (foundations and parity), night two S4–S7 (the chooser comes before the editor, which depends on it).

**Build report** in the usual format:
- schools verified
- simplifications made without Guy
- everything logged to `OPEN_QUESTIONS.md`
- a click-through list for Step 3

---

## 12. Steps 3 and 4 — Test and merge

**Step 3, live on the branch preview:**
- **Parity**: every panel, both phases, Candidates and Results, at ≥2 real schools, flag on vs off.
- **Inheritance**: column → panel → dataview, including overrides and the span rule.
- **Chooser**: no dead ends; preview matches the saved result; titles resolve placeholders correctly when the subject changes.
- **Roles**:
  - a Teacher can't see the editor or another user's dashboards
  - a School-Admin's team share reaches team members only
  - super-admin assignment reaches the right roles across schools
  - multi-role users get each role's dashboards
- **Existing data**: notes, preferences, saved sets and onboarding all intact.
- **Phone width** for the chooser and library, and custom dashboards as column tabs.
- **Versions**: draft edits invisible to assigned users until published; restore works and is undoable; an upgrade keeps notes and open rows where panels survive, and resets changed panels to the new default.
- **Copy this view**: into a matching column (follows it) and a mismatched one (overridden); into a meeting slide, which re-arranges.
- **Placeholders**: visible to super-admin only; Export planned views; Ready to swap in when a matching draft exists.
- **Meetings**: migrated meetings intact; views pinned; auto-archive the day after; caps count upcoming meetings only.
- **Limits**: super-admin unlimited, School-Admin 20, others 5.
- **Standard elements**: title, source, note, export and fullscreen on every view, including meeting slots.
- **Role homes**: each role sees its own home; multi-role users switch; key tiles follow Assign.

**Step 4:** merge to `main` with the flag still off. Flip the flag once parity is signed off live, and keep the old path for one release.
