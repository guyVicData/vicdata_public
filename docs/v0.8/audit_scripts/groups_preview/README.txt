Groups r1 preview harness (screenshots in docs/v0.8/groups_r1_screenshots). Files end .txt so nothing here builds.
Built like docs/v0.8/audit_scripts/smt_preview: Tailwind CSS + esbuild of harness.tsx with the stubs there
(supabase, next/navigation, next/link, next/dynamic), served by python3 -m http.server from the folder
holding index.html, bundle.js, app.css and fx/.
  cap_grp.mts  the group fixtures (production lookups, census, the app's school accounts, read-only);
               ?demo=1 picks the labelled demo overlay (accounts, grants, usage, one likely, one left).
  cap_ho.mts   SMT fixtures for one member school, as its SMT and as head office ("Private to ...").
Run: npx -y tsx --env-file=.env cap_grp.mts fx/grp.js; npx -y tsx --env-file=.env cap_ho.mts fx/index.js 140985
Pick a free port and check the server's folder before trusting a shot.
