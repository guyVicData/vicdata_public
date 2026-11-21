// The "smt/context" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { SmtSchool } from "../smt/school";
import type { SmtPhase } from "../smt/levels";
import { buildContext, type ContextArea } from "../smt/context";
import type { Catchment } from "../smt/catchment";

/** Context: public data; the resolved catchment carries the school's saved catchment as the caller read it. */
export function cachedContext(school: SmtSchool, area: ContextArea, level: SmtPhase, catchment: Catchment) {
  return cachedResult(resultKey("smt/context", school.urn, { area, level, catchment }), () => buildContext(school, area, level, catchment));
}
