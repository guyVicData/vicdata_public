Academic Results round 2 of 2: real Region/Nation-scale RANKABLE comparator
sets. Full detail in docs/vicdata_phase3_academic_results_region_nation_
comparator_brief_v1.md — read it in full before starting, and read Rolls'
own three real large-set implementations it points to (region_nation_rank()
and its two follow-up migrations, RankingsView.tsx's large-set branch,
GraphsView.tsx's large-set branch/aggregate-trends.ts) before designing
anything new — this round is reuse-heavy, not a from-scratch build.

Key finding already established, not to re-derive: unlike round 1's
choropleth, this does NOT need a cross-database join. vicdata's own
database already has everything a new `academic_region_nation_rank()` RPC
needs in one place — academic_headline_snapshot, school_entities.la_name,
la_name_region_crosswalk — confirmed directly. Model the new RPC on Rolls'
own region_nation_rank() shape.

Two of the three display surfaces are largely already solved: Map, because
round 1's `viewByArea` choropleth just needs Rolls' own auto-trigger
pattern (`isRegionOrNationScope`) applied once Region/Nation becomes a real
SetOption; Rankings and Graphs both have direct real prior art in Rolls'
own components (percentile+neighbour-window; aggregate-lines chart) to
mirror, not reinvent.

Real open questions the brief flags explicitly rather than deciding for
you: the new RPC's own filter-parity scope limit (Academic's filter surface
differs from Rolls'), whether it needs the same school_lineage/URN-reissue
fallback academic_headline_lookup has (this RPC is per-school, unlike
round 1's grouped geography RPC), and whether LARGE_SET_PROFILE_THRESHOLD
(200) transfers unchanged for Academic's own real set sizes. Confirm each
directly and name the real call made in the build report.

Wiring: reverse the one deliberate null-out in DataViewShell.tsx
(`regionOption={activeTopic === "academic" ? null : ...}`) once everything
downstream is ready to receive a real large set; give AcademicDataView's
own per-ticked-URN profile fetch the same large-set bypass
DataViewShell.tsx already applies to Rolls' own fetch.

This is a genuinely bigger round than prior ones — new backend RPC plus
three frontend large-set branches. Local build/test only, no commit/push.
Verify the new RPC against real hosted data for at least one real region,
spot-checked manually, not asserted from inspection. Full build report
naming every real design call, especially the two flagged-open questions.
