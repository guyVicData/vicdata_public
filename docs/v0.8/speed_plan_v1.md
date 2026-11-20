# VicData speed: what's slow, and the plan

Live measurements on vicdata.co.uk, 20 Nov 2026. These are times in the preview browser, from the page opening until its last API answer arrived, one page at a time. Schools were reached through the platform-admin peek (`?lookAs=…&peek=1`). The aim is a steady, quick demo at Leighton Park next week; architecture comes after.

## 1. What happened today (done)

| What | Why | Commit |
|---|---|---|
| **The server ran out of memory and restarted.** About a minute of 502s at 17:16, even on `/api/health`. | The in-process cache (`src/lib/server-cache.ts`) was capped at 2,000 entries by count, not size. Whole-set rows, LSOA boundaries and populations filled the instance's ~256 MB heap in two hours (Render: `FATAL ERROR: Reached heap limit`, instance restarted). | n/a |
| Render instance **0.5 CPU / 512 MB → 1 CPU / 2 GB** (`1c-2g`, $25/month), plus `NODE_OPTIONS=--max-old-space-size=1536` | 4× the memory and 2× the CPU. Ranking and building the overviews is CPU work. | Render settings |
| Cache bounded by size: least recently used goes first past `SERVER_CACHE_MAX_MB` (default 400) | It can't grow without limit again. When it evicts, it logs one line at most every 10 minutes: `[server-cache] … entries, ~… MB`. | `35971f0` |
| **Teacher home: the GCSE figures failed for many schools** (502 "Could not load this school's figures") | A label function in a `"use client"` file was called from server code. A production build refuses that. It hit any school with a GCSE-phase qualification other than GCSE, Double Award, Cambridge National or BTEC. | `f5a8a6b` |

After the upgrade, a health check every 3 seconds for 10 minutes, including all the testing below: 200/200.

## 2. Measurements (after the upgrade)

"Cold" means the first request after a restart, when the server cache is empty. It costs 2–5× a warm request.

**Leighton Park (110110)**

| Page | Time | The slow call |
|---|---|---|
| Teacher home (Teacher + Admissions sections) | 10.2 s | `/api/admissions/pipeline` 8.4 s (cold) |
| SMT home, 10 nearest | 8.7 s | `/api/smt/school` 6.5 s (cold), then the overview |
| SMT Academic / Pupils / Context, 10 nearest | 3.9 / 4.6 / 4.0 s | the page's own route, 2.9–3.4 s |
| SMT home / Academic, **independent schools in the South East** | 7.4 / 5.5 s | overview 4.9 s, academic 4.4 s |
| SMT home / Academic, **independent schools in England** | **16.9 / 17.6 s** | chooser-set 5.2 s, then overview 10.7 s; academic 16.4 s |
| SMT home / Academic, **all sixth forms and colleges in the South East** | **10.7 / 17.6 s** | overview 9.6 s; academic 16.7 s |
| Admissions home | 4.7 s | rivals 2.8 s |

**Other schools**

| School | Teacher home | SMT home | SMT Academic | SMT Pupils | Admissions |
|---|---|---|---|---|---|
| George Dixon Academy (Birmingham, state 11–18) | 11.0 s (pipeline 9.0 s, cold) | 13.5 s (`smt/school` 9.6 s, cold) | 2.2 s | 3.8 s | 2.9 s |
| Ashton Sixth Form College | 1.9 s | 3.3 s | 3.2 s | 4.6 s | 5.5 s |
| Barton Peveril (FE sixth form college) | 2.5 s | 2.7 s | 3.6 s | 3.9 s | 2.7 s |

The Chase's (137625) GCSE dashboard drew in 2.8 s; everything had loaded at 3.9–6.5 s.

**Harris Federation (head office):** group home 1.1 s, full overview 0.5 s, each walk 0.4–0.7 s, a member school's SMT 1.5–2.3 s. Groups are fine.

**What the numbers say**
1. **Cold beats everything else.** The first school after a restart pays the national populations, the IGCSE list and similar loads: `smt/school` 6.5–9.6 s, pipeline 8–9 s. The same calls warm take 0.4–2.5 s. Every deploy restarts the server, so the first person after a deploy waits.
2. **Whole-population sets are the one truly slow thing:** 10–18 s for England-wide or all-sector regional sets, even warm. Region-and-sector sets (about 7 s) are tolerable.
3. **Each page does too much.** A typical page makes 8–11 API calls. Several run one after another. Some are duplicated: the account badge twice, the Teacher home's figures twice. Some load data for a page the user hasn't opened.

## 3. Before the demo (done 20 Nov, evening)

| Step | Commit | Result |
|---|---|---|
| Warm-up script, one page at a time (`scripts/warm-demo.mjs`; setup and use at its top). National values are kept 12 hours, so a morning run lasts the day. | `0c707e4`, this commit | Leighton Park, cold → warm: Teacher home 2–10 s → 1.7–2.1 s; SMT home 9–13 s → 1.4 s; SMT Academic, Pupils, Context 3.3–3.5 s → 1.2–1.7 s; Admissions 4.4–4.9 s → 2.1–2.3 s. **Big sets:** independent schools in England 15.9 s / 13.3 s → 1.1 s / 3.4 s; all sixth forms in the South East 11.0 s / 13.6 s → 1.0 s / 3.0 s; independent schools in the South East 5.8 s / 4.6 s → 1.0 s / 1.4 s |
| SMT Academic looks rows up by school and year once (byte-for-byte the same output on 7 states) | `0c707e4` | 488-school set: 3.6 s → 2.0 s of building |
| Account badge: count only, once per page, not blocking the menu | `e35d2e7` | |
| Teacher home: identical phase requests share one answer | `e35d2e7` | |
| SMT: the comparison set's request starts alongside `/api/smt/school` | `9dc4fee` | |
| Saved comparison sets for head office and peek (was 403) | `9dc4fee` | |
| Background preloads | kept | Once the memory crash was fixed they cost little, and with one presenter they make switching phase or Admissions dashboard instant. Revisit for the beta, when many people use the site at once. |

**For the demo:** run `node scripts/warm-demo.mjs 110110 --sets` after the last deploy and again within the hour before (about 1–2 minutes). Any deploy afterwards restarts the server and empties the caches.

**Found, not fixed:** a state school's *State schools in England* set at GCSE is 3,497 schools and takes over 2 minutes to build (too long for the browser, and too big to cache). Leighton Park, as an independent school, never sees it. Hide that default for state schools before the beta, or wait for 4.2 item 1.

## 4. After the demo: the architecture (agreed with Guy, 20 Nov)

### 4.1 Why whole-population sets are slow (measured)
Leighton Park, SMT Academic against independent schools in England (488 schools), locally against the live data:

| Step | Time |
|---|---|
| Resolve the set's members | 4.6 s cold |
| Fetch every member school's qualification rows (62,618 rows, fetched in pages one after another) | 7.3 s cold |
| Fetch value added | 1.0 s cold |
| Compute the page: the row list is filtered again for every school and year, so the work grows with the square of the set size | **3.5 s of CPU every time, even warm** (more on Render's single CPU) |

The set's members and each member school's figures are the same whoever is looking. Only "where you sit" and leaving your own school out of the set differ.

### 4.2 The changes, in order

1. **Each school's figures worked out when new data comes in** (the main job). After each ingest, a job writes one row per school per line, mode and year (value, range, entries, band), plus the member lists of the ~60 standard sets (regions × sectors × phases, and England). A request reads only the members' finished figures (~490 small rows, not 62,000 raw ones) and computes the set's averages in milliseconds, leaving the school out exactly as now. It works for any set: custom and saved sets too, since a set is just a list of schools. The database rank lookup already works this way (17 Oct, `db_performance_report_v1.md`). Expected: 17 s → under 1 s, first view included.
2. **A shared results cache in Postgres** (Guy's idea): the first person to open a view pays, every colleague after reads it in milliseconds. The key is school + view + set + data version. A new ingest changes the version, so stale figures can't be served, and a clean-up job deletes old answers. It survives restarts and deploys, and works with two servers.
   - Anything that depends on the viewer is kept out of the stored answer and added per request: personal saved sets, notes, and the role-dependent Admissions figures in the SMT Overview (split those out first).
   - Security is unchanged: membership is checked first, and only the server (service role) reads the table.
   - Size: ~1,000 schools × ~30 answers × ~100 KB stored (Postgres compresses large JSON) ≈ 3 GB; 3,000 schools ≈ 10 GB. That's within or near Supabase Pro's included 8 GB, then about $0.125/GB a month. Bounded by deleting answers unopened for 60–90 days, and storing only answers that took more than about 0.5 s to build.
   - **Built 20 Nov, off until switched on** (`RESULTS_CACHE=on` in Render; the table first: `supabase/ops/results_cache/apply_results_cache.sql`). `src/lib/results-cache.ts` (memory, then `public.results_cache`), the keyed views in `src/lib/cached-views.ts`. Refined from the plan: the answer is kept as text, not jsonb (jsonb reorders keys; the cached answer is byte for byte the built one; Postgres compresses either); the code version is a hash of every file the API routes import (`scripts/write-build-info.mjs`, `server_code`), not a git log, so a shallow clone gives the same answer and helpers outside `src/lib` count; nothing is stored until the newest stamp is 30 minutes old (the app's derived tables are recomputed just after a promote, unstamped), and a row is used for 24 hours at most; an answer built past a failed read is never stored (`src/lib/build-trace.ts`). `RESULTS_CACHE_EPOCH` set to anything new drops every stored answer.
   - **Warm it ahead of time:** after each ingest, a background job builds the default views for every beta school, one at a time (1,000 schools at ~10 s each is under 3 hours, overnight), so no tester ever opens a cold page.
3. **One data call per page instead of 8–11**, together with Stage 2's cookie sessions (front door part 3, Q1, agreed): the server checks who is signed in once and can draw the first view itself.
4. **Cloudflare caches the public, same-for-everyone data:** England figures, region maps, LA and LSOA boundaries, national populations. These get their own cacheable routes, so they never reach our server.
5. **Heavy work off the web server:** ingest-time builds and warm-ups run as a separate Render background worker or cron job, so a slow build never delays a click.
6. **Two web instances** (Render's Pro workspace, $25/month plus compute): one restart or crash doesn't take the site down. They pair with 2, which every instance shares.
7. **Hosting regions stay as they are:** Render's nearest region to Supabase's London (eu-west-2) is Frankfurt, and Render has no London region. Cutting how many calls run one after another (1 and 3) fixes the distance better than moving would.

**Order:** 1 and 2 together straight after the demo (nearly every page under a second for every school, first view included), then 3 alongside Stage 2's cookie sessions, then 4–6 before the January beta.

### 4.3 Before the demo, from this
Look the Academic builder's rows up by school and year once, instead of searching the whole list each time (and check the Overview for the same pattern): the 3.5 s of computing becomes milliseconds on every SMT set, with no figure changed.

## 5. Not recommended

- **A bigger instance than `1c-2g`:** Node mostly uses one CPU; the 2 GB isn't full.
- **A parallel background warm-up:** that's what broke requests before.
- **Bigger in-memory caches as the fix for slow whole-population sets:** a cold set still takes 17 s. The fix is computing less, and remembering the answer durably (4.2, items 1 and 2).
