// VicData 0.8 review fixes (14 Nov, M7): which subject family each subject belongs to, for colouring a chart
// by family (R-SUBJECT-COLOUR). The family map is one national taxonomy (vicdata's subject_families /
// subject_family_map), so a subject's family is the same at every school: the dashboard registers the rows
// it has loaded (subject, familyId) and every colour helper reads them. A subject not yet registered keeps
// the old grey (Current) or palette (Trends) colour, so nothing draws wrong while rows load.
const BY_SUBJECT = new Map<string, string>();

export function registerSubjectFamilies(rows: { subject: string; familyId: string | null | undefined }[]): void {
  for (const r of rows) if (r.subject && r.familyId) BY_SUBJECT.set(r.subject, r.familyId);
}

/** A series key ("Geography::GCSE (9-1) Full Course", or the bare subject) to its family, or null. */
export function familyOfKey(key: string): string | null {
  return BY_SUBJECT.get(key.split("::")[0]) ?? null;
}

/** For tests: forget every registration. */
export function clearSubjectFamilies(): void {
  BY_SUBJECT.clear();
}
