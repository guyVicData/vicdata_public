Groups r3 preview and parity (files end .txt so nothing here builds).
  cap_dashboards.mts / index_dashboards.html  round 2's dashboard harness (groups_r2_preview), extended with
              Academic, Pupils and the per-school projection; recap with the fixture switch on.
  cap_group.mts   stage S: a member school's SMT with its group chosen as the set (live round 1 lookups):
              npx -y tsx --env-file=.env --tsconfig tsconfig.json cap_group.mts fx/group.js 137018 140985
  index.html      the SMT preview page (docs/v0.8/audit_scripts/smt_preview) with fx/group.js, the chooser
              payload stub (fx.savedSets, with a target) and ?groupset=1 choosing the school's group.
  smtpar.mjs / cmp.py   SMT parity: every dashboard x school x theme x width and every rail view, PNG + DOM,
              TREES=base,r3 (bundles built from each tree with the admissions_preview build.sh).
