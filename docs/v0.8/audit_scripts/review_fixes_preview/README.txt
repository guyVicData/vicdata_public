0.8 review fixes (14 Nov): the walks' screenshot harness, the fixture capture and the palette pick (files end .txt so
nothing builds). $SCRATCH is the session scratchpad.
  cap/cap.ts (+ view-as-server.stub.ts, build.mjs)   read-only capture of the routes' own answers through their real
        handlers with a stand-in caller (the service-role reader), as front door part 2's cap did: Admissions pipeline,
        market share and rivals (Leighton Park 11+ and 16+, The Chase 11+), SMT school/overview/academic/pupils/context
        (both schools), and loadTeacherModel (The Chase GCSE Geography and its smallest subject; Leighton Park Post-16,
        its smallest subject and Physics) -> docs/v0.8/review_14nov/fixtures/*.json (the walk tests run on these).
        Run: node cap/build.mjs, then node --env-file=.env --env-file=.env.local node_modules/.cache/h/cap.cjs <dir>.
  cap/cap2.ts (build2.mjs)   the harness's extra answers (SMT chooser set and context map; the group walks' dash payloads
        through dashPayload over the group fixtures, Harris and Nexus; projections) -> $SCRATCH/fx2.json. Needs
        VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=<tree>/docs/v0.8/groups_fixtures.
  harness.tsx / index.html / build.sh   the app's own WalkPage, every walk, Supabase and next/* stubbed (stubs/), /api from
        the fixtures. ?walk=…&step=N (1-based: the old harness's step=0 showed step 1, so its file names were one off --
        walks.md finding 31)&theme=dark|light|mid&urn=110110|137625&g=harris|nexus&fx=<teacher fixture>&entry=16%2B.
        The sticky phone footer is pinned static so full-page shots don't print it mid-page; map tiles hidden.
  shot.mjs + jobs.py   Playwright's headless Chromium (chromium_headless_shell-1148; the installed Chrome crashes), a
        full-page PNG per job and 390 px measurements. Serve the folder with python3 -m http.server 3291.
  palette.py / palette2.py / board.py   the subject-family palette pick (CIEDE2000, contrast) and its board (Pillow, in a
        scratch venv, python -I): docs/v0.8/review_fixes_screenshots/palette_board.png.
  checks.sh / unit.sh   build, eslint, tsc, rule tests, catalogue unit tests, every PGlite suite (the PostGIS ones with
        PGlite 0.5.5 as their headers say); every unit test file in its own process (group files on the fixtures).
