# Teacher view — Rankings map, round 3: no basemap at card size, category colour, drop the inline list — build report

Covers `vicdata_phase3_teacher_view_rankings_map_round3_declutter_brief_v1.md`, all three changes. Three files changed: `AcademicMapView.tsx`, `RankingsMap.tsx`, `[phase]/page.tsx`.

## 1. No basemap at card size

In `AcademicMapView`'s map-init effect, the `L.tileLayer(...).addTo(map)` call now runs only when `!dense`, and `L.map()` gets `attributionControl: !dense`. The map instance itself is unchanged: same projection, pan/zoom, dashed ring, dots and zoom control. `dense` is read once at mount, which is safe because fullscreen mounts its own separate instance (CardBox), so `dense` never changes for one map's lifetime.

In dense mode the map element gets an inline `background: var(--box-bg)`. It is inline so that it beats leaflet.css's own grey container fill, and it resolves per theme: `#0e0e10` dark, `#f7f7f9` light. Non-dense (fullscreen, and the Data View) is untouched.

## 2. Dot colour from the subject's category

Prop-threading only, as the brief describes:
- Each `MapChip` gains `familyId`, via `familyFor(headline, i.subject)?.id`, from the headline rows already loaded.
- The page passes the active chip's `familyId` to `RankingsMap`, which passes it on to `AcademicMapView`.
- There, the existing `familyId ? gradeBandColourForFamily(...) : gradeBandColour(...)` (dots) and `gradeBandLegendStopsForFamily` (fullscreen colour key) pick up the category's ramp.
- The dots' figures still come from the subject, because subject mode is checked before family mode in `rowDataByUrn`, the tooltip, the size legend and the dense caption.
- With no subject ticked, `familyId` is null and the ramp is the ordinary blue.

The chips themselves keep their qualification colours. **Open option, flagged per the brief:** colouring the map by qualification type instead (green GCSE, blue BTEC & OCR, and so on) would need a new ramp keyed by hex rather than `family_id`. Not built; one to decide once this has been seen live.

## 3. The inline ranked list is gone

The default map view's always-on `{position && (<ul>…)}` list under the map is deleted. The "N of M" figure and its sentence above the map stay. The full list remains one tick away as the existing pinnable "Nearest 10, as a list" view (`rank_list`, rendered by `RankedSet`, with distance and IGCSE handling), which is unchanged, as are its three sibling sets and `ColumnBuilder`.

**Knock-on, flagged:** the map doesn't print, and the deleted list was also the default view's printable ranking (a comment said so, and has been updated). A teacher who wants the ranking in an export now pins "Nearest 10, as a list", which prints.

## Verification

**Checks:** `tsc --noEmit` clean; ESLint clean on all three files; `next build` passes.

**Real map, real data, measured.** A temporary local harness (deleted) rendered the real `RankingsMap` for Acland Burghley's real Nearest 10 at card height, dense and fullscreen side by side. Values were read from the DOM via headless Chrome:

| Case | Dense: tiles / attribution / fill | Fullscreen: tiles / attribution | Dot colours |
|---|---|---|---|
| GCSE, no subject, dark | 0 / none / `#0e0e10` | 6 / present | generic blue ramp (`#4a8df5`, `#245bd8`, `#1e3a8a`, …) — unchanged |
| GCSE, Biology, dark | 0 / none / `#0e0e10` | 6 / present | Sciences & Maths ramp (`#4770e0`, `#3662dd`, …) |
| GCSE, History, light | 0 / none / `#f7f7f9` | 6 / present | Humanities amber ramp (`#cc8952` … `#b45309`) |

`#b45309` is Humanities & Social Sciences' own `SUBJECT_FAMILY_COLOURS` light-theme value, and the Sciences & Maths ramp runs to its `#1d4ed8`. The dense caption and the "ⓘ 1 not shown" badge still show; fullscreen keeps its toggle, legend (now in the category's colours) and exclusion note.

**Data View unaffected:** it never passes `dense` (tiles and attribution as before) or a subject; its own family mode was already this code path; and it never had the inline list.

**Live verification: NOT done.** vicdata.co.uk still returns its Basic Auth gate to this session's browser, and the production preview link isn't available here. To check, both phases, both themes:
1. the card map is plain with no attribution;
2. fullscreen has its tiles;
3. Biology tints blue and History amber;
4. no inline list sits under the map;
5. "Add a view" still offers "Nearest 10, as a list".
