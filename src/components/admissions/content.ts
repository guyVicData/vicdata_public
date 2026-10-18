// VicData 0.8 SMT feedback round 1 (F-6, R-RAIL-HIDES-EMPTY): which Admissions views have something to
// show, for the rail (src/lib/rail-content.ts). Loading or failed data has content (never hidden on a
// guess). A view that tells the lead what to do (build the lists in setup, no boarding list yet) keeps
// its icon; only "nothing to show for this school and entry point" hides one.
import { drawsLine, hasPoint } from "@/lib/rail-content";
import type { Ctx } from "./AdmissionsDashboard";

export function admissionsHasContent(dv: string, c: Ctx): boolean {
  if (dv === "DV-ADM-P-SHAPE" || dv === "DV-ADM-M-SHAPE") return c.shape.status !== "ready" || c.shape.data.profile.some((r) => r.female + r.male > 0);
  if (dv.startsWith("DV-ADM-P-")) {
    if (c.pipeline.status !== "ready" || "empty" in c.pipeline.data) return true;
    const p = c.pipeline.data;
    switch (dv) {
      case "DV-ADM-P-PIPELINE":
        return p.ladder.past.some((x) => x.pool !== null) || p.ladder.future.some((x) => x.pool !== null);
      case "DV-ADM-P-FUNNEL":
        return !p.funnel.length || p.funnel.some((s) => s.value !== null);
      case "DV-ADM-P-MAP":
        return p.feederTable.rows.some((r) => r.easting !== null && r.northing !== null);
      case "DV-ADM-P-ENTRY-LINE":
      case "DV-ADM-P-ENTRY-BARS":
        return drawsLine(p.now.series.map((x) => ({ value: x.cohort })));
      case "DV-ADM-P-ENTRY-TABLE":
        return hasPoint(p.now.series.map((x) => ({ value: x.cohort })));
      case "DV-ADM-P-POOL-INDEXED":
        return drawsLine(p.poolTrends.indexed.feeders);
      case "DV-ADM-P-AREA-POP":
        return !!p.areaPopulation && (!!p.areaPopulation.laSeries || !!p.areaPopulation.regionSeries);
      case "DV-ADM-P-HOLD-LINE":
      case "DV-ADM-P-HOLD-TABLE":
        return !!p.hold.current && p.hold.needed.some((x) => x.share !== null);
    }
    return true;
  }
  if (dv.startsWith("DV-ADM-M-")) {
    if (dv === "DV-ADM-M-STRENGTHS") return c.rivals.status !== "ready" || c.rivals.data.stage === "ks2" || c.rivals.data.areas.length > 0;
    if (c.market.status !== "ready") return true;
    const m = c.market.data;
    switch (dv) {
      case "DV-ADM-M-BARS":
        return m.entryAge.rows.some((r) => r.period === m.summary.latest);
      case "DV-ADM-M-MAP":
        return m.extras.some((e) => e.traits?.easting != null && e.traits?.northing != null);
      case "DV-ADM-M-VS-LINE":
      case "DV-ADM-M-VS-BARS":
        return drawsLine(m.summary.vsIndexed.mine);
      case "DV-ADM-M-SHARE-LINE":
        return drawsLine(m.entryAge.rows.filter((r) => r.urn === m.urn).map((r) => ({ value: r.share })));
    }
    return true;
  }
  return true;
}
