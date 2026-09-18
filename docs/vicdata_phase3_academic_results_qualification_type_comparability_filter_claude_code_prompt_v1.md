Read docs/vicdata_phase3_academic_results_qualification_type_comparability_filter_brief_v1.md
in full and execute it. Two genuinely separate pieces -- don't conflate them.

**Part A** is a simple layout fix: move the existing stage buttons (KsStageSwitcher,
currently portalled into TopicTabs' row via stageSwitcherSlot) into one combined row with
the existing Qualification Type pills (Ks5CohortSwitcher), relabelled "QUALIFICATION
[stage buttons] TYPE [type pills]". Same labels, same behaviour, both controls unchanged
functionally. Do NOT rename any of the five existing TYPE pills (A-level/Academic/Applied
General/Tech Level/Technical Certificate) -- the brief explains why "Tech Level" and
"Academic" must keep their current names rather than being simplified to "T-level"/"IB".

**Part B** is new: a real qualification-type comparison filter, built from the brief's own
evidence-backed bucket table (A-level / IB / BTec & OCR / Other, each with a one-line
description, VRQ flagged with its own honest caveat rather than folded in as if comparable).
Verify the bucket assignment for all 33 real qualification-type strings programmatically
against real ingested data before building -- the brief lists them, but check them yourself
rather than trusting the brief's table blindly.

The brief recommends Part B live as its own new control, separate from Part A's row --
applied at both comparator-set membership (which schools count as comparable) and the
subject-family card/deep-dive drawer level (which entries show within one school's card),
sharing one bucket definition. This is flagged in the brief as a recommendation to confirm
with Guy before building, not a locked decision -- check with him in this session if there's
any ambiguity about where it should live before you build it, rather than guessing.

Build Part A first (no open questions). Build Part B against real data: confirm GCSE/A-level
behaviour is completely unchanged by this round (equivalence-check the same way the
qualification-type bugfix round did -- reimplement old vs new and diff real row counts, not
eyeballed). Confirm the VRQ caveat actually renders, not just exists in a data structure.

T Level is explicitly out of scope here -- a companion brief covers it separately, and this
filter should be built so a fifth bucket can be added later without restructuring what you
build now.

Full build report, same shape as every prior round: real data verified, not just code
inspection. Commit and push once verified, per the normal working pattern.
