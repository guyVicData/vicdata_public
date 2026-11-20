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

## 3. Before the demo (low risk, hours each)

In order of value for the demo:

1. **A warm-up script, run once after the last deploy and again an hour before the demo.** It requests, one at a time, every page and set we'll show (Leighton Park's Teacher, SMT, Admissions, the sets chosen for the demo). It must run one request at a time: the reverted background warm-up (bc6d8b0) ran in parallel and broke the next request. Raise the TTL from 1 h to 12 h for the national, public reads (populations, IGCSE list, England figures), which change only at ingest, so a morning warm-up lasts the day. **Biggest win for the least risk.**
2. **Stop the background preloads.** The Teacher dashboard fetches the other phase 4 s after drawing (`prefetchOtherPhases`, `TeacherDashboard.tsx`). Admissions fetches the other dashboard's routes after 1.2 s. Each page view costs the server double, and that work competes with the next click.
3. **A cheap account badge.** `/api/school-admin/account?waiting=1` runs the whole account summary, including a `usage_events` scan, to show one number. It's on every Teacher page, and is often called twice (0.4–1 s each). Give it a count-only path, and call it once.
4. **Remove duplicate calls:** `/api/front-door/teacher` twice per phase on the Teacher home, the account badge twice.
5. **SMT: run `smt/school` and the chooser-set together** instead of one after the other (about 1 s off every SMT page).
6. **Demo choice, not code:** demo SMT on Leighton Park's 10 nearest or *independent schools in the South East*. Open *independent schools in England* only after warming it.

Also found, not speed: **`/api/teacher/saved-comparator-sets` returns 403 for head-office users** on a member school's SMT pages, so their saved sets are missing. The route recognises only the View as cookie, not head-office access or the peek. Small fix; worth doing before groups are demoed.

## 4. After the demo, before the January beta

1. **Finished answers cached per set.** Cache the built Overview and Academic for each set (memory note: split out the caller-dependent Admissions figures first). A whole-population set then costs 17 s once an hour, not every time.
2. **Set figures computed in the database.** `rankSets`, `rankFixedSets`, `buildOverview` and `smt/academic`'s whole-set rows become SQL functions: one call instead of 8–15 one after another, and far less data shipped to Node. This continues the 17 Oct database work (`db_performance_report_v1.md`).
3. **A per-school dashboard payload worked out when new data comes in** (v0.6.4 "C3"). The Teacher dashboard becomes one read.
4. **Cookie sessions** (front door part 3, Q1, agreed): the server knows who's signed in, checks it once per page instead of 4–6 times, and can render the first view itself.
5. **Hosting:**
   - Render is in Frankfurt, which is its nearest region; Render has no London. Supabase is in London (eu-west-2). Each call one after another pays about 10–20 ms each way. Cutting how many calls run one after another (2 and 3 above) fixes this better than moving.
   - **Two instances** (Render's Pro workspace, $25/month plus compute) means one restart or crash doesn't take the site down. The in-process cache is per instance, so pair it with a shared cache (Render Key Value / Redis) once there are two.
   - Keep the deploy-time warm-up as a post-deploy step.

## 5. Not recommended

- **A bigger instance than `1c-2g`:** Node mostly uses one CPU; the 2 GB isn't full.
- **A parallel background warm-up:** that's what broke requests before.
- **Bigger caches as a fix for slow whole-population sets:** a cold set still takes 17 s. The fix is computing less (4.1 and 4.2).
