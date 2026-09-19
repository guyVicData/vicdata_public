# Remove value-added from the academic views — defer to its own future tab

Guy's call, closing out the Academic Results phase: value-added currently appears in a handful of places across the site, but coverage is patchy — many institutions and courses have no real value-added figure at all, since it's sourced from a single, KS5-only, modern-years-only DfE dataset (`dfe_ks5_subject_value_added`). Rather than leave a partial, sometimes-there-sometimes-not metric sitting inside the main academic views, take it out entirely for now. It'll come back later as its own dedicated tab, alongside a similarly-scoped future "destinations" tab — not part of this round.

**Scope: this is a display/UI removal, not a data-pipeline removal.** Leave `ingest/sources/dfe_ks5_subject_value_added.py`, the underlying Supabase source table, and the raw ingest completely untouched — that real DfE data is worth continuing to collect for when the dedicated tab gets built. Nothing in `ingest/` should change as part of this round.

## Real locations, confirmed by grep before writing this brief (verify directly yourself too, don't just trust this list)

- `src/components/data-view/SubjectAreaSection.tsx` — the KS5 subject-mode "Results" card is explicitly labelled `Results (value added)` when a subject is selected at KS5 (search `" (value added)"` and `valueAddedInFamily`/`vaRows` around the `results`/`resultsPctChange` computation for subject mode). `resultsPctChange` is deliberately kept null for this case (value-added centres on/crosses zero, so a %-change is mathematically unstable) — that reasoning goes away once value-added itself is gone, so re-check what `resultsPctChange` should do for whatever replaces it (see below).
- `src/components/data-view/SubjectDeepDiveDrawer.tsx` — same `Results (value added)` label and rendering, reusing `SubjectTable`.
- `src/components/data-view/SubjectTable.tsx` — the actual value-added row rendering (the value plus its confidence interval, "likely between X and Y once normal year-to-year variation is accounted for").
- `src/components/data-view/AcademicGraphsView.tsx` — threads `valueAdded`/`SubjectValueAdded` through to `SubjectTable` and `SubjectDeepDiveDrawer`; also carries the comment explaining why entries and value-added rows for the same subject don't always merge cleanly (methodology exclusions, too-new subjects) — useful context, not necessarily code that needs to change if it just stops being invoked.
- `src/lib/academic-data-view.ts` — `SubjectValueAdded` type, `parseSubjectValueAdded()`, and the `lookupReferenceData({ sourceId: "dfe_ks5_subject_value_added", ... })` calls (two of them) that fetch it into `subjectData`/`comparatorSubjectByUrn`.
- `src/app/api/data-view/academic-subject/route.ts` and `academic-subject-comparison/route.ts` — the API routes that currently include `valueAdded` in their response payload.

## What to do

Remove every real DISPLAY of a value-added figure or value-added comparison from the site — the label, the number, the confidence-interval sentence, the whole "Results (value added)" framing. Don't leave a partial or half-labelled remnant anywhere.

Use real judgement on how deep to go in each file: stripping the fetch/parse plumbing (`SubjectValueAdded` type, `parseSubjectValueAdded`, the two `lookupReferenceData` calls, the API route fields) is fine to do if it's clean and low-risk, but it's also fine to leave it in place as unused/dead code if ripping it out risks destabilising something else that shares the same fetch — the real requirement is that nothing renders a value-added figure anywhere in the UI, not that every line of plumbing is gone. Say which approach you took and why.

**The one real open question, worth investigating with real data rather than guessing**: once value-added is gone, the KS5 subject-mode "Results" card currently has nothing to show in its place — value-added was originally added because it was "the only source for KS5's real ... figure" at subject grain, before the bucket-aware points rollup round existed. That round now gives `academic_subject_rollup` real, bucket-scored points at subject grain too (not just family/category grain) for every bucket with a real challenge table. Check directly: does `academic_subject_rollup` have usable, real KS5 subject-level points coverage that could honestly fill this gap (the same way family-grain Results now shows real bucket-scored points instead of being suppressed)? If real coverage is genuinely there, wire the KS5 subject-mode Results card to read from it instead of leaving an empty gap — same discipline as always, never fabricate or borrow, only show it where it's honestly real. If coverage is too thin or the metric doesn't fit cleanly at subject grain, leave the card honestly suppressed with a clear "not available at subject level" message instead, and say why. Either way, report the real coverage numbers you found before deciding.

Don't touch `resultsPctChange`'s current KS4-mode or family-mode behaviour — this only concerns the KS5 subject-mode case that value-added used to own.

## Verify

- Sweep `vicdata_public/src` for `value.added`/`valueAdded`/`value_added` after the change and confirm nothing renders in the UI — comments or unused type/plumbing code left behind is fine and worth noting, but zero live rendering.
- A real KS5 school with a real subject that used to show a value-added figure: confirm the card either shows the new real bucket-scored subject-level figure (if that's what you built) or an honest, clearly-worded "not available" message — not a blank space or a leftover label.
- KS4 and category/family-mode Results are completely unaffected.
- `ingest/` is untouched — confirm with a diff, not just by not having edited it.

## Deliverable

Build report: every file touched and what changed in it, the real coverage numbers behind the subject-level-points-fallback decision and which way you went, the verification above, and confirmation the ingest pipeline was left alone. Commit and push, `vicdata_public` only unless the ingest investigation turns up something in `vicdata` worth flagging (not changing).
