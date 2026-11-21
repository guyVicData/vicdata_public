// The "smt/academic" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { SmtSchool } from "../smt/school";
import type { SmtSet } from "../smt/overview";
import { buildAcademic } from "../smt/academic";
import type { AcademicState } from "../smt/qual-groups";
import { setKey } from "./smt-set-key";

export function cachedAcademic(school: SmtSchool, state: AcademicState, set: SmtSet) {
  return cachedResult(resultKey("smt/academic", school.urn, { state, set: setKey(set) }), () => buildAcademic(school, state, set));
}
