Read docs/vicdata_phase3_academic_results_remove_value_added_brief_v1.md in full and execute
it. Guy's call, closing out the Academic Results phase: value-added is patchy (KS5-only,
modern-years-only, many institutions/courses have no real figure), and he wants it removed
from the main academic views entirely for now -- it'll come back later as its own dedicated
tab, like a future "destinations" tab, not part of this round.

Scope: this is a DISPLAY removal, not a data-pipeline removal. Leave
ingest/sources/dfe_ks5_subject_value_added.py, its Supabase source table, and the raw ingest
completely untouched -- confirm with a diff that ingest/ wasn't touched, don't just avoid
editing it.

Real locations I confirmed by grep before writing the brief (verify directly yourself too):
SubjectAreaSection.tsx (the KS5 subject-mode "Results (value added)" card and its
resultsPctChange-stays-null reasoning), SubjectDeepDiveDrawer.tsx (same label, reuses
SubjectTable), SubjectTable.tsx (the actual value-added row + confidence-interval rendering),
AcademicGraphsView.tsx (threads valueAdded through to both of the above), academic-data-view.ts
(SubjectValueAdded type, parseSubjectValueAdded, two lookupReferenceData calls against
dfe_ks5_subject_value_added), and the academic-subject / academic-subject-comparison API
routes (valueAdded in their response payloads).

Remove every real display of a value-added figure or comparison -- the label, the number, the
CI sentence, the whole framing. Use judgement on how deep to strip the fetch/parse plumbing --
fine to remove it cleanly, fine to leave as unused dead code if removing it risks
destabilising something else sharing the same fetch. The real requirement is nothing renders
a value-added figure anywhere, not that every line of plumbing is gone. Say which you did and
why.

The one real open question, investigate with real data: once value-added is gone, the KS5
subject-mode Results card has nothing to show. Value-added was originally added because it
was the only source for KS5's real subject-level figure, before the bucket-aware points
rollup round existed. That round gave academic_subject_rollup real, bucket-scored points at
SUBJECT grain too, not just family grain. Check directly: does academic_subject_rollup have
usable real KS5 subject-level points coverage that could honestly fill this gap, same
discipline as always (never fabricate, only show what's honestly real)? If real coverage is
there, wire the card to it instead of leaving a gap. If coverage's too thin or it doesn't fit
cleanly at subject grain, leave it honestly suppressed with a clear "not available at subject
level" message and say why. Report the real coverage numbers before deciding either way.

Don't touch resultsPctChange's existing KS4-mode or family-mode behaviour -- only the KS5
subject-mode case value-added used to own.

Verify: sweep vicdata_public/src for value.added/valueAdded/value_added after the change,
confirm nothing renders in the UI (leftover comments/dead plumbing is fine, zero live
rendering is not). A real KS5 school with a real subject that used to show value-added: card
now shows either the new real subject-level points or a clear "not available" message, never
a blank space or stale label. KS4 and category/family Results completely unaffected.

Build report: every file touched and what changed, the real coverage numbers behind the
subject-level-points-fallback decision and which way you went, verification, and confirmation
ingest/ is untouched. Commit and push -- vicdata_public only, unless the ingest investigation
turns up something in vicdata worth flagging (not changing).
