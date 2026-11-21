// Panel menu "Save as CSV" (21 Nov): SMT Pupils's rows, one builder per view (see csv.ts).
import type { CsvTable } from "@/lib/csv";
import type { Pupils } from "@/lib/smt/pupils";

/** The rows for one Pupils view as ViewBody draws it; null where it draws nothing tabular. */
export function pupilsCsv(dv: string, d: Pupils): CsvTable | null {
  void dv;
  void d;
  return null;
}
