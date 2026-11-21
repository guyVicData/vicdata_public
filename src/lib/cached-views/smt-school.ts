// The "smt/school" view (cached-views/views.json). Server-only.
import { cachedResult, resultKey } from "../results-cache";
import { smtSchool, type SmtSchool } from "../smt/school";
import { dependOn, type BuildTrace } from "../build-trace";

/** The school as SMT's chips need it (/api/smt/school): public data only (the anon client, the national
 * populations, the IGCSE list, England's schools), the same for every caller, so keyed on the URN alone.
 * "No such school" (null) isn't kept. */
/** `started`: the route's own read, begun alongside its caller check -- reused as the build, so the shared store
 * is only asked (and only ever written) once the caller has passed. */
export function cachedSmtSchool(urn: string, started?: { trace: BuildTrace; promise: Promise<SmtSchool | null> }) {
  return cachedResult(
    resultKey("smt/school", urn, {}),
    () => {
      if (!started) return smtSchool(urn);
      // Begun outside this build: link its trace in, so a read it carried past still keeps the answer out of the store.
      dependOn(started.trace);
      return started.promise;
    },
    { shouldStore: (s) => s !== null },
  );
}
