# Read-only SQL runner against the vicdata production DB. Connection string from
# /Users/guy/dev/vicdata/.env (VICDATA_DB_URL); never printed. Every session is forced
# read-only, so no statement here can write.
import os, sys, time, json
from dotenv import load_dotenv
import psycopg2
load_dotenv("/Users/guy/dev/vicdata/.env")
conn = psycopg2.connect(os.environ["VICDATA_DB_URL"])
conn.set_session(readonly=True, autocommit=False)
cur = conn.cursor()
cur.execute("set statement_timeout = '300s'")
sql = sys.stdin.read()
for stmt in [s for s in sql.split(";\n") if s.strip()]:
    t0 = time.time()
    cur.execute(stmt)
    ms = (time.time() - t0) * 1000
    if cur.description:
        cols = [d[0] for d in cur.description]
        print("\t".join(cols))
        for r in cur.fetchall():
            print("\t".join("" if v is None else str(v) for v in r))
    print(f"-- {ms:.0f} ms", file=sys.stderr)
conn.rollback()
