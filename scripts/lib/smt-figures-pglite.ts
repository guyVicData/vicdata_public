// A local PGlite (WASM Postgres) holding smt_school_figures, for scripts/build-smt-figures.ts --pglite and the
// parity harness (scripts/smt-academic-parity.ts --figures-pglite): the real migration applied over Supabase's
// three roles, and the real read function called, so the local runs read exactly what the live table would
// answer (jsonb round trip included). Never touches a real database.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = new URL("../../supabase/migrations/20261125100000_v08_smt_school_figures.sql", import.meta.url).pathname;

export async function openFiguresPglite(dir: string): Promise<PGlite> {
  const db = new PGlite(dir);
  const has = await db.query<{ t: string | null }>(`select to_regclass('public.smt_school_figures')::text as t`);
  if (!has.rows[0]?.t) {
    await db.exec(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
      end $$;
      grant usage on schema public to anon, authenticated, service_role;`);
    await db.exec(readFileSync(MIGRATION, "utf8"));
  }
  return db;
}

/** The read function, as the service role calls it. */
export function pgliteFiguresRpc(db: PGlite) {
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
