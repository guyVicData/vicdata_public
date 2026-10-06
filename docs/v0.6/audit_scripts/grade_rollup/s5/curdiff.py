# python3 curdiff.py <outRoot>: every Current-panel pair (latest-year views) whose words differ, grouped by diff; pixel-only Current diffs.
import json, os, re, sys, difflib
from collections import Counter, defaultdict
from PIL import Image, ImageChops
root = sys.argv[1]; A, B = f"{root}/main", f"{root}/br"
NONVIEW = re.compile(r"^(Full screen|Exit full screen|Collapse|Open:|Where this figure|What this shows|Add a private note|Edit note|Export)")
def canon(d):
    m = {}
    for f in os.listdir(d):
        if not f.endswith(".json") or "__" not in f: continue
        n = f[:-5]
        if not os.path.exists(os.path.join(d, n + ".png")): continue
        j = json.load(open(os.path.join(d, f)))
        p = [r[:-1] for r in j.get("rail", []) if r.endswith("*") and not NONVIEW.match(r)]
        m.setdefault(n.rsplit("__", 1)[0] + "__" + (p[0] if p else "only"), n)
    return m
CA, CB = canon(A), canon(B)
txt = Counter(); ex = {}; pix = Counter(); pixex = {}; n_cur = 0; by_fx = Counter()
for k in sorted(CA):
    if k not in CB or ".current" not in k: continue
    n_cur += 1
    a = json.load(open(f"{A}/{CA[k]}.json")); b = json.load(open(f"{B}/{CB[k]}.json"))
    if a["text"] != b["text"] or a.get("caption") != b.get("caption"):
        d = [l for l in difflib.unified_diff(a["text"].split("\n"), b["text"].split("\n"), lineterm="", n=0) if l[:1] in "+-" and l[:3] not in ("+++", "---")]
        if a.get("caption") != b.get("caption"): d.append(f"CAPTION {a.get('caption')!r} -> {b.get('caption')!r}")
        key = " | ".join(d)[:240]; txt[key] += 1; ex.setdefault(key, k); by_fx[k.split("-")[0] + " " + k.split("-")[2]] += 1
    else:
        ia = Image.open(f"{A}/{CA[k]}.png").convert("RGB"); ib = Image.open(f"{B}/{CB[k]}.png").convert("RGB")
        if ia.size != ib.size: key = f"size {ia.size}->{ib.size}"
        else:
            bb = ImageChops.difference(ia, ib).getbbox()
            if not bb: continue
            key = f"same size, bbox {bb}"
        kk = re.sub(r"\d{6}-ks\d-|-(dark|light)|-\d+__", "", k)[:0] + key; pix[kk] += 1; pixex.setdefault(kk, k)
print(f"Current pairs {n_cur}; word diffs {sum(txt.values())}; pixel-only diffs {sum(pix.values())}")
print("word diffs by school/state:", dict(by_fx))
for t, c in txt.most_common(): print(f"{c:4d}  {t}\n      e.g. {ex[t]}")
for t, c in pix.most_common(): print(f"{c:4d}  PIXEL {t}  e.g. {pixex[t]}")
