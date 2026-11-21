// The "smt/overview" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { SmtAdmissionsReader } from "../smt/auth-rules";
import type { SmtSchool } from "../smt/school";
import { buildOverview, type SmtSet } from "../smt/overview";
import { setKey } from "./smt-set-key";

/** Overview: the caller matters only through whether a head office may see the school's Admissions
 * (the market panel's privateNote); with a set, the market rivals are the set's, so no lists are read. */
export function cachedOverview(school: SmtSchool, set: SmtSet, admissions: SmtAdmissionsReader) {
  return cachedResult(resultKey("smt/overview", school.urn, { set: setKey(set), privateNote: admissions.privateNote ?? null }), () => buildOverview(school, set, admissions));
}
