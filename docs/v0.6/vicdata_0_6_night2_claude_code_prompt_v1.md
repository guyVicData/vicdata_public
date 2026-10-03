# VicData 0.6, night 2: chooser, editor, library and homes, meetings

Claude Code build prompt. Night 2 of 2: stages **S4–S7**, on the same `v0.6` branch.

## Read first, in this order

1. `docs/v0.6/night1_build_report_v1.md` and the night-1 entries in `docs/OPEN_QUESTIONS.md`, plus any notes Guy has added after reviewing them. **Where these differ from the design docs, they win.**
2. `docs/v0.6/vicdata_0_6_scope_brief_v1.md`: §3 (chooser), §4 (editor, placeholders, versions, homes), §7 (panel unit, copy-to, meetings), §7a (G1–G13), §12 (tests).
3. `docs/v0.6/vicdata_0_6_add_a_view_combinations_v1.md` and `docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md`.
4. `docs/wireframes/v0.6/`: every board. **The wireframe file wins over prose for anything visual.**
5. `docs/catalogue/` from night 1: the real registry.

All recommended defaults are accepted. The ground rules from night 1 still hold:
- the branch is `v0.6`, never `main`;
- commit per stage, with tsc, eslint and build clean;
- log decisions rather than ask;
- the same stop conditions;
- with the flag off, the live site is unchanged.

**Iteration-friendly UI:** Guy will use meetings and dashboard editing in his own workflow straight after the build and iterate fast. Favour simple, easily changed components over polish, and keep layout and interaction constants in one place.

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

## S4 — "Add a view" chooser

Boards: Ch3Pick, Ch3Adjust, Ch3Empty, PickEither, Ch1Data, Ch2Focus, Ch2Subject, Ch2Custom.

**Opens on Pick, pre-filled from the panel's context** (column + row + overrides), with a one-line summary and a "Change" link.

**Pick**
- Uses night 1's matching function, **familiar first**:
  1. "Familiar — from VicData dashboards": views in the matching panel of a default VicData dashboard;
  2. other views on VicData dashboards;
  3. "Also fits": everything else.
- **Each card shows:**
  - the **standard rail icon**;
  - a preview at the panel-unit shape;
  - the resolved title;
  - a meta line with where it lives ("on GCSE Results, Comparisons");
  - data-gap warning tags (structural filter, never hidden for data gaps).
- **Either rows** group the list into *Latest year* / *Over time*.
- **Second tab: "Browse VicData dashboards"**, a mini map of those dashboards. Views taken from it that don't match the column arrive marked "overridden".

**Customise**
- One screen with a live preview, three filter boxes (Numbers, Years, Look) and the title with placeholder chips.
- Numbers offers only the measure's honest number types; the rest are dotted and can't be picked.
- Includes the **roll forward** toggle.
- Touching anything **forks** to a custom view, with the banner. "Back to ready-made" undoes it.

**Empty state**
- One-tap loosening options, each with a count of the views it would unlock.
- "Ask for this view" (logged as a request).
- Super-admin gets **"Add a placeholder"** instead: description, rough shape, notes, and the exact context saved.

**Steps 1–2 (via Change)**
- Build the **grouped** layouts exactly as drawn:
  - Step 1: family cards, only the picked one open, then phase → measure → which result;
  - Step 2: block 1, "which part of school", with follow / always nested; block 2, "Compare with something", as a switch with sub-bands for other schools, averages and other subjects.
- **Area data** shows the area focus set instead.
- **Reuse** the existing onboarding subject picker (single-select variant) and the comparator chooser. Don't rebuild them.

## S5 — Editor (super-admin)

Boards: New1–4, Editor, RowSettings, ColumnChange, SpanAsk, Skeleton, History, Assign.

**Creating and setting up**
- **New dashboard**: the 4 steps, reusing the onboarding tour's frame.
- **Edit bar**: History · Settings · Rename · Assign · Save as · Publish · Exit. It's collapsible.

**Layout**
- Column edit (data, focus, compare via steps 1–2 or the comparator chooser).
- Add row with structure presets.
- **Row settings**: name, time, structure, open by default.
- Panel menu: rename, override, move view, copy view, move panel, delete.
- Spans in whole units.

**Edge cases**
- **Span question**, asked once when the spanned columns differ.
- **Column change revalidation**: keep as override / remove / swap to nearest equivalent.

**Placeholders**
- Dashed "Planned" panels, visible to super-admin only.
- **Export planned views**: placeholders plus "Ask" requests, written to a markdown list in catalogue terms.
- **Ready to swap in** when a `draft` view matches a placeholder's context.

**Versions** (brief §4.8)
- Draft autosaves; assigned users see only published.
- Publish makes a new immutable version.
- History panel: preview, restore (as a new draft), compare (change summary).
- Undo/redo for the last 30 actions.

**Upgrade behaviour** (G1)
- On publish of a VicData dashboard, per-user state survives where the panel survives.
- Changed panels open at their new default.
- A dismissible "Updated — what's changed" line on first visit.

**Assign**
- Roles (super-admin) / teams (School-Admin) / mine.
- Live by default.
- The **"Key VicData dashboard"** toggle, which controls Home tiles and the tour.

## S6 — Library, role homes, icons, Copy this view

Boards: Main, HomeSMT, Icon, CopyTo, CopyToMeeting.

**Library**
- Dashboards and Meetings tabs.
- Filters: owner and colour.
- "+ New dashboard".

**Role home pages** for Teacher, SMT and Admissions
- Tiles: key dashboards, Dashboards, Recruitment, Meetings.
- **The role switch shows only for users holding more than one role.**
- SMT and Admissions key dashboards show an empty tile until they're built after 0.6.
- The existing GCSE/Post-16 path (≈4 steps from home) stays for VicData key dashboards only.

**Linked-dashboard switcher** in the top bar.

**Icons**: from a view (data-free glyph) or the icon set, plus a super-admin-only upload with a Storage bucket and RLS.

**Copy this view** (replaces the two disabled Export options)
- To a dashboard (new or editable), with a slot map and the fit check: either follows the column, or is marked overridden.
- To a meeting: pick the meeting (last used pre-picked), then the slide; it goes in the next free slot and the slide **re-arranges** (1 → 2 across → 3 across → 3 × 2).
- "Copy and stay" or "Copy and open".

## S7 — Meetings

Boards: Meeting, MeetingPlay, MeetingsArchive, CopyToMeeting.

**The meeting itself**
- `kind: "presentation"`.
- Each slot holds **one specific, fully pinned view**: settings resolved, year pinned with a per-view "keep live" option. No columns, rows, panels or rail.
- The standard elements still attach to every slot.

**Slides**
- Title and speaker notes.
- **Automatic layout by count**, with a manual override.
- All slots are panel-unit size; 3 × 2 fits 1280 × 720.

**Slide editing**
- Behaviour per the **MeetingPlay** prototype: select, swap, move to previous/next slide, add slide, layouts, suggested titles, shuffle, undo.
- **Add drag-and-drop** on top of that.

**Presenting**
- Present (1-up fullscreen), Grid view, PDF export.

**Dates and archive**
- Every meeting is dated and **auto-archives the day after**.
- Archived meetings are read-only and unlimited, and can still be presented and exported.
- **"Reuse for next meeting"**: new date, optionally move every view on to the latest data.
- No delete-by date for meetings. Recruitment keeps its own.

**Migration**
- Today's meetings move onto presentation configs, per the S0 mapping.
- Retire the old page once parity is checked. **Don't drop the old tables tonight.**

## Finish

Run through scope brief §12 as far as you can headless. Say plainly what needs Guy's eyes. Then write `docs/v0.6/night2_build_report_v1.md`:
- schools verified;
- simplifications made without Guy;
- everything logged;
- a **click-through list keyed to wireframe board names**, so Guy can test against the canvas board by board.

Do not merge. Step 3 (test) and Step 4 (merge, flag still off, then flip) are Guy's.
