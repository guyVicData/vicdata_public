// A local PGlite (WASM Postgres) holding smt_school_figures, for scripts/build-smt-figures.ts --pglite and the
// parity harness (scripts/smt-academic-parity.ts --figures-pglite): the real migration applied over Supabase's
// three roles, and the real read function called, so the local runs read exactly what the live table would
// answer (jsonb round trip included). Never touches a real database.
import { readFileSync } from "node:fs";

// A local test tool, not one of the app's packages (Render doesn't install it, and the build's type check
// must not need it): loaded at run time, only when a local run asks for PGlite.
type PGliteDb = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown>; close(): Promise<void> };
async function newPGlite(dir: string): Promise<PGliteDb> {
  const spec = "@electric-sql/pglite";
  const { PGlite } = (await import(spec)) as { PGlite: new (dir: string) => PGliteDb };
  return new PGlite(dir);
}


const MIGRATIONS = ["20261125100000_v08_smt_school_figures.sql", "20261125110000_v08_smt_census_figures.sql"].map((m) => new URL(`../../supabase/migrations/${m}`, import.meta.url).pathname);

export async function openFiguresPglite(dir: string): Promise<PGliteDb> {
  const db = await newPGlite(dir);
  const has = await db.query<{ t: string | null }>(`select to_regclass('public.smt_school_figures')::text as t`);
  if (!has.rows[0]?.t) {
    await db.exec(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
      end $$;
      grant usage on schema public to anon, authenticated, service_role;`);
    await db.exec(readFileSync(MIGRATIONS[0], "utf8"));
  }
  // The census stage (20261125110000): a PGlite made before it takes it now.
  const census = await db.query<{ ok: boolean }>(`select pg_get_constraintdef(oid) like '%census%' as ok from pg_constraint where conname = 'smt_figures_builds_stage_check'`);
  if (!census.rows[0]?.ok) await db.exec(readFileSync(MIGRATIONS[1], "utf8"));
  return db;
}

/** The read function, as the service role calls it. */
export function pgliteFiguresRpc(db: PGliteDb) {
  return async (fn: string, a: Record<string, unknown>) => {
    if (fn !== "smt_school_figures_read") throw new Error(`no ${fn} here`);
    await db.exec("set role service_role");
    try {
      const r = await db.query<{ r: unknown }>(`select public.smt_school_figures_read($1, $2, $3, $4, $5, $6, $7) as r`, [a.p_stage, a.p_version, a.p_urns, a.p_period_min, a.p_subject_period, a.p_full_urn, a.p_drop ?? null]);
      return r.rows[0]?.r ?? null;
    } finally {
      await db.exec("reset role");
    }
  };
}
