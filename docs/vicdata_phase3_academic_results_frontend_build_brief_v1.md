# Brief: build the Academic Results front end (vicdata_public) — free snapshot card +

paid Data View tab, all three key stages

Scoped directly from `vicdata_phase3_academic_results_frontend_spec_v1.md` — **read
that in full first**, every decision below cites a specific section in it. Also read
`vicdata_phase3_academic_results_summary_wordings_v1.md` for the actual sentence
wording to use (placeholders in `[brackets]` — fill with real values, don't rewrite
the wording itself unless something genuinely doesn't fit the real UI).

**Do not start this brief until `vicdata_phase3_academic_results_rpc_bridge_brief_v1.md`
(the `vicdata` + `vicdata_public` RPC-bridge round) is confirmed built, reviewed, and
committed.** Table existence alone is not the real dependency: `academic_headline_snapshot`,
`academic_subject_family_rollup`, and `academic_geography_aggregate` all grant `select`
to `authenticated` only, in `vicdata`'s own database — `vicdata_public` never holds
anything but the `vicdata` anon key, so it cannot read them directly no matter how
complete the backend round is. The real, load-bearing check is: do
`academic_headline_lookup`/`academic_subject_family_lookup`/`academic_geography_lookup`
exist as callable RPCs, are they granted to `anon`, and does a real test call from
`vicdata_public` (not just from a local `psql` session against `vicdata`) actually
return rows? If any of that isn't true yet, stop and say so — don't build against a
guessed shape, and don't treat "the tables exist" as sufficient on its own.

**Region/Nation-scale Rankings for Academic is explicitly not unblocked by that RPC
round either** (see its own Part C) — only ticked-comparator-set rankings are. Ship §5
below with the Region/Nation scale toggle hidden or disabled for the Academic tab
specifically (Rolls' own toggle stays exactly as it is), rather than wiring it to
something that would silently return wrong or empty results. This is a real, separate
follow-up round (a local snapshot table + sync script + ranking RPC inside
`vicdata_public` itself, mirroring `school_current_snapshot`/`region_nation_rank()`
end-to-end) — flag it, don't attempt a shortcut version of it here.

## Read this first

- `vicdata_phase3_academic_results_frontend_spec_v1.md` in full — the spec this brief
  implements.
- `vicdata_phase3_academic_results_summary_wordings_v1.md` — real candidate sentences
  for every view below.
- `vicdata_phase3_academic_results_topic_spec_v1.md` — the underlying data/tiering
  spec (subject taxonomy, tiering rules, care principles).
- `vicdata_phase3_member_data_view_spec_v1.md` and the build-results log
  (`vicdata_phase3_member_data_view_build_results_v1.md`) — the real, live Rolls Data
  View this reuses the shell, filter, and comparator-set machinery from. Read the real
  code before assuming any of its described behaviour still matches — this doc is a
  log across many rounds, not a live source of truth.
- The real code: `src/app/schools/[urn]/page.tsx` (the `ComingSoonCard` placeholder to
  replace), `src/components/data-view/DataViewShell.tsx` (the `TOPIC_TABS` array and
  `TOPIC_COLOURS.Academic`), `src/lib/tag-colours.ts`.
- `vicdata_phase3_academic_results_rpc_bridge_brief_v1.md` and its own build report —
  the real shape of `academic_headline_lookup`/`academic_subject_family_lookup`/
  `academic_geography_lookup`, and its Part C on why Region/Nation-scale Rankings is out
  of scope here (see the dependency note above).

## Goal

Land the whole Academic Results front end in one round, both integration points, all
three key stages together:

1. Free State of School page — replace the `ComingSoonCard title="Academic snapshot"`
   placeholder with a real snapshot card (spec §7).
2. Paid Member Data View — activate the "Academic" tab (spec §2), building:
   - Key-stage switcher as the primary navigation axis, category→subject drill-down
     filter beneath it (spec §2).
   - Map, three depth levels (spec §3) — headline (population-sized circles, trend/
     grade-band colour toggle), family (entries-sized, trend colour only for now —
     see explicitly-deferred below), subject (same as family, one level finer).
   - Graphs, four sections mirroring Rolls' shipped structure (spec §4).
   - Rankings, single active-metric ranking + rank-over-time (spec §5).
   - Subject-level table folded into Graphs' Overview once drilled to one subject
     (spec §6).
3. Comparator-set selection (tick-list, default lists, button row, Add/subtract
   window) reused unchanged from Rolls, re-pointed at academic data — confirm directly
   how it's currently wired for Rolls before assuming the same hooks work verbatim for
   a second topic; this is likely the first time that machinery has had to serve two
   topics at once, so flag anything that turns out to be more Rolls-specific than
   expected rather than silently forking it.

## Explicitly deferred, don't build this round

- **Grade-band percentage at family/subject level** (spec §9) — only average point
  score exists as a computed field below headline. Ship headline-level grade-band
  colouring; leave family/subject-level Map colour on trend-only until this is built
  (a small, separate follow-up — group real entries by grade, divide).
- **Vocational/BTEC point-score conversion** — show `avg_point_score` as genuinely
  unavailable for low-coverage families using `points_coverage_percent`, per the
  honest wording already drafted (summary-wordings doc §6). Do not attempt to compute
  or estimate a substitute figure.
- **New comparator-set types** (GCSE-results quintile, BTEC-heavy mix, niche A-level
  offering) — future round.
- The Destinations topic, and any change to existing Rolls behaviour beyond the
  shared comparator-set re-pointing above.

## Judgement calls, don't default without checking — write up the reasoning either way

- **Which GCSE grade-band threshold is the map's default** (English & Maths vs
  EBacc — spec §9): pick one, explain why, and confirm whether the colour-mode
  selector needs a third dimension for this rather than silently picking one.
- **Whether subject-family metrics get their own Rankings entry** (spec §5) — leaning
  toward no (Graphs only), consistent with Rolls' own deliberate single-metric
  cut-down, but decide against the real UI once built rather than assumed in the
  abstract.
- **Minimum-N threshold** for small-cohort suppression (spec §6, §9) — propose a real
  number grounded in what small-cohort noise actually looks like in the real ingested
  data, don't leave it unset.

## Deliverable

Same report shape as every prior round: what was built, real screenshots or a
described walkthrough of the free snapshot card and each Data View section for at
least one real multi-key-stage school (e.g. a through-school with GCSE + A-level) and
one KS2-only primary school, confirmation the comparator-set tick-list genuinely
carries the same selection across from Rolls (not a fresh proximity search), the
judgement calls above with your reasoning, and anything genuinely ambiguous written up
rather than guessed. Confirm directly that nothing was written to hosted/production
and no existing Rolls behaviour regressed.

Do not commit or push — build and test locally, write up the report, and stop there.
Guy and Claude (the other assistant) will review the real diff together and say when
to commit, per the established pattern for this project.
