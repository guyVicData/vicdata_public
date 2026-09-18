# Closing out the Academic Results phase: archive convention + briefing refresh

Housekeeping round, not a feature round. Two things, both mechanical but both need real judgement applied per file rather than a blind regex sweep.

## Part A: establish and apply an archive convention

Both repos' `docs/` folders have accumulated a large flat pile of round-specific artifacts (brief/prompt/build-report triples, one set per round, going back months) alongside the small number of genuinely living reference docs. Convention, to apply now and going forward:

**Create `docs/archive/` in each repo** (flat, no further subfolders — the filenames are already self-describing enough that nested categorisation would just add another judgement call for no real benefit). Move into it, via `git mv` so history is preserved, every file that is a **round-specific working artifact**: a brief, a Claude Code prompt, a build/verification report, a handoff note — anything that was written to instruct or record ONE specific build round, now shipped. In practice this is the great majority of what's currently in both `docs/` folders.

**Leave at the top level of `docs/`** — these are standing references describing how the system currently works or currently stands, not a historical round's instructions:
- `vicdata_roadmap.md`
- `vicdata_briefing_gcse_what_is_measured_v1.md`, `vicdata_briefing_ks2_what_is_measured_v1.md`, `vicdata_briefing_post16_what_is_measured_v1.md` (see Part B — these are being refreshed this round, not archived)
- `STYLE.md`, `OPEN_QUESTIONS.md` (vicdata), `vicdata_backlog_v1.md`, `vicdata_data_view_open_questions.md` (vicdata_public) — living lists
- `vicdata_public/docs/reports/` — leave this folder and its contents completely alone; it's an existing, separate, dated review-log convention, not something this round touches

**Use judgement on the rest** — spec/design/investigation docs (`*_spec_v1.md`, `*_topic_spec_v1.md`, `*_design_v1.md`, mockup/reference files, scoping docs) that don't fit either bucket cleanly. If a spec's content is now fully superseded by shipped code and the refreshed briefing docs from Part B, archive it. If it still describes something real that isn't captured elsewhere (an intended design not yet fully realised, an open scoping question), leave it at the top level and say so in the report — don't guess silently either way on a file you're not sure about.

**Going forward**: once any future round's brief/prompt/build-report is confirmed shipped, move that round's own files into `docs/archive/` as a routine last step — worth doing as part of that round's own commit rather than letting the pile grow again.

## Part B: refresh the three briefing docs

`vicdata_briefing_post16_what_is_measured_v1.md` in particular is now significantly stale — it was written 2026-09-14, before T-Level ingest, the VRQ bucket move, and the whole IB Diploma round. It currently states things that are now flatly wrong, e.g.: "searching `dfe_ks5_subject_results` for 'T Level' as a qualification label found nothing real" (T-Level now has its own real bucket, pathway-family mapping, and DfE points table) and "the IB's own famous points total (out of 45) is not currently folded into the points conversion at all" (this is now built — `ib_diploma::avg_total_points`). Leaving a stale briefing in place is worse than no briefing at all, since a future reader (human or Claude Code) has no way to know which parts are still true.

Rewrite `vicdata_briefing_post16_what_is_measured_v1.md` as a new v2 (keep v1 for the archive, per Part A), verified against the live current code and data, not copied forward from memory of what it used to say. It should cover, accurately as of now:

- The real qualification-bucket system (`alevel`/`ib`/`btec_ocr`/`tlevel`/`other`) — what's in each, how each is scored or deliberately not scored, and why the buckets exist (DfE's own five cohort labels don't match how a school actually thinks about its own offer).
- The real grading tables now implemented for each bucket, including the IB Diploma Core's real three-column structure (Reflective Project / Extended Essay / Theory of Knowledge — Table 2g) and why the old two-column assumption was wrong.
- What "Baccalaureate" and the three Diploma Programme Core rows (`Learning Skills`/`Study Skills`/`Self Development`) actually are in the data, and why they're excluded from the subject system rather than treated as subjects.
- The new `ib_diploma::avg_total_points` headline metric — what it is, its real methodology, and how it differs from the existing bucket-level points figure.
- T-Level's real coverage now (pathway→family mapping, its own bucket, DfE's real points table).
- Update or confirm the UCAS Tariff section — check whether the primary-source verification the old doc flagged as outstanding (DfE's own `aps_per_entry` methodology spreadsheet) was ever actually resolved in a later round; say plainly if it's still open.

Check `vicdata_briefing_gcse_what_is_measured_v1.md` and `vicdata_briefing_ks2_what_is_measured_v1.md` too — the KS2 domain-comparison round and the GCSE exclusion round both happened since these were written. Update them if anything they state is now inaccurate or incomplete; if they're still accurate, say so rather than rewriting for its own sake.

Same convention as the phase's other briefings: verified live against the current code/data, not written from memory of what a round's build report said happened.

## Deliverable

Confirmation of what moved to `docs/archive/` in each repo (rough counts fine, don't enumerate 140 filenames), what was deliberately left at the top level and why, any file you weren't sure about and left in place, and the refreshed/confirmed state of all three briefing docs. Commit and push, both repos.
