# Teacher view — Rankings map, round 3: no basemap at card size, category colour, drop the inline list

Three separate, small changes to the same card, from Guy live against the shipped round-2 build (`8ea82ad`, dots-only overlays already fixed). vicdata_public only.

## 1. No basemap tiles at card size — dots only until fullscreen

Guy: "map should NOT show background map until we go full screen."

`src/components/data-view/AcademicMapView.tsx`, the map-init effect (~line 673-690): `L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);` (~line 682) unconditionally adds the real CARTO/OSM tile layer, whatever the container size.

Gate that one line on `!dense`: skip adding the tile layer when `dense` is true, so the Leaflet map still exists (still real lat/lng projection, still real pan/zoom, dots still correctly geo-positioned relative to each other) but nothing is drawn underneath them — a plain background instead of roads/place names/imagery. Confirmed safe to gate once at mount rather than react to `dense` changing later: `CardBox`'s own header comment already establishes that fullscreen mounts a **second, separate** instance of the map (`"each instance owns its own Leaflet map"`), so `dense` is fixed for the lifetime of a given `AcademicMapView` mount — no need to add/remove the tile layer on a live prop change.

Give the map container a plain neutral fill in dense mode (reuse an existing panel/box background CSS variable — whatever `RankingsMap`'s wrapper or the card box already uses — so it reads correctly in both themes) so the dots have a clean, quiet backdrop rather than Leaflet's own default white.

Also skip/hide the attribution control in dense mode (`attributionControl: false` on the `L.map()` call when `dense`, or equivalent) — attributing OpenStreetMap/CARTO for a basemap that isn't shown would look like a leftover.

When `dense` is false (fullscreen), everything is unchanged: real tiles, real attribution, exactly as today.

**What NOT to touch:** zoom controls, pan/zoom interactivity, the dashed "your school" ring, the dot markers themselves, the Data View's own (never-dense) map. All unaffected — only the tile layer and attribution control are conditional.

## 2. Dot colour tied to subject category, not a generic ramp

Guy: "also maps colours do not relate to anything - should probably be subject category specific or match qualification."

Real, previously-flagged gap: the last build report itself noted "subject mode colours with the ordinary grade-band ramp. The family-tinted ramp belongs to a category selection, which subject mode doesn't have." Guy's asking for exactly that.

The good news: the ramp-selection code already only checks whether a `familyId` prop is present — `src/components/data-view/AcademicMapView.tsx` ~line 832: `colour = familyId ? gradeBandColourForFamily(data.avgValue, minGrade, maxGrade, familyId) : gradeBandColour(data.avgValue, minGrade, maxGrade);` — and the legend key at ~line 1150 does the same (`stops={familyId ? gradeBandLegendStopsForFamily(familyId) : undefined}`). Neither line cares whether `subject` is also set. `rowDataByUrn`'s own data-selection already checks `subject` before `familyId` for which entries/avgValue to use (per this file's own comment, "in practice exclusive of familyId; subject mode is checked first"), so passing **both** `subject` and `familyId` together is safe: the dot's size/value still comes from the subject, only its colour hue comes from `familyId`.

**Which family to use — subject category, not qualification type.** Two real colour systems exist in this codebase and Guy offered either: the 8 real subject categories (`SUBJECT_FAMILY_COLOURS` / `src/lib/subject-family-colours.ts` — Sciences & Maths, Arts Media & Design, etc., the same ids `familyId` already expects), or the qualification-type colours already on the chips (`QUALIFICATION_FAMILIES` / green-GCSE, blue-BTEC&OCR, etc.). Use the **subject category** — it's the one `familyId`/`gradeBandColourForFamily`/`gradeBandLegendStopsForFamily` already exist for, so this is a prop-threading change, not a new colour system. If Guy would rather see the qualification colours on the map instead once he's seen this live, that's a real but separate follow-up (a new ramp function keyed by hex rather than family_id) — flag it as an open option in the build report rather than building both.

**Resolving it:** `src/lib/teacher-view-catalogue.ts` already has `familyFor(headline, subject): { id, label } | null`, reading the same `academic_subject_headline` rows Teacher view already has loaded — no new fetch. In `src/app/teacher/[phase]/page.tsx`'s `MapChip` construction (~line 678-700), add a `familyId: string | null` field via `familyFor(headline, i.subject)?.id ?? null`, and pass it through as a new `familyId` prop on the `RankingsMap` call (~line 1106-1114) and in turn from `RankingsMap` to `AcademicMapView` (mirroring exactly how `subject`/`subjectLabel`/`subjectBucket` were threaded last round).

With nothing ticked (map on whole-school headline), `familyId` stays null and the ramp is unchanged (the ordinary blue scale) — this only changes anything once a subject chip is active.

## 3. Drop the inline ranked list under the map — it's already a proper opt-in view

Guy: "we shouldn't have the general ranking list below the map" / "rankings will be something we call as an option when the user customises or adds complexity to the dashboard."

Good news: that mechanism already exists and doesn't need building. `src/lib/teacher-view-catalogue.ts`'s `rankingsViews()` already defines a real, separate, pinnable view — `specialView("rankings", "rank_list", "Nearest 10, as a list", ...)`, labelled "Ranked list · same ten as the map" — addable via the Rankings column's own `ColumnBuilder` ("Add a view"), same as its three sibling comparator sets. Its own render path (`page.tsx`'s `renderSpecial`, `rank_list` branch, ~line 761) uses `RankedSet`, which shows the same "N of M" anchor, the full ranked list, distance, and IGCSE-exclusion flags — a proper, more complete version of what the inline list shows.

The thing to remove is a **second, redundant, always-on copy** of the same idea, hardcoded directly into the default map view's own JSX: `src/app/teacher/[phase]/page.tsx`, inside the default `"nearest"` view's `renderSpecial` branch, the `{position && (<ul>...)}` block (~line 1118-1130) that lists the top 5 (or, fullscreen, all) neighbours by raw value under the map, with no distance or IGCSE-exclusion handling. Delete this block entirely. The default map view keeps its "N of M" figure above the map (unchanged, ~line 1057-1069) and the map itself; a teacher who wants the full list already has it one tick away via "Add a view" → "Nearest 10, as a list" — which is a better version of what's being removed, not a lesser one.

**What NOT to touch:** the "N of M" position figure and its sentence above the map — that stays on the default view, per Guy's own past instruction that the position is the anchor and never stands alone. The `rank_list`/`rank_same_sector`/`rank_local_rivals`/`rank_similar_size` pinnable views and `RankedSet` itself — unchanged, already correct. `ColumnBuilder`/"Add a view" mechanism — unchanged.

## Verification

Both phases, both themes, a real school with real neighbours:

1. Card size: the map background is plain (no roads/place names), dots and the existing dense caption/exclusion badge still show correctly, no leftover attribution text in the corner.
2. Fullscreen: real basemap tiles and attribution are back, exactly as before this round.
3. Ticking a subject chip colours its dots by that subject's real category (e.g. Biology should tint toward Sciences & Maths' blue, History toward Humanities & Social Sciences' amber) — cross-check against `SUBJECT_FAMILY_COLOURS`. With no subject ticked, the map's colour ramp is unchanged (plain blue).
4. The compact card no longer shows a plain ranked `<ul>` under the map. "Add a view" on the Rankings column still offers "Nearest 10, as a list" (and the other three sets), and picking it still shows the full `RankedSet` list, with distance/IGCSE handling intact.
5. The Data View's own Academic map — unaffected by all three changes (never passes `dense`, never had the inline list, its own family-colour mode already worked this way).
6. `tsc --noEmit` and `next build` clean.
