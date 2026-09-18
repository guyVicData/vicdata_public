// DfE performance points at qualification-bucket grain -- the browser-side twin of
// vicdata's own ingest/dfe_points.py. The two MUST agree: the same bucket rule and the
// same challenge tables are used server-side to compute each school's headline bucket
// figure and client-side to filter and score subject-grain rows. Change one, change
// both.
//
// Source: DfE, "Performance points: a practical guide" (August 2026), read directly
// for this round. Two things it says govern everything here, quoted verbatim:
//
//     "The calculation of points is defined as 'size' times 'challenge'"
//     "It cannot and should not be compared to systems designed to measure an
//      individual's achievement -- for example, the UCAS tariff."
//
// So nothing here touches UCAS Tariff. DfE publishes per-qualification challenge
// tables for A level, IB, BTEC and OCR Cambridge Technical individually even though it
// only pre-aggregates them into coarser blended cohorts, so computing at bucket grain
// stays entirely inside DfE's own methodology, just at a finer grain than DfE happens
// to publish.
//
// THE DENOMINATOR: DfE's average is points over SIZE-WEIGHTED entries, not raw entry
// count. Verified against DfE's own published aps_per_entry at three real schools;
// Capital City College is the case that discriminates, because its real AS entries at
// size 0.5 make the two denominators diverge and only the size-weighted one tracks
// DfE (27.51 computed vs 27.95 published, against 26.34 for raw entries). See
// dfe_points.py's docstring for the full table and the IB cross-check.

export const KS5_BUCKETS = ["alevel", "ib", "btec_ocr", "other"] as const;
export type Ks5Bucket = (typeof KS5_BUCKETS)[number];

export const KS5_BUCKET_LABEL: Record<Ks5Bucket, string> = {
  alevel: "A-level",
  ib: "IB",
  btec_ocr: "BTec & OCR",
  other: "Other",
};

export const KS5_BUCKET_DESCRIPTION: Record<Ks5Bucket, string> = {
  alevel: "A level, AS level and Advanced Extension Award. Uses DfE's own published A-level points figure, unchanged.",
  ib: "International Baccalaureate: Higher and Standard level components and the Diploma Programme Core.",
  btec_ocr: "BTEC and OCR Cambridge Technical qualifications, combined into one comparable bucket.",
  other: "EPQ, Core Maths, Pre-U, VRQ and other general qualifications. Shown by subject only: see the note below for why there is no single points figure.",
};

// Why "Other" carries no headline number, stated in the UI rather than left implicit.
export const KS5_OTHER_NO_FIGURE_NOTE =
  "No single points figure is shown for Other because these qualifications are not comparable with each other. VRQ Level 3 alone covers nine different qualification sizes under one DfE label, so an average across this group would imply a comparability that does not exist.";

// A-level deliberately keeps DfE's OWN published measure, byte-identical to what the
// page used before this filter changed -- the most scrutinised figure here, and DfE's
// real number already matches this bucket exactly, so it is never recomputed.
// IB and BTec & OCR use the computed bucket measures, which DfE has never published.
//
// "Other" returns a key the backend DELIBERATELY never writes. That is not a trick to
// fake an absence: the absence is the real, intended answer (see
// KS5_OTHER_NO_FIGURE_NOTE), and routing it through a real-but-never-populated key
// means every existing honest-absence path in the views handles it correctly without
// a separate nullable code path threaded through all of them. Use
// ks5BucketHasPointsFigure() when the UI needs to EXPLAIN the absence rather than just
// render it.
export function ks5BucketMeasureKey(bucket: Ks5Bucket): string {
  if (bucket === "alevel") return "A level::aps_per_entry";
  return `bucket:${bucket}::aps_per_entry`;
}

// Whether this bucket has a headline points figure at all. False only for "other".
export function ks5BucketHasPointsFigure(bucket: Ks5Bucket): boolean {
  return bucket !== "other";
}

// Headline measure wording per bucket, the bucket-grain sibling of ks5HeadlineLabel.
export function ks5BucketHeadlineLabel(bucket: Ks5Bucket): string {
  if (bucket === "other") return "entries by subject (no comparable points figure)";
  return `average points per ${KS5_BUCKET_LABEL[bucket]} entry`;
}

// Real ENTRIES behind the bucket, on one consistent basis for all four.
//
// Deliberately NOT DfE's "A level::aps_per_entry_student_count" for the A-level
// bucket, even though that is what the old five-pill UI used. That measure is a
// STUDENT count, not an entry count: at school 100369 it reads 71 against 225 real
// A-level entries, because 71 students each sat about three A-levels. Left as-is it
// would put a student count and an entry count side by side under one "entries"
// label, so A-level would look a third the size of that school's IB provision when
// it is in fact larger -- wrong in the pills, and wrong again wherever entries drive
// a magnitude, such as the map's circle sizing.
//
// The points figure above still uses DfE's own published A-level number, untouched.
// Only this count changes basis, and it changes to the one the label already claims.
export function ks5BucketEntriesKey(bucket: Ks5Bucket): string {
  return `bucket:${bucket}::entries`;
}

// T Level is deliberately absent and falls to "other": DfE has published no challenge
// table for it at all ("T Level Points for 16-19 performance tables will be shared in
// due course", confirmed absent from the same guide), which is exactly why its own
// separate brief uses UCAS Tariff instead. Adding a fifth bucket later needs only a
// branch here and a label above -- the filter does not have to be restructured.
export function bucketFor(qualificationType: string): Ks5Bucket {
  const q = qualificationType || "";
  if (q === "GCE A level" || q.startsWith("GCE AS level") || q === "Advanced Extension Award") return "alevel";
  if (q.startsWith("IBO ") || q.startsWith("International Baccalaureate")) return "ib";
  if (q.startsWith("BTEC ") || q.startsWith("OCR Cambridge Technical")) return "btec_ocr";
  return "other";
}

// Table 2a. `*` is the SAME GRADE as `A*`, just DfE's label for it in the 2021-2023
// sources: confirmed in the real data, where the two labels never co-occur in one
// period. Omitting it silently drops every top A-level grade in the historic years.
const ALEVEL: Record<string, number> = { "A*": 60, "*": 60, A: 50, B: 40, C: 30, D: 20, E: 10, Fail: 0 };
// Table 2b. Stated per AS entry (size 0.5), divided by size below to express it per
// unit of size like every other table here.
const AS_LEVEL: Record<string, number> = { A: 25, B: 20, C: 15, D: 10, E: 5, Fail: 0 };
// Table 2f. SL is NOT half of HL (SL grade 7 = 25, HL grade 7 = 60), so both are used
// verbatim rather than one scaled from the other.
const IB_HIGHER: Record<string, number> = { "7": 60, "6": 48, "5": 36, "4": 24, "3": 12, "2": 0, "1": 0, Fail: 0 };
const IB_STANDARD: Record<string, number> = { "7": 25, "6": 20, "5": 15, "4": 10, "3": 5, "2": 0, "1": 0, Fail: 0 };
// Table 2g. The ingested data does not name which core component a row is, only its
// size, and the two real sizes happen to identify them.
const IB_CORE_BY_SIZE: Record<string, Record<string, number>> = {
  "0.3": { A: 12, B: 9, C: 6, D: 3, E: 0, Fail: 0 },
  "0.2": { A: 10, B: 8, C: 6, D: 4, E: 2, Fail: 0 },
};
// Tables 3f/3g (four-grade), 3j (seven-grade), 3k (ten-grade), as challenge per UNIT
// of size. Verified linear against the guide's own per-size columns: four-grade size 2
// D* = 100 = 2 x 50; ten-grade size 2.75 D*D*D* = 137.5 = 2.75 x 50.
const VOC_FOUR: Record<string, number> = { "Distinction*": 50, Distinction: 35, Merit: 25, Pass: 15, Fail: 0 };
const VOC_SEVEN: Record<string, number> = {
  "Distinction*-Distinction*": 50, "Distinction*-Distinction": 42.5, "Distinction-Distinction": 35,
  "Distinction-Merit": 30, "Merit-Merit": 25, "Merit-Pass": 20, "Pass-Pass": 15, Fail: 0,
};
const VOC_TEN: Record<string, number> = {
  "Distinction*-Distinction*-Distinction*": 50, "Distinction*-Distinction*-Distinction": 45,
  "Distinction*-Distinction-Distinction": 40, "Distinction-Distinction-Distinction": 35,
  "Distinction-Distinction-Merit": 95 / 3, "Distinction-Merit-Merit": 85 / 3,
  "Merit-Merit-Merit": 25, "Merit-Merit-Pass": 65 / 3, "Merit-Pass-Pass": 55 / 3,
  "Pass-Pass-Pass": 15, Fail: 0,
};

// Real rows that carry no result to score: DfE small-number suppression, absence, and
// the IB Combined Certificate's award flag. Never silently treated as a fail.
const NON_GRADE_LABELS = new Set(["No result", "No result / X", "Suppressed", "Awarded", "Not Awarded"]);

// Challenge (points per unit of size) for ONE real entry row, or null where DfE
// publishes no points for it. Multiply by size for points; accumulate size for the
// size-weighted denominator. Returns null rather than 0 for anything unscorable so
// callers keep scored and unscored entries apart instead of averaging absences in.
export function challengeFor(qualificationType: string, size: number | null, grade: string): number | null {
  if (NON_GRADE_LABELS.has(grade)) return null;
  const bucket = bucketFor(qualificationType);

  if (bucket === "alevel") {
    if (qualificationType.startsWith("GCE AS level")) {
      const p = AS_LEVEL[grade];
      return p === undefined ? null : p / (size || 0.5);
    }
    // Advanced Extension Award is graded Distinction/Merit and has no A-level table;
    // left unscored rather than mapped onto A-level grades by resemblance.
    const p = ALEVEL[grade];
    return p === undefined ? null : p / (size || 1);
  }

  if (bucket === "ib") {
    if (qualificationType.includes("Higher level")) {
      const p = IB_HIGHER[grade];
      return p === undefined ? null : p / (size || 1);
    }
    if (qualificationType.includes("Standard level")) {
      const p = IB_STANDARD[grade];
      return p === undefined ? null : p / (size || 0.5);
    }
    if (qualificationType.includes("Diploma Programme Core")) {
      if (!size) return null;
      const p = (IB_CORE_BY_SIZE[sizeKey(size)] ?? {})[grade];
      return p === undefined ? null : p / size;
    }
    // The whole Diploma ("International Baccalaureate", size 5, grades 24-45) and the
    // Combined Certificate (size 0) are AGGREGATES of the same students' own HL/SL/Core
    // results. Scoring them alongside the components counts the same work twice and
    // mixes two units: one subject entry against a whole two-year Diploma. Confirmed
    // empirically -- including the whole Diploma pushed school 100369's IB average to
    // 60.2, ABOVE the HL maximum of 60.
    return null;
  }

  if (bucket === "btec_ocr") {
    if (!size || size <= 0) return null;
    for (const table of [VOC_TEN, VOC_SEVEN, VOC_FOUR]) {
      if (grade in table) return table[grade];
    }
    return null;
  }

  // "other": no figure, deliberately. See KS5_OTHER_NO_FIGURE_NOTE.
  return null;
}

// Match IB_CORE_BY_SIZE's keys without float-equality trouble ("0.3" vs 0.30000004).
function sizeKey(size: number): string {
  return String(Math.round(size * 100) / 100);
}

// Size-weighted average across real subject-grain grade rows, DfE's own formula.
// Returns null when nothing in the set is scorable, never 0 -- an honest absence.
export function averagePointsFor(
  rows: { qualificationType: string; sizeWeight: number | null; grade: string; entries: number }[],
): { average: number; scoredEntries: number } | null {
  let points = 0;
  let sizeUnits = 0;
  let scored = 0;
  for (const r of rows) {
    const challenge = challengeFor(r.qualificationType, r.sizeWeight, r.grade);
    if (challenge === null || !r.sizeWeight) continue;
    points += challenge * r.sizeWeight * r.entries;
    sizeUnits += r.sizeWeight * r.entries;
    scored += r.entries;
  }
  if (sizeUnits <= 0 || scored <= 0) return null;
  return { average: points / sizeUnits, scoredEntries: scored };
}
