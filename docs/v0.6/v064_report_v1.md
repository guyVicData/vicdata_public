# VicData 0.6.4: trend tables, speed, Post-16 audit — report

Branch `v0.6.4`, from `main` (f9d71b8). Prompt: `docs/v0.6/vicdata_0_6_round4_tables_post16_speed_claude_code_prompt_v1.md`. Calls logged in `docs/OPEN_QUESTIONS.md` under "2026-10-07 — 0.6.4".

**No stop condition was hit.** There is no RLS change, no migration and no database write. The Data View is unchanged. A's figure changes are only the expected ones (trend tables gain years), and C changes no figure or pixel. So A and C are merged into `main` and pushed. **B is an audit only.** The matrix and proposal are in `docs/v0.6/post16_vs_gcse_matrix_v1.md`, waiting for your review. No Post-16 panel was changed.

**Checks on every commit:** `tsc --noEmit` clean; eslint 0 errors (the 2 warnings are main's); `next build` clean. Unit tests **344/344** (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`). Real-data rule tests **PASS=17, FAIL=0, ERROR=0** (MANUAL 15, NONE 20, SUPERSEDED 2), including the new R-TREND-TABLE-YEARS. No server key in client code: the only new server module, `src/lib/server-cache.ts`, is imported by API routes alone, and the page's bundles were not given any new environment variable.

| Commit | What |
|---|---|
| `799ed87` | A: trend tables show their chart's years |
| `9011a4e` | C: speed quick wins |
| (this) | B: the Post-16 vs GCSE matrix and proposal; this report |

---

## A — Grade-band trend tables

### The cause: the 0.6.2 card rule, not wiring

I reproduced it on real data: fixtures built by the tree's own fetchers, both drawing paths, card and fullscreen, years across and years down (`docs/v0.6/audit_scripts/v064_tables/probe_*.tsv`). Cases:

- The Chase 137625 GCSE History, on Grade 4+, bands 9–4, 9–7 and grade 9, Grade counts, and a grade-9 selection;
- King's Worcester 117037 A level Maths, on A*–E and A*–A.

| Table | Card, years across | Card, years down | Fullscreen (either) |
|---|---|---|---|
| Every Trend table and % change table (Results, Context, Comparisons) on a grade measure | **2022/23, 2024/25 only** | 2021/22–2024/25 | 2021/22–2024/25 |
| Grade counts' change table | 2022/23, 2024/25 | **2022/23, 2024/25** | **2022/23, 2024/25** |
| Every trend line chart | — | — | 2021/22–2024/25 |

- **Every table's data already ran from 2021/22**, the same as its chart. The card's years-across table shows only the change's two ends (2022/23 and the latest, R-TREND-FROM-2223, 0.6.2) and gave **no sign that two years were hidden**. That reads as "the table starts later".
- **Nothing applies `MODERN_GRADE_FROM` / R-CURRENT-GRADES-FROM-2324 to a Trends table.** `grades.ts`' uses are for the latest-year spread's earlier year; `SubjectPanels` ~346 and ~1133 are Current's frame only.
- **Grade counts' change table** really did hold just two years, fullscreen included.
- **Not reproduced:** a table starting at **2023/24**, as the prompt describes. If that's what you saw live, please tell me which table, layout and focus it was (live check 1 below).

### The fix (both paths: it lives in YearTable and the grade-spread lib)

- **The cue.** A card table with years across keeps the change's two ends and adds a **"+2 more years"** link under the table. Its hover names the hidden years ("Also 2021/22, 2023/24"). A click swaps that view to years down, where every year shows; it's remembered like the swap button. Years down and fullscreen show every year, as before. Latest-year-only tables get no cue.
- **Grade counts' change table** lists every graded year from 2021/22 (or from your own "From" year) to the latest. The Change is still measured from 2022/23, and the card columns are still its two ends, with the cue. Because its years now include 2021/22, its "i" carries the trend note, like every other trend view.
- **Rule:** R-TREND-TABLE-YEARS (new; R-TREND-FROM-2223 and R-CURRENT-GRADES-FROM-2324 now refer to it). Its real-data test builds every trend table preset on a grade measure, next to its column's trend chart, through the series builder. That covers both schools, Grade 4+ / A*–E and bands 9–4 / 9–7 / 9 (A*–A / A*), and Grade counts. **148 checks, every chart and table on 2021/22–2024/25.**

### Before / after (`docs/v0.6/v064_screenshots/`, `a*-before.png` / `a*-after.png`)

| Shot | Before | After |
|---|---|---|
| a1 The Chase History bands, Trends chart | 2021/22–2024/25 | unchanged |
| a2 …Trend table, card | 2022/23 · 2024/25 · Change | same columns, plus "+2 more years" |
| a3 …the same on a phone (390) | as a2 | as a2, with the cue |
| a4 King's Worcester Maths, bands, Trend table | 2022/23 · 2024/25 | plus "+2 more years" |
| a5 King's Worcester Maths, A*–E, Comparisons Trend table | 2022/23 · 2024/25 | plus "+2 more years" |
| a6 The Chase History, Grade counts' change table | 2022/23 · 2024/25 in every layout | the card the same plus the cue; years down and fullscreen show 2021/22–2024/25 |

### Parity (A)

Main vs branch on the 0.6.3 matrix: 5 schools × 7 states × 1280/390 × both themes, every panel and rail view. **1,366 view pairs, 0 unexpected:**

| | Pairs |
|---|---|
| Identical | 1,092 |
| The cue only (words equal apart from "+N more years") | 250 |
| Grade counts' change table (the cue, and the trend note in its "i") | 24 |

Every figure in every table is unchanged. Output: `audit_scripts/v064_tables/parity_A.out`.

---

## C — Speed

### C1: how it was measured, and what limits the numbers

- **Live in a browser wasn't possible.** vicdata.co.uk returns 401 (the Basic Auth gate) to Claude in Chrome too, and I can't enter credentials. Instead, all read-only:
  1. every Teacher route body replayed from this Mac, with each upstream call timed (`audit_scripts/v064_perf/perf.mts.txt`, three rounds; each round runs every route twice in one process);
  2. the page's `/api/*` waterfall per scenario in the harness (`api.mjs.txt`, `api_waterfall.out`);
  3. `explain analyze` on vicdata-production for the heaviest RPCs;
  4. the built page's JS chunks.
- **This Mac's network was slow and very variable today.** Round 1 hit 5–18 s per route; rounds 2–3 were steady, and they are the figures below. So treat call counts, serial depth and bytes as solid, and wall times as relative.
- **Render:** no `render.yaml`, so the plan isn't in the repo. Cloudflare → Render answered every request in about one round trip, with no sign of a sleeping instance (a free instance takes 30 s or more to wake). Please confirm the plan in Render's dashboard (live check 4).

### The six scenarios, as the page fetches them (main)

| Scenario | `/api/*` calls (in order; ‖ = in parallel) | Server time on its critical path (rounds 2–3) |
|---|---|---|
| 1 Cold first visit, `/teacher/ks4` | dashboard ‖ chooser-set → subject-geography ‖ saved-sets ‖ **academic-schools** (needs chooser-set's schools) | Columns 1–2: about 0.6–0.8 s (dashboard). **Column 3: chooser-set 0.8–1.2 s, then academic-schools about 0.95 s ≈ 1.8–2.2 s.** Plus the browser's own serial reads (membership → onboarding → settings → notes → last-seen) |
| 2 Warm reload (under 5 min) | the same requests; the 5-minute cache is per tab, so a reload starts empty | as 1 |
| 3 GCSE → Post-16 | **all of 1 again for the other phase** (dashboard, chooser-set, academic-schools, saved-sets, geography), plus the browser's serial reads | as 1: the slow one you noticed |
| 4 Focus subject or qualification | one subject-geography (one subject-grade-geography on bands / counts, comparator-grades on Grade 4+) | about 0.2–0.5 s |
| 5 Results ↔ Candidates | none (from the fetch cache) | 0 |
| 6 Comparisons map | none for data; before C, the map code came with the page | 0 |

### The top causes, ranked by time

1. **Column 3 waits on two heavy calls in a row:** chooser-set (the nearest 10), then academic-schools (the profiles of those 10 schools, about 1 MB, both phases, census pages). About 1.8–2.2 s server time on every load and **every phase switch**.
2. **A phase switch repeats the whole load:** about 2 s server, plus the browser's chain. Nothing was prefetched.
3. **chooser-set built every default list to keep one.** `resolveDefaultNearest` called `buildDefaultComparatorLists`, which also built the LA set, the 16+ list and the region lookup, then threw them away.
4. **The browser's own reads ran one after another after the dashboard:** onboarding → settings → notes → last-seen (each about 0.1–0.2 s from a browser).
5. **The page shipped code most members never use:** 1,433 KB of JS (418 KB gzipped). That included the in-place editor (about 120 KB), the comparator chooser, the map code (AcademicMapView, about 300 KB) and the whole rules catalogue (about 125 KB of rule statements).
6. **Public reference data fetched afresh on every request:** England's national rows (dashboard) and the LA / region / England area rows. The geography routes also read their three areas one after another.

**Ruled out:**

- *Missing indexes.* In Postgres the heavy RPCs take 23–49 ms (subject families, headline, grade rollup), and the census facts query 8 ms on `canonical_facts_current_source_entity_idx`. As the app sees them, each call costs 100–600 ms: it's round trips and payload, not indexes.
- *The published dashboard config per switch.* It loads alongside the school's data, so it isn't on the critical path.
- *Comparator grades per switch.* One call of under 0.2 s, only on Grade 4+.

### C2: quick wins (committed in `9011a4e`)

| Fix | Where | Effect |
|---|---|---|
| chooser-set's nearest 10 builds only what it uses | `default-comparator-lists.ts` (`only: "nearest"`), `chooser-sets.ts` | 7 schools: **byte-identical answers, 41–64% faster** (e.g. 118952 3.7 → 1.2 s; 130432 FE 1.5 → 0.8 s). The Data View's default-lists route is unchanged |
| A one-hour per-instance cache for public reference reads (no user data, errors never kept) | `src/lib/server-cache.ts`; dashboard (England), subject-geography, subject-grade-geography (areas, a school's LA and region), phases (current periods) | geography routes on a warm instance: **228 → 50 ms** and **239 → 36 ms** (GCSE), **517 → 40 ms** / **316 → 39 ms** (Post-16) |
| Parallel reads | dashboard (neighbours ‖ target school); both geography routes (three areas; LA ‖ region) | one or two round trips fewer each |
| The member's reads start with the school's data | `TeacherDashboard` loader | onboarding, settings and notes no longer wait for the dashboard (about 3 browser round trips off every load and phase switch) |
| Prefetch the other phase | `prefetchOtherPhases` | 4 s after the page draws, at idle: the other onboarded phase's dashboard and nearest-10 set go into the 5-minute fetch cache. **A switch within 5 minutes skips both** (about 1.4–1.9 s of server time); only academic-schools and the browser's reads remain |
| Lazy-load the editor, the comparator chooser and the map code | `TeacherDashboard`, `RankingsMap` | the page's JS: **1,433 → 851 KB raw, 418 → 245 KB gzipped (−41%)** |
| The rules catalogue off the page | `dataviewById` / `measureById` beside their data; page-path libs import from there | in the −41% above |

Upstream calls per route replay: **GCSE 117 → 100** on a first visit, **90** with the reference cache warm; **Post-16 111 → 97 / 86**.

#### Before / after, route by route (median of rounds 2–3, warm instance, ms)

| Route | GCSE 137625 before | after | Post-16 117037 before | after |
|---|---|---|---|---|
| dashboard | 553–638 | 507–558 | 647–665 | 482–502 |
| chooser-set (nearest) | 776–858 | 588–672 | 1,174–1,202 | 897–1,001 |
| academic-schools | 968–979 | 1,039–1,119 (unchanged code; noise) | 861–952 | 801–826 |
| subject-geography | 227–228 | 44–50 | 243–517 | 35–51 |
| subject-grade-geography | 199–239 | 35–36 | 197–316 | 38–59 |
| phases | 129–132 | 111–124 | 128–143 | 98–105 |

All rounds: `audit_scripts/v064_perf/round{1,2,3}.jsonl`.

**What this means for each scenario, roughly:**

- **1 and 2 (first load, reload):** Column 3 about 0.3 s sooner (chooser-set). The member's reads no longer queue behind the dashboard. The page has about 170 KB less to download and parse (gzipped).
- **3 (GCSE → Post-16):** within 5 minutes of a page, the dashboard and the nearest set come from the cache, so Columns 1–2 draw at once. Column 3 waits only on academic-schools (about 0.8–1 s).
- **4–6:** unchanged or faster (area figures cached; the map code loads on first use).

**Not measured: the real browser end to end.** Please time scenarios 1 and 3 on live (live checks 2–3).

### Parity (C changes no figure or pixel)

- **The page:** the A branch vs the C branch on the same matrix: **1,366 pairs, 1,364 identical, 2 anti-aliasing noise** (words equal, ≤8/255), 0 unexpected, maps included (`parity_C.out`).
- **The nearest set:** byte-identical for 7 school/phase pairs.
- **The Data View:** none of the 27 changed source files is in the Data View pages' module graph (267 modules, checked with an esbuild metafile). The one shared server function (`buildDefaultComparatorLists`) is called by the Data View's route without the new option, so it takes the unchanged path.

### Proposed indexes

**None.** `explain analyze` shows no missing index behind the slow calls (see "Ruled out"). Nothing to apply.

### C3: bigger options (proposed, not built)

| Option | Cost | Benefit |
|---|---|---|
| **A Teacher-only academic-schools** (the profile fields the maps and Comparisons read, this phase only, no census pages), or **chooser-set returning the profiles itself** | 1–2 days, its own parity run (the route is shared with the Data View today) | Column 3's second call goes, or shrinks by most of its 1 MB: about 0.5–0.9 s off every load and switch. **The biggest remaining win.** |
| **A precomputed per-school "dashboard payload" table**, refreshed on ingest (vicdata-production, ingest repo) | 2–4 days plus an ingest step | dashboard + nearest set + profiles in one indexed read: first load about 2 s → a few hundred ms |
| **`reference_data_lookup`: keyset paging, or the predecessor fallback only for missing URNs** (ingest repo function change) | half a day plus a test | the census read takes 8 ms inside, about 160 ms per page today, and each page re-runs it (offset paging) |
| **Revalidate the reference cache on ingest** (a webhook from the ingest repo) | half a day | the one-hour cache could become a day, and an ingest would show at once |
| **Edge caching** of public reference routes (Cloudflare) | needs the routes split into public / member parts | little more than the in-process cache gives, for one instance |
| **A paid Render instance** | if not already on one | only matters if the instance sleeps; I saw no sign of it |
| **The comparator ranking in SQL** (`rankSets` in the dashboard route, about 0.4–0.7 s) | 1–2 days | one round trip instead of about 15 |

---

## B — Post-16 vs GCSE (audit only; stopped for your review)

**The document:** [`docs/v0.6/post16_vs_gcse_matrix_v1.md`](post16_vs_gcse_matrix_v1.md). It holds the B1 matrix (every column, panel and measure: GCSE rail, default and titles; Post-16 today; the difference; why) and a view × family table at real schools: A level 117037, AS / BTEC 130432, IB 118952, T Level 130416, Core Maths / EPQ 117037, Pre-U / FSMQ at Eton and Winchester. Then the B2 proposal. It was read from code and real data (read-only, the app's own fetchers); nothing was rendered for it. **No Post-16 panel was changed.**

**Headline findings:**

1. **The config already matches.** One VIEWS table builds both phases' dashboards, and every view lists both phases. So rail order, defaults and titles are the same on paper. Every real difference comes from host rules or the data.
2. **A live wrong figure, outside this round's scope: BTEC points for 2021/22 and 2022/23 are stored as 0, not missing.** I confirmed it: Croydon 130432 Business Studies, four BTEC sizes, `avgPointScore` 0 in 2021/22 and/or 2022/23; 2023/24 on are real (14.4–27.6). England's rows for those years are 0 too, as are comparators' BTEC bucket rows. The app draws a 0 as a figure (`teacher-view-measures.ts:64-80` drops only nulls). So Post-16 BTEC points trends, area charts and Comparisons lines fall to 0 in those years today. The likely cause is the ingest scoring the historic short codes before mapping them (not verified). **This needs your decision:** an ingest fix (vicdata repo), and/or an interim app rule that treats those zeros as missing. Either is a figure change, so I haven't made one.
3. **Grade bands opens with no range at Post-16** (no presets on Post-16 scales, by design in 0.6.3). Column 1 says "Pick a grade range…", and Context and Comparisons fall back to points. GCSE opens on 7–9. Proposed: a default band per scale, or open on Grade distribution.
4. **A*–E fits A-level scales only** (BTEC, IB, T Level and Pre-U get the 0.6.3 note). Core Maths and EPQ are A–E graded and *are* scored as A*–E: your call.
5. **Comparisons and the maps use bucket figures at Post-16; Column 1 uses the exact qualification.** So they disagree where a bucket holds more than one qualification: Croydon Maths 2024, bucket 21.45 against A level 24.00; Sevenoaks Maths, IB 46.76 against HL 49.07 / SL 41.17; BTEC sizes blended.
6. **Two accidents on an AS focus:**
   - Column 1's Trend map on points plots the A-level bucket with no note (Comparisons gives way to a note).
   - The note and the map legends say "A-level" instead of "AS level".
7. **The default comparator set is the GCSE nearest 10, not schools with a sixth form**, so few comparators share a Post-16 qualification: 3 for King's A level Maths, 1 for Sevenoaks IB, 0 for Croydon AS Law.
8. **Few lines:** T Level has 2 years and BTEC 2 real years, so they draw bars (R-TREND-LINE-4YR). A level and IB match GCSE.
9. **The Post-16 headline is A-level points per entry**, so IB-only schools and FE colleges without A levels have no ranking headline. The IB Diploma total isn't a subject (R-IB-NONSUBJECT).
10. **T Level works where DfE publishes per-pathway grades** (Christ The King 130416, Health), but not at Croydon (grades only under "All subjects"). Pre-U and FSMQ have no current entries.

**B2, in brief:** keep the shared VIEWS table; the rails already match. There are seven honest alternatives: a Post-16 default band; the BTEC zeros; greying A*–E for non-A-level scales; your call on Core Maths / EPQ; exact-qualification comparator figures; a Post-16 default set; a headline note. Each comes with precise change points (file:line), per-family exceptions, and the ingest fix. **Waiting for your review before any build.**

**Not verified** (listed in the document): the *published* configs (the anon key can't read them; only the code copy was compared); anything rendered; the cause of the BTEC zeros; why Croydon's T Level grades are school-wide only; AEA (no example found); a subject rename ("Business Studies:Single" → "Business Studies") that may shorten some A-level trends.

---

## Logged calls (OPEN_QUESTIONS.md, 2026-10-07 — 0.6.4)

- A: the card keeps first-and-latest plus the cue, rather than four columns (they don't fit a card column without truncating names). The cue swaps to years down rather than opening fullscreen.
- A: Grade counts' change table now lists every year in years down and fullscreen; its "i" now carries the trend note.
- C: the reference cache lasts one hour (an ingest shows within the hour). Public keys only, after the membership checks.
- C: the dashboard's ranking and subject reads stay serial (its own comment records a statement timeout when they ran together).
- C: the prefetch waits 4 s after the page draws, then for idle, so it never competes with Column 3's own calls. It covers onboarded phases only.
- B: found, not fixed: BTEC 2021/22–2022/23 points stored as 0 (a live wrong figure; needs your decision, matrix change 2).
- C: academic-schools isn't narrowed this round (shared with the Data View; needs its own parity run). Proposed in C3.

## For Guy after Render's "Deploy live" (hard-refresh)

1. **A:** The Chase, GCSE, focus History, Results → Grade bands 9–4, Trends → Trend table. The card shows 2022/23 · 2024/25 · Change and "+2 more years"; hovering names 2021/22 and 2023/24, and a click swaps to years down with all four years. Fullscreen shows all four. **If you saw a table starting at 2023/24 before, tell me which table and layout** (I couldn't reproduce that).
2. **C, first load:** a cold `/teacher/ks4`. DevTools → Network: dashboard and chooser-set start together, and the page's JS is about 245 KB gzipped (was about 418).
3. **C, the switch:** wait about 5 s after the page draws, then switch GCSE → Post-16. dashboard and chooser-set should come from the cache (no request); only academic-schools and subject-geography go out.
4. **Render plan:** confirm it's a paid instance (no sleeping).
5. **B:** read `docs/v0.6/post16_vs_gcse_matrix_v1.md` and approve or amend the target before the build.
