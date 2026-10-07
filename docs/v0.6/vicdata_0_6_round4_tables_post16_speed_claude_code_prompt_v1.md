# VicData 0.6.4 — Grade-band tables, Post-16 matched to GCSE, faster loading

Claude Code build prompt. Three items from Guy's review on 7 Oct 2026. One continuous pass, in this order, committing after each stage:

| Part | What | Output |
|---|---|---|
| **A** | Fix | merge |
| **C** | Measure, then quick wins | merge |
| **B** | Audit only | report, then **stop for Guy** |

**Ground rules (as 0.6.3):**

- **Branch `v0.6.4` from `main`.** Commit per stage, with tsc, eslint, build and all tests clean.
  - Unit tests: `npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`.
  - Rule tests: `npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`.
  - Parity: the 0.6.3 harness.
- **Change both drawing paths:** the config renderer (`src/lib/view-series/`, `src/components/dashboard-config/`) and the legacy hosts.
- **The Data View must stay pixel-identical.**
- **Never put a server key in client code.**
- **Database changes** (indexes, functions): write them, test them, and leave them for Guy with apply commands. Say which database each one is for:
  - vicdata-public, `lnhulykjlxmoneappnsp`;
  - vicdata-production, `hrqrbvrrhlidpoybezhs`, the ingest repo `~/dev/vicdata`.
- **Log calls** under "2026-10-07 — 0.6.4" in `docs/OPEN_QUESTIONS.md`.
- **Merge A and C into `main` and push** when their checks pass. B's audit is a document, so committing it on `main` is fine too.
- **Stop before merging for:**
  - any RLS change;
  - a destructive migration;
  - a Data View change;
  - a figure change outside the expected lists.

---

## A — Grade band trend **tables** start in 2023/24 while the graph starts in 2021/22

**Guy:** *GCSE History grade-band trends only run from 2023 in table view, but the data is there: the graph shows from 2021.*

1. **Reproduce.** The Chase (137625), GCSE History, Grade bands 9–4 and 9–7 (and a single grade), Column 1 Trends.
   - Compare the line chart and the trend table, card and fullscreen, years across and years down (0.6.3 transpose).
   - Do the same for Grade 4+ and Grade counts' change table, and for Context and Comparisons trend tables on bands.
   - Note which tables show which years.
2. **Find the cause, and say which it is:**
   - **Wiring:** a table built from a modern-years-only source. For example, a frame or helper applying `MODERN_GRADE_FROM` / `R-CURRENT-GRADES-FROM-2324` (meant for **latest-year** views only) to a Trends table; `src/lib/view-series/grades.ts` ~61–126; `SubjectPanels.tsx` ~346, ~390, ~1133.
   - **The 0.6.2 card rule** ("card year tables show 2022/23 and the latest; fullscreen shows every year").
   - **Something else.**
3. **The rule from now on:**
   - **A trend table shows the same years as its trend chart:** 2021/22 onward for grade measures.
   - **Change figures** follow R-TREND-FROM-2223 (measured from 2022/23, with the note).
   - **Years across** on a card may still show first and latest when space is short, with a clear "+2 more years" cue.
   - **Years down**, and fullscreen, show **every year**.
   - `R-CURRENT-GRADES-FROM-2324` applies to latest-year (Current) views only, **never** to Trends.
4. **Add a rule test** that compares chart years with table years for every trend table on grade measures, at GCSE and Post-16.
5. **Before/after** for The Chase History bands, plus one Post-16 subject.
6. **Expected changes:** trend tables gain 2021/22–2022/23 rows or columns. **Nothing else.**

---

## C — Initial load and qualification switching are slow (measure first)

**Guy:** *Initial load is slow, especially when you switch qualification. Once loaded, it's fast.*

### C1 — Measure on live, with no code change

**Scenarios:**
1. A cold first visit to `/teacher/ks4` (signed in).
2. A warm reload.
3. GCSE → Post-16.
4. Switching the focused subject or qualification within a phase (e.g. Maths → History; A level Maths → BTEC Business).
5. Results ↔ Candidates.
6. Opening the Comparisons map.

**For each scenario, record:**
- time to first paint and time to all panels drawn;
- the request waterfall: each `/api/*` call, its duration, payload size, and whether it's repeated or serial;
- server timings, logging the route handlers and the Supabase calls behind them;
- JS bundle sizes for the Teacher page (is Leaflet and the map code lazy-loaded?);
- whether Render's instance is cold-starting or sleeping (check the plan behaviour and the first-request latency).

**Report the top causes, ranked by time saved.**

**Likely suspects to confirm or rule out:**
- **Serial fetches** that could run in parallel.
- **The same data fetched twice:**
  - the client cache is 5 min, in-memory, per tab;
  - nothing is shared server-side between users or requests.
- **Whole-school fact pulls** (`academic-data-view.ts`), possibly with the 50-page loader, on every qualification switch, when only one subject or qualification changed.
- **Comparator grades** for 10 schools on each switch; `academic_subject_grade_rollup_lookup` is now applied.
- **The published dashboard config** being loaded per switch.
- **Missing database indexes** behind the slowest queries. Use `explain analyze` on read-only copies of the real queries.
- **Big client bundles:** Leaflet, the editor and the chooser code loading for members who never edit.

### C2 — Quick wins (no figure may change)

Implement the safe, high-value fixes from C1. **Expected kinds:**
- **Parallelise** independent fetches.
- **De-duplicate in flight.**
- **Server-side caching** of public reference data that changes only on ingest: school lists, subject headlines, geography aggregates, comparator lists. Use Next's data cache (`revalidate`) or an in-process LRU, keyed safely, with **no per-user data in a shared cache**.
- **Prefetch:** the other phase, and the other measure, after first paint, at idle.
- **Lazy-load** the map, editor and chooser bundles.
- **Narrow fetches** to the subject or qualification that changed.
- **Propose indexes** (don't apply them).

**Then re-measure the same scenarios and report before/after timings.** Parity must be **identical** (C changes no figures or pixels).

### C3 — Bigger options (propose, don't build)

List them with cost and benefit, for example:
- a precomputed per-school "dashboard payload" table refreshed on ingest;
- edge caching;
- a paid Render instance to remove cold starts;
- moving a heavy computation into SQL.

---

## B — Post-16 Candidates and Results to match GCSE (audit, then stop)

**Guy:** *Can Post-16 Candidates and Results panels match GCSE as much as possible in graphs, maps, rankings, default views and rail order? This needs careful checking beforehand. Tell me if there are qualifications or grade views not working with that set of views.*

### B1 — The matrix (document only, no code change)

Build `docs/v0.6/post16_vs_gcse_matrix_v1.md`.

**Rows:** every column, row and panel, on Candidates and on each Results measure:
- Average points;
- A*–E (Grade 4+ at GCSE);
- Grade bands, including a single grade;
- Grade counts with no selection, and with a selection (0.6.3).

**For each, give:**
- **GCSE:** the rail views in order, the default view, and the titles.
- **Post-16 today:** the same three.
- **Difference.**
- **Why:** design, a data limit, a rule (cite it), or an accident.

**Then test each GCSE view against each Post-16 qualification family**, at real schools:

| Family | School |
|---|---|
| A level | King's Worcester 117037, Maths |
| AS | an AS-only item, e.g. Croydon College 130432 Law |
| BTEC / vocational single, double and triple | Croydon College 130432, Business |
| IB (subject 1–7 and the Diploma) | Sevenoaks 118952 |
| T Level | a school that has one |
| Pre-U, EPQ, Core Maths / FSMQ | where present |

**For each view × family, mark:**
- **works;**
- **works with a caveat** (say which);
- **doesn't work**, with the reason: no data, scale mismatch, points not comparable, suppression, small n, a rule such as R-POINTS-SAME-QUAL, R-KS5-ASAEA-EXCL, A*–E only for A-level scales, no England benchmark, or no geography.

Include the maps (0.6.3 rules a–d), the rankings, the trend line versus bars (years), and Context's family gating.

### B2 — Proposal (document only)

In the same document, add:
- **The target Post-16 rail and defaults** for each panel, matching GCSE wherever the matrix says it works.
- **What can't match, and the honest alternative** for each: a different default, a greyed view with a reason, or a family-specific note.
- **Any per-family exceptions,** e.g. IB Diploma points, T Level, AS.
- **Any config or catalogue changes,** listed precisely: `src/catalogue/dashboards/teacher.ts` VIEWS for `c1/c2/c3`, `dataviews.ts` measures and `resultsMeasures`, the hosts' phase gating.

**Then STOP.** Commit the document, push, and report to Guy. **Don't change Post-16 panels in this pass.** Guy will review and approve the target before the build.

---

## Finish

1. **Write `docs/v0.6/v064_report_v1.md`,** covering:
   - **A:** the cause, the fix and before/after.
   - **C:** the measurements, quick wins with before/after timings, C3 options, and proposed indexes with apply commands and which database.
   - **B:** the headline findings from the matrix (what can't match, and why), and the link to the matrix document.
   - Parity, and logged calls.
2. **Merge A and C to `main`** if no stop condition, and push:
   ```
   git checkout main && git pull && git merge --no-ff v0.6.4 -m "0.6.4 trend tables, speed; Post-16 audit" && npm run build && git push
   ```
3. **Tell Guy** to wait for Render's "Deploy live", and that B needs his review.
