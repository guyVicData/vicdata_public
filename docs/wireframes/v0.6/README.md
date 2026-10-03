# VicData 0.6 wireframes

Exported byte-for-byte from the Design canvas "VicData 0.6 — Dashboard editor & dataset chooser" (3 Oct 2026). Each `.dc.html` is one board: plain HTML/CSS with a small `<x-dc>` / `support.js` harness and, on some, a logic block. Read the markup and `<style>` blocks for exact values. `support.js` belongs to the design tool and is not included; the files are a spec to read, not pages to run.

Hard-coded hexes in boards are illustrative. Use the app's real colour and icon tokens for the same meaning, and build every screen in both themes (see the night prompts' "Pixel-perfect" section).

| Board | What it shows | Size |
|---|---|---|
| `Main.dc.html` | 0. Library — My dashboards (entry point, + New) | 390×844 |
| `New1.dc.html` | New dashboard · Step 1 — name, start from, main data, colour | 390×844 |
| `New2.dc.html` | New dashboard · Step 2 — layout, accordion, linked dashboards | 390×844 |
| `New3.dc.html` | New dashboard · Step 3 — columns: data + compared to | 390×844 |
| `New4.dc.html` | New dashboard · Step 4 — here's what you'll get | 390×844 |
| `Ch3Pick.dc.html` | Add a view — opens here: ready-made views, pre-filled from the column | 390×760 |
| `Ch3Adjust.dc.html` | Customise — numbers, years, look and title on one screen (forks to a custom view) | 390×760 |
| `Ch3Empty.dc.html` | Nothing built yet — loosen a choice, or (super-admin) add a placeholder | 390×760 |
| `Ch1Data.dc.html` | Step 1 of 3 — Data: one family open, one decision per band | 390×760 |
| `Ch2Focus.dc.html` | Step 2 of 3 — two numbered blocks: which part of school; compare with | 390×760 |
| `Ch2Subject.dc.html` | 2a — Subject picker (only if a different subject is picked) | 390×760 |
| `Ch2Custom.dc.html` | 2b — Custom area (only if Custom area is picked) | 390×760 |
| `Editor.dc.html` | Editor — super-admin edit mode on GCSE Candidates | 1280×1120 |
| `Assign.dc.html` | Assign / share — super-admin to roles (School-Admin: teams) | 390×760 |
| `Icon.dc.html` | Dashboard icon — from a view, icon set or upload | 390×760 |
| `Skeleton.dc.html` | Skeleton dashboard — planned panels, one ready to swap in | 1280×760 |
| `CopyTo.dc.html` | Copy a view — to a dashboard (or new one) or a meeting, then pick the slot | 390×760 |
| `Meeting.dc.html` | Meeting — a 16:9 non-scrolling dashboard per slide, same 385×256 panels (3×2 fits exactly) | 1600×980 |
| `CopyToMeeting.dc.html` | Copy to a meeting — pick a slide; it re-arranges (1 → 2 across → 3 → 3×2) | 390×760 |
| `MeetingPlay.dc.html` | Meeting playground — working prototype: swap, move between slides, layouts, titles, undo | 1440×900 |
| `HomeSMT.dc.html` | Role home — SMT (switch shows only for people given several roles, e.g. SMT + Teacher) | 390×844 |
| `People.dc.html` | School-Admin — People: roles as a set, approvals | 390×844 |
| `Teams.dc.html` | School-Admin — Teams: automatic from roles + made by you | 390×844 |
| `MeetingsArchive.dc.html` | Meetings — Archive tab, Reuse for next meeting | 390×844 |
| `PhoneDash.dc.html` | Custom dashboard on a phone — columns as tabs | 390×844 |
| `PickEither.dc.html` | Add a view — row time 'Either': grouped, with a data-gap warning tag | 390×760 |
| `RowSettings.dc.html` | Row settings — name, Time, panels, open by default | 390×760 |
| `ColumnChange.dc.html` | Column data changed — keep / remove / swap each view that no longer fits | 390×760 |
| `SpanAsk.dc.html` | Spanning panel over mismatched columns — asked once | 390×760 |
| `Platform.dc.html` | Super-admin — schools, per-school switches, look-as-role | 1280×760 |
| `History.dc.html` | Editor — draft vs live, History panel: preview, restore, compare | 1280×760 |
