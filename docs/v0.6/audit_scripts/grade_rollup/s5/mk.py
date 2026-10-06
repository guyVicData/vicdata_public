# python3 mk.py <nworkers>: the S5 parity matrix, split into cx-<k>.json.
import json, sys, urllib.parse
FX = [("137625", "ks4", "^History$", '{"top":"9","bottom":"5"}'), ("100053", "ks4", None, '{"top":"9","bottom":"5"}'),
      ("117037", "ks5", "^Mathematics$", '{"top":"A*","bottom":"B"}'), ("130432", "ks5", None, '{"top":"Distinction*","bottom":"Merit"}')]
cases = []
for urn, ph, focus, band in FX:
    states = [("cand", "measure=candidates")] + [(p, f"pill={p}") for p in ["points", "threshold", "bands", "counts"]] + [("bandsaved", "pill=bands&band=" + urllib.parse.quote(band))]
    for sid, sq in states:
        for against in ["category", "whole", "selected"]:
            for th in ["dark", "light"]:
                for w in [1280, 390]:
                    c = {"id": f"{urn}-{ph}-{sid}-{against}-{th}-{w}", "q": f"urn={urn}&phase={ph}&{sq}&against={against}", "theme": th, "w": w}
                    if focus: c["focus"] = focus
                    if against != "category": c["only"] = [".c2."]
                    cases.append(c)
n = int(sys.argv[1])
# interleave so each worker gets a mix
for k in range(n):
    json.dump(cases[k::n], open(f"cx-{k}.json", "w"))
print(len(cases), "cases")
