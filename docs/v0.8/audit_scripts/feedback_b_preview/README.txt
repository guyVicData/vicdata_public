0.8 feedback B (15 Nov): the screenshot harness (files end .txt so nothing builds). Build A's walk harness
(review_fixes_preview) extended to draw the homes' own sections. $SCRATCH is the session scratchpad.
  harness.tsx   the app's own WalkPage, or ?page=home&s=ks4,ks5,smt,admissions: the homes' real sections in HomeFrame.
  index.html    /api answered from the fixtures (docs/v0.8/review_14nov/fixtures, the A build's fx2 and
                teacher_137625_ks5_art, and the sets library for 110110 and 137625 captured read-only through
                libraryData with a service-role reader, as View as reads it). The Teacher route is answered per phase
                (Leighton Park has no GCSE fixture). Switches: ?delay=ms holds every answer (the loading graphic);
                ?teacher=fail answers the Teacher home 502; ?smtlevel=gcse|post16 is the SMT home's remembered phase.
                Known: the SMT context fixture is the whole-school one at any level.
  build.sh      Tailwind over the tree, then the esbuild bundle (stubs for Supabase and next/*).
  shot.mjs      Playwright's headless Chromium 1148 (playwright-core 1.49.1), a full-page PNG per job, 390 px measures.
  jobs.py       the 48 jobs: python3 -I jobs.py jobs.json. Serve the folder: python3 -m http.server 3391 --bind 127.0.0.1.
  squash.py     the PNGs to 256 colours (Pillow in a scratch venv, python -I), to keep the folder small.
  checks.sh / unit.sh   per-commit checks in a scratch worktree: eslint, build, tsc, rule tests, catalogue unit,
                every PGlite suite (the PostGIS ones with PGlite 0.5.5), every unit file in its own process.
