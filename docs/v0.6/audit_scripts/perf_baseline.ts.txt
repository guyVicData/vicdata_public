// Throwaway S0 perf baseline. Read-only: calls the same lib functions the Teacher
// dashboard's API routes call, for a real school, and times each route-equivalent plus
// every underlying HTTP call (vicdata RPCs and vicdata-public PostgREST).
type Call = { scope: string; host: string; path: string; ms: number; status: number };
const calls: Call[] = [];
let scope = "";
const origFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const u = new URL(url);
  const t0 = performance.now();
  const res = await origFetch(input as RequestInfo, init);
  // Body read time matters (large JSON): clone and await text so ms includes transfer.
  const clone = res.clone();
  await clone.text();
  const ms = performance.now() - t0;
  let path = u.pathname.replace("/rest/v1/", "");
  if (path.startsWith("rpc/") && init?.body && typeof init.body === "string") {
    try {
      const b = JSON.parse(init.body);
      const ids = b.p_entity_ids ? ` ids=${b.p_entity_ids.length}` : "";
      const src = b.p_source_id ? ` src=${b.p_source_id}` : "";
      const off = b.p_offset ? ` off=${b.p_offset}` : "";
      path += `${src}${ids}${off}`;
    } catch {}
  } else if (!path.startsWith("rpc/")) {
    path += "?" + Array.from(u.searchParams.keys()).join(",");
  }
  calls.push({ scope, host: u.host.split(".")[0], path, ms, status: res.status });
  return res;
}) as typeof fetch;

const R = "/Users/guy/dev/vicdata_public/src/lib/";

async function main() {
  const urn = process.argv[2];
  const phase = process.argv[3] as "ks4" | "ks5";
  const adv = await import(R + "academic-data-view.ts");
  const ref = await import(R + "vicdata-reference.ts");
  const agg = await import(R + "academic-aggregate-trends.ts");
  const cs = await import(R + "teacher-view-comparator-series.ts");
  const rk = await import(R + "teacher-view-rankings.ts");
  const chooser = await import(R + "chooser-sets.ts");
  const rn = await import(R + "region-nation-comparator.ts");
  const sb = await import(R + "supabase.ts");
  const supabase = sb.createServerAnonSupabaseClient();
  const timings: { step: string; ms: number }[] = [];
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    scope = name;
    const t0 = performance.now();
    const out = await fn();
    timings.push({ step: name, ms: performance.now() - t0 });
    return out;
  };

  // 1. GET /api/teacher/dashboard (route.ts body after the membership check)
  const dash = await step("api/teacher/dashboard", async () => {
    const { data: neighbourRows } = await supabase
      .from("school_nearest_neighbours")
      .select("rank, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status, establishment_type_group, statutory_low_age, statutory_high_age, la_name)")
      .eq("urn", urn).eq("pool", "general").order("rank", { ascending: true }).limit(100);
    const pool = cs.neighbourPool((neighbourRows ?? []) as never, phase);
    const { data: targetRow } = await supabase.from("schools").select("establishment_type_group").eq("urn", urn).maybeSingle();
    const targetIndependent = rk.isIndependent((targetRow as { establishment_type_group: string | null } | null)?.establishment_type_group ?? null);
    const cohortSizes = await adv.fetchLatestCohortSizes([urn, ...pool.map((p: { urn: string }) => p.urn)], phase);
    const buildSets = (usable: never[]) => {
      const sets: Record<string, unknown> = { nearest: usable.slice(0, rk.SET_SIZE), same_sector: rk.sameSector(usable, targetIndependent), local_rivals: rk.localRivals(usable) };
      sets.similar_size = rk.similarSize(usable, cohortSizes, cohortSizes.get(urn) ?? null);
      return sets;
    };
    const ranked = await cs.rankSets(urn, pool, buildSets as never, phase, cohortSizes);
    const { byUrn } = await adv.fetchSubjectLevelDataForSchools([urn], phase);
    const headlineByUrn = await adv.fetchSubjectHeadlineForSchools([urn], phase, undefined, phase === "ks5" ? null : undefined);
    const qualHeadline = phase === "ks5" ? (await adv.fetchSubjectQualificationHeadlineForSchools([urn], phase)).get(urn) ?? [] : [];
    let england;
    if (phase === "ks5") {
      england = await ref.lookupAcademicSubjectQualificationGeography({ ksStage: "ks5", measure: "avg_point_score", groupingType: "national", groupingKeys: [agg.NATIONAL_GROUPING_KEY], minSchoolCount: 1 });
    } else {
      england = await ref.lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: "national", groupingKeys: [agg.NATIONAL_GROUPING_KEY], minSchoolCount: 1 });
    }
    const body = { subjectData: byUrn.get(urn), headline: headlineByUrn.get(urn) ?? [], qualHeadline, england, ranked, poolSize: pool.length };
    return { body, bytes: JSON.stringify(body).length, poolSize: pool.length };
  });

  // 2. GET /api/teacher/saved-comparator-sets (no saved sets assumed -> union is the target only)
  await step("api/teacher/saved-comparator-sets", async () => {
    await cs.rankFixedSets(urn, [], phase);
    await supabase.from("school_nearest_neighbours").select("rank, distance_km, schools!school_nearest_neighbours_neighbour_urn_fkey(urn, current_name, phase, status, establishment_type_group, statutory_low_age, statutory_high_age, la_name)").eq("urn", urn).eq("pool", "general").order("rank", { ascending: true }).limit(100);
    await supabase.from("schools").select("la_name, establishment_type_group").eq("urn", urn).maybeSingle();
  });

  // 3. POST /api/teacher/chooser-set {kind: nearest} (the default column set)
  const nearest = await step("api/teacher/chooser-set(nearest)", () => chooser.resolveDefaultNearest(urn, phase));

  // 4. GET /api/data-view/academic-schools?includeSubjects=1 for the comparator union
  const union = Array.from(new Set([...nearest.rows.map((r: { urn: string }) => r.urn), urn]));
  await step(`api/data-view/academic-schools(${union.length} urns, includeSubjects)`, () => adv.fetchAcademicProfiles(union, { includeSubjects: true }));

  // 5. Panel: GET /api/teacher/subject-geography for the school's biggest subject
  const entries = (dash.body.subjectData?.entries ?? []) as { subject: string; qualificationType: string; period: number; entries: number }[];
  const latest = Math.max(...entries.map((e) => e.period));
  const top = entries.filter((e) => e.period === latest && (phase === "ks5" ? e.qualificationType === "GCE A level" : e.qualificationType === "GCSE (9-1) Full Course")).sort((a, b) => b.entries - a.entries)[0];
  const subject = top?.subject ?? "Mathematics";
  const qual = top?.qualificationType ?? (phase === "ks5" ? "GCE A level" : "GCSE (9-1) Full Course");
  const geoOf = async (grade: boolean) => {
    const { data: school } = await supabase.from("schools").select("la_name").eq("urn", urn).maybeSingle<{ la_name: string | null }>();
    const regionName = (await rn.resolveTargetRegionNation(urn))?.regionName ?? null;
    for (const [gt, key] of [["la", school?.la_name ?? null], ["region", regionName], ["national", agg.NATIONAL_GROUPING_KEY]] as const) {
      if (!key) continue;
      if (grade) await ref.lookupAcademicSubjectGradeGeography({ ksStage: phase, groupingType: gt, groupingKeys: [key], subject, qualificationType: qual });
      else if (phase === "ks5") await ref.lookupAcademicSubjectQualificationGeography({ ksStage: "ks5", measure: "avg_point_score", groupingType: gt, groupingKeys: [key], subject, qualificationType: qual, minSchoolCount: gt === "national" ? 1 : undefined });
      else await ref.lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: gt, groupingKeys: [key], subject, minSchoolCount: gt === "national" ? 1 : undefined });
    }
  };
  await step(`api/teacher/subject-geography(${subject})`, () => geoOf(false));
  // 6. Results on Grade bands / counts: GET /api/teacher/subject-grade-geography
  await step(`api/teacher/subject-grade-geography(${subject})`, () => geoOf(true));
  // 7. Results on Grade 4+/A*-E: GET /api/teacher/comparator-grades for the set's schools
  await step(`api/teacher/comparator-grades(${union.length} urns)`, () => adv.fetchSubjectLevelDataForSchools(union, phase));

  const out = { urn, phase, poolSize: dash.poolSize, dashboardPayloadBytes: dash.bytes, unionSize: union.length, timings, calls };
  console.log(JSON.stringify(out));
}
main().catch((e) => { console.error(e); process.exit(1); });
