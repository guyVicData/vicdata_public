// What scripts/dashboards-seed-sql.ts seeds, as data: every VicData-owned dashboard in the catalogue,
// its group and the roles it is assigned to. The seed script and its PGlite test
// (supabase/tests/v061_s2_reseed_pglite.mjs) both read this, so adding a dashboard to the catalogue
// changes what the test expects without editing it (0.8 SMT r3 snags, fix 2).
import type { DashboardConfig } from "../types";
import { DASHBOARDS } from "./index";
import { ADMISSIONS_SEED_ROLES, isAdmissionsDashboard } from "./admissions";
import { SMT_SEED_ROLES, isSmtDashboard } from "./smt";

export type SeedPlanEntry = { slug: string; group: string | null; roles: readonly string[] };

/** Each dashboard to its own roles: Teacher's to 'teacher', Admissions' to Admissions and SMT, SMT's to SMT. */
export function seedRoles(id: string): readonly string[] {
  return isSmtDashboard(id) ? SMT_SEED_ROLES : isAdmissionsDashboard(id) ? ADMISSIONS_SEED_ROLES : ["teacher"];
}

export function seedPlan(dashboards: readonly DashboardConfig[] = DASHBOARDS): SeedPlanEntry[] {
  return dashboards.filter((d) => d.owner === "vicdata").map((d) => ({ slug: d.id, group: d.group?.id ?? null, roles: seedRoles(d.id) }));
}
