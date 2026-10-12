Admissions r2 preview harness (scratchpad copy; files end .txt so nothing here runs or builds).
Rebuild in a scratch dir: copy these back without .txt, put fixtures in fx/ (cap2.mts <outdir> <urn> <entries>,
run with `npx -y tsx --env-file=<repo>/.env`, then concatenate fx_*.js into fx/index.js), then:
  ./build.sh                       Tailwind CSS over the repo + esbuild bundle of harness.tsx with the stubs
  python3 -m http.server 8977 --bind 127.0.0.1
  node shot.mjs <port> <out.png> "<url>" <w> <h> <waitMs>     (env CLICK=js;;js, CLIP=selector, LOGS=1)
  node shots.mjs jobs.json         4 at a time;  node timing.mjs   client draw timings
index.html params: case=<urn> role=lead|member|smt|admin|viewas|teacher|shared saved=1 theme=dark|light
  view=market-share entry=16%2B setup=entry|day|boarding|rivals page=people|team|home|slot
Routes are served from the fixtures (window.fetch), the session and tables from a fake Supabase client.
