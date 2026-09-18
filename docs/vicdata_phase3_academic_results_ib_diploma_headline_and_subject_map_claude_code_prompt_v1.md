Read docs/vicdata_phase3_academic_results_ib_diploma_headline_and_subject_map_brief_v1.md in
full and execute it. This is a bigger round than recent small fixes -- Guy's own first live IB
review surfaced three real problems, and scoping them properly (I verified all of this directly
against live Supabase data before writing the brief, not assumed) surfaced a fourth, genuinely
new one inside code a previous round already shipped and believed correct.

Four real, confirmed findings, all detailed with real evidence in the brief:

1. "Baccalaureate" (under qualifications "International Baccalaureate" and "International
   Baccalaureate Combined Certificate") is DfE's own whole-Diploma total score row, not a
   subject -- currently mis-mapped into the "Enterprise & Applied Studies" family as if it were
   an optional subject choice.

2. "Learning Skills" and "Study Skills" (under "IBO Diploma Programme Core") are the IB Core's
   TOK+EE bonus-point components, mandatory for every Diploma candidate, not subject choices --
   also mis-mapped into "Enterprise & Applied Studies". Real complication: "Study Skills" is
   ALSO the genuine DfE name for EPQ ("Extended Project (Diploma)"), a real, legitimate, large
   subject that must NOT be removed alongside the IB Core one of the same name -- the fix has to
   tell these apart by qualification, not text.

3. A THIRD Core component exists that the codebase doesn't currently know about: "Self
   Development" (same qualification, "IBO Diploma Programme Core", size 0.2) -- confirmed real
   and distinct (not a renamed alias -- it co-occurs with Learning/Study Skills in every real
   period 2021-2024 at a consistently smaller, separate school count). This directly contradicts
   an existing, previously-verified comment in dfe-qualification-buckets.ts's IB_CORE_BY_SIZE
   table ("the two real sizes happen to identify them") -- Self Development shares Study Skills'
   own size (0.2), so it is very likely being silently scored through Study Skills' own points
   table today. Research whether Self Development is genuinely IB-Core-matrix-eligible content
   (in which case the scoring needs to become subject-aware, not just size-aware) or should be
   excluded from bucket points the same deliberate way the whole Diploma total already is --
   don't guess, check DfE's own real documentation for what it represents.

4. "Mathematical Studies" is a real, live grade-scale collision between "Core Maths
   Qualifications at Level 3" (letter grades) and "IBO Higher/Standard level component"
   (numeric grades 1-7) sharing one raw subject text -- confirmed at real schools with real
   co-occurring data in the same periods (a list of real URNs is in the brief).

Guy's decision: fix the root cause structurally (subject_family_map becomes qualification/
bucket-aware, reusing the already-tested bucket_for()/bucketFor() twins rather than inventing
new classification logic), not a narrow one-off patch -- this is the third time this shape of
bug has surfaced this arc (T-Level pathways, VRQ, now this). AND build the new "IB Diploma
total points" headline metric in the same round, not as a fast-follow -- confirmed there is no
existing DfE-published column for this (dfe_ks5_headline only has DfE's own blended cohort
categories, not a pure IB figure), so it's a genuinely new computation from the Baccalaureate
subject-level data (size 5, grades 24-45), using the same weighted-average methodology already
used elsewhere in this codebase. Placement: above the subject list, as the real headline
indicator IB schools look for -- exact placement/wording is your judgement call, state what you
decided and why.

The brief gives two real options for the structural fix's shape (extending
subject_family_map's own key vs. a smaller override table/list consulted first) and says to
pick whichever is the smaller, cleaner real diff once you're looking at the actual 282 existing
rows -- don't assume upfront. It also asks you to check whether KS4 has a live version of this
same qualification-collision problem before assuming it doesn't need the same treatment.

Precise, already-verified exclusion set for part B (removing Baccalaureate/Core components from
the subject system) is in the brief -- confirmed exact, nothing else hides under these
qualification/subject pairs.

Full build report per the brief's Deliverable section: the findings re-verified independently,
the structural fix's actual shape and why, the exclusion applied, the Self Development decision
and its reasoning, the new headline metric's real methodology and judgement calls, the
recompute, and the hand-checks (including specific before/after numbers if the Self Development
fix changes any real school's existing IB points figure). Commit and push once verified.
