# Qualification-type comparability filter v2: replace DfE's blended pills in place, compute real DfE-consistent points per bucket

**Supersedes `vicdata_phase3_academic_results_qualification_type_comparability_filter_brief_v1.md`.** v1 recommended keeping the new comparability buckets as a separate control from the existing five DfE pills. Guy has since decided differently: **the new buckets replace the DfE pills, in the same place they currently sit.** This version reflects that decision and the real technical work it requires.

**Before doing anything else**: check your own recent commit history on `AcademicDataView.tsx`/`academic-data-view.ts` for what the v1 brief's round already built (the layout merge, and whether a separate Part B control was started). Report what you find. This brief may need to undo or rework part of that rather than build on top of it blindly.

## What's changing and why

Today's five pills (`KS5_COHORT_OPTIONS`: A level / Academic / Applied General / Tech Level / Technical Certificate) are DfE's own pre-blended headline categories, each wired to a real DfE-published points figure (`TALLPPE_ALEV_1618`, `TALLPPE_ACAD_1618`, `TALLPPE_AGEN`, `TALLPPE_TLEV`, `TALLPPE_TechCert`). These get replaced, in the same "TYPE" position in the row, by the real-world buckets confirmed with Guy this round:

```
QUALIFICATION [KS2] [GCSE] [Post-16]     TYPE [A-level] [IB] [BTec & OCR] [Other]
```

**The real technical problem this creates**: DfE has never published a pre-blended headline figure for three of these four buckets. "A-level" matches DfE's own A-level figure directly. But DfE's "Academic" cohort blends A-level+IB together -- there's no pure IB figure. DfE's "Applied General" and "Tech Level" are two separate figures, and Cambridge Technicals split across both by subject area (confirmed last round) -- no single DfE figure matches a combined "BTec & OCR" bucket. "Other" was never a coherent DfE category at all.

**The resolution -- real, not UCAS Tariff**: DfE's own points guide ("Performance points: a practical guide") is explicit that its system must never be compared to UCAS Tariff. But the same guide publishes pre-calculated `challenge` values **per individual qualification** -- A-level, IB, BTEC, and OCR Cambridge Technical each have their own real table, not just DfE's coarser pre-blended cohort output. DfE's own formula is `points = size x challenge`, summed across real entries and divided by entry count for an average. This means a genuine, DfE-consistent points figure can be computed for IB alone, and for BTEC+OCR combined, directly from real subject-grain grade data -- never touching UCAS Tariff, staying entirely within DfE's own methodology, just computed at a finer grain than DfE happens to pre-aggregate.

**A real head start already exists in the ingest**: confirmed in `dfe_ks5_subject_results.py`'s own comments (the 2026-09-12 Haverstock School investigation), real entries already carry an `a_level_equivalent_size`/`asize` field -- this is very likely already DfE's own "size" component (GLH converted to A-level-equivalent size). Check whether this is real and usable before treating "size" as something to re-derive from scratch.

## Per-bucket points plan

- **A-level**: keep using DfE's own real published `TALLPPE_ALEV_1618` figure directly, unchanged. This is the most scrutinised figure on the page -- don't recompute it when DfE's own real number already matches this bucket exactly.
- **IB**: compute from real subject-grain IB entries (IBO Higher/Standard level components, International Baccalaureate Diploma points, IBO Diploma Programme Core, IB Combined Certificate) x DfE's own published IB challenge table.
- **BTec & OCR**: compute from real subject-grain BTEC + OCR Cambridge Technical entries x DfE's own published BTEC and OCR Cambridge Technical challenge tables (two real DfE tables, combined into one weighted bucket average across every entry in the bucket).
- **Other**: EPQ, Core Maths, Free-standing Maths, Pre-U, VRQ, Other General. This bucket was deliberately built as a catch-all of qualifications that are NOT comparable within themselves (VRQ especially -- confirmed genuinely opaque, spans multiple real differently-sized qualifications under one DfE label). **Do not compute or show a single headline points figure for "Other."** Show its real subject-level content with each qualification's own honest one-line note (from the v1 brief's table), no summary number implying they're one comparable thing.

## Real verification required before computing anything

1. Fetch DfE's current "Performance points: a practical guide" directly and confirm the real challenge tables for A-level, IB, BTEC, and OCR Cambridge Technical -- map every one of the 33 real ingested `qualificationType` strings (from the companion filter work) to its correct table and grade structure. Don't assume a qualification's table from its name alone; verify against the guide's real content, the same discipline used for the Cambridge Technical Applied-General/Tech-Level split last round.
2. Confirm whether `a_level_equivalent_size`/`asize` in the real ingested data is genuinely DfE's own size value (matching the guide's Table 1 GLH conversion) before relying on it -- check a handful of real rows against the guide's own worked conversions.
3. Equivalence-check the new A-level headline figure (unchanged, still `TALLPPE_ALEV_1618`) against what's live today, to confirm nothing regressed in the pill replacement itself.
4. Compute IB and BTec & OCR figures for a handful of real schools (an IB school, Capital City College for BTec & OCR) and sanity-check the resulting average points look plausible against DfE's own published component-level figures for those same schools, where DfE happens to publish anything comparable (e.g. DfE's blended "Academic" figure for an IB-heavy school should be in the right neighbourhood of a computed pure-IB figure, even though they're not the same number).

## What stays from v1, unchanged

The real bucket groupings, splits, and one-line descriptions (A-level / IB / BTec & OCR / Other, with BTEC-only/OCR-only sub-splits and VRQ's own caveat) are unchanged -- see the v1 brief for that table if you need it again. The subject-family card and comparator-set-level filtering (Part B of v1) still applies using these same buckets, and the brief's own recommendation there -- both comparator-set membership AND subject-family card/drawer filtering, sharing one bucket definition -- stands, confirmed by Guy. Only the headline TYPE row's relationship to DfE's pills has changed.

T Level is still out of scope here -- its own brief (`vicdata_phase3_academic_results_t_level_ingest_brief_v1.md`) already uses UCAS Tariff specifically because, unlike A-level/IB/BTEC/OCR, DfE has never published any challenge table for T Level at all ("T Level Points for 16-19 performance tables will be shared in due course" -- confirmed absent from the same guide used here). That's still the right call for T Level and doesn't change.

## Deliverable

Report what the prior v1 round already built before changing anything. Real verification of DfE's challenge tables against the real 33 qualification types, not assumed. Real computed IB and BTec & OCR points figures, sanity-checked against real schools. A-level's figure stays DfE's own real number, unchanged. "Other" gets no invented headline points figure. Full build report. Commit and push once verified.
