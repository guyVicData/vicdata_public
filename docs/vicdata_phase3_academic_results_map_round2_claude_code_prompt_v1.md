Map round 2 on Academic Results — live feedback gathered against vicdata.co.uk
right after the Stage 2 UX round (commit a9b5ce3) shipped. Full detail in
docs/vicdata_phase3_academic_results_map_round2_brief_v1.md — read it in full
before starting.

Six items. Item 1 is a real, live, intermittent bug (Yerbury Primary School:
Map blank in Trend mode with real data present in Graphs; toggling to Grade
band and back fixes it) — reproduce it for real against that exact school
with the dev server running and find the actual mechanism before touching
code; the brief has specific leads (it isn't the already-fixed stale-
container-size issue) but no prescribed fix. Items 2-5 are design-parity
gaps against Rolls' own `MapView.tsx` — that component is the literal
reference for the distance ring, the colour legend's position/title/scale
labels, and the circle-size scale box; copy its real working code rather
than rebuilding a similar version. Item 6 is a small default/position change
(Grade band as default colour mode, toggle moved to the left overlay next
to ViewSwitcher).

Local build/test only, same discipline as every prior round — no commit,
push, or hosted/production changes. Full build report when done, naming
item 1's real root cause explicitly (not just "fixed").
