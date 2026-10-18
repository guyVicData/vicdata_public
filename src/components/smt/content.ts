// VicData 0.8 SMT feedback round 1 (F-6, R-RAIL-HIDES-EMPTY): which SMT views have something to show,
// for the rail (src/lib/rail-content.ts). A view whose data hasn't loaded has content (never hidden on
// a guess); a view that explains something (rivals not chosen in Admissions, a level it isn't for, the
// IGCSE note, the reserved bands) keeps its icon. Only "nothing to show for this school" hides one.
import { SMT_NOTES } from "@/catalogue/notes";
import { drawsLine, hasPoint } from "@/lib/rail-content";
import type { Ctx } from "./SmtDashboard";

export function smtHasContent(dv: string, c: Ctx): boolean {
  if (dv.startsWith("DV-SMT-O-")) {
    if (c.overview.status !== "ready") return true;
    const o = c.overview.data;
    switch (dv) {
      case "DV-SMT-O-MAP":
        return Object.values(o.schools).some((s) => s.easting !== null && s.northing !== null);
      case "DV-SMT-O-FLAGS":
        // "Not available yet" (thresholds not loaded) is said; "No flags" is nothing to show.
        return o.flags.length > 0 || !o.flagsLoaded;
      case "DV-SMT-O-ROLL-LINE":
        return drawsLine(o.trends.roll.lines[0]?.pts);
      case "DV-SMT-O-ROLL-TABLE":
        return o.trends.roll.lines.length > 0;
      case "DV-SMT-O-RESULTS-LINE":
        return o.trends.results.some((t) => drawsLine(t.school)) || (c.school.phases.igcse === true && !o.trends.results.length);
      case "DV-SMT-O-RESULTS-TABLE":
        return o.trends.results.some((t) => t.school.length > 0) || (c.school.phases.igcse === true && !o.trends.results.length);
      case "DV-SMT-O-MARKET-LINE":
      case "DV-SMT-O-MARKET-TABLE":
        // No 11+ entry is nothing to show; rivals not chosen yet points to Admissions, and stays.
        return o.trends.market.status === "ready" || o.trends.market.reason !== SMT_NOTES.marketNoEntry;
    }
    return true;
  }
  if (dv.startsWith("DV-SMT-P-")) {
    if (c.pupils.status !== "ready") return true;
    const p = c.pupils.data;
    switch (dv) {
      case "DV-SMT-P-SHAPE":
        return p.shape.yearGroups.length > 0;
      case "DV-SMT-P-LEAVING":
        return p.leaving.length > 0;
      case "DV-SMT-P-MARKET":
        return p.market.status === "ready" || p.market.reason !== SMT_NOTES.marketNoEntry;
      case "DV-SMT-P-PHASES":
        return drawsLine(p.trends.phases[0]?.pts);
    }
    return true;
  }
  if (dv.startsWith("DV-SMT-C-")) {
    if (c.context.status !== "ready") return true;
    const x = c.context.data;
    switch (dv) {
      case "DV-SMT-C-MAP":
        // Around the school the neighbourhoods draw (their own read); the LA fallback needs its schools.
        return x.area === "around" || x.map.schools.length > 0;
      case "DV-SMT-C-BYAGE":
        return x.byAge.ages.length > 0;
      case "DV-SMT-C-NEARBY":
        return drawsLine(x.nearby.indexed.school);
      case "DV-SMT-C-BIRTHS-INDEXED":
        return drawsLine(x.births.indexed.la);
    }
    return true;
  }
  // Academic: a level the view isn't for says why (academicWhyNot), and keeps its icon.
  if (c.academic.status !== "ready") return true;
  const a = c.academic.data;
  if (c.level.phase === "primary") return true;
  switch (dv) {
    case "DV-SMT-A-AREAS":
      return !a.parts.length || a.parts.some((p) => p.areas.length > 0);
    case "DV-SMT-A-SUBJECTS":
      return c.level.phase === "whole" || !!a.parts[0]?.subjects.length;
    case "DV-SMT-A-GRADES":
      return a.parts.some((p) => p.grades.entries > 0);
    case "DV-SMT-A-TREND-LINE":
      return (c.level.phase === "gcse" && !!c.school.phases.igcse && !c.level.area) || a.parts.some((p) => drawsLine(p.trend.school));
    case "DV-SMT-A-TREND-TABLE":
      return (c.level.phase === "gcse" && !!c.school.phases.igcse && !c.level.area) || a.parts.some((p) => hasPoint(p.trend.school));
    case "DV-SMT-A-MIX":
    case "DV-SMT-A-MIX-TABLE":
      return a.parts.some((p) => p.mix.years.length > 0) || (a.igcse && c.level.phase === "gcse");
  }
  return true;
}
