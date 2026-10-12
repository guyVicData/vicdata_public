VicData parity harness (rebuilt 2026-10-12)
===========================================
Compares the branch WORKING TREE of /Users/guy/dev/vicdata_public against `main`.
Read-only against the repo (no file in it is written; main is a detached worktree here) and the
database (fixture capture uses the app's own read fetchers). Everything is written under this
directory. Server keys are used only in the tsx capture processes, never in a bundle.

RUN
  cd <this dir> && ./run_parity.sh              # full run, ~30-40 min, prints SUMMARY at the end
  ./run_parity.sh --sets "c5_0 sv"               # a subset of case sets (c5_0..c5_3 rka rkb sv)
  ./run_parity.sh --selftest                     # + negative control (a planted label change must be caught)
  ./run_parity.sh --recapture-main | --rk | --no-walk
  Env: PARITY_HTTP (port, default 8991), PARITY_WALK_CAP (seconds per walker, default 5400),
       MAPSLEEP (ms wait on map views, default 500).
  Exit code 0 = clean; 3 = something unexpected / only-one-side / DIFFERENT / FAILED (see SUMMARY).
  Each run writes out/run_<stamp>/: SUMMARY.txt, run.log, walk_<set>.log, cmp_<set>.txt,
  <set>/{main,br}/*.png|*.json (one PNG + one text digest per panel view), graph/, and the SSR
  outputs in logs/ssr/.

WHAT IT DOES (in order)
  1. main-tree/   `git worktree add --detach main-tree main` + `cp -cR node_modules` (APFS clone).
                  Reused; moved to main's tip automatically if main has moved (then main's fixtures
                  are re-captured).
  2. http         python3 -m http.server on 127.0.0.1:$PARITY_HTTP serving h/.
  3. fixtures     lib/capall.sh <br|main> -> lib/cap.mts in each tree (npx tsx --env-file=<repo>/.env,
                  that tree's own lib): the 10 fixtures of the 0.6.5 matrix (137625, 100053 ks4;
                  117037, 130432 (+_aslaw _btec _tlevel), 118952 (+_ibmaths), 130416 ks5) into
                  h/fix/fix_<tag>_<urn>_<phase><fx>.js, incl. leanProfiles. Branch: every run.
                  Main: cached. The summary says whether both trees' fixtures are byte-identical.
  4. bundles      lib/build.sh <tree>: Tailwind v4 CSS (lib/css.mjs) + esbuild@0.24.0 of lib/harness.tsx
                  (members' TeacherDashboard, admin=0, in-memory Supabase stub lib/stubs/supabase.ts,
                  stubs for next/link, next/navigation, next/dynamic; NODE_ENV=production,
                  NEXT_PUBLIC_DASHBOARD_RENDERER=config) -> h/bundle-<tree>.js, h/app-<tree>.css.
  5. ranking fix. h/fix/fix_rk_*.js (shared by both trees, computed by the branch lib): only when
                  missing or --rk. lib/probe_rk.mjs loads the ranking cases on both bundles and records
                  the chooser-set / subject-ranking bodies with no fixture; lib/caprk.mts computes them
                  (resolveRankingSet, subjectRanking, lean + full profiles); repeated until none missing.
                  A walk that still meets an unanswered request writes <case>__unstubbed.txt.
  6. walk         lib/walk.mjs, one headless Chrome per case set, in parallel (CDP; every panel x
                  rail view, phone tabs at 390, both themes as the cases say). Case sets in lib/cases/:
                  cases5_0..3 (0.6.5 matrix, 116 cases), cases6_rk_a/b (0.6.6 rankings, 24),
                  cases7_saved (0.6.7 saved set, 3). Progress line every 60 s.
  7. compare      lib/cmp6.py: pairs main/X with br/X by case + panel + pressed rail view:
                  IDENTICAL (pixels + words equal), NOISE (words equal, max channel diff <= 8),
                  NOISE-render (words equal, <= 0.1% px), else UNEXPECTED; only-main / only-branch;
                  errors / failed / unstubbed files per side.
  8. import graph lib/graph.py: esbuild --metafile (packages external) of entries importing
                  @/app/schools/[urn]/data/page (dataview), @/app/schools/[urn]/page (public),
                  @/app/teacher/[phase]/page + teacher/page + teacher/people/page (teacher), plus
                  dataview-api / public-api = the route.ts files those client graphs fetch. Each graph
                  is intersected with `git diff --name-only main -- src` + untracked src files.
                  Expected for Data View / public page: none.
  9. SSR          lib/ssr.sh [urn...] (default 137625 117037): esbuild (node) of lib/ssr/entry.tsx per
                  tree; the public school page is awaited (async server components resolved by hand)
                  and renderToStaticMarkup'd. The branch runs on live read-only data with every fetch
                  recorded (logs/ssr/store.json); main replays the recording. Byte comparison.
 10. selftest     lib/selftest.sh (--selftest): bundle-neg.js = branch bundle with "Growing" ->
                  "Growinq"; one case walked main vs neg must give UNEXPECTED pairs.

PIECES RUN ALONE (all from this directory's lib/)
  ./lib/capall.sh br            ./lib/build.sh br          python3 lib/graph.py
  ./lib/ssr.sh 137625           ./lib/selftest.sh          python3 lib/cmp6.py out/run_X/c5_0
  PARITY_HTTP=8991 node lib/walk.mjs out/x 9700 lib/cases/cases7_saved.json   (needs the http server)

PROVENANCE
  Rebuilt from docs/v0.6/audit_scripts (v065/, grades_maps_tables/) plus the 0.6.6 / 0.6.7 patches
  replayed from the session transcript c95d26c6 (harness ranking/ticked/saved params, index.html
  ranking, headlineLabel, comparator-profiles, saved sets, exact-set academic-schools; cmp6, caprk,
  caplean, cases6_rk, cases7_saved), the stubs from session 22f4c365's subagents (supabase.ts,
  navigation.ts, link.tsx, dynamic.tsx), leaflet-all.css re-concatenated from node_modules (same
  18,223 bytes). New: per-tree capture incl. lean profiles in one step, unstubbed-route log,
  progress logs, API-route graphs, the SSR check, the negative control, the driver.

KNOWN FLAKES (seen 2026-10-12, also in 0.6.6/0.6.7)
  rk-137625-nat-pending__c1.trends__Map: words equal, map pixels differ on some runs (identical on
  others; same in 0.6.6). Re-check one case: build lib/cases/recheck.json with that case and run
  walk.mjs + cmp6.py on it twice (server must be up).
  "rej TypeError: parameter 1 is not of type 'Element'" __errors.txt on a random 130416/130432 ks5
  case, either tree, not repeatable (0.6.7 saw the same).

0.7 r3 (2026-10-12): PARITY_MASK=1 ./run_parity.sh hides the panel icon row on both trees (main: the
header's full screen / collapse and the footer's Export; branch: [data-panel-icons]) and drops their
labels from the digest, so a pair differs only if something outside the icon row changed. Run it with
and without the mask: unmasked counts every pair the icon row changes, masked shows nothing else did.
Geometry check for a pair that still differs: admissions_preview/geo.js.txt (element rects inside the
panel, icon row skipped) on both bundles, then diff.
