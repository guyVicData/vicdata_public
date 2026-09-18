# Brief: exclude IGCSE-heavy independent schools from GCSE comparison (supersedes stage-1 Part D)

Builds directly on the stage-1 fixes round (`docs/vicdata_phase3_academic_results_stage1_fixes_brief_v1.md`,
report at `docs/vicdata_phase3_academic_results_stage1_fixes_build_report_v1.md`), currently
sitting uncommitted in the working tree. **Parts A, B, and C from that round are unchanged
and correct — don't touch `AcademicMapView.tsx`'s Leaflet fix, the Category-filter
fix, or the tooltip fix.** This brief replaces that round's Part D (a caveat shown
alongside the number) with what Guy actually decided once he saw it: these schools
get left OUT of GCSE comparison entirely, not shown with a caveat next to a
misleading number. Read `vicdata`'s own
`docs/vicdata_phase3_academic_results_summary_wordings_v1.md` §11 in full — it's
already been rewritten to the final decided design and wording; use it as written.

## What changed since the caveat was built, and why

Guy asked directly whether this could be simplified to "just Eng+Maths" as the gate.
Checked against real data for six real independent schools before answering:
Crosfields (URN 110155) has real, substantial `engmath_94_percent` (95.8–100%) and a
normal Attainment 8 (60–70) — genuinely comparable GCSE data. Leighton Park, Wellington
College, Sevenoaks, Charterhouse, and King's College School Wimbledon all show
`engmath_94_percent` at exactly 0% every year. None of the six have Progress 8
published at all (including Crosfields) — confirming Progress 8 presence/absence is
NOT a usable signal here (it's absent from independent schools generally, comparable
or not), but `engmath_94_percent` alone sorts this real sample perfectly. The `ebacc`
condition from the original trigger is dropped — EBacc's own definition requires
English+Maths among its components, so `ebacc_94_percent` is 0 in every real case
where `engmath_94_percent` is 0 anyway; checking both was redundant.

One condition was added that wasn't in Guy's own framing, flagged to him directly and
confirmed: restrict the gate to `establishment_type_group === "Independent schools"`.
A real state comprehensive hitting exactly 0% on Eng+Maths in a given year would mean
genuinely disastrous results, not an IGCSE curriculum, and shouldn't silently vanish
from GCSE rankings as if its data weren't real. `establishment_type_group` is already
a real column on the same `public.schools` table `fetchAcademicProfiles` already
queries (confirmed directly — it's one of `search_schools`'s own return columns,
selected `from public.schools` in that migration) — this costs one more column on an
existing query, not a new fetch.

## Part 1 — the gate itself

In `academic-data-view.ts`, replace `igcseExclusionLikely`'s current body (checks
`ebacc_94_percent`) with the simplified, real trigger:

```
engmath_94_percent === 0 && attainment8_average !== null && attainment8_average > 5
  && establishment_type_group === "Independent schools"
```

This needs `establishment_type_group` threaded onto `AcademicSchoolProfile`:
- Add `establishment_type_group: string | null` to the `schools` select in
  `fetchAcademicProfiles` (`supabase.from("schools").select("urn, current_name, town,
  easting, northing, establishment_type_group")`) and onto the returned profile object.
- Add the field to `AcademicSchoolProfile`, `WireAcademicSchoolProfile`, and both
  `serializeAcademicProfile`/`deserializeAcademicProfile` — it's a plain string/null,
  no Map-serialisation concern like `ageGenderCounts`.

Keep the function name `igcseExclusionLikely` (already used in two places from the
last round, already the right concept) — just change its body and add the new
parameter it now needs to read.

**Re-verify with real execution, not just types**: run it against all seven real
schools now on record for this feature — Leighton Park (110110), Wellington College
(110125), Sevenoaks (118952), Charterhouse (125340), King's College School Wimbledon
(102684) should all return `true`; Crosfields (110155) and Huntington School
(121673, the original control) should both return `false`. All seven URNs and their
real `engmath_94_percent`/`attainment8_average` figures are already in this brief and
the wordings doc — no need to re-derive them, just confirm the function produces the
right boolean for each.

## Part 2 — where exclusion applies, and the visible note

Compute, once per rendered view (in `AcademicDataView.tsx`, since it already has
`targetProfile` and `tickedProfiles` together), the set of KS4-excluded schools among
`[targetProfile, ...tickedProfiles]` — `stage === "ks4" && igcseExclusionLikely(p)`.
Thread the excluded set (or just the non-excluded group, whichever is cleaner given
each view's existing shape) down to Graphs/Rankings/Map alongside the props they
already receive, rather than each view recomputing it separately.

- **The school being viewed is itself excluded**: free snapshot card
  (`AcademicSnapshotCard.tsx`) drops the GCSE line entirely and shows §11's
  "isn't comparable... see its A-level results" sentence in its place (not a number
  with a caveat underneath — that's exactly what's being undone from the last round).
  Data View Overview (`AcademicGraphsView.tsx`) shows the same sentence where the
  headline stat would be. Rankings (`AcademicRankingsView.tsx`) shows it in place of
  a rank. KS2 and KS5 for the same school are completely unaffected — if the school
  has real A-level data, the KS5 tab should work exactly as normal.
- **One or more ticked (non-target) schools are excluded**: they're dropped from the
  spread/growth/trend calculations and the ranked list at KS4 (denominator shrinks
  accordingly — "#3 of 8" if 2 of 10 are excluded, not "#3 of 10"), and a visible note
  appears naming them, using §11's own singular/plural wording — not a silently
  shrunk group with no explanation. One reasonable place for this note: near the top
  of whichever section is affected (Overview, Growth/decline, Context-over-time,
  Rankings) — use your judgement on exact placement per section, but it needs to be
  visible wherever the group's composition has actually changed, not just once
  globally if that would read as detached from the specific chart it affects.
- **Map**: an excluded school gets no circle on the KS4 map at all — use §11's group
  note near the map's own legend, same list-and-reason shape as everywhere else.
- **Edge case, handle gracefully rather than render something broken**: if excluding
  every gated school leaves nothing real to compare (a comparator set made up
  entirely of IGCSE-heavy independents), use §11's own "none of the schools in this
  set have comparable GCSE figures" wording instead of an empty or broken chart.

## What NOT to build this round

- No change to A-level or KS2 — this is a KS4-only exclusion, full stop.
- No change to the Category (subject family) filter, map remount fix, or tooltip fix
  from the stage-1 round — those are done and correct, this brief only touches Part D.
- No attempt to re-derive a different metric for GCSE at these schools (Progress 8,
  subject-level, or otherwise) — already investigated directly with Guy; nothing
  better exists in DfE's public data at this project's scale, which is why exclusion
  (not a substitute metric) is the decided approach.

## Deliverable

Full report, same shape as every prior round. Confirm the gate's real output for all
seven named schools, confirm (via the real `/api/data-view/academic-schools` route or
equivalent server-side check, same discipline as the last round) that a comparator
set mixing excluded and non-excluded schools produces the right group/average/ranking
behaviour with the excluded ones genuinely out of the calculation, not just hidden in
the UI while still silently pulling down an average. Same honesty rule as last round
on the browser-dependent checks (note plainly whether one was available — if so, use
it this time for a real visual check of the note/exclusion behaviour, since that's
exactly the kind of thing a code read can't fully confirm). Build and test locally
only — do not commit, push, or touch hosted/production. Guy will review against
Leighton Park, Wellington College, Crosfields, and Huntington School himself before
anything ships.
