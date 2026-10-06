# S1 sample dump (read-only). Seeded random sample of (school, subject, qualification)
# sets per key stage from academic_subject_grade_rollup, plus every rollup row and every
# raw canonical_facts_current row for those sets, so the tsx side can compare them with
# what the app's own fetch returns. Usage: python sample.py <n> <out.json>
import os, sys, json, random
from dotenv import load_dotenv
import psycopg2
load_dotenv("/Users/guy/dev/vicdata/.env")
conn = psycopg2.connect(os.environ["VICDATA_DB_URL"]); conn.set_session(readonly=True)
cur = conn.cursor(); cur.execute("set statement_timeout='300s'")
N = int(sys.argv[1]); out = sys.argv[2]
SOURCES = {"ks4": ["dfe_ks4_subject_entries", "dfe_ks4_subject_entries_historic"],
           "ks5": ["dfe_ks5_subject_results", "dfe_ks5_subject_results_historic", "dfe_tlevel_results"]}
res = {}
for ks in ("ks4", "ks5"):
    cur.execute("select distinct entity_id, subject, qualification_type from academic_subject_grade_rollup where ks_stage=%s order by 1,2,3", (ks,))
    allsets = cur.fetchall()
    rnd = random.Random(20261005)
    sets = rnd.sample(allsets, N)
    if ks == "ks4":
        chase = ("137625", "History", "GCSE (9-1) Full Course")
        if chase not in sets: sets.append(chase)
    urns = sorted({s[0] for s in sets})
    cur.execute("select entity_id, subject, qualification_type, grade, period, entries from academic_subject_grade_rollup where ks_stage=%s and entity_id = any(%s)", (ks, urns))
    want = set(sets)
    rollup = [[e, s, q, g, p, float(v)] for e, s, q, g, p, v in cur.fetchall() if (e, s, q) in want]
    cur.execute("select source_id, entity_id, period, breakdown, value_numeric from canonical_facts_current where source_id = any(%s) and entity_id = any(%s)", (SOURCES[ks], urns))
    facts = []
    for src, e, p, b, v in cur.fetchall():
        parts = b.split("::")
        if len(parts) >= 3 and (e, parts[1], parts[0]) in want:
            facts.append([src, e, p, b, None if v is None else float(v)])
    res[ks] = {"population": len(allsets), "sets": [list(s) for s in sets], "rollup": rollup, "facts": facts}
    print(ks, "population sets", len(allsets), "sample", len(sets), "urns", len(urns), "rollup rows", len(rollup), "facts rows", len(facts))
json.dump(res, open(out, "w"))
