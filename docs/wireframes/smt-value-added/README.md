# VicData 0.8 wireframes — SMT Academic by qualification: Results · Entries · Value added

Exported from the Design canvas "VicData SMT — Value added and Academic mock-up" (8 Nov 2026), https://claude.ai/artifact/LAtoEbQyvcPSa8eP1odU6L. Each `.dc.html` is one board: plain HTML/CSS with the canvas's `<x-dc>` / `support.js` harness. `support.js` belongs to the design tool and is not included: **the files are a spec to read, not pages to run.** Read the markup and `<style>` blocks for exact values.

The plan these boards illustrate is `docs/v0.8/smt_value_added_plan_v1.md`. Where a board and the plan disagree, **the plan wins**: it records decisions made after some boards were drawn (noted below).

**Real data.** Every figure is real (vicdata-production, 8 Nov): Progress 8 to 2023/24; Post-16 value added 2023/24–2024/25; points per entry 2022/23–2024/25. Three things are mock-up stand-ins, not rules:
- **Sets** are the 10 nearest of the same sector offering the qualification, by straight distance. The build uses Teacher's rule (`findSurroundingSchools` + exact-qualification filter).
- **Region ranks** are `[r] of [N]` placeholders.
- **EPQ points** are `[x]` placeholders: VicData doesn't hold EPQ points yet.

**Colours.** Hard-coded hexes are illustrative. Use the app's real colour tokens for the same meaning, and build every screen in both themes. Bands use blue for above and orange for below (lightness differs as well as hue); your school is the SMT accent.

## Academic in Value added mode

Value added is a mode of Academic, not a dashboard (Guy, 8 Nov): SMT keeps four dashboards, and row 2 carries the **Results · Entries · Value added** switch beside the qualification chips. Every board shows this.

| Board | What it shows | Size |
|---|---|---|
| `Main.dc.html` | Leighton Park · Post-16 · A level · **chart**: ranked dot and 95% range, a line at 0, England strip; column 1 = the Post-16 lines | 1440×1230 |
| `LP-GCSE.dc.html` | Leighton Park (independent) · GCSE · **ranking table** of the set's **state schools'** Progress 8; own row says why it has none; column 1 explains and summarises the state schools | 1440×1230 |
| `LP-NoState.dc.html` | A chosen set with no state schools: the message in the middle of chart, table and map | 1100×520 |
| `Phone.dc.html` | Leighton Park on a phone: column 1, then the views as tabs | 390×844 |
| `AB-Areas.dc.html` | Acland Burghley · Post-16 · All · **by subject area**, each area's subjects by qualification; † = placed in an area by VicData | 1440×1230 |
| `AB-GCSE-Map.dc.html` | Acland Burghley · GCSE · Progress 8 **map** coloured by DfE band (derived); column 1 = Progress 8 only | 1440×1230 |
| `SV-IB.dc.html` | Sevenoaks · Post-16 · IB · chart; the default set reaches 59 km to find 10 IB schools | 1440×1230 |
| `PM-Option1.dc.html` | Plumstead Manor · Applied · **OPTION 1 — chosen**: DfE's headline types (Applied general, Tech level), switch above the table | 1440×1230 |
| `PM-Option2.dc.html` | Plumstead Manor · Applied · Option 2 — **rejected** (one line per qualification and size). Kept for reference only; don't build it | 1440×1230 |

## Academic in Results and Entries modes, Post-16

| Board | What it shows | Size |
|---|---|---|
| `AC-LP-Chart.dc.html` | Leighton Park · A level · **points chart** (quarters within the set, set median); column 1 = points per entry + DfE grade equivalent per line; trends: points over time, every line's change, **entries mix** (shows Leighton Park's IB ending) | 1440×1230 |
| `AC-PM-Table.dc.html` | Plumstead Manor · Applied · **ranking table**, Applied general · Tech level switch | 1440×1230 |
| `AC-PM-Areas.dc.html` | Plumstead Manor · All · **subject areas by qualification**, each subject ranked only against the same subject in the same qualification | 1440×1230 |
| `AC-SV-Map.dc.html` | Sevenoaks · IB · **map** coloured by quarter of the set | 1440×1230 |
| `AC-PM-Entries.dc.html` | Plumstead Manor · All · **Entries mode** (the Results · Entries switch in the control bar): each subject's entries, three-year counts, **XS–XL size against England** (fifths of schools entering that subject in that qualification), share of the school's Post-16 entries against the set's typical school, how many of the set offer it; trends: biggest moves, entries mix, where the mix differs most from the set. Column 1's "set's typical [x]%" is a placeholder | 1440×1230 |

## Where boards lag the plan

- The trend's dashed "due mid-Nov" box for 2025/26 is a placeholder: the year appears when DfE publishes it, with no code change.
