SMT round 1 preview harness (0.8). Files end .txt so nothing here builds.
  cap.mts      fixtures from the routes' own server functions (read-only), for The Chase and Leighton Park:
               npx -y tsx --env-file=.env cap.mts fx/index.js 137625 110110
  build.sh     Tailwind CSS over a tree, then an esbuild bundle of harness.tsx (stubs: copy them from
               docs/v0.7/audit_scripts/admissions_preview); ENTRY=harness_home.tsx for the homes
  index.html   the page: fixtures, a fake Supabase (window.__DB) and fetch stubs for /api/smt/* and /api/teacher/*
               ?case=137625|110110 &page=overview|academic|home|editor &theme &level &area &role=smt|multi|padmin
  shot.mjs     headless Chrome screenshots (CLICK= to open a menu or full screen)
  homecmp.mjs  the Teacher and Admissions homes, main vs branch, DOM and PNG byte for byte (20 pairs)
Serve the folder on a free port (check the server's cwd: other sessions' servers may hold the defaults).
