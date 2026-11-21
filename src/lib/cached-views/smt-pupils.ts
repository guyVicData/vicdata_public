// The "smt/pupils" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import type { SmtAdmissionsReader } from "../smt/auth-rules";
import type { SmtSchool } from "../smt/school";
import type { SmtSet } from "../smt/overview";
import { buildPupils, readPupilsAdmissions } from "../smt/pupils";
import type { SmtLevel } from "../smt/levels";
import { setKey } from "./smt-set-key";

/** Pupils: the school's saved entry points and lists are read first, with the caller's reader, and
 * keyed as read. */
export async function cachedPupils(school: SmtSchool, set: SmtSet, level: SmtLevel, admissions: SmtAdmissionsReader) {
  const pre = await readPupilsAdmissions(school, admissions);
  return cachedResult(resultKey("smt/pupils", school.urn, { set: setKey(set), level, adm: pre }), () => buildPupils(school, set, level, admissions, pre));
}
