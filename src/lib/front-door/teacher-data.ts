// VicData 0.8 front door: loads the rows the Teacher home and walks are built from, for one school and
// phase, with the same lib calls the dashboard route and the subject-geography route make (so the walk's
// figures are the dashboard's). Server only. The shaping is teacher-model.ts (pure).
import type { SupabaseClient } from "@supabase/supabase-js";
import { NATIONAL_GROUPING_KEY } from "@/lib/academic-aggregate-trends";
import { fetchSubjectHeadlineForSchools, fetchSubjectLevelDataForSchools, fetchSubjectQualificationHeadlineForSchools } from "@/lib/academic-data-view";
import { resolveDefaultNearest } from "@/lib/chooser-sets";
import { resolveTargetRegionNation } from "@/lib/region-nation-comparator";
import { cachedReference } from "@/lib/server-cache";
import { lookupAcademicSubjectGeography, lookupAcademicSubjectGradeGeography, lookupAcademicSubjectQualificationGeography } from "@/lib/vicdata-reference";
import type { EnglandAverages } from "@/lib/teacher-view-measures";
import { buildTeacherModel, type AreaRows, type TeacherModel, type TeacherModelInput, type TeacherPhaseId } from "./teacher-model";

/** England's subject averages, as the dashboard route reads them (GCSE by subject, Post-16 by exact qualification). */
export async function englandSubjectAverages(phase: TeacherPhaseId): Promise<EnglandAverages> {
  if (phase === "ks5") {
    const exact = await lookupAcademicSubjectQualificationGeography({ ksStage: "ks5", measure: "avg_point_score", groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY], minSchoolCount: 1 });
    return { basis: "qualification", values: exact.filter((r) => r.avg_value !== null).map((r) => ({ key: `${r.subject}::${r.qualification_type}`, period: r.period, value: Number(r.avg_value) })) };
  }
  const rows = await lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY], minSchoolCount: 1 });
  return { basis: "subject", values: rows.filter((r) => r.avg_value !== null).map((r) => ({ key: r.subject, period: r.period, value: Number(r.avg_value) })) };
}

/** The focus subject in the school's LA, region and England: the subject-geography route's reads. */
async function areaRows(supabase: SupabaseClient, urn: string, phase: TeacherPhaseId, subject: string, qualificationType: string) {
  const [laName, regionName] = await Promise.all([
    cachedReference(`school:la:${urn}`, async () => {
      const { data, error } = await supabase.from("schools").select("la_name").eq("urn", urn).maybeSingle<{ la_name: string | null }>();
      if (error) throw error;
      return data?.la_name ?? null;
    }).catch(() => null),
    cachedReference(`school:region:${urn}`, async () => (await resolveTargetRegionNation(urn))?.regionName ?? null).catch(() => null),
  ]);
  const fetchRows = async (groupingType: "la" | "region" | "national", key: string | null): Promise<AreaRows | null> => {
    if (!key) return null;
    const minSchoolCount = groupingType === "national" ? 1 : undefined;
    const query = { measure: "avg_point_score", groupingType, groupingKeys: [key], subject, minSchoolCount };
    const rows = await cachedReference(`geo:${phase}:${groupingType}:${key}:${subject}:${phase === "ks5" ? qualificationType : ""}`, () =>
      phase === "ks5" ? lookupAcademicSubjectQualificationGeography({ ksStage: "ks5", ...query, qualificationType }) : lookupAcademicSubjectGeography({ ksStage: "ks4", ...query }),
    ).catch(() => []);
    const out = rows.map((r) => ({ period: r.period, entries: r.entries_total === null ? null : Number(r.entries_total), avgPointScore: r.avg_value === null ? null : Number(r.avg_value) })).sort((a, b) => a.period - b.period);
    return out.length ? { name: groupingType === "national" ? "England" : key, rows: out } : null;
  };
  const [la, region, england] = await Promise.all([fetchRows("la", laName), fetchRows("region", regionName), fetchRows("national", NATIONAL_GROUPING_KEY)]);
  return { la, region, england };
}

/** The school's own rows (cheap): enough for the subject list and the home's first two tiles. */
export async function loadTeacherInput(supabase: SupabaseClient, urn: string, phase: TeacherPhaseId, opts: { focusKey: string | null; ticked: string[]; full: boolean; lite?: boolean }): Promise<TeacherModelInput> {
  const [{ byUrn }, headlineByUrn, qhByUrn, england, nameRow] = await Promise.all([
    fetchSubjectLevelDataForSchools([urn], phase, { gradeYears: "four" }),
    fetchSubjectHeadlineForSchools([urn], phase, undefined, phase === "ks5" ? null : undefined),
    phase === "ks5" ? fetchSubjectQualificationHeadlineForSchools([urn], phase) : Promise.resolve(new Map()),
    cachedReference(`dashboard:england:${phase}`, () => englandSubjectAverages(phase)).catch(() => null),
    supabase.from("schools").select("current_name").eq("urn", urn).maybeSingle<{ current_name: string | null }>(),
  ]);
  const own = byUrn.get(urn) ?? { entries: [], valueAdded: [], gradeDistribution: [] };
  const input: TeacherModelInput = {
    phase,
    school: { urn, name: nameRow.data?.current_name ?? urn },
    entries: own.entries,
    gradeRows: own.gradeDistribution,
    headline: headlineByUrn.get(urn) ?? [],
    qualificationHeadline: (qhByUrn.get(urn) ?? []) as TeacherModelInput["qualificationHeadline"],
    england,
    area: { la: null, region: null, england: null },
    nearest: [],
    nearestNote: null,
  };
  // Setup needs the subject list only.
  if (opts.lite) return input;
  // The nearest schools and the area: the third tile and the walks' wider screens.
  const focus = buildTeacherModel(input, opts.focusKey, opts.ticked).focus;
  const [near, area] = await Promise.all([
    resolveDefaultNearest(urn, phase).catch(() => null),
    opts.full && focus ? areaRows(supabase, urn, phase, focus.subject, focus.qualificationType) : Promise.resolve(input.area),
  ]);
  if (near) {
    // At GCSE a subject's 10 nearest include IGCSE schools (R-IGCSE-SUBJECT): the subject's own rows.
    const rows = (near.subjectRows ?? near.rows).filter((r) => !r.isTarget);
    const urns = rows.map((r) => r.urn);
    const [nh, nqh] = await Promise.all([
      fetchSubjectHeadlineForSchools(urns, phase, undefined, phase === "ks5" ? null : undefined),
      phase === "ks5" ? fetchSubjectQualificationHeadlineForSchools(urns, phase) : Promise.resolve(new Map()),
    ]);
    input.nearest = rows.map((r) => ({ urn: r.urn, name: r.name, distanceKm: r.distanceKm, headline: nh.get(r.urn) ?? [], qualificationHeadline: (nqh.get(r.urn) ?? []) as TeacherModelInput["qualificationHeadline"] }));
    input.nearestNote = near.subjectNote ?? near.note ?? null;
  }
  input.area = area;
  if (opts.full) {
    // The nearby walk's map: every school's grid position (public school rows).
    const urns = [urn, ...input.nearest.map((n) => n.urn)];
    const { data: rows } = await supabase.from("schools").select("urn, easting, northing").in("urn", urns);
    input.coords = Object.fromEntries(((rows ?? []) as { urn: string; easting: number | null; northing: number | null }[]).map((r) => [r.urn, { easting: r.easting, northing: r.northing }]));
    // The grades screen's England ticks: England's share at each grade, the same subject and qualification
    // and the same year as the school's grades (the grade-geography rows the dashboard's Grades view reads).
    const model = buildTeacherModel(input, opts.focusKey, opts.ticked);
    if (model.focus && model.grades) {
      const p = model.grades.period;
      const geo = await cachedReference(`geo:grades:${phase}:${model.focus.subject}:${model.focus.qualificationType}:${p}`, () =>
        lookupAcademicSubjectGradeGeography({ ksStage: phase, groupingType: "national", groupingKeys: [NATIONAL_GROUPING_KEY], subject: model.focus!.subject, qualificationType: model.focus!.qualificationType, periodMin: p, periodMax: p }),
      ).catch(() => []);
      const total = geo.reduce((t, r) => t + Number(r.entries_total), 0);
      if (total > 0) input.englandGradeShare = Object.fromEntries(geo.map((r) => [r.grade, Number(r.entries_total) / total]));
    }
  }
  return input;
}

export async function loadTeacherModel(supabase: SupabaseClient, urn: string, phase: TeacherPhaseId, opts: { focusKey: string | null; ticked: string[]; full: boolean; lite?: boolean }): Promise<TeacherModel> {
  return buildTeacherModel(await loadTeacherInput(supabase, urn, phase, opts), opts.focusKey, opts.ticked);
}
