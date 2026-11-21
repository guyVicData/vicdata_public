// Panel menu "Save as CSV" (21 Nov): SMT Context's rows, one builder per view (see csv.ts).
import type { CsvTable } from "@/lib/csv";
import type { Context } from "@/lib/smt/context";

/** The rows for one Context view as ViewBody draws it; null where it draws nothing tabular. */
export function contextCsv(dv: string, d: Context): CsvTable | null {
  void dv;
  void d;
  return null;
}
