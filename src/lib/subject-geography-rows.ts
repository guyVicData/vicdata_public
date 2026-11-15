// VicData 0.8 feedback A1 (R-SUBJECT-MATCH): a subject's LA, region and England rows, as the dashboard's
// subject-geography route and the Teacher walks read them. Server only.
//
// For a subject in no group, the one filtered read both used before (same cache key). For a grouped title
// ("Art and Design" with "Fine Art", "Photography"…: subject-match.ts), one read of the area's every subject
// in the qualification, kept to the group's titles and merged per year (entries summed, points weighted by
// entries). The minimum school count still applies per title in the database, so an area where each title
// has too few schools publishes nothing for the group either.
import { cachedReference } from "./server-cache";
import { lookupAcademicSubjectGeography, lookupAcademicSubjectQualificationGeography } from "./vicdata-reference";
import { isGrouped, mergeByPeriod, readQualifications, sameSubject } from "./subject-match";

export type AreaRow = { period: number; entries: number | null; avgPointScore: number | null; schoolCount: number };

export async function subjectAreaRows(phase: "ks4" | "ks5", groupingType: "la" | "region" | "national", key: string, subject: string, qualificationType: string | null): Promise<AreaRow[]> {
  const minSchoolCount = groupingType === "national" ? 1 : undefined;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  if (!isGrouped(phase, subject, qualificationType)) {
    const query = { measure: "avg_point_score", groupingType, groupingKeys: [key], subject, minSchoolCount };
    const rows = await cachedReference(`geo:${phase}:${groupingType}:${key}:${subject}:${phase === "ks5" ? qualificationType : ""}`, () =>
      phase === "ks5" ? lookupAcademicSubjectQualificationGeography({ ksStage: "ks5", ...query, qualificationType: qualificationType! }) : lookupAcademicSubjectGeography({ ksStage: "ks4", ...query }),
    );
    return rows.map((r) => ({ period: r.period, entries: num(r.entries_total), avgPointScore: num(r.avg_value), schoolCount: Number(r.school_count ?? 0) })).sort((a, b) => a.period - b.period);
  }
  // 0.8 feedback B: GCSE families read the area's every subject; Post-16 ones every subject in the
  // qualification, and the IB components too in a family that spans the IB (as build A, no older label: the
  // area rollups are stored under the latest one).
  const rows =
    phase === "ks4"
      ? await cachedReference(`geo:ks4:${groupingType}:${key}:*:`, () => lookupAcademicSubjectGeography({ ksStage: "ks4", measure: "avg_point_score", groupingType, groupingKeys: [key], minSchoolCount }))
      : (
          await Promise.all(
            readQualifications(phase, subject, qualificationType!, { aliases: false }).map((q) =>
              cachedReference(`geo:${phase}:${groupingType}:${key}:*:${q}`, () =>
                lookupAcademicSubjectQualificationGeography({ ksStage: "ks5", measure: "avg_point_score", groupingType, groupingKeys: [key], minSchoolCount, qualificationType: q }),
              ),
            ),
          )
        ).flat();
  const mine = (rows as { subject: string; qualification_type?: string | null; period: number; entries_total: unknown; avg_value: unknown; school_count?: unknown }[]).filter((r) =>
    sameSubject(phase, { subject, qualificationType }, { subject: r.subject, qualificationType: phase === "ks5" ? (r.qualification_type ?? qualificationType) : null }),
  );
  return mergeByPeriod(mine, (r) => ({ entries: num(r.entries_total), points: num(r.avg_value) }), (period, m, parts) => ({
    period,
    entries: m.entries,
    avgPointScore: m.points,
    // A school offering two titles is counted under each: the largest title's count is the floor.
    schoolCount: Math.max(...parts.map((p) => Number(p.school_count ?? 0))),
  }));
}
