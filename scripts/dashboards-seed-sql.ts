// Prints the SQL that publishes the VicData dashboards from src/catalogue/dashboards into the
// S2 tables: one group per linked set, one dashboard per config, and a "key" assignment to
// the Teacher role.
//
// 0.6.1 S2 (the re-seed, D9): the configs are schema_version 2 (each view instance carries its
// ViewSpec). Where a dashboard already exists -- live, the four Teacher dashboards hold the
// v1 seed -- its config is published OVER the current one as the next version, exactly as
// the editor's publish does (version = latest + 1, published_version_id moved, the draft
// cleared), unless the published version already IS this config: so running it twice
// publishes once. Only drafts still in the old format are cleared (a v2 draft Guy has started
// is kept). Instance ids are unchanged, so members' open rows and chosen views carry over
// (D10, carryUserState keys on the preset).
//
//   npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/seed.sql
//   supabase db query --linked -f /tmp/seed.sql
//
// Run as the service role (the CLI is), so created_by is left null.
//
// `--legacy-v1` prints the v1 seed exactly as 0.6 S3 shipped it (insert-if-missing, version
// 1, specs stripped), for the PGlite re-seed test only.
import { DASHBOARDS } from "../src/catalogue/dashboards";
import type { DashboardConfig } from "../src/catalogue/types";

const legacy = process.argv.includes("--legacy-v1");
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out: string[] = ["begin;"];

// The v1 shape: no specs, schema_version 1.
function asV1(d: DashboardConfig): unknown {
  return {
    ...d,
    schema_version: 1,
    panels: d.panels.map((p) => ({ ...p, dataviews: p.dataviews.map((v) => {
      const x: Record<string, unknown> = { ...v };
      delete x.spec;
      return x;
    }) })),
  };
}

const groups = new Map<string, string>();
for (const d of DASHBOARDS) if (d.owner === "vicdata" && d.group) groups.set(d.group.id, d.group.label);
for (const [slug, label] of groups) {
  out.push(`insert into public.dashboard_groups (slug, label, owner_scope) values (${lit(slug)}, ${lit(label)}, 'vicdata') on conflict (slug) do nothing;`);
}

for (const d of DASHBOARDS) {
  if (d.owner !== "vicdata") continue;
  out.push(`insert into public.dashboards (slug, kind, owner_scope, name, group_id, group_order)
  values (${lit(d.id)}, ${lit(d.kind)}, 'vicdata', ${lit(d.name)},
          ${d.group ? `(select id from public.dashboard_groups where slug = ${lit(d.group.id)})` : "null"}, ${d.group?.order ?? 0})
  on conflict (slug) do nothing;`);
  if (legacy) {
    out.push(`with dash as (select id from public.dashboards where slug = ${lit(d.id)}),
  v as (
    insert into public.dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary)
    select dash.id, 1, 1, ${lit(JSON.stringify(asV1(d)))}::jsonb, 'Seed', 'Seeded from the hand-coded Teacher dashboard (0.6 S3)'
    from dash where not exists (select 1 from public.dashboard_versions x where x.dashboard_id = dash.id)
    returning id, dashboard_id
  )
  update public.dashboards set published_version_id = v.id from v where dashboards.id = v.dashboard_id;`);
  } else {
    const config = `${lit(JSON.stringify(d))}::jsonb`;
    out.push(`with dash as (
    select d.id from public.dashboards d
    where d.slug = ${lit(d.id)}
      and not exists (select 1 from public.dashboard_versions p where p.id = d.published_version_id and p.config = ${config})
  ),
  v as (
    insert into public.dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary)
    select dash.id, coalesce((select max(x.version) from public.dashboard_versions x where x.dashboard_id = dash.id), 0) + 1,
           ${d.schema_version}, ${config}, 'Re-seed (0.6.1)', 'The Teacher dashboard in the ViewSpec format (0.6.1 S2): the same views, ids and defaults'
    from dash
    returning id, dashboard_id
  )
  update public.dashboards set published_version_id = v.id, updated_at = now() from v where dashboards.id = v.dashboard_id;`);
    out.push(`delete from public.dashboard_drafts where dashboard_id = (select id from public.dashboards where slug = ${lit(d.id)})
  and coalesce((config ->> 'schema_version')::int, 0) < ${d.schema_version};`);
  }
  out.push(`insert into public.dashboard_assignments (dashboard_id, target_kind, role, mode, is_key)
  select id, 'role', 'teacher', 'live', true from public.dashboards where slug = ${lit(d.id)}
    and not exists (select 1 from public.dashboard_assignments a join public.dashboards x on x.id = a.dashboard_id where x.slug = ${lit(d.id)} and a.role = 'teacher');`);
}
out.push("commit;");
console.log(out.join("\n"));
