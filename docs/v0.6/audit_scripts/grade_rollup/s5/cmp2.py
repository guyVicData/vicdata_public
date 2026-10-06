# python3 cmp2.py <outRoot>: main vs br (after S4b), pixels and digests, every shot; each difference classified.
#   (cmp.py's kinds, amended by Guy's decisions of 6 Oct: A -- every latest-year view identical;
#   B -- every grade / points trend statement measured from 2022/23, points included.)
#   IDENTICAL            pixels and digest equal
#   NOTE-ONLY            pixels equal; only the "i" popover text differs, and only by the 2021/22
#                        grading note (S4) and/or the S2 "published per grade only from 2023/24"
#                        clause leaving
#   EXP-YEARS            a Trends panel on a grade measure (Grade 4+/A*-E, bands, counts; or
#                        Context / Comparisons following them) whose branch view reaches back to
#                        2021/22 or 2022/23 -- the expected kinds (years gained, bars -> lines,
#                        change since the first year, direction words, ranked change)
#   EXP-STATEMENT        a Trends panel on a grade or points measure (not Candidates) whose words
#                        or picture differ only as R-TREND-FROM-2223 says: its statements are
#                        measured from 2022/23 (never "since 2021/22" on the branch), the %
#                        change half starts at 2022/23, and every table row's latest-year value
#                        is main's
#   UNEXPECTED           anything else (reviewed by hand). A Current (latest-year) panel is
#                        never expected to differ beyond NOTE-ONLY; nor is anything on Candidates.
import json, os, re, sys
from collections import Counter, defaultdict
from PIL import Image, ImageChops

root = sys.argv[1]
A, B = os.path.join(root, "main"), os.path.join(root, "br")
NOTE = "Trends are measured from 2022/23."
S2_CLAUSES = [
    re.compile(r"Grades are published per subject only from 2023/24, so this covers fewer years than (average points|the other measures)\. ?"),
    re.compile(r"(Grade 4\+ rate|A\*–E rate|Grade 4\+|A\*–E) is published per grade only from 2023/24, so this covers fewer years than (average points|the other measures)\. ?"),
    re.compile(r"[^.\n]* is published per grade only from 2023/24, so this covers fewer years than (average points|the other measures)\. ?"),
]
GRADE_STATES = {"threshold", "bands", "counts", "bandsaved", "band94"}

def norm_info(t, side):
    if t is None: return None
    if side == "main":
        for r in S2_CLAUSES: t = r.sub("", t)
    else:
        t = re.sub(r"\s*" + re.escape(NOTE) + r"[^\n]*", "", t)
    return re.sub(r"\s+", " ", t).strip()

def table_rows(text):
    # A table row in innerText: a label line, then a line of tab-separated year values.
    out = {}
    lines = (text or "").split("\n")
    for i in range(len(lines) - 1):
        nxt = lines[i + 1]
        if nxt.startswith("\t") and lines[i].strip() and not lines[i].startswith("\t"):
            vals = [v for v in nxt.split("\t") if v.strip()]
            if vals and all(re.match(r"^[−+-]?[\d.,]+%?$|^—$", v.strip()) for v in vals):
                out.setdefault(lines[i].strip(), vals)
    return out
latest_checked = [0]; latest_bad = []
NONVIEW = re.compile(r"^(Full screen|Exit full screen|Collapse|Open:|Where this figure|What this shows|Add a private note|Edit note|Export)")
def canon(d):
    # name -> the pressed rail view's label, so main and br pair by VIEW, not by rail position
    m = {}
    for f in os.listdir(d):
        if not f.endswith(".json") or "__" not in f: continue
        n = f[:-5]
        try: j = json.load(open(os.path.join(d, f)))
        except Exception: continue
        if not os.path.exists(os.path.join(d, n + ".png")): continue
        pressed = [r[:-1] for r in j.get("rail", []) if r.endswith("*") and not NONVIEW.match(r)]
        base = n.rsplit("__", 1)[0]
        key = base + "__" + (pressed[0] if pressed else "only")
        if key in m: dup[d].append((key, n)); continue
        m[key] = n
    return m
dup = {A: [], B: []}
CA, CB = canon(A), canon(B)
names = sorted(CA)
missing = [k for k in names if k not in CB]
extra = sorted(k for k in CB if k not in CA)
cls = Counter(); by = defaultdict(list); notes = Counter(); rows = []
for n in names:
    if n not in CB: continue
    fa, fb = CA[n], CB[n]
    ia, ib = Image.open(os.path.join(A, fa + ".png")).convert("RGB"), Image.open(os.path.join(B, fb + ".png")).convert("RGB")
    da, db = json.load(open(os.path.join(A, fa + ".json"))), json.load(open(os.path.join(B, fb + ".json")))
    pix_same = ia.size == ib.size and ImageChops.difference(ia, ib).getbbox() is None
    parts = n.split("__")
    case = parts[0]; panel = [p for p in parts if re.match(r"^c\d\.(current|trends)$", p)][0]
    state = case.split("-")[2]
    trends = panel.endswith("trends")
    text_same = da["text"] == db["text"] and da.get("caption") == db.get("caption")
    info_same = da.get("info") == db.get("info")
    note_added = (db.get("info") or "").count(NOTE) > (da.get("info") or "").count(NOTE)
    if pix_same and text_same and info_same:
        k = "IDENTICAL"
    elif pix_same and text_same and norm_info(da.get("info"), "main") == norm_info(db.get("info"), "br"):
        k = "NOTE-ONLY"
        notes[("note added" if note_added else "") + (" S2 clause gone" if da.get("info") != db.get("info") and not note_added else "") + f" [{state} {panel.split('.')[1]}]"] += 1
    elif trends and state in GRADE_STATES and text_same and ia.size == ib.size and ImageChops.difference(ia, ib).getbbox()[3] <= 44 and norm_info(da.get("info"), "main") == norm_info(db.get("info"), "br").replace("2021/22–", "2023/24–"):
        k = "EXP-PICKER"  # same words; only the header strip differs (the year menu gains its chevron)
    elif trends and state in GRADE_STATES and re.search(r"2021/22|2022/23", (db["text"] or "") + (db.get("caption") or "")) and not re.search(r"2021/22|2022/23", (da["text"] or "") + (da.get("caption") or "")):
        k = "EXP-YEARS"
    elif trends and state in GRADE_STATES and re.search(r"2021/22|2022/23", db["text"] + (db.get("caption") or "")) and da["text"] != db["text"]:
        k = "EXP-YEARS"  # main also named one of those years (e.g. a "From" menu); still a years diff
    elif trends and state != "cand" and "since 2021/22" not in (db["text"] + (db.get("caption") or "")) and norm_info(da.get("info"), "main") is not None:
        k = "EXP-STATEMENT"
    else:
        k = "UNEXPECTED"
    if k in ("EXP-YEARS", "EXP-STATEMENT"):
        ra, rb = table_rows(da["text"]), table_rows(db["text"])
        for lab, va in ra.items():
            vb = rb.get(lab)
            if vb is None: continue
            latest_checked[0] += 1
            if va[-1] != vb[-1]:
                latest_bad.append(f"{n} row {lab!r}: main {va} br {vb}")
    cls[k] += 1
    by[k].append(n)
    rows.append({"name": n, "kind": k, "pix_same": pix_same, "state": state, "panel": panel, "note_added": note_added})
print(f"pairs {sum(cls.values())}  " + "  ".join(f"{k} {v}" for k, v in sorted(cls.items())) + f"  missing-in-br {len(missing)}  extra-in-br {len(extra)}")
print("by state x panel x kind:")
grid = Counter((r["state"], r["panel"].split(".")[1], r["kind"]) for r in rows)
for key in sorted(grid): print("  ", key, grid[key])
print("note-only detail:"); [print("  ", k, v) for k, v in sorted(notes.items())]
since2122 = [r["name"] for r in rows if r["state"] != "cand" and r["panel"].endswith("trends") and "since 2021/22" in (json.load(open(os.path.join(B, CB[r["name"]] + ".json")))["text"] + (json.load(open(os.path.join(B, CB[r["name"]] + ".json"))).get("caption") or ""))]
print("branch graded Trends still saying 'since 2021/22':", len(since2122)); [print("  SINCE2122", x) for x in since2122[:20]]
print("EXP-YEARS with grading note added:", sum(1 for r in rows if r["kind"] == "EXP-YEARS" and r["note_added"]), "of", cls["EXP-YEARS"])
print(f"latest-year check (EXP-YEARS table rows: last year's value main = br): {latest_checked[0]} rows, {len(latest_bad)} differ")
for x in latest_bad[:100]: print("LATEST-DIFF", x)
for n in by["UNEXPECTED"][:400]: print("UNEXPECTED", n)
print("views only in main (by panel/view):", Counter(m.split("__", 1)[1].split("__", 1)[-1] if False else re.sub(r"^.*?__((tab\d__)?c\d\.\w+__.*)$", r"\1", m).split("__")[-1] + " @" + m.split("-")[2] for m in missing))
print("views only in br (by view @state):", Counter(m.split("__")[-1] + " @" + m.split("-")[2] + " " + re.search(r"c\d\.\w+", m).group(0) for m in extra))
print("duplicate view shots (same pressed view twice):", len(dup[A]), len(dup[B]))
for n in missing[:60]: print("MISSING-in-br", n)
for n in extra[:60]: print("EXTRA-in-br", n)
json.dump(rows, open(os.path.join(root, "cmp2.json"), "w"))
