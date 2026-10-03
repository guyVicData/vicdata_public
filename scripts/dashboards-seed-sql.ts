// Prints the SQL that seeds the VicData dashboards from src/catalogue/dashboards into the
// S2 tables: one group per linked set, one dashboard per config, its config published as
// version 1, and a "key" assignment to the Teacher role. Idempotent (keyed on slugs).
//
//   npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/seed.sql
//   supabase db query --linked -f /tmp/seed.sql
//
// Run as the service role (the CLI is), so created_by is left null.
import { DASHBOARDS } from "../src/catalogue/dashboards";

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out: string[] = ["begin;"];

const groups = new Map<string, string>();
for (const d of DASHBOARDS) if (d.owner === "vicdata" && d.group) groups.set(d.group.id, d.group.label);
for (const [slug, label] of groups) {
  out.push(`insert into public.dashboard_groups (slug, label, owner_scope) values (${lit(slug)}, ${lit(label)}, 'vicdata') on conflict (slug) do nothing;`);
}

for (const d of DASHBOARDS) {
  if (d.owner !== "vicdata") continue;
  const config = lit(JSON.stringify(d));
  out.push(`insert into public.dashboards (slug, kind, owner_scope, name, group_id, group_order)
  values (${lit(d.id)}, ${lit(d.kind)}, 'vicdata', ${lit(d.name)},
          ${d.group ? `(select id from public.dashboard_groups where slug = ${lit(d.group.id)})` : "null"}, ${d.group?.order ?? 0})
  on conflict (slug) do nothing;`);
  out.push(`with dash as (select id from public.dashboards where slug = ${lit(d.id)}),
  v as (
    insert into public.dashboard_versions (dashboard_id, version, schema_version, config, label, change_summary)
    select dash.id, 1, ${d.schema_version}, ${config}::jsonb, 'Seed', 'Seeded from the hand-coded Teacher dashboard (0.6 S3)'
    from dash where not exists (select 1 from public.dashboard_versions x where x.dashboard_id = dash.id)
    returning id, dashboard_id
  )
  update public.dashboards set published_version_id = v.id from v where dashboards.id = v.dashboard_id;`);
  out.push(`insert into public.dashboard_assignments (dashboard_id, target_kind, role, mode, is_key)
  select id, 'role', 'teacher', 'live', true from public.dashboards where slug = ${lit(d.id)}
    and not exists (select 1 from public.dashboard_assignments a join public.dashboards x on x.id = a.dashboard_id where x.slug = ${lit(d.id)} and a.role = 'teacher');`);
}
out.push("commit;");
console.log(out.join("\n"));
