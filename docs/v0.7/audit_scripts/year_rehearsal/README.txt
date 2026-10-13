Year rules Y3: rehearsing a new year (GCSE 2025/26 here). Files end .txt so nothing here builds.

The fixture is scripts/year-rehearsal/ in the repo (synthetic-year.ts + install-ks4-2025.ts): a fetch
wrapper that adds the new year to every vicdata reference read, so the app's own server code computes
everything from it. Preload it into any capture process:
  npx -y tsx --env-file=.env --import=./scripts/year-rehearsal/install-ks4-2025.ts <capture script> ...

How 13 Oct's rehearsal was run (harnesses in docs/v0.7/audit_scripts/parity_harness and
admissions_preview):
  Teacher   parity_harness/lib/cap.mts per school (137625 History, 117037 Mathematics, 118952 Mathematics),
            once plain (today) and once with the preload (2025/26); fixtures renamed fix_main_<urn>_ks4_y.js
            (today) and fix_br_<urn>_ks4_y.js (2025/26), each given dashboard.latestYears; the branch bundle
            copied as both bundle-main.js and bundle-br.js; walk.mjs over cases_y.json; cmp6.py.
  Data View harness_dv.tsx (build_dv.sh, index_dv.html, yr-stub.ts for a tree without years.ts) draws the
            Data View's academic graphs and rankings and the public page's academic sentence from those
            fixtures' wire profiles; dvshots.mjs, today vs 2025/26 (and main vs branch, today, for parity).
  Admissions admissions_preview/cap2.mts with the preload into fx_y26/; par_y.mjs (par.mjs with a fixture
            set per tree) today=fx_s12 vs y26=fx_y26, both on the branch bundle; parcmp.py.
Pick free ports (lsof -iTCP:<port> -sTCP:LISTEN) and check a server's cwd before trusting a run: other
sessions' harness servers may hold the defaults (8977, 8979, 8991).
Next year: change from/to in install-ks4-2025.ts (or add install-ks5-...).
