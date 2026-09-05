# Handover to Claude Code — FE college & mainstream school gender-narrative fixes

*Prepared by Claude (planning session) for Claude Code to implement, test, commit, and push. This is a full spec, not a partial diff — every branch below was tested against real data before being written up here. Claude Code should still run its own verification (existing lint/typecheck, and a spot-check against the real URNs listed) before committing.*

---

## 1. Background — how this came about

Guy reviewed a real before/after for one FE college's opening paragraph (Herefordshire, Ludlow and North Shropshire College) and asked for a rewrite. Working through the real edge cases with him surfaced two issues that turned out to apply to **both** the FE-college narrative branch and the mainstream (ordinary school) narrative branch, since they share `classifyGenderComposition()` and (until now) the same `GENDER_ALWAYS_ON_HEDGE` constant:

1. **A generic, unevidenced hedge sentence** — `GENDER_ALWAYS_ON_HEDGE = "The gender balance varies from year to year."` — gets appended to every co-ed gender sentence on both branches. No year-over-year trend is computed anywhere in the codebase to support this claim. Guy's words: *"'The gender balance varies from year to year.' is not true."*
2. **A "single-sex" claim that fires at ≥98% dominant, not literally 100%** (`classifyGenderComposition`'s existing `SINGLE_SEX_SUPPRESSION_BAND = 0.02`). Guy's point: a reader takes "single-sex" to mean literally 100%; asserting it at 99% overclaims. But dropping the categorical claim entirely is *also* wrong for mainstream schools, where "single-sex" is a genuine admissions-policy fact (GIAS's own declared category) — a small non-dominant count there is most likely dual registration, an EHCP placement, or a trans pupil recorded under their affirmed gender, not real mixed admissions. The two branches ended up needing **different resolutions** for this same issue — see below.

Both fixes are in **`src/lib/narrative.ts`**. The FE fix also touches its one call site in **`src/app/schools/[urn]/page.tsx`**.

---

## 2. FE college branch — `feParagraphPhaseGender()`

### Real motivating example (confirmed against live data, URN 130710)

Before (current live text):
> "Herefordshire, Ludlow and North Shropshire College is a 16+ college, with pupils from Year 12 to Year 13. It is co-educational, mostly girls, with girls making up 61% of all students. The gender balance varies from year to year."

After (this spec, same real school, same real data):
> "Herefordshire, Ludlow and North Shropshire College is a 16+ college. It is co-educational, and across all age groups is predominantly female, with women making up 61% of all students. The gender balance varies across the age brackets, with U19 students 56% male, and adults (19+) 75% female."

### What changed and why

- **Age-range clause dropped** ("with pupils from Year 12 to Year 13") — misleading for a 16+ college whose real population includes adults well past Year 13.
- **"girls"/"boys" → "female"/"women" / "male"/"men"** — `classifyGenderComposition()`'s shared vocabulary (`"girls"|"boys"`) is correct for actual child pupils on the mainstream branch but wrong for FE's genuinely mixed 16-19/adult population. Translated locally inside the FE functions only (a new `FE_GENDER_WORDS` lookup) — the shared function itself is untouched, since the mainstream branch still needs "girls"/"boys".
- **The generic hedge sentence is replaced with the real U19-vs-adult breakdown**, wired through from data that's already computed upstream in `page.tsx` (`feUnder19Snapshot`/`feAdultSnapshot`) but wasn't previously passed into this sentence.
- **The "and across all age groups is X, with N%..." framing in the opening only appears when BOTH brackets (U19 and adult) have real gender data.** Otherwise it's a claim about "all age groups" rebuilt on partial or no bracket evidence — so it's dropped, and every percentage moves into the tail sentence(s) instead.
- **"Single-sex" claim**: only asserted when the dominant share is **literally 100%** ("It is single sex."). Between 98% and 100% (the "small trans-reporting minority in an otherwise single-sex college" case Guy described), **no categorical claim is made at all** — not "single sex" (overclaims), not "co-educational" (equally wrong the other way) — the sentence just states the real percentage and lets the number carry the meaning. Checked against real national data: **zero real FE colleges are GIAS-declared single-sex** (391 of 394 real FE-participation institutions are "Mixed", 3 null) — so there's no authoritative field to lean on here either way; the computed composition is the only signal, and it's being used honestly.

### Full real branch matrix (all confirmed via test scripts against real and synthetic data)

| Case | Example output |
|---|---|
| Both brackets real, ordinary co-ed (real, Herefordshire) | *(see "After" example above)* |
| Only one bracket has any population at all (real, City Lit, URN 130401 — adult-only) | "City Lit is a 16+ college. It is co-educational. The students are all adults (19+) and are predominantly female (70%)." |
| Both brackets have a population, only one has real gender data (synthetic) | "Example College is a 16+ college. It is co-educational. Among under-19 students, 60% are female. No data is available on the gender split for adult (19+) learners." |
| Neither bracket has real gender data (aggregate-only figure) | "Example College is a 16+ college. It is co-educational. No data is available on how the gender balance varies by age bracket." |
| Exactly 100%, one bracket only (synthetic) | "Example College is a 16+ college. It is single sex. The students are all under 19 and are all female (100%)." |
| Exactly 100%, both brackets real (synthetic) | "Example College is a 16+ college. It is single sex. The gender balance varies across the age brackets, with U19 students 100% female, and adults (19+) 100% female." |
| 98–99.9% ("middle band"), one bracket only (synthetic) | "Example College is a 16+ college. The students are all under 19 and are 99% female." |
| 98–99.9% ("middle band"), both brackets real (synthetic) | "Example College is a 16+ college. The gender balance varies across the age brackets, with U19 students 99% female, and adults (19+) 99% female." |

### Real bug fixed along the way (worth keeping in the commit)

`lookupReferenceData()` (`src/lib/vicdata-reference.ts`) can't handle a large `entityIds` batch in one call — a 264-entity batch during testing hit a real server-side statement timeout (`57014`). Not part of this narrative fix directly, but flagged here since it was found while testing this work: any future code path that could build an entityIds array that large (a "compute this for every school in a set" feature) would hit the same wall. No fix needed for *this* change (none of the call sites here build a batch that large), just flagging for awareness.

### Reference implementation

The full, tested code (verified with `tsc --noEmit`, and against the real/synthetic cases above) is in the attached diff (`fe_narrative.diff`, generated via `git diff origin/main -- src/lib/narrative.ts src/app/schools/[urn]/page.tsx` in a sandbox clone). Claude Code should read this diff, adopt it (or improve on it), and verify independently rather than trust-and-commit blind — but it's a working starting point, not a rough sketch.

Key new/changed symbols in `narrative.ts`:
- `FE_GENDER_WORDS` (new, local vocabulary lookup)
- `feParagraphPhaseGender()` — signature changed: drops `lowAge`/`highAge` params, adds `under19`/`adult` params (each `{ total: number; female: number | null; male: number | null } | null`)
- `feBracketComposition()` (new helper)
- `feBothBracketsSentence()` (new helper)
- `fePartialBracketSentence()` (new helper)
- `feSingleSexClause()` (new helper)
- `feCompositionClause()` (existing helper, one bug fixed: "predominantly female, with 70% female" stuttered — now "predominantly female (70%)")

Call site in `page.tsx` (~line 661) changes from:
```ts
feParagraphPhaseGender(school.current_name, school.statutory_low_age, school.statutory_high_age, feGenderFemale, feGenderMale),
```
to:
```ts
feParagraphPhaseGender(school.current_name, feGenderFemale, feGenderMale, feUnder19Snapshot, feAdultSnapshot),
```
(`feUnder19Snapshot`/`feAdultSnapshot` already exist in scope at that point — no new computation needed, just wiring.)

---

## 3. Mainstream school branch — `paragraph1PhaseGender()`

This branch needs the **same two issues fixed, but resolved differently** — confirmed against real data that the difference matters (see below).

### Real data check that shaped the fix

Scanned all 807 real GIAS-declared single-sex schools nationally (`schools.gender` = "Boys" or "Girls") against real DfE census enrollment:
- **582** are exactly 100% one gender.
- **64** are ≥98% but not exactly 100% — real, well-known schools: Hampton School (11 girls of 1,578), Reading School (1 girl of 1,138), Torquay Boys' Grammar School, Enfield Grammar School, Cardinal Heenan Catholic High School, and others.
- **142** are declared single-sex in GIAS but real enrollment isn't even close to 98% dominant. **Not a live bug** — the current code already uses computed real census composition (`classifyGenderComposition`), not GIAS's category field, for this sentence, so these already correctly render as co-educational today regardless of GIAS's field. No change needed for this group.
- 19 have no real census data at all (unaffected either way — falls through to `if (!comp) return null` already).

### Why the resolution differs from FE

For FE colleges, there's no admissions-policy fact backing "single-sex" at all (confirmed zero GIAS-declared non-Mixed FE colleges) — so the FE fix drops the categorical claim in the 98–99.9% band entirely. For mainstream schools, "single-sex" genuinely **is** an admissions-policy fact (that's what GIAS's declared gender field means), so the 64 real schools above should keep the "single-sex" claim — just be upfront about the small real minority rather than implying literal 100%. Guy confirmed this exact wording:

> "It is single-sex (boys); a small number of pupils (11 of 1,578) are recorded as girls."

### Required changes to `paragraph1PhaseGender()`

1. **Single-sex branch**: when the non-dominant count is exactly 0, keep the sentence exactly as today ("It is single-sex (boys)."). When it's greater than 0 (the 98–99.9% band), append the minority clause: `"; a small number of pupils ({minorityCount} of {total}) are recorded as {oppositeGenderWord}"`.
2. **Co-ed branch**: drop `GENDER_ALWAYS_ON_HEDGE` entirely, with nothing substituted in its place — unlike FE, mainstream schools have one single census population, not an under-19/adult split, so there's no bracket-level detail to offer instead. The sentence simply ends after the percentage clause.
3. This makes `GENDER_ALWAYS_ON_HEDGE` (in `narrative-config.ts`) and its import in `narrative.ts` fully dead code once both branches drop it — remove the constant, its export, and the import, after confirming no other real usage (checked: none found in the current codebase, and there are no existing test files anywhere in this repo to break).

### Draft implementation (for Claude Code to verify/refine, not a rubber-stamp)

```ts
if (comp.kind === "single_sex") {
  // 2026-10-01, per Guy's direct correction: >=98% one gender is a real, meaningful
  // "single-sex" signal for a school (a small non-dominant count is very likely
  // dual-registration, an EHCP placement, or a trans pupil recorded under their
  // affirmed gender within a genuinely single-sex admissions policy -- not real mixed
  // enrollment), so the categorical claim stays, unlike the FE branch (which has no
  // admissions-policy fact to back it at all). But asserting it with no caveat
  // implies literal 100%, which isn't always true -- confirmed against real national
  // data: 64 real declared single-sex schools (Hampton School, Reading School,
  // Torquay Boys' Grammar School, Enfield Grammar School among them) carry a small
  // non-dominant count, not zero. Be upfront about that real minority.
  const total = female + male;
  const minorityCount = Math.min(female, male);
  const minorityWord = comp.dominantGender === "girls" ? "boys" : "girls";
  const minorityClause = minorityCount > 0
    ? `; a small number of pupils (${minorityCount.toLocaleString()} of ${total.toLocaleString()}) are recorded as ${minorityWord}`
    : "";
  return `${schoolName} is ${article} ${phase} ${schoolWord}, ${ageRangeClause}. It is single-sex (${comp.dominantGender})${minorityClause}.`;
}

const inHedgeZone = comp.kind === "mostly" && comp.dominantSharePct < BALANCED_BAND_HIGH * 100 + GENDER_LABEL_HEDGE_WIDTH_PP * 100;
const qualifier = comp.kind === "balanced" ? ", roughly balanced" : inHedgeZone ? "" : `, mostly ${comp.dominantGender}`;

// 2026-10-01, per Guy's direct correction: GENDER_ALWAYS_ON_HEDGE isn't a real,
// evidenced claim here either -- no year-over-year trend is computed anywhere.
// Unlike the FE branch, there's no bracket-level breakdown to substitute in its
// place, so it's simply dropped.
return (
  `${schoolName} is ${article} ${phase} ${schoolWord}, ${ageRangeClause}. It is co-educational${qualifier}, ` +
  `with ${comp.dominantGender} making up ${comp.dominantSharePct.toFixed(0)}% of all pupils.`
);
```

### Real test cases to verify against

- **Hampton School** (URN 102946): 11 girls, 1,567 boys → "It is single-sex (boys); a small number of pupils (11 of 1,578) are recorded as girls."
- **Reading School** (URN 136449): 1 girl, 1,137 boys → "It is single-sex (boys); a small number of pupils (1 of 1,138) are recorded as girls."
- Any exactly-100% single-sex school (e.g. spot-check a couple from the 582 group) → unchanged sentence, no minority clause.
- Any ordinary co-ed school → same sentence as today minus the trailing hedge sentence.

---

## 4. Housekeeping (unrelated to the narrative fix, but flagged during this work)

1. **`.git/index.lock` is sitting in the real repo** (`$HOME/mnt/vicdata_public/.git/index.lock`), left over from an earlier `device_bash` command that couldn't clean up after itself. Harmless at rest, but will block the next real git operation until removed.
2. **One leftover scratch file** in the real repo: `scripts/_scratch_acland_burghley_peers.ts` (untracked, harmless, from an earlier round — never got delete permission to remove it via `device_bash`).
3. **`src/lib/typology.ts` already has an uncommitted change** in the real repo — a separate, already-approved fix (nursery schools/PRUs wrongly sharing the "Junior" phase tag with genuine primaries). Guy's call whether to commit this as part of the same push or have Claude Code redo it from scratch as its own piece of work — noting it here so it isn't missed or double-handled.
4. **No test files exist anywhere in this repo yet.** This narrative module in particular (`narrative.ts`) has a lot of branch logic and would benefit from a fixture-test file (see the separate `claude/proofreading.md` strategy doc in this project for the general QA approach) — worth considering alongside this change, not required to ship it.

---

## 5. What to actually do

1. Resolve the housekeeping items in §4 first (at minimum, remove the stale lock file so git operations work).
2. Implement/verify the FE fix (§2) and mainstream fix (§3) in `src/lib/narrative.ts` (+ the one call-site change in `page.tsx`).
3. Remove `GENDER_ALWAYS_ON_HEDGE` (`narrative-config.ts`) and its import once both branches no longer reference it.
4. Verify against the real URNs listed above (130710, 130401, 102946, 136449) plus a exactly-100% single-sex spot check.
5. Commit and push.
