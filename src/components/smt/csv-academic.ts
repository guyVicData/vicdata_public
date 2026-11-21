// Panel menu "Save as CSV" (21 Nov): SMT Academic's rows, one builder per view (see csv.ts).
import type { CsvTable } from "@/lib/csv";
import type { Academic } from "@/lib/smt/academic";

/** The rows for one Academic view as ViewBody draws it; null where it draws nothing tabular. */
export function academicCsv(dv: string, d: Academic): CsvTable | null {
  void dv;
  void d;
  return null;
}
