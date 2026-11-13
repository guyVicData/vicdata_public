Group sets M4-M6 preview, screenshots and the shared-sets SSR parity (files end .txt so nothing here builds).
  cap.mts        the dash route's own steps (resolveCompare + the builders) over the group fixtures, with a few
                 stored sets and subsets as a head office would have them -> fx/gs.js. Run with the fixture switch:
                 VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=$PWD/docs/v0.8/groups_fixtures \
                   npx -y tsx --env-file=.env --env-file=.env.local --tsconfig tsconfig.json cap.mts fx/gs.js
  harness.tsx    renders GroupDashboard (?page=overview|schools|academic|pupils), the library (library), the
                 editor in group mode (edit) and Manage sets (sets); index.html stubs /api/group/dash, /api/group/sets
                 and /api/group/library from fx/gs.js (?who=school|view_as reads as a member school's SMT or View as).
  build.sh       Tailwind CSS over the worktree + the esbuild bundle (stubs/ for supabase and next/*).
  shots.sh       the report's screenshots (1440 and 390, dark and light), with pshot.mjs: Playwright's headless
                 Chromium (npm i playwright-core@1.49.1; npx playwright@1.49.1 install chromium). The installed
                 Google Chrome 157 dies at start-up in this environment.
  parity_sets_ssr.tsx  the shared sets code school pages use (SetSelector in 24 states, the creator pills, the header
                 line, every way-back rule over 20 addresses), rendered on the server in each tree: copy into the
                 tree's src/ as __parity_sets.tsx, `npx tsx src/__parity_sets.tsx > out.json`, compare the two.
