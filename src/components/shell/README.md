# The shared shell

Every role's dashboard is drawn from these parts: Teacher, Admissions, SMT, and the group view to come. A product brings its data, its views and its catalogue entries. It never brings its own nav, bar, panel or grid. If a view seems to need a new piece of chrome, stop and report it rather than building one (spec `docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md` §1).

These files moved here in 0.8 (Part A) from `src/components/teacher/`, `src/components/admissions/`, `src/components/edit-mode/` and `src/components/dashboard-config/ConfigDashboard.tsx`. The old paths re-export them unchanged.

## The parts

| Part | File | What it is |
|---|---|---|
| Nav | `TeacherNav.tsx` | The VicData mark, the role home, the phase switch, the library and the account menu. The View as pill appears only while viewing as someone. |
| Theme | `TeacherChrome.tsx` | The dark/light toggle (`useTeacherTheme`, `ThemeToggle`); print is always light. |
| Control bar | `ControlBar.tsx` | The badge and "{Product} — {school}", the dashboard switch, the focus chips with their ±, then the product's pills in the `chrome` slot. |
| Dashboard switch | `GroupSwitcher.tsx` | The linked dashboards of one group (Candidates · Results; Pipelines · Market share; Overview · Academic). |
| Pills | `FilterPills.tsx`, `PillMenu.tsx` | `FChip` (a filter pill), `MenuChip` (a pill with a one-choice menu), `EntryChip` (a pill-shaped focus chip), and `PillMenu` (Teacher's pill with a menu: "Compared against"). |
| Edit bar | `EditSwitch.tsx` | The footer's **Edit** and **View as…**, for platform admins only, on a page that registers a VicData dashboard (`useInPlaceEdit`, `src/lib/edit-mode.ts`). |
| Grid, Teacher | `DashboardGrid.tsx`, `DashboardColumn.tsx` | Three columns with dividers; each column is a card with its accent bar and question. |
| Grid, Admissions/SMT | `Rows.tsx` | `ShellPage` (the frame), `ShellRow` (a collapsible row head, then a three-column grid), `RowHead`, `PhoneStack`. Column 1 is one panel; the large view is a `RailPanel` with `span={2}`. |
| Panel | `CardBox.tsx` | Every panel: header, icon row, body, footer notes, full screen. |
| Panel with a rail | `RailPanel.tsx` | `CardBox` with a tag line, a span and a rail of views (`Rail`). On a phone the rail becomes `Tabs`. `FocusFill` and `fillHeight` let a chart fill full screen. |
| Icon row | `PanelIconRow.tsx` | The fixed icon order, below. |
| Footer | `PanelFooter.tsx` | The source "i", the caption button (the honesty note), the private note, the flag, and the ⋯ menu's `PanelExport`. |
| Menus | `PanelMenu.tsx` | `PanelMenu`, `MenuRow`, `MenuHeading`, `MenuDivider`, `useDismiss`. |
| Full screen | `TeacherModal.tsx` | The modal behind ⤢: the panel's rail, caption and source in full. |
| Icons | `PanelIcons.tsx` | The rail's and the panels' glyphs, and `IconButton`. |
| Accent | `accent.ts` | Each product's accent, named once. |

## The icon order

Every panel's top-right icons are `PanelIconRow`, in this order (`PANEL_ICON_ORDER`):

1. **⋯ menu**: Print this graph, Copy this view…, then any panel extras after a divider.
2. **⤢ full screen**: in full screen, the same button exits it.
3. **⌃ collapse**: Teacher's accordion only.

A slot that doesn't apply keeps its width, so the other icons never move. Admissions and SMT panels leave the third slot empty, because their rows collapse instead. Notes live in the footer, behind the caption button, never as loose text.

## What a product supplies

- **Accent.** Set it once, on the page root (`#teacher-root`): `style={accentVars(productAccent("smt"))}`.
  - Every shell part then reads `var(--accent)` / `var(--accent-rgb)`.
  - Teacher's accent follows the phase (`PHASE_ACCENT`). Admissions and SMT follow the role (`ROLE_ACCENT`).
  - No shell part takes a hex.
- **Dashboards.** Supply a dashboard group in `src/catalogue/dashboards/<product>.ts` and pass it to `GroupSwitcher` through `ControlBar`'s `switcher` slot.
- **Badge and title.** Pass `badge` (the "A", the "S") and `phaseLabel` ("Admissions", "SMT") to `ControlBar`.
- **Focus chips.** Pass them through `ControlBar`'s `subjects` / `focusKey` / `onFocus` (single-select, held in the URL by the product).
  - Name the group with `subjectsLabel` (the accessible label only; nothing is drawn before the chips).
  - Use `editSubjects` for the ±, or leave it out.
- **Filters.** Put pills (`FChip`, `MenuChip`, `PillMenu`) in `ControlBar`'s `chrome` slot, only where they apply: boarding only for a boarding school, gender only for a mixed school.
- **Views.** Each view is a catalogue entry plus a component, drawn inside a `RailPanel` or `CardBox`.
- **Notes.** Take the honesty wording from the product's notes file (`ADMISSIONS_NOTES`, `SMT_NOTES`) and pass it as the panel's `caption`.
- **Edit.** Register the page's dashboard with `useInPlaceEdit`, so the footer's Edit opens the shared editor in place.
