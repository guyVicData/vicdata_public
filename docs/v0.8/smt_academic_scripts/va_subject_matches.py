"""0.8 SMT Academic, step 0: draft the value-added subject matches (F-44).

DfE's value-added file (dfe_ks5_subject_value_added) names subjects its own way. This matches each
of its (qualification, subject) names to the results file's name in the same qualification, so the
subject area follows from subject_family_map and value added joins to the subject's results.

Inputs: JSON exports of the ingest database (read-only queries, see README in this folder):
  va.json   value-added (qualification, subject, schools)
  res.json  results-file (qualification, subject) since 2022/23
  fam.json  subject_family_map (ks5)
  lab.json  subject_label_map (ks5)
  fams.json subject_families
Outputs: docs/v0.8/va_subject_matches_draft.md and src/lib/smt/va-subject-matches.ts.

Run: python3 -I va_subject_matches.py <export dir> <repo root>
"""
import json, re, sys
from pathlib import Path

src, repo = Path(sys.argv[1]), Path(sys.argv[2])
load = lambda n: json.loads((src / f"{n}.json").read_text())
va, res, fam, lab, fams = load("va"), load("res"), load("fam"), load("lab"), load("fams")

family = {r["raw_subject"]: r["family_id"] for r in fam}
family_ci = {k.lower(): v for k, v in family.items()}
area_label = {r["family_id"]: r["display_label"] for r in fams}
label_map = {r["stored_label"]: r["latest_label"] for r in lab}
results = {}
for r in res:
    results.setdefault(r["q"], set()).add(r["s"])

# The value-added file's qualification -> the results file's.
def res_qual(q):
    return "GCE AS level" if q.startswith("GCE AS level") else q

def norm(s):
    s = re.sub(r"\s*&\s*", " and ", s)
    s = re.sub(r"\s*/\s*", " / ", s)
    s = re.sub(r"^(.*?):\s*(.+)$", lambda m: f"{m.group(1)} ({m.group(2)})" if m.group(1) != "Business Studies" else m.group(0), s)
    return re.sub(r"\s+", " ", s).strip()

# Name changes that aren't spelling: VicData's matches (checked by Guy before they go in).
MANUAL = {
    "Art & Design (3d Studies)": "3D Studies",
    "Art & Design (Critical Studies)": "Critical Studies",
    "Art & Design (Fine Art)": "Fine Art",
    "Art & Design (Graphics)": "Graphics",
    "Art & Design (Photography)": "Photography",
    "Art & Design (Textiles)": "Textiles",
    "D&T Engineering": "Design and Technology (Engineering)",
    "D&T Product Design": "Design and Technology (Product Design)",
    "D&T Textiles Technology": "Design and Technology (Textiles Technology)",
    "Computer Studies/Computing": "Computer Science",
    "Accounting/Finance": "Accounting and Finance",
    "Tourism": "Travel and Tourism",
    "Computer Appreciation / Introduction": "Computer Appreciation (Introduction)",
    "Additional Mathematics FSMQ": "Mathematics (Additional)",
}
# Rows that sit outside the subject areas.
OUTSIDE = {
    ("Extended Project (Diploma)", "Study Skills"): "the EPQ sits outside the subject areas",
    ("International Baccalaureate", "Baccalaureate"): "the IB Diploma as a whole: outside the subject areas",
    ("IBO Diploma Programme Core", "Self Development"): "IB core (CAS, Theory of Knowledge, Extended Essay): outside the subject areas",
    ("IBO Diploma Programme Core", "Learning Skills"): "IB core: outside the subject areas",
    ("IBO Diploma Programme Core", "Study Skills"): "IB core: outside the subject areas",
}

def area_of(name):
    return family.get(name) or family_ci.get(name.lower())

rows = []
for v in va:
    q, s, n = v["q"], v["s"], v["schools"]
    if s == "All subjects":
        continue  # the qualification's own row, never a subject
    rq = res_qual(q)
    names = results.get(rq, set())
    names_ci = {x.lower(): x for x in names}
    match, how, sure = None, None, True
    if (q, s) in OUTSIDE:
        rows.append(dict(q=q, s=s, n=n, results=None, area=None, how=OUTSIDE[(q, s)], sure=False, vicdata=True))
        continue
    if s in names:
        match, how = s, "same name"
    elif s in label_map and label_map[s] in names:
        match, how = label_map[s], "DfE's rename (subject_label_map)"
    elif norm(s).lower() in names_ci:
        match, how = names_ci[norm(s).lower()], "spelling (& / : and case)"
    elif s in MANUAL and MANUAL[s] in names:
        match, how, sure = MANUAL[s], "VicData match", False
    if match:
        a = area_of(match)
        rows.append(dict(q=q, s=s, n=n, results=match, area=a, how=how if a else how + "; NO AREA for the results name", sure=sure and bool(a), vicdata=how not in ("same name", "DfE's rename (subject_label_map)")))
        continue
    # No results name in this qualification: the area from the name itself, or its nearest form.
    for cand, why in ((s, "no results row in this qualification; area from its own name"), (label_map.get(s, ""), "no results row in this qualification; area from DfE's rename"), (norm(s), "no results row in this qualification; area from its spelling"), (MANUAL.get(s, ""), "no results row in this qualification; area from VicData's match")):
        if cand and area_of(cand):
            rows.append(dict(q=q, s=s, n=n, results=None, area=area_of(cand), how=why, sure=False, vicdata=True))
            break
    else:
        rows.append(dict(q=q, s=s, n=n, results=None, area=None, how="NO MATCH: needs an area from Guy", sure=False, vicdata=True))

rows.sort(key=lambda r: (r["sure"], r["q"], r["s"]))
unsure = sum(1 for r in rows if not r["sure"])
# Today (before this list): the app finds a value-added subject's area only by its exact name in subject_family_map.
today = [r for r in rows if r["q"] == "GCE A level" and r["s"] not in family]
alevel = [r for r in rows if r["q"] == "GCE A level"]
today_all = [r for r in rows if r["s"] not in family and (r["q"], r["s"]) not in OUTSIDE]

md = [
    "# Value-added subject matches: DRAFT for Guy to check (0.8 SMT Academic, step 0)",
    "",
    "Generated by `docs/v0.8/smt_academic_scripts/va_subject_matches.py` from read-only exports of vicdata-production (8 Nov 2026).",
    "**Not applied to the database.** The app reads this list from `src/lib/smt/va-subject-matches.ts` (same script), so swapping in the approved list is a data change only.",
    "",
    f"{len(rows)} value-added subject names (every qualification, both years; the \"All subjects\" rows aren't subjects). **{unsure} need a look** and are listed first; the rest are the same name, DfE's own rename, or a spelling difference (\"&\" for \"and\", \"/\" spacing, \"X: Y\" for \"X (Y)\", case).",
    "",
    f"**Today** {len(today)} of {len(alevel)} A-level value-added subjects ({sum(r['n'] for r in today):,} of {sum(r['n'] for r in alevel):,} school-subject rows) and {len(today_all)} of {len(rows)} names overall get no area, because the app looks the value-added name up in subject_family_map as it stands. With this list every one has an area, or sits outside the areas (the EPQ, the IB's whole-diploma and core rows).",
    "",
    "How decided:",
    "- **same name** / **DfE's rename**: DfE's own; not marked.",
    "- **spelling**: VicData's, but mechanical.",
    "- **VicData match**: a different name for what is evidently the same subject (e.g. \"Art & Design (Fine Art)\" is the results file's \"Fine Art\").",
    "- **no results row in this qualification**: DfE publishes value added for a subject with no results row under that qualification (usually small or suppressed); the area comes from the name.",
    "- **outside the subject areas**: the EPQ and the IB's whole-diploma and core rows.",
    "",
    "The (i) on every by-area view marks the VicData matches (column \"VicData's\").",
    "",
    "| Value-added name | Qualification | Schools | Results name | Area | How decided | VicData's |",
    "|---|---|---:|---|---|---|---|",
]
for i, r in enumerate(rows):
    if i == unsure:
        md.append("| **— the rest: DfE's own names or spelling —** | | | | | | |")
    md.append(f"| {r['s']} | {r['q']} | {r['n']} | {r['results'] or 'none'} | {area_label.get(r['area'], '—') if r['area'] else '—'} | {r['how']} | {'yes' if r['vicdata'] else ''} |")
(repo / "docs/v0.8/va_subject_matches_draft.md").write_text("\n".join(md) + "\n")

ts = [
    "// GENERATED by docs/v0.8/smt_academic_scripts/va_subject_matches.py -- do not edit by hand.",
    "// 0.8 SMT Academic, step 0 (F-44): each value-added (qualification, subject) name -> the results file's",
    "// name in the same qualification, and its subject area. DRAFT until Guy checks docs/v0.8/va_subject_matches_draft.md;",
    "// the approved list replaces this file (a data change only). `vicdata`: the match is VicData's, not DfE's.",
    "export type VaSubjectMatch = { results: string | null; area: string | null; vicdata: boolean; outside: boolean };",
    "export const VA_SUBJECT_MATCHES_STATUS: \"draft\" | \"approved\" = \"draft\";",
    "export const VA_SUBJECT_MATCHES: Readonly<Record<string, VaSubjectMatch>> = {",
]
for r in sorted(rows, key=lambda r: (r["q"], r["s"])):
    outside = (r["q"], r["s"]) in OUTSIDE
    ts.append(f"  {json.dumps(r['q'] + '::' + r['s'])}: {{ results: {json.dumps(r['results'])}, area: {json.dumps(r['area'])}, vicdata: {'true' if r['vicdata'] else 'false'}, outside: {'true' if outside else 'false'} }},")
ts.append("};")
(repo / "src/lib/smt/va-subject-matches.ts").write_text("\n".join(ts) + "\n")
print(len(rows), "rows,", unsure, "to check,", sum(1 for r in rows if r["area"] is None and (r["q"], r["s"]) not in OUTSIDE), "with no area")
