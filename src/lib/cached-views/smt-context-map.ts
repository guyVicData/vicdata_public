// The "smt/context/map" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { SmtSchool } from "../smt/school";
import type { SmtPhase } from "../smt/levels";
import { buildContext } from "../smt/context";
import { buildContextMap } from "../smt/context-map";
import type { Catchment } from "../smt/catchment";

/** The neighbourhood map; its fallback state (no boundaries, no coordinates, nothing near) isn't kept. */
export function cachedContextMap(school: SmtSchool, level: SmtPhase, catchment: Catchment) {
  return cachedResult(
    resultKey("smt/context/map", school.urn, { level, catchment }),
    async () => {
      const c = await buildContext(school, "around", level, catchment);
      return buildContextMap(school, level, c.map.schools, catchment.km);
    },
    { shouldStore: (m) => m.state !== "fallback" },
  );
}
