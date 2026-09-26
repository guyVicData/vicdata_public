# Teacher View — column headers back to one-word titles, subject named in the question instead

Small wording-only round. Ground truth checked against HEAD `615601d` in `vicdata_public` — re-read before editing since line numbers may have shifted.

**Problem.** When a subject is focused, `subjectHeadings` (`src/app/teacher/[phase]/page.tsx` ~L1200-1227) currently folds the subject name into the *title* itself — "Maths (General) Results", "Maths (General) in Context", "Maths (General) Comparisons" — so the header reads "Maths (General) Results — how well pupils do in this subject." (confirmed live). Guy wants the titles back to the plain one-word names (`Results` / `Context` / `Comparisons` / `Candidates`, i.e. `COLUMN_TITLE` as already defined in `src/lib/teacher-view-catalogue.ts` ~L64) in every state, subject focused or not — and the subject name, qualification and school name move into the question sentence instead, which becomes a full standalone question rather than a lowercase continuation clause.

`DashboardColumn.tsx` (~L86-94) already renders `{title}{badge} — {question}` in one `<h2>` — no change needed there, just the strings.

**Do this, in `subjectHeadings` (page.tsx ~L1200-1227):**
- Hoist `const at = schoolName ?? "your school";` to the top of the returned object (it's currently declared only inside the `context` entry's own IIFE) and reuse it everywhere below.
- Drop every `title` field — title is always the plain `COLUMN_TITLE` word now, subject-focused or not.
- Split `rankings` into `{ results: {...}, candidates: {...} }`, the same shape `context` already uses (Results and Candidates modes need different Comparisons wording — see below).
- Rewrite the six `question` strings as full, capitalised questions:
  - `candidates.question`: `` `How many ${learners} at ${at} are entered for ${subj} ${qual}?` ``
  - `results.question`: `` `How well do ${learners} at ${at} do in ${subj} ${qual}?` ``
  - `context.results.question`: `` `How do ${subj} ${qual} results compare with other subjects at ${at}?` ``
  - `context.candidates.question`: `` `How do ${subj} ${qual} entries compare with other subjects at ${at}?` ``
  - `rankings.results.question`: `` `How do ${at}'s ${subj} results compare with other schools?` ``
  - `rankings.candidates.question`: `` `How do ${at}'s ${subj} entry numbers compare with other schools?` ``

**Call sites to update accordingly:**
- ~L1314-1315 (column 1): `title` becomes simply `COLUMN_TITLE[showingResults ? "results" : "candidates"]` — the `subjectHeadings` branch for title goes away; `question` keeps its existing `subjectHeadings ? ... : q.howWell/q.howMany` shape unchanged.
- ~L1504 (Context column): `title` becomes `COLUMN_TITLE.context`; `question` keeps its existing shape.
- ~L1602-1603 (Comparisons column): `title` becomes `COLUMN_TITLE.rankings`; `question` becomes `subjectHeadings?.rankings[showingResults ? "results" : "candidates"].question ?? q.wider` (now that `rankings` is split).

**No subject focused / KS2** (`subjectHeadings` is `null`): unaffected — already falls back to plain `COLUMN_TITLE` + the existing `q.howWell` / `q.howMany` / `q.nearMe` / `q.wider` strings (`src/lib/teacher-view-phases.ts`), which this round doesn't touch.

**Acceptance** (subject focused, e.g. Maths (General), GCSE, at The Chase):
- Results mode: `Results — How well do pupils at The Chase do in Maths (General) GCSE?` / `Context — How do Maths (General) GCSE results compare with other subjects at The Chase?` / `Comparisons — How do The Chase's Maths (General) results compare with other schools?`
- Candidates mode: `Candidates — How many pupils at The Chase are entered for Maths (General) GCSE?` / `Context — How do Maths (General) GCSE entries compare with other subjects at The Chase?` / `Comparisons — How do The Chase's Maths (General) entry numbers compare with other schools?`

One commit.
