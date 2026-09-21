# VicData Phase 3 — Teacher view: dashboard card mechanism — titling, fullscreen v2, light theme, map background (round 5 brief v1)

## Context

Round 4 shipped the box-level structure for the Teacher view dashboard cards (`GCSE/Post16-Dashboard[-Desktop].dc.html` mockups, Design artifact Version 33): column header = icon + natural-language question only; each pinned view gets its own bordered "box" inside the column, with a small box title, a fullscreen toggle and a share icon (placeholder) in its top-right corner, and one "Edit this view →" link per column, positioned under the box(es).

Guy then asked to resolve six points before building further (verbatim, his message):

> a) graph / map titles — these do need careful working out and we should do that mechanism now — we have already some natural language questions attached to data sets in the build — have a look at how the site currently titles each graph / map. NB I want to restrict choices quite tightly so we can get the titles well worked out — maybe we talk about what 'edit this view' shows in each column; and that will help generate titles.
> b) full screen — let's get this designed so it can be built and working (NB we already have it on the advanced dashboard — so this is v2 and should be even better)
> c) share is a placeholder for now — that's fine
> d) light view I think we should build now — again we already have this in the advanced dashboard.
> e) a thing I asked a while ago which connects with a) above — I want to see somehow a complete set of choices for graphs; so that I can pick ones that really work well with each data set.
> f) map view — we should load the location map in the background, exactly the same as the advanced maps.

Followed by a clarification on (f): fullscreen on the Rankings card should also load the location map, not just the small card.

This brief records the mechanism decided for each point and what's now reflected in the mockups (Design artifact, Version 34). It is grounded in prior build reports and design briefs already in this project (cited below), not a fresh read of the current repo this round — Claude Code should verify the specific real APIs/selectors named below before wiring them up, per usual practice.

## a) + e) Box titles and the "complete set of choices" — one mechanism, not two

These turned out to be the same problem. Every Teacher view card already has a real, tightly-scoped `VIEWS` catalogue behind its "Edit this view" screen (`GCSE/Post16-Edit-Candidates/Results/Context/Rankings.dc.html` — these already existed pre-round-5 and mirror the "gated, not flat catalogue" principle from the design brief §7: choices scoped to column topic, then ticked subject(s), then qualification-type-comparability). Each `VIEWS` entry already had a full-sentence `label` (e.g. "Entries this year, by qualification type") and a `description`.

What was missing was a short (2–4 word) form for the box title. Round 5 adds a `shortTitle` field to every entry in every `VIEWS` array. The box a view populates on the dashboard is titled with that view's `shortTitle`; ticking a second view in an Edit screen pins a second box with its own `shortTitle`, consistent with round 4's "each graph sits in its own box, one Edit-this-view link per column" rule.

Confirming this is the right mechanism: deriving `shortTitle` from each column's *default* view lands exactly on the box titles already hardcoded in round 4 — "Entries this year", "Average point score", "Share of entries", "10 nearest schools" — without adjusting any of them. The mechanism and the mockup were already in agreement.

This is the same idea as the live site's existing filter-reactive chart titling (`vicdata_phase3_member_data_view_graphs_redesign_v1.md`: "Roll Trends since 2019-20" becomes "Post 16 Roll Trends since 2019-20" when the Post-16 filter is active — every chart's title updates live as filters change), just applied at box level instead of full-chart level, and it's a direct instance of the "natural-language-question headings" load-bearing principle from the Teacher view design brief §14.

**Subject-category templating — resolved, not open.** The School Context views' "vs. subject category" / "category vs. category" `shortTitle`s use "Humanities" as an illustrative placeholder in the mockup, but the real category name should be templated from the platform's existing, already-built subject-family taxonomy — not invented or left as a gap. This is real and live elsewhere in the product: 8 families (Sciences & Maths; Humanities & Social Sciences; Languages & Literature; Arts, Media & Design; Business & Law; Technology, Engineering & Construction; Health & Care; Enterprise & Applied Studies), derived from Ofqual/DfE Sector Subject Areas, stored in `subject_families`/`subject_family_map` (`raw_subject` × `ks_stage` → family), and already exposed to the public frontend via the `academic_subject_family_map_lookup` RPC — used today in `CategoryFilter.tsx`, `AcademicGraphsView.tsx`'s entries-share donut, and `SubjectAreaSection.tsx` on the advanced Academic Results dashboard. "Humanities" in the mockup stands for "Humanities & Social Sciences" for a Geography teacher, resolved via that same lookup — Claude Code should reuse it (or Teacher view's own existing resolution of family for the teacher's ticked subjects, if that already exists) rather than build a second one.

The current `VIEWS` catalogue per card, for reference (identical shape GCSE and Post-16, values differ slightly by qualification names — see each Edit screen for the literal list):

- **Candidates**: entries this year (default) / entries, 5-year trend / entries vs. Nearest 10 / entries as % of year group
- **Results**: average point score (default) / points, 5-year trend
- **School Context**: share of entries (default, always-on pie) / vs. qualification average / vs. subject category / vs. whole school / vs. custom comparison set / category vs. category
- **Rankings**: 10 nearest schools, map (default) / nearest 10, as a list / nearest 10, same sector / local rivals / similar-sized schools

## b) Fullscreen v2

The current advanced-dashboard fullscreen (`FullscreenChartModal`) is "one chart, bigger" — an overlay that stays open until closed, not a page navigation. Round 5's mockup fullscreen is designed as a genuine floating modal, replacing round 4's "box takes over the grid row, siblings disappear" trick:

- A dimmed, blurred backdrop covers the whole dashboard; clicking it closes fullscreen.
- The fullscreened box floats above the backdrop at near-full-viewport size (roughly a 4–6% margin on desktop, 3% on mobile), scrollable if its content needs more room than that.
- Everything else keeps rendering underneath, unlike round 4 where other columns vanished from the grid entirely — this reads as a real modal, not a layout reshuffle.
- The existing "Exit full screen" icon in the box header still closes it; the backdrop click is the second, more standard affordance.

This is a UX target for Claude Code to build against, not a literal port of the mockup's CSS — `FullscreenChartModal`'s actual implementation should be checked for whether it already supports this floating-panel-plus-backdrop pattern or whether it needs extending (it may currently only support single-chart content; Teacher view fullscreen needs to also host the Rankings map and its chip/legend furniture).

## c) Share

No change this round — stays a non-functional placeholder (`onClick="() => {}"`, `title="Add to a custom dashboard or Meetings"`), per Guy's explicit confirmation.

## d) Light theme

The real site already has a light/dark toggle for Teacher view, scoped to Teacher view's own CSS subtree (`vicdata_phase3_teacher_view_phases_3_10_completion_build_report_v1.md`, Q15 — verified in compiled CSS with dedicated light-escape guards), with print piggybacking on it via `beforeprint`/`afterprint`. That mechanism is not new.

What's new in round 5 is the UI it needs to cover: box titles, the fullscreen modal, and the map background/legend furniture didn't exist when that toggle was built. The mockup now includes a full light-mode pass (all four dashboard boards) so Guy can review the specific combinations — light mode + fullscreen modal open, light mode + Rankings map — rather than reviewing light mode and the new card mechanism separately. Claude Code's job here is to confirm the existing light-theme CSS subtree already covers (or is easily extended to cover) this new markup, not to build a toggle from scratch.

## f) Map background

Real precedent: `MapView.tsx` (Rolls' canonical Leaflet map) and `AcademicMapView.tsx` (built to match it "as closely as possible") — bivariate encoding (size = count/entries, colour = trend/grade-band), dashed distance ring around the target school, floating overlay UI (view switcher, export button, colour toggle, dot-legend, trend colour key, size legend), `fitBounds` auto-zoom to the comparator set, scroll-to-zoom gesture handling. Real geographic infrastructure backing it: MSOA choropleth boundaries (ONS 2021), feeder-school coordinates via postcode geocoding, `COUNTRY_COORDS` for international pupils, LA/region crosswalk.

The `.dc.html` mockup tool cannot embed a live Leaflet map, so round 5 approximates it with a CSS grid-over-vignette texture (faint graticule lines + radial vignette) in place of the flat gradient placeholder used before — legible as "a map," not a mood gradient — sized at card height (~128–140px) normally and 460–500px when fullscreen, per Guy's follow-up that fullscreen should load the map too. A caption only shown in the fullscreen state says plainly that this is a static preview and the live build uses the same interactive map component as the other dashboards — that line should be **removed** once the real map is wired in; it exists only so the mockup doesn't overclaim.

**The real build should load the actual `MapView`/`AcademicMapView` component into the Rankings box**, in both its normal card size and its fullscreen size, rather than a new bespoke map — same bivariate encoding, same dashed ring, same legend conventions already established for the advanced dashboards' maps, scoped down to Teacher view's existing comparator-set vocabulary (Nearest 10 default, same-sector, local rivals, similar-sized).

## What's in the mockup now

Design artifact, Version 34 (https://claude.ai/artifact/Pp48VuSubaKRpgHwQJTrAs): `shortTitle` added to all eight `Edit-*.dc.html` `VIEWS` arrays; fullscreen-as-modal, light theme toggle, and the map basemap texture built into all four dashboard boards (`GCSE/Post16-Dashboard.dc.html` mobile, `GCSE/Post16-Dashboard-Desktop.dc.html` laptop).
