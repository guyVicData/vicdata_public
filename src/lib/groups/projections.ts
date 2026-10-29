// VicData 0.8 groups r3 (P): each member school's area projection, at its saved catchment (read with the
// service key: the caller's access to the group is already checked, and the catchment is only read),
// else its default (src/lib/smt/catchment.ts: 15 km independent, the density radius for a state school). Server-only.
import { createServiceRoleSupabaseClient } from "../supabase";
import { areaProjection } from "../smt/area-data";
import { resolveCatchment, type CatchmentSchool } from "../smt/catchment";
import { stateDensityKm } from "../smt/catchment-density";
import type { SchoolYearRow } from "./aggregates";

export type ProjectionRow = { urn: string; name: string; km: number; from: "saved" | "default"; ages: string; now: number | null; end: number | null; endYear: number | null; latestYear: number | null; pct: number | null };

async function savedKm(urns: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!urns.length) return out;
  const sb = createServiceRoleSupabaseClient();
  const { data: accs } = await sb.from("school_accounts").select("id, school_urn").in("school_urn", urns);
  const byAcc = new Map(((accs ?? []) as { id: string; school_urn: string }[]).map((a) => [a.id, a.school_urn]));
  if (!byAcc.size) return out;
  const { data, error } = await sb.from("school_catchment").select("school_account_id, km").in("school_account_id", Array.from(byAcc.keys()));
  if (error) return out; // before round 4's migration: defaults
  for (const r of (data ?? []) as { school_account_id: string; km: number }[]) out.set(byAcc.get(r.school_account_id)!, r.km);
  return out;
}

export async function schoolProjections(schools: SchoolYearRow[]): Promise<ProjectionRow[]> {
  const members = schools.filter((s) => s.role === "member" && s.years.some((y) => y.listed_now) && !s.outside_england && s.easting !== null);
  const saved = await savedKm(members.map((s) => s.urn));
  const jobs = members.map((s) => async (): Promise<ProjectionRow | null> => {
    const f = [...s.years].reverse().find((y) => y.figures)?.figures;
    if (!f) return null;
    const ages = f.roll_by_age.map((n, a) => (n >= 3 ? a : -1)).filter((a) => a >= 0);
    if (!ages.length) return null;
    const lo = Math.max(0, ages[0]);
    const hi = Math.min(18, ages[ages.length - 1]);
    const independent = s.establishment_type_group === "Independent schools";
    // 0.8 Admissions fb1: a state school's default is its density radius (catchment.ts), as SMT's.
    const cs: CatchmentSchool = { independent, high: hi, phases: { post16: f.phases.includes("post16") }, densityKm: independent ? null : await stateDensityKm(s.urn, lo, hi) };
    const c = resolveCatchment(cs, null, saved.get(s.urn) ?? null);
    const p = await areaProjection(s.urn, c.km, [lo, hi]).catch(() => null);
    const rows = p?.rows.filter((r) => r.ageFrom === lo && r.ageTo === hi) ?? [];
    const now = rows.find((r) => r.year === p?.latestYear)?.middle ?? null;
    const endRow = rows.find((r) => r.year === p?.horizonEnd) ?? null;
    return { urn: s.urn, name: s.name ?? s.urn, km: c.km, from: c.from === "saved" ? "saved" : "default", ages: `${lo}–${hi}`, now, end: endRow?.middle ?? null, endYear: p?.horizonEnd ?? null, latestYear: p?.latestYear ?? null, pct: now && endRow?.middle ? Math.round((1000 * (endRow.middle - now)) / now) / 10 : null };
  });
  const out: (ProjectionRow | null)[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]();
    }
  }));
  return out.filter((r): r is ProjectionRow => !!r).sort((a, b) => a.name.localeCompare(b.name));
}
