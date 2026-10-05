0.6.2 S1 -- grade rollup reconciliation scripts (docs/v0.6/grade_rollup_reconciliation_v1.md).
All read-only. No keys in any file.

  q.py          runs SQL from stdin against the vicdata data DB in a READ ONLY session
                (connection string from /Users/guy/dev/vicdata/.env, never printed):
                  /Users/guy/dev/vicdata/.venv/bin/python q.py < full_reconcile.sql
  sample.py     seeded (20261005) sample of 200 (school, subject, qualification) sets per
                phase, plus The Chase GCSE History; dumps rollup + raw facts to sample.json
  *.mts.txt     tsx scripts using the app's own lib (rename to .mts; run from the repo root):
                  npx -y tsx --env-file=.env compare.mts sample.json
                  npx -y tsx --env-file=.env timing.mts 137625 ks4 History
                  npx -y tsx --env-file=.env ks5_historic.mts 117037 Mathematics
  *.sql         q1 national totals + indexes; q3/q4 snapshots and current-vs-all facts; q5
                rows by rollup exclusion class; q6/q7 grade labels (labels.tsv); full_reconcile
                every key, both phases, four years; explain index use; lineage/lineage2
                predecessor effects; labels_impact historic KS5 label differences;
                period_check the period -> academic year mapping
  *.out         outputs as run on 5 Oct 2026
  S2 (0.6.2):
  s2_fixture.mts.txt      builds src/lib/grade-rows.fixtures.json (KS4 rollup rows by read-only SQL,
                          facts through the app's lookup) for src/lib/grade-rows.test.ts
  s2_scale_check.mts.txt  30 schools x both phases: modern-year grade rows and rates identical
                          with gradeYears "four"; lists the sets whose bestScale would change
