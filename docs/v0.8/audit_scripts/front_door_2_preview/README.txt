Front door part 2: the report's screenshots and the 390 x 844 measurements (files end .txt so nothing builds).
  cap/cap.ts + cap/view-as-server.stub.ts + cap/build.mjs   the fixtures, read-only, through the app's own route
        handlers (sets library and editor, Admissions lists/pipeline/market share, SMT school/overview, chooser set,
        teacher phases) with a stand-in caller (the service-role reader; GETs and SMT's read-only POSTs only), plus
        loadTeacherModel and readAccountSummary. build.mjs bundles it (esbuild API, the stub swapped in for every
        import of view-as-server) into <repo>/node_modules/.cache/h/cap.cjs; run from the repo root with
        node --env-file=.env --env-file=.env.local node_modules/.cache/h/cap.cjs <out>/fx.json
  harness.tsx / index.html / build.sh   the real components (?page=guided-feeders|guided-rivals|library|account|
        membership|home-teacher|home-admissions|home-smt|welcome|setup|walk&walk=…&step=…; &theme=dark|light|mid;
        membership &ms=pilot|active &today=yyyy-mm-dd), Supabase and next/* stubbed, /api stubbed from fx.json.
        The CARTO basemap needs the production key: index.html hides the tile pane.
  shot.mjs jobs.json   Playwright's headless Chromium (chromium_headless_shell-1148): a full-page PNG per job and
        measure.json (scrollWidth against the viewport; every link, button, select, summary, input, tab and switch
        under the job's root selector smaller than 44 px; a checkbox or switch measured by its label).
  Serve the folder with python3 -m http.server <port> --bind 127.0.0.1, then node shot.mjs jobs.json out <port>.
