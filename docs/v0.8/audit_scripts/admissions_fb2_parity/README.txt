Admissions feedback round 2 parity (6 Nov): base 38ad793 (main 5fe846e + the prompt) vs branch 6ca0c1d.
Files end .txt so nothing here runs or builds. They are the harness scripts that differ from the committed
copies (most of them are the deploy-gate round's adaptations, carried over); copy them back over:
  teacher/   docs/v0.7/audit_scripts/parity_harness   (+ h/leaflet-all.css; paths point at the two worktrees,
             base 38ad793 in place of main-tree; run: PARITY_HTTP=8771 ./run_parity.sh)
  adm/       docs/v0.7/audit_scripts/admissions_preview
             cap2.mts reads REPO (run in each tree: REPO=<tree> npx -y tsx --env-file=<tree>/.env cap2.mts fx_<t> <urn> <entries>,
             then cat fx_<urn>.js > fx_<t>/index.js); css.mjs takes the tree as argv[3]; harness.tsx: theme on page=slot;
             par.mjs: 4 schools and a fixture dir per tree (name=bundle:css:fxdir);
             shot.mjs: DOM=<file> also writes document.body (a full screen is a fixed layer outside the panel);
             fxdiff.py: the fixtures' differing paths; where.py <out> <A> <B>: which panel's DOM differs, and its view.
  smt/       docs/v0.8/audit_scripts/smt_preview (+ the catchment routes); cap_base/cap_br.mts import from each tree;
             smtpar.mjs (+ smtpar_only.mjs, ONLY=<urn_page_theme_w>,...) and cmp.py
  grp/       groups_r3_preview + groups_r2_preview's smtpar files; cap.mts needs
             VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=<tree>/docs/v0.8/groups_fixtures REPO=<tree>;
             grppar_pick.mjs with PICK='{"harris":"131747","dukes":"100080"}'
  dv/        docs/v0.7/audit_scripts/year_rehearsal (harness_dv.tsx); fixtures are the Teacher run's fix_{main,br}_*_ks4.js;
             SCHEME=light|dark node dvshots.mjs <cdp> <http> out_<scheme> base=bundle_base:app_base:main br=bundle_br:app_br:br
  pxdiff.py  <dirA> <dirB> <png>...: differing pixels, max channel step, bbox
Absolute paths name the session scratchpad's worktrees (base/, branch/); repoint them for another run.
Full-screen extra (Leighton Park 11+, light, 1440x900, NOFULL=1): ROLL-LINE is in c3.trends, VS-LINE in c1.trends.
