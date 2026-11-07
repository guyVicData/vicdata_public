import { NextRequest, NextResponse } from "next/server";
import { resolveCaller } from "@/lib/view-as-server";
import { entryPoint } from "@/lib/admissions/entry-points";
import { editorData, SUGGESTIONS_SHOWN } from "@/lib/sets/editor-data";
import { entryOfPhase } from "@/lib/sets/model";

// VicData 0.8 sets round 1 (C12-C16): the set editor's rows, suggestions and closeness figures.
//   GET ?urn&kind=compared_against|feeders&entry=11+ (or &phase=ks4|ks5)&urns=1,2,3
//       [&sector=state|independent][&boarding=1][&n=10]
// Public reference data about schools (GIAS, the census, published results), for any approved member
// of the focus school (or a platform admin's View as of it): every member uses sets. The set itself is
// read and saved with the member's own session (RLS), never here.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (!request.headers.get("authorization")) return NextResponse.json({ error: "Authorization is required" }, { status: 400 });
  const c = await resolveCaller(request, sp.get("urn"), { refusal: "Sets are for the school's own staff." });
  if (c instanceof NextResponse) return c;
  const kind = sp.get("kind") === "feeders" ? "feeders" : "compared_against";
  const ep = entryPoint(sp.get("entry") ?? entryOfPhase(sp.get("phase") === "ks5" ? "ks5" : sp.get("phase") === "ks4" ? "ks4" : null) ?? "");
  if (!ep) return NextResponse.json({ error: "entry (4+, 11+, 16+ or age:N) or phase (ks4, ks5) is required" }, { status: 400 });
  const urns = (sp.get("urns") ?? "").split(",").filter((u) => /^\d{5,7}$/.test(u)).slice(0, 500);
  const sector = sp.get("sector") === "state" || sp.get("sector") === "independent" ? (sp.get("sector") as "state" | "independent") : "all";
  const n = Number(sp.get("n") ?? SUGGESTIONS_SHOWN);
  try {
    return NextResponse.json(await editorData(c.urn, ep, kind, urns, { sector, boardingOnly: sp.get("boarding") === "1", n: Number.isFinite(n) ? n : SUGGESTIONS_SHOWN }));
  } catch (err) {
    console.error("[sets/editor] failed:", err);
    return NextResponse.json({ error: "Could not read the schools." }, { status: 502 });
  }
}
