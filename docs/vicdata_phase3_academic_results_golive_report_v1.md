# Go-live report: Academic Results — STOPPED at step 3, real blocker found

Executing `vicdata_phase3_academic_results_frontend_round2_build_report_v1.md`'s own
Part D checklist, in order. Stopped partway through step 3 (of the six real steps) when
a genuine, previously-uninvestigated blocker turned up. `vicdata_public` was **not**
touched at all — no commits, no push, no deploy attempt — per the explicit instruction
to never let the front end go live before the database underneath it is real.

## Step 1 — `vicdata`: commit and push the remaining docs — DONE

```
$ git add docs/vicdata_phase3_academic_results_topic_spec_v1.md \
          docs/vicdata_phase3_academic_results_rpc_bridge_claude_code_prompt_v1.md \
          docs/vicdata_phase3_academic_results_summary_wordings_v1.md
$ git commit -m "Add Academic Results planning docs: subject taxonomy resolution, RPC bridge prompt, summary wordings"
[main e9a00a6] Add Academic Results planning docs: subject taxonomy resolution, RPC bridge prompt, summary wordings
 3 files changed, 227 insertions(+), 17 deletions(-)
 create mode 100644 docs/vicdata_phase3_academic_results_rpc_bridge_claude_code_prompt_v1.md
 create mode 100644 docs/vicdata_phase3_academic_results_summary_wordings_v1.md
```

`git push origin main` initially failed: `git@github.com: Permission denied
(publickey)` — the SSH key `~/.ssh/id_ed25519_guyvicdata` the repo's remote
(`github-guyvicdata`) needs existed on disk but wasn't loaded into the SSH agent
(`ssh-add -l` returned "The agent has no identities"). Stopped and asked rather than
working around it. You loaded the key yourself; retried:

```
$ git push origin main
To github-guyvicdata:guyVicData/vicdata.git
   a92d22e..e9a00a6  main -> main
```

Pushed successfully.

## Step 2 — reconfirm the pending migration list — DONE, matched exactly

```
$ supabase migration list
```

Same 14 migrations (`20260912100000` through `20260913320000`) showed `remote: ""`;
everything through `20260828101500` showed `remote` matching `local`, identical to the
round 2 report. Nothing changed hosted-side in between. Safe to proceed.

## Step 3 — apply the 14 migrations — migrations applied and verified; RPC check surfaced a real, separate blocker

```
$ supabase db push
```

All 14 applied in order, one benign notice (`NOTICE (42P07): relation
"canonical_facts_snapshot_id_idx" already exists, skipping` — that specific index
already existed on hosted, the migration is idempotent, not an error). A post-push
"failed to cache migrations catalog" warning appeared (an unrelated CLI catalog-caching
step hitting a missing cert file in its own temp workspace) — this is the CLI's own
post-push convenience step failing, not the migration application itself, which had
already completed and reported success before this warning printed.

Re-ran `supabase migration list`: all 14 now show `remote` matching `local`. Migrations
genuinely applied.

**Real anon-key HTTP call to hosted `academic_headline_lookup`** (hosted URL/key
sourced from `vicdata`'s own `.env`, read into the request only, never printed or
logged):

```
$ curl -X POST "${VICDATA_API_URL}/rest/v1/rpc/academic_headline_lookup" \
    -H "apikey: ${VICDATA_ANON_KEY}" -H "Authorization: Bearer ${VICDATA_ANON_KEY}" \
    -d '{"p_entity_ids":["121673"],"p_ks_stage":"ks4"}'
HTTP 200
[]
```

The function is genuinely reachable and callable by the anon key (a real 200, correctly
shaped as an empty array, not a permission or schema error) — but it returned **no
rows** for a real URN (Huntington School) that has real, substantial data in the local
stack throughout every prior round's own testing.

**Investigated why, read-only, before reporting** (no changes made):

```sql
select count(*) from academic_headline_snapshot;                          -- 0
select source_id, count(*) from canonical_facts_current
  where source_id in ('dfe_ks4_headline','dfe_ks5_headline',
    'dfe_ks4_headline_historic','dfe_ks5_headline_historic','dfe_ks2_attainment')
  group by source_id;                                                     -- (no rows at all)
select count(*) from subject_families;                                    -- 8
select count(*) from academic_subject_family_rollup;                      -- 0

select source_id, last_successful_ingest from source_registry
  where source_id in ('dfe_ks2_attainment','dfe_ks4_headline','dfe_ks4_headline_historic',
    'dfe_ks4_subject_entries','dfe_ks5_headline','dfe_ks5_headline_historic',
    'dfe_ks5_subject_results','dfe_ks5_subject_value_added');
-- every one: last_successful_ingest = NULL

select count(*) from ingest_snapshots where source_id like 'dfe_ks%';     -- 0
```

**The real, confirmed finding**: every migration this round applied — the schema, the
three new RPCs, the reference/taxonomy tables — is now genuinely live on hosted
`vicdata`. `subject_families`' 8 real rows exist because that migration seeds them
directly. But **none of the eight Academic Results DfE sources
(`dfe_ks2_attainment`, `dfe_ks4_headline`(`_historic`), `dfe_ks5_headline`(`_historic`),
`dfe_ks4_subject_entries`, `dfe_ks5_subject_results`, `dfe_ks5_subject_value_added`)
have ever been ingested against hosted `vicdata` at all** — `last_successful_ingest` is
null for every one of them, and there are zero real `ingest_snapshots` rows for any of
them. Every real ingest run across this entire project's history (every round, going
back to the very first KS2/KS4/KS5 briefs) was run against the **local** Docker stack
only, per the standing "never touch hosted" discipline every round has followed until
now. Nobody has ever actually populated hosted `vicdata`'s own `canonical_facts` with
this real academic data — the migrations only ever built the schema and RPCs waiting
for it.

**This is why I stopped.** Applying migrations was necessary but not sufficient —
running the real ingest pipeline against hosted, for eight real sources, is a
substantial, separate, new production action (real external DfE fetches, real
promote-triggered recomputes against the live database, likely a non-trivial amount of
time) that was never part of this brief's own scope or the round 2 report's Part D
checklist, and isn't something to improvise into without your explicit say-so. Deploying
`vicdata_public` now — even though every line of its own code is correct and fully
tested — would put a genuinely empty Academic Results experience in front of real site
visitors (every snapshot card and Data View Academic tab would show "no real data
available," for every real school), which is exactly the failure mode you asked me to
make sure never happens.

## Not done — stopped here, as instructed

- `vicdata_public`: **no commits, no push, no deploy check, no smoke test.** Nothing in
  this repo was touched.
- Steps 4-6 of your own instructions (commit/push `vicdata_public`, check the Render
  deploy mechanism and hosted env vars, smoke-test the live site) were not started.

## What's true right now

- `vicdata`: fully committed and pushed (`e9a00a6`), all 14 Academic Results migrations
  genuinely applied and confirmed on hosted, all three new RPCs confirmed reachable and
  correctly-shaped via a real anon-key call.
- Hosted `vicdata` has **no real Academic Results data at all** yet — the tables and
  functions are live and empty.
- `vicdata_public`: still exactly as round 2 left it — committed nowhere, not pushed,
  not deployed.

## Real open question for you, not decided here

Whether to run the real ingest against hosted now (and if so, in what order, and
whether you want to run it yourself or have me run it as its own explicit, separate
round with its own plan) is a genuinely new decision this discovery raises — it's a
bigger, riskier, first-time-against-production action than anything this rollout
checklist itself asked for. Flagging it rather than guessing which way you'd want it
run.
