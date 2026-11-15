0.8 feedback C (15 Nov): the screenshot harness, the fixture capture and the palette pick (files end .txt so
nothing builds). $SCRATCH is the session scratchpad.
  cap/capc.ts (+ build.mjs, view-as-server.stub.ts)   read-only capture through the routes' own handlers with a
        stand-in caller (the service-role reader): SMT school/overview/academic (and at Post-16)/pupils/context for
        Leighton Park and The Chase, and their Admissions rivals and market share at 11+ ->
        docs/v0.8/feedback_15nov/fixtures/*_c.json (feedback-c.test.tsx runs on these); the Admissions sets and
        shape answers for the harness -> $SCRATCH/fxx. node cap/build.mjs, then
        node --env-file=.env --env-file=.env.local node_modules/.cache/h/capc.cjs <fixtures dir> <extra dir>.
  cap/gen.test.tsx   rewrites the harness's fx.js (build B's) with those answers and The Chase's Post-16 Art and
        Design model rebuilt by the branch's buildTeacherModel (from teacher_137625_ks5_input.json).
  harness.tsx / index.html / build.sh   build B's harness plus the real dashboards: ?page=smtdash&dash=…,
        ?page=admdash (the whole SmtDashboard / AdmissionsDashboard, Supabase and next/* stubbed, /api from the
        fixtures). ?smtlevel=post16 is the remembered phase; the walk's Academic answers at ?level=post16.
  shot.mjs + jobs.py   Playwright's headless Chromium 1148 (the installed Chrome crashes), full-page PNGs, 390 px
        measures (no page scrolls sideways). A job's `click` picks a rail view by its name or title.
  squash.py   the PNGs to 256 colours (Pillow in a scratch venv, python -I).
  palette.py / pick8.py / board.py   the C14 pick (CIEDE2000; R-SUBJECT-COLOUR's floors) and the board
        (docs/v0.8/feedback_c_screenshots/palette_board.png).
  checks.sh / unit.sh   eslint, build, tsc, the rule tests, catalogue unit, every PGlite suite (PostGIS ones with
        PGlite 0.5.5), every unit file in its own process; in place on the worktree.
