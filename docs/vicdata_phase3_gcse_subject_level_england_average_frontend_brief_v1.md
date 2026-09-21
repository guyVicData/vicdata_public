# GCSE Results — subject-level national comparison anchor (dashboard consumption, KS4 only)

## Backend round shipped and verified — this round is cleared to start

The companion backend round (`vicdata` repo,
`docs/vicdata_phase3_gcse_subject_level_england_average_backend_brief_v1.md` /
`..._build_report_v1.md`) is live on production: `academic_subject_geography_aggregate`
is populated (21,691 rows: 208 national, back to 2020/21), and the new
`academic_subject_geography_lookup` RPC is granted to `anon` and independently
confirmed to return correct figures. `academic_geography_aggregate` (the existing
family/whole-school table) is untouched — still 42,639 rows.

**The confirmed real RPC contract** (from the backend build report — use this, not a
guess):

```
academic_subject_geography_lookup(
  p_ks_stage      text,             -- required, e.g. 'ks4'
  p_measure       text default null,
  p_grouping_type text default null,  -- 'la' | 'region' | 'national'
  p_grouping_keys text[] default null,
  p_subject       text default null,
  p_family_id     text default null,
  p_period_min    int default null,
  p_period_max    int default null,
  p_limit         int default null,
  p_offset        int default 0
)
returns table (
  grouping_type text, grouping_key text, ks_stage text, subject text,
  family_id text, measure text, period int, avg_value numeric,
  entries_total numeric, school_count int
)
```

Same shape as the existing `academic_geography_lookup`, with `subject` swapped in for
the sibling's family-only grouping. **Subject spelling matches
`academic_subject_rollup`/`academic_subject_headline` exactly** (e.g. "Maths
(General)") — the same vocabulary `headline`/`resultsFor()` already use for
`item.subject` in `[phase]/page.tsx`, so a direct string match against `item.subject`
is safe with no translation layer needed.

## Why this brief exists

The Teacher dashboard's Results card shows each ticked subject's score against "the
England average" — currently, at GCSE (KS4), that average is computed per subject
FAMILY, not per subject (`src/app/api/teacher/dashboard/route.ts`'s `englandAverages()`,
KS4 branch, reading `academic_geography_lookup`). Guy: "the whole point of comparisons
is meant to be that granular." The backend round's own before/after numbers show why
this matters, not just in principle: at 2024/25, Biology sits +0.82 above its family
average and Maths (General) sits −0.63 below it — the family figure was hiding a real
spread between them.

**Scope: KS4 only**, matching the backend round. KS5's anchor stays bucket-grain,
unchanged, for a later round.

## What to build

### 1. A new lookup wrapper in `src/lib/vicdata-reference.ts`

Add `lookupAcademicSubjectGeography()`, modelled directly on the existing
`lookupAcademicGeography()` a few lines above it in the same file — same
paged-`fetchPage` shape, same parameter set as that function but with `subject`/
`familyId` in place of the sibling's `familyId`-only filter, calling
`"academic_subject_geography_lookup"` with `p_ks_stage`, `p_measure`, `p_grouping_type`,
`p_grouping_keys`, `p_subject`, `p_family_id`, `p_period_min`, `p_period_max`,
`p_limit`, `p_offset` — the confirmed real parameter list above.

Define an `AcademicSubjectGeographyRow` type matching the confirmed real return columns
(`grouping_type, grouping_key, ks_stage, subject, family_id, measure, period,
avg_value, entries_total, school_count`).

### 2. Update `englandAverages()` in `src/app/api/teacher/dashboard/route.ts`

The KS4 branch currently reads:

```ts
const rows = await lookupAcademicGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY] });
return {
  basis: "family",
  values: rows.filter((r) => r.avg_value !== null).map((r) => ({ key: r.family_id, period: r.period, value: r.avg_value as number })),
};
```

Replace it with the new subject-grain lookup (same `groupingType: "national"`,
`groupingKeys: [NATIONAL_GROUPING_KEY]`, `measure: "avg_point_score"` filters), keyed
by `subject` instead of `family_id`, and rename the basis from `"family"` to
`"subject"` (update the `EnglandAverage`/return type's `basis: "bucket" | "family"` to
`"bucket" | "subject"` everywhere it's declared — the function's own signature and the
exported type). Update the function's own header comment (the one currently explaining
"GCSE: there is no national figure per subject or per qualification...") — that's no
longer true, say so and say why (the new subject-grain aggregate, backend round dated
2026-09-21).

### 3. Update `src/app/teacher/[phase]/page.tsx` to match

Two call sites currently branch on `englandAvg.basis === "family"` / read
`score.familyId` — both need to follow the type's rename to `"subject"`:

- `englandFor()` (~line 333-339): change
  `const key = englandAvg.basis === "bucket" ? comparabilityKey(phase, item.qualificationType) : score.familyId;`
  to key by `item.subject` instead of `score.familyId` for the non-bucket branch
  (`item` is already the function's first parameter and already carries `.subject` —
  no new data needed, and the RPC's subject spelling matches `item.subject` exactly,
  per the confirmed contract above). Note this makes `resultsFor()`'s returned
  `familyId` field unused by this call site; check whether anything else in the file
  still reads it before removing it from `resultsFor()`'s return type.
- The subject-list caption (~line 611-613): change
  `` `${Math.abs(delta).toFixed(1)} points ${delta >= 0 ? "above" : "below"} the England ${ph === "ks4" ? "GCSE average for its subject family" : "average for this qualification"}.` ``
  so the KS4 branch reads "GCSE average for this subject" (or equally clear wording) —
  it's genuinely per-subject now, the caption should say so.
- The Results card's box caption (~line 890-892): change
  `` englandAvg?.basis === "family" ? "Average point score per GCSE entry, vs. the England GCSE average for that subject's family." : ... ``
  to `basis === "subject"` and reword to "...vs. the England GCSE average for that
  subject." (drop "family" from the wording here too).

Search the file for any other occurrence of `basis === "family"` or `.familyId` inside
an England-average context before finishing — these are the ones found this round, not
guaranteed to be the only ones.

## What NOT to touch

KS5's branch of `englandAverages()`, `englandFor()`'s bucket branch, and
`comparabilityKey()` — all unchanged, bucket-grain is still correct there for now. The
Round 5 column-mechanism's five comparison axes (`teacher-view-catalogue.ts`'s `AXES`)
— a completely separate mechanism from this Results-card anchor, not touched by this
round. Onboarding Step 3's results preview — it already reuses this same
`resultsFor`/`englandFor` computation (per the onboarding rebuild brief), so it picks up
this fix automatically once this round ships; no separate change needed there.
`academic_geography_aggregate`/`academic_geography_lookup` themselves — unchanged on
the backend, still correct for KS5 and for the whole-school headline.

## Verification

Live, both themes: check Biology and Maths (General) specifically — the backend
round's own numbers show these two move the most (+0.82 and −0.63 against their old
family figure respectively), so they're the clearest real confirmation the anchor
actually changed grain, not just that the code compiles. Confirm both captions read
"subject" rather than "subject family" / "subject's family". Confirm KS5 is visually
and numerically unchanged (a regression check, not a new feature to test).
