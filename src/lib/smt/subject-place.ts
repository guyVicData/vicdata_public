// SMT's Subjects rows: a subject's place in the set and in England, from Teacher's subjectRanking,
// with its shared place carried through ("=851st", as Teacher prints it: subject-ranking-view.ts).
// Client-safe: a type import only.
import type { SubjectRanking } from "../subject-ranking";

export type SubjectPlace = { rank: number; of: number; tied: boolean };

export function subjectPlace(r: Pick<SubjectRanking, "targetRank" | "ranked" | "targetTied">): SubjectPlace | null {
  return r.targetRank === null ? null : { rank: r.targetRank, of: r.ranked, tied: r.targetTied === true };
}
