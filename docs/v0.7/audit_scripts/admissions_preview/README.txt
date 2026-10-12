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

0.7 admissions editor s1-2 (12 Oct): the Admissions parity pass and the focus / editor shots.
  par.mjs <port0> <workers> name=bundle:css ...   every view of both dashboards, per school x entry x theme x width,
                                                  step 0 = each panel's default, step i = each panel's view i-1;
                                                  full-page PNG + #teacher-root DOM per step (map tiles blocked). OUT=, HTTP_PORT=
  python3 parcmp.py <out> <treeA> <treeB>         pairs identical only when pixels AND DOM match
  harness_s2.tsx (ENTRY=harness_s2.tsx ./build.sh) adds page=look: one view with ?dv= &lk=key:value &feeders=
  focus.sh                                        the large view's full screen at 1440/1920/1280x720, both themes
  shot.mjs: NOFULL=1 keeps the window size (a fixed modal isn't stretched to the page height)
