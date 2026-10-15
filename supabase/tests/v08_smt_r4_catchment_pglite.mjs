// VicData 0.8 SMT round 4 (R3): the saved catchment (school_catchment) and the wider boundary read
// (20261113090000_v08_smt_r4_catchment.sql), on top of round 3's lsoa_boundaries
// (20261111090000_v08_smt_r3_lsoa_boundaries.sql). Local only (WASM Postgres with PostGIS); never
// touches a real database. The membership tables and helpers are stubs of production's, defined as
// production defines them (20260807092000_school_accounts_and_memberships.sql,
// 20261106090000_v07_admissions_r1.sql).
//
// Checks (R-SMT-RADIUS's RLS half):
//   - a School-Admin and the account holder save, change and clear their own school's catchment;
//   - an approved member reads it but can't write it; a pending member reads nothing;
//   - another school's School-Admin can neither read nor write it, nor move a row to their school;
//   - head office (not a member) reads and writes nothing with its own token (the server reads for it);
//   - anon reads and writes nothing; the table holds only 2-30 km;
//   - lsoa_boundaries_near answers to 32 km (a 30 km catchment and its one-mile ring), not beyond;
//   - the migration can be applied twice.
//
// PostGIS needs the newer PGlite, as round 3's test:
//   d=$(mktemp -d) && (cd $d && npm i --no-audit --no-fund @electric-sql/pglite@0.5.5 @electric-sql/pglite-postgis@0.2.5) && PGLITE_DIR=$d node supabase/tests/v08_smt_r4_catchment_pglite.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = process.env.PGLITE_DIR;
if (!dir) throw new Error("PGLITE_DIR is not set (see the header)");
const mod = (p) => import(pathToFileURL(path.join(dir, "node_modules", p)).href);
const { PGlite } = await mod("@electric-sql/pglite/dist/index.js");
const { postgis } = await mod("@electric-sql/pglite-postgis/dist/index.js");

const db = await PGlite.create({ extensions: { postgis } });
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
// As a signed-in user (authenticated with auth.uid() = uid), anon, or the service role.
const as = async (role, uid, fn) => {
  await ex(`set role ${role}`);
  await ex(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
  try {
    return await fn();
  } finally {
    await ex("reset role");
  }
};
const tryAs = async (role, uid, sql, p) => {
  try {
    return { rows: (await as(role, uid, () => q(sql, p))).rows };
  } catch (e) {
    return { error: e.message };
  }
};

// Production's shape, the parts the policies read.
await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's default grants: every new table is open to anon and authenticated until a migration says
-- otherwise (school_catchment's revokes anon; RLS does the rest).
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create table public.profiles (id uuid primary key);
create table public.schools (urn text primary key);
create table public.school_accounts (id uuid primary key, school_urn text not null unique references public.schools (urn), account_holder_membership_id uuid);
create table public.school_memberships (id uuid primary key, school_account_id uuid not null references public.school_accounts (id), profile_id uuid not null references public.profiles (id),
  status text not null, is_admin boolean not null default false, roles text[] not null default array['teacher']);
create function public.is_member_of_school_account(p_school_account_id uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.school_memberships where school_account_id = p_school_account_id and profile_id = auth.uid() and status = 'approved') $$;
create function public.is_admin_of_school_account(p_school_account_id uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.school_memberships where school_account_id = p_school_account_id and profile_id = auth.uid() and status = 'approved' and is_admin = true) $$;
create function public.is_account_holder_of_school_account(p_school_account_id uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.school_accounts sa join public.school_memberships sm on sm.id = sa.account_holder_membership_id where sa.id = p_school_account_id and sm.profile_id = auth.uid()) $$;
create function public.is_school_admin_or_holder(p_school_account_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_of_school_account(p_school_account_id) or public.is_account_holder_of_school_account(p_school_account_id) $$;
`);
const R3 = readFileSync(new URL("../migrations/20261111090000_v08_smt_r3_lsoa_boundaries.sql", import.meta.url), "utf8");
const R4 = readFileSync(new URL("../migrations/20261113090000_v08_smt_r4_catchment.sql", import.meta.url), "utf8");
await ex(R3);
await ex(R4);
await ex(R4); // twice: idempotent
ok("the migration applies twice", true);

// Two schools. Leighton Park (A): its School-Admin, its account holder (not an admin), an SMT member,
// a pending member. The Chase (B): its School-Admin.
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [SA, SB] = [id(101), id(102)];
const P = { adminA: id(1), holderA: id(2), smtA: id(3), pendingA: id(4), adminB: id(5), headOffice: id(6) };
await ex(`
insert into public.schools values ('110110'), ('137625');
insert into public.profiles values ${Object.values(P).map((p) => `('${p}')`).join(", ")};
insert into public.school_accounts values ('${SA}', '110110', null), ('${SB}', '137625', null);
insert into public.school_memberships values
  ('${id(201)}', '${SA}', '${P.adminA}', 'approved', true, array['teacher']),
  ('${id(202)}', '${SA}', '${P.holderA}', 'approved', false, array['teacher']),
  ('${id(203)}', '${SA}', '${P.smtA}', 'approved', false, array['smt']),
  ('${id(204)}', '${SA}', '${P.pendingA}', 'pending', true, array['smt']),
  ('${id(205)}', '${SB}', '${P.adminB}', 'approved', true, array['smt']);
update public.school_accounts set account_holder_membership_id = '${id(202)}' where id = '${SA}';
`);
const auth = "authenticated";
const read = async (uid, school = SA) => (await tryAs(auth, uid, "select km from public.school_catchment where school_account_id = $1", [school])).rows?.map((r) => r.km) ?? null;

ok("RLS is on", (await q("select relrowsecurity r from pg_class where relname = 'school_catchment'")).rows[0].r === true);

// The School-Admin saves, changes, clears.
const save = (uid, school, km) => tryAs(auth, uid, "insert into public.school_catchment (school_account_id, km, updated_by) values ($1, $2, $3) on conflict (school_account_id) do update set km = excluded.km, updated_by = excluded.updated_by, updated_at = now() returning km", [school, km, uid]);
ok("School-Admin saves 8 km", (await save(P.adminA, SA, 8)).rows?.[0]?.km === 8);
ok("School-Admin changes it to 10 km", (await save(P.adminA, SA, 10)).rows?.[0]?.km === 10);
ok("the account holder (not an admin) changes it to 12 km", (await save(P.holderA, SA, 12)).rows?.[0]?.km === 12);

// Members read; nobody else does.
ok("an SMT member reads it", JSON.stringify(await read(P.smtA)) === "[12]");
ok("the School-Admin reads it", JSON.stringify(await read(P.adminA)) === "[12]");
ok("a pending member reads nothing", JSON.stringify(await read(P.pendingA)) === "[]");
ok("another school's School-Admin reads nothing", JSON.stringify(await read(P.adminB)) === "[]");
// Head office (0.8 audit fixes, 9): not a member, so its own token reads nothing and writes nothing.
// The server reads the row for it, read-only, after checking its access (catchmentRights).
ok("head office's own token reads nothing", JSON.stringify(await read(P.headOffice)) === "[]");
const rh = await save(P.headOffice, SA, 20);
ok("head office can't save", rh.error !== undefined && JSON.stringify(await read(P.adminA)) === "[12]", rh.error);
const rh2 = await tryAs(auth, P.headOffice, "update public.school_catchment set km = 20 where school_account_id = $1 returning km", [SA]);
ok("head office can't change it", (rh2.rows?.length ?? 0) === 0 && JSON.stringify(await read(P.adminA)) === "[12]");
ok("anon can't read", (await tryAs("anon", null, "select km from public.school_catchment")).error !== undefined);

// Writes: the member, the pending admin, another school's admin, anon -- none.
const r1 = await save(P.smtA, SA, 20);
ok("an SMT member (not admin) can't save", r1.error !== undefined && JSON.stringify(await read(P.adminA)) === "[12]", r1.error);
const r2 = await save(P.pendingA, SA, 20);
ok("a pending School-Admin can't save", r2.error !== undefined && JSON.stringify(await read(P.adminA)) === "[12]", r2.error);
const r3 = await save(P.adminB, SA, 20);
ok("another school's School-Admin can't save it", r3.error !== undefined && JSON.stringify(await read(P.adminA)) === "[12]", r3.error);
const r4 = await tryAs(auth, P.adminB, "update public.school_catchment set km = 20 where school_account_id = $1 returning km", [SA]);
ok("another school's School-Admin can't change it (no row visible)", (r4.rows?.length ?? 0) === 0 && JSON.stringify(await read(P.adminA)) === "[12]");
const r5 = await tryAs(auth, P.adminA, "update public.school_catchment set school_account_id = $1 where school_account_id = $2 returning km", [SB, SA]);
ok("a School-Admin can't move their row to another school", r5.error !== undefined && JSON.stringify(await read(P.adminA)) === "[12]", r5.error);
ok("anon can't write", (await tryAs("anon", null, `insert into public.school_catchment (school_account_id, km) values ('${SB}', 5)`)).error !== undefined);
ok("The Chase's School-Admin saves their own", (await save(P.adminB, SB, 15)).rows?.[0]?.km === 15 && JSON.stringify(await read(P.adminB, SB)) === "[15]" && JSON.stringify(await read(P.adminA)) === "[12]");

// The range.
for (const km of [1, 31, 0, -5]) ok(`${km} km is refused`, (await save(P.adminA, SA, km)).error !== undefined);
ok("2 and 30 km are accepted", (await save(P.adminA, SA, 2)).rows?.[0]?.km === 2 && (await save(P.adminA, SA, 30)).rows?.[0]?.km === 30);
const del = await tryAs(auth, P.smtA, "delete from public.school_catchment where school_account_id = $1 returning km", [SA]);
ok("an SMT member can't clear it", (del.rows?.length ?? 0) === 0 && JSON.stringify(await read(P.adminA)) === "[30]");
const clr = await tryAs(auth, P.adminA, "delete from public.school_catchment where school_account_id = $1 returning km", [SA]);
ok("the School-Admin clears it (back to the default)", clr.rows?.length === 1 && JSON.stringify(await read(P.smtA)) === "[]");

// The boundary read: to 32 km.
const square = (e, n, side) => `ST_AsGeoJSON(ST_Transform(ST_MakeEnvelope(${e}, ${n}, ${e + side}, ${n + side}, 27700), 4326))`;
const SCHOOL = { e: 473300, n: 170700 }; // Leighton Park
for (const [code, de] of [["E01000001", 0], ["E01000002", 25000], ["E01000003", 31000], ["E01000004", 33000]]) {
  const g = (await q(`select ${square(SCHOOL.e + de, SCHOOL.n, 300)} g`)).rows[0].g;
  await as("service_role", null, () => q("select public.ingest_lsoa_boundary($1, $2, $3, 'test')", [code, code, g]));
}
const near = async (m) => (await as("anon", null, () => q("select gss_code from public.lsoa_boundaries_near($1, $2, $3) order by 1", [SCHOOL.e, SCHOOL.n, m]))).rows.map((r) => r.gss_code).join();
ok("near: 30 km and a one-mile ring (31,609 m) finds three", (await near(30000 + 1609.344)) === "E01000001,E01000002,E01000003");
ok("near: 32 km is the most", (await near(32000)) === "E01000001,E01000002,E01000003");
ok("near: over 32 km answers nothing", (await near(32001)) === "");
ok("near: 20 km still answers as before", (await near(20000)) === "E01000001");

console.log(`\n${pass} / ${pass + fail} passed`);
process.exit(fail ? 1 : 0);
