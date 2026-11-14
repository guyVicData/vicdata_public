0.8 non-mainstream groups (M5-M9): the parity harness and the screenshots (files end .txt so nothing here builds).
$SCRATCH stands for the session scratchpad: base/ (a detached worktree of main 00ca9de, node_modules copied, not
symlinked), h/ (these files), pw/ (playwright-core 1.49.1 and its headless Chromium: the installed Chrome crashes).
  cap_base.mts   the group sets round's cap (docs/v0.8/audit_scripts/group_sets_preview/cap.mts), pointed at base/:
                 the dash route's steps over base's own fixtures, Harris and Dukes -> fx/base.js
  cap_br.mts     the branch: the route's own body (src/lib/groups/dash-payload.ts dashPayload) with the same stored
                 sets and keys for Harris and Dukes, plus Nexus, Birmingham and Shaw, the library and its group pages
                 -> fx/br.js. Run in the tree: REPO=<tree> VICDATA_GROUP_FIXTURES=true
                 VICDATA_GROUP_FIXTURES_DIR=<tree>/docs/v0.8/groups_fixtures npx tsx --env-file=.env --env-file=.env.local cap_br.mts fx/br.js
  jsondiff.py    <base.js> <br.js> harris,dukes: every value of every dash response, the sets and schools answers;
                 a changed or missing value is a move, a new key an addition (M5-M8: 0 moves).
  build.sh       <tree> <site> <fx>: Tailwind over the tree, the esbuild bundle (stubs/ for supabase and next/*), the
                 fixtures (HIDX/HTSX pick index_br.html and harness_br.tsx, which add the library's group page).
  domtext.mjs    the words parity: every Harris and Dukes page (each dash response, the editor, Manage sets) in base
                 (port 3192) and branch (3191), 1440 and 390, the page's innerText compared.
  shots.sh       the report's screenshots (13 screens x 1440/390 x dark/light/mid) with pshot.mjs.
