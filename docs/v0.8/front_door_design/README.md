# Design references for the 0.8 "friendly front door" round

Exported 13 Nov 2026 from the design canvas "VicData walkthroughs — GCSE mockup"
(https://claude.ai/artifact/AqF26AWW1j2e6TRz1kGbWh). These are design references
(layout, wording, colour, behaviour), not code to port. **All figures, school names
and dates are illustrative.**

`png/` holds a screenshot of every screen; `dc/` holds the source `.dc.html` boards
(the design canvas format: an `<x-dc>` template plus a small logic class).

| Screen | PNG | Source |
|---|---|---|
| Teacher home, GCSE + Post-16 (mid-tone) | `home_teacher.png` | `MidTeacher.dc.html` |
| SMT home (mid-tone, orange) | `home_smt.png` | `MidSMT.dc.html` |
| Primary SMT home (KS2) | `home_primary_smt.png` | `MidPrimarySMT.dc.html` |
| Head office home (orange field, bronze accent) | `home_group.png` | `MidGroup.dc.html` |
| Admissions home (sky) | `home_admissions.png` | `MidAdmissions.dc.html` |
| Old question home inside the prototype (superseded by the homes above) | `walk_home_prototype.png` | `Main.dc.html` |
| Walk "How many pupils take Geography?", screens 1–6 | `walk_many_1..6.png` | `Main.dc.html` (`WALKS.many`) |
| Walk "How well did they do?", screens 1–6 | `walk_well_1..6.png` | `Main.dc.html` (`WALKS.well`) |
| Walk "How do we compare with schools nearby?", screens 1–5 | `walk_nearby_1..5.png` | `Main.dc.html` (`WALKS.nearby`) |
| One vocabulary: icons, names, colours, labelling rules | `vocabulary.png` | `Vocabulary.dc.html` |
| Dumbbell view (walk size and dashboard size) | `dumbbell.png` | `Dumbbell.dc.html` |
| Walk outlines for Post-16, Admissions, SMT | `other_roles.png` | `OtherRoles.dc.html` (SMT drawn violet there: now orange) |
| Panel layer ladder in dark and light (+ an early mid-tone, colours superseded) | `themes_ladder.png` | `Themes.dc.html` |
| Sets library with stronger colour | `sets_library.png` | `SetsColour.dc.html` |
| Guided sets editor, feeders | `sets_editor_feeders.png` | `SetsGuided.dc.html` |
| Guided sets editor, rivals | `sets_editor_rivals.png` | `SetsGuidedRivals.dc.html` |
| School admin account page | `admin_account.png` | `MidAdminB.dc.html` |
| School admin membership page | `membership.png` | `Membership.dc.html` |

`Icon.dc.html` holds the glyph set used by the boards (copied from the app's own
icons: COLUMN_ICON_PATHS and PanelIcons, plus a new dumbbell glyph).

Note on the mid-tone pages: the "Dark · Mid · Light" switch in each header is part of the
design; the header and "Also here" band stay dark in Mid.
