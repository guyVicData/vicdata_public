# VicData 0.6, night 1: audit, roles, dashboard engine, Teacher dashboards as config

Claude Code build prompt. Night 1 of 2: stages **S0–S3**. Night 2 (S4–S7) is a separate prompt and starts only after Guy has reviewed tonight's report.

## Read first, in this order

1. `docs/v0.6/vicdata_0_6_scope_brief_v1.md`: **the spec**. Sections 0–7a and 11 matter most tonight.
2. `docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md`: the four-layer catalogue (rules → measures → renderers → dataviews), the definition of done, and honest number types.
3. `docs/v0.6/vicdata_0_6_add_a_view_combinations_v1.md`: the matching rule (§2) and the findings F1–F12 that the engine has to support.
4. `docs/wireframes/v0.6/`: the Design canvas boards as raw `.dc.html` (HTML/CSS plus a small logic block). Tonight you need **People**, **Teams**, **Platform** and **PhoneDash** for real UI. Read **Editor**, **Skeleton**, **History**, **Meeting** and **MeetingPlay** so the data model you build supports them, but don't build their UI tonight. The wireframe file wins over prose for anything visual.

**All recommended defaults in those docs are accepted** (D-, A-, C- and G-series). Treat them as decisions, not questions.

## Pixel-perfect, every screen (Guy: "pixel perfect is key to trustworthiness")

**Follow the wireframes tightly.** For every screen with a board in `docs/wireframes/v0.6/`, match the board's structure, order, spacing, sizes, radii, copy and states exactly. Read the literal markup and `<style>` blocks; don't paraphrase them. Where the prose and a board disagree on anything visual, the board wins.

**Stick to the existing design conventions.** Radical consistency is house style: the same position, icon and colour language everywhere a pattern appears.
- **Shared shells, not new ones:**
  - `CardBox` and its panel chrome;
  - the `TeacherModal` / fullscreen modal shell;
  - `PillMenu`, `PanelMenu` and `useDismiss` for popovers;
  - the comparator chooser's modal (hub, adjust, filter boxes, Save / Save as footer);
  - the onboarding tour's frame;
  - `QualificationFamilyTiles` and `CategorySubjectPicker`;
  - `TickList`.
- **Real tokens, never hand-picked hexes:**
  - `TAG_COLOURS`, `SUBJECT_FAMILY_COLOURS`, `PHASE_ACCENT`, `colourByGroup`;
  - the phase glyphs and `FAMILY_ICONS`: one icon per meaning, everywhere;
  - the size badges, the existing type scale and the dark/light theme variables.
- **The panel unit is fixed** (S0's measured size) on dashboards, meeting slots, Pick previews and slot maps. Spans are whole units.
- **Both themes.** Some boards are drawn light (the chooser, dialogs) and some dark (app pages). That's wireframe convenience only. Build every screen in both themes from the app's theme variables.
- **When a board conflicts with an established code convention:**
  - a board's colour or icon that differs from the real token or icon for the same meaning: use the real one;
  - layout, spacing, copy and structure: follow the board;
  - log each such case in `OPEN_QUESTIONS.md` so Guy can see it.
- **Check it, then say what still needs eyes.** Where headless rendering works, screenshot each built screen at the board's width and compare it with the board. Where it doesn't, say exactly why, and list the screens Guy must check by eye against which boards. Never report a screen as matching without having compared it.

## Ground rules

- **Branch.** Create `v0.6` from `main`. Each stage is its own commit (or a few). Before moving on, each must be clean on `tsc --noEmit`, `eslint` and the production build. Push the branch so a preview deploy exists. **Never merge or push to `main`.**
- **Live site untouched.** The new renderer sits behind a flag (`?renderer=config` and/or an env flag). With the flag off, every existing page must render exactly as it does today, branch included.
- **Wrap, don't rewrite.** Registry entries call the existing view components. Where logic is tangled into a panel component's local state, extract the minimum and log each extraction.
- **Log decisions, don't ask.** Every judgement call goes in `docs/OPEN_QUESTIONS.md`, in its existing format, and you carry on.
- **Stop only for:**
  - an RLS or schema change that would alter who can see or edit **existing** data (saved sets, notes, preferences, memberships, meetings);
  - anything that changes what the **unflagged** live dashboards render;
  - a destructive or irreversible migration;
  - a rule lift (S2) that would change a figure on a live dashboard.
- **Verify, don't assume.** Earlier briefs have been wrong about what exists. In round 8, notes and Meetings were already built. Every "exists today" claim in the docs is checked in S0 before anything is built on it.

## S0 — Audit (read-only; writes docs)

Write `docs/v0.6/audit_v1.md` and seed `docs/catalogue/`.

1. **View inventory** across `CandidatesPanels`, `SubjectPanels` (Results and Context) and `ComparisonsPanels`, for **both phases**, Candidates and Results. For each view record:
   - panel and row;
   - data and measure, focus, compare kind;
   - number type, date mode, view type;
   - params;
   - title logic;
   - empty and suppressed states;
   - which rules it applies, and **where**.

   This becomes the dataview registry seed.
2. **Rules**: every rule found, in the catalogue doc's card format (ID, statement, why, applies to, enforced in, test case, origin). Mark each rule enforced *only* inside a panel component as **must lift**. Start from the catalogue doc §2.1 list and confirm or correct each one against the code.
3. **Measures**: one card per measure, with geographies available (✓/✗ with reason), honest number types, years and rules. Include **Rolls** and **Live births**: find where their data and fetches live (advanced Data View and Supabase tables).
4. **Placement mismatches**: every hand-built panel whose views don't match its column under the matching rule. Column 1's "against the wider system" views are the known one (combinations doc F2).
5. **Panel unit**: the real rendered panel size and gap from `DashboardGrid` and `CardBox` at desktop width. The docs say about 385 × 256 with 24 px gaps; confirm or correct.
6. **Per-user state and notes**: what `teacher_view_preferences` and `teacher_view_notes` (`chart_key`) hold today, and a mapping plan onto stable panel and view IDs.
7. **Meetings**: today's tables, the page and `addSlide()`, and how they map to `kind: "presentation"` configs (migration happens night 2).
8. **Roles and RLS**: today's role storage, the RLS helpers, how the VC Sets toggle and the testing school/role switcher authenticate, and how the system admin is identified.
9. **Performance baseline**: number of fetches and load time for one GCSE and one Post-16 dashboard at a real school.
10. **Claims check**: a table of every "exists today" claim in the three docs, marked confirmed or corrected.

## S1 — Roles

Wireframes: People, Teams, Platform.

- **Roles become a set** per person per school. Migrate the single value and backfill.
  - Roles: Teacher, SMT, Admissions, School-Admin.
  - HOD and Finance stay in the enum but are hidden in the UI.
  - Teacher remains the self-select default on join.
- **`is_platform_admin()`**: one audited, platform-scoped check. Move the VC Sets per-school toggle and the role/school preview switch onto it. The preview becomes read-only "Look at it as…" on the Platform screen, logged. No school can reach it.
- **Teams**:
  - tables plus RLS, many-to-many, managed by School-Admin;
  - automatic teams derived from roles: All staff, SMT, Admissions;
  - teams are a sharing target only in 0.6.
- **Screens**:
  - School-Admin **People**: role chips toggled on and off, approve join requests, search and filter;
  - School-Admin **Teams**;
  - super-admin **Platform**: school list, per-school switches, look-as-role.
- **Sign-in events** (brief G13): record one row per member, per school, per sign-in: membership, school, timestamp. Keep 12 months. **No UI.** Never record a parent-context session against an employing school.
- **Parent wall**: nothing tonight may create a school-admin query path that could reach non-employment activity.

## S2 — Dashboard engine (behind the flag)

**Tables:**
- `dashboards` (kind `dashboard` | `presentation`; owner scope VicData / school / user);
- `dashboard_versions` (**immutable**: every publish is a new row);
- drafts kept separate from the published version;
- groups (linked dashboards);
- assignments (role / team / user, live or copy, "key VicData dashboard" flag);
- a per-user state layer (extend `teacher_view_preferences` or a sibling table) keyed by **stable panel and view IDs**.

Write RLS for all of these, with caps enforced: personal dashboards are unlimited for super-admin, 20 for School-Admin and 5 for others. Meetings use the same caps for upcoming meetings only; archived meetings are unlimited.

**Config JSON with `schema_version`:**
- layout: 1–4 columns, presets or custom;
- column headers: data, measure, phase, focus (including follow-chips / always), compare;
- rows: unlimited; each has name, **time** (latest / over time / either), structure with whole-unit spans, and open by default;
- panels with overrides;
- dataviews, including `kind: "placeholder"`;
- the presentation fields (slides, slots, pinned views) reserved now and built night 2.

**Catalogue in code (`src/catalogue/`):**
- typed rules, measures (including **Rolls** and **Births**, with no views yet), renderers and dataviews, seeded from S0;
- **lift every must-lift rule into its measure's fetch function** before wrapping any view;
- a rule test runner that checks each rule's real-school test case;
- an export script that generates `docs/catalogue/*.md`.

**Renderer:**
- the fixed **panel unit** everywhere;
- **one batched fetch per dashboard**, de-duplicated;
- closed rows load when opened;
- one error boundary per panel;
- the **standard elements always attached**: title, source citation from the measure card, note, export, fullscreen;
- **automatic fullscreen**: the same panel instance, carrying all its settings;
- on phone, columns become tabs (PhoneDash).

**Matching rule (combinations doc §2)** as a pure, unit-tested function. The chooser UI uses it night 2:
- data and measure;
- focus;
- the compare subset rule;
- row time;
- palette;
- status;
- familiar-first ordering: (1) views in the matching panel of a default VicData dashboard, (2) other views on VicData dashboards, (3) the rest.

**Catalogue page** (super-admin): every registered view, live, for a chosen school, phase and subject, with its card. It shows **side by side with the hand-coded panel** for parity checks.

## S3 — The four Teacher dashboards as config

- **Seed the configs:** GCSE Candidates, GCSE Results, Post-16 Candidates and Post-16 Results, in two linked groups. The group switcher replaces the Candidates/Results toggle.
- **Carry everything** in scope brief §5, including:
  - row time (Current = latest, Trends = over time);
  - the F2 views as a marked panel override;
  - qualification gating;
  - the AS/AEA and minimum-count rules;
  - titles and their fallbacks;
  - the alignment spacer;
  - the Results sub-measure pill.
- **Map existing notes and preferences** onto stable IDs. A test user's notes and open rows must survive.
- **Self-check parity** on the Catalogue page: at least one independent and one state school, both phases, Candidates and Results. Name the schools.
- **Generate `docs/catalogue/*.md`** and commit it.

## Build report

Write `docs/v0.6/night1_build_report_v1.md` covering:
- the schools verified;
- every must-lift rule and whether its lift changed any figure (it shouldn't have);
- the corrected claims;
- simplifications made without Guy;
- everything logged to `OPEN_QUESTIONS.md`;
- a short click-through list for Guy on the preview: the People, Teams and Platform screens, and the Catalogue page parity walk.

Night 2 starts from this report.
