// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_view_as_fixes_pglite.mjs
// VicData 0.8 View as fixes (item 4): 20261116090000_v08_view_as_fixes_admin_membership.sql over a stub of
// the live tables that point at school_memberships, with the live foreign keys and delete rules (read from
// the app database's catalogue on 18 Oct 2026). Local only (WASM Postgres); never touches a real database.
// Checks: Guy's membership at 100053 goes with its sign-ins, Admissions grant, team places and usage rows,
// and the school's test admissions lists and entry points (his, with no other member) go too; the school
// account and its automatic teams stay; nobody else's rows change; a second run does nothing;
// another member approved by him, or the account held by him, is kept with the link cleared; owned saved
// sets stop it; a profile that isn't a platform admin is never touched.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const migration = readFileSync(`${repo}20261116090000_v08_view_as_fixes_admin_membership.sql`, "utf8");

const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const OTHER = "00000000-0000-0000-0000-0000000000b2";
const ACLAND = "643e0267-865b-49cf-8c91-79cbfb9deb65";
const CHASE = "00000000-0000-0000-0000-00000000c4a5";
const GUY_M = "7dca67ce-78e8-4391-8b72-5fe9c79f805d";
const GUY_CHASE_M = "00000000-0000-0000-0000-0000000000c1";
const OTHER_M = "00000000-0000-0000-0000-0000000000a2";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok || !detail ? "" : ` -- ${detail}`}`);
};

async function fresh({ admin = true, extra = "" } = {}) {
  const db = new PGlite();
  await db.exec(`
    create table public.profiles (id uuid primary key);
    create table public.platform_admins (profile_id uuid primary key references public.profiles (id));
    create table public.school_accounts (id uuid primary key, school_urn text unique, account_holder_membership_id uuid, pending_account_holder_membership_id uuid);
    create table public.school_memberships (id uuid primary key, school_account_id uuid references public.school_accounts (id) on delete cascade, profile_id uuid references public.profiles (id) on delete cascade, status text, roles text[], is_admin bool, approved_by uuid references public.school_memberships (id));
    alter table public.school_accounts add foreign key (account_holder_membership_id) references public.school_memberships (id);
    alter table public.school_accounts add foreign key (pending_account_holder_membership_id) references public.school_memberships (id);
    create table public.saved_sets (id serial primary key, school_account_id uuid, owner_membership_id uuid references public.school_memberships (id));
    create table public.saved_rankings (id serial primary key, school_account_id uuid, owner_membership_id uuid references public.school_memberships (id));
    create table public.teams (id serial primary key, school_account_id uuid);
    create table public.team_members (team_id int references public.teams (id), membership_id uuid not null references public.school_memberships (id) on delete cascade);
    create table public.sign_in_events (id serial primary key, membership_id uuid not null references public.school_memberships (id) on delete cascade, school_account_id uuid);
    create table public.admissions_grants (membership_id uuid primary key references public.school_memberships (id) on delete cascade, school_account_id uuid);
    create table public.usage_events (id serial primary key, membership_id uuid references public.school_memberships (id) on delete set null, school_urn text);
    create table public.admissions_lists (id serial primary key, school_account_id uuid, updated_by uuid);
    create table public.admissions_entry_points (id serial primary key, school_account_id uuid, updated_by uuid);

    insert into public.profiles values ('${GUY}'), ('${OTHER}');
    ${admin ? `insert into public.platform_admins values ('${GUY}');` : ""}
    insert into public.school_accounts (id, school_urn) values ('${ACLAND}', '100053'), ('${CHASE}', '137625');
    insert into public.school_memberships values
      ('${GUY_M}', '${ACLAND}', '${GUY}', 'approved', '{admissions,teacher}', true, null),
      ('${GUY_CHASE_M}', '${CHASE}', '${GUY}', 'approved', '{teacher}', false, null),
      ('${OTHER_M}', '${CHASE}', '${OTHER}', 'approved', '{smt}', false, null);
    insert into public.teams (school_account_id) values ('${ACLAND}'), ('${ACLAND}'), ('${ACLAND}');
    insert into public.team_members values (1, '${GUY_M}');
    insert into public.sign_in_events (membership_id, school_account_id) select '${GUY_M}', '${ACLAND}' from generate_series(1, 13);
    insert into public.sign_in_events (membership_id, school_account_id) values ('${OTHER_M}', '${CHASE}');
    insert into public.admissions_grants values ('${GUY_M}', '${ACLAND}'), ('${OTHER_M}', '${CHASE}');
    insert into public.usage_events (membership_id, school_urn) select '${GUY_M}', '100053' from generate_series(1, 27);
    insert into public.usage_events (membership_id, school_urn) values ('${OTHER_M}', '137625'), ('${GUY_CHASE_M}', '137625');
    insert into public.admissions_lists (school_account_id, updated_by) select '${ACLAND}', '${GUY}' from generate_series(1, 4);
    insert into public.admissions_entry_points (school_account_id, updated_by) values ('${ACLAND}', '${GUY}'), ('${ACLAND}', '${GUY}');
    insert into public.admissions_lists (school_account_id, updated_by) values ('${CHASE}', '${GUY}'), ('${CHASE}', '${OTHER}');
    insert into public.admissions_entry_points (school_account_id, updated_by) values ('${CHASE}', '${GUY}');
    ${extra}
  `);
  return db;
}
const one = async (db, sql) => Object.values((await db.query(sql)).rows[0])[0];
const count = (db, sql) => one(db, `select count(*)::int from ${sql}`);

// 1. The live case.
{
  const db = await fresh();
  await db.exec(migration);
  check("Guy's membership at 100053 is gone", (await count(db, `public.school_memberships where id = '${GUY_M}'`)) === 0);
  check("his sign-ins there go with it (13)", (await count(db, `public.sign_in_events where school_account_id = '${ACLAND}'`)) === 0);
  check("his Admissions grant there goes", (await count(db, `public.admissions_grants where membership_id = '${GUY_M}'`)) === 0);
  check("his team places go; the teams stay", (await count(db, "public.team_members")) === 0 && (await count(db, "public.teams")) === 3);
  check("his 27 usage rows at 100053 are removed, not left anonymous", (await count(db, "public.usage_events where school_urn = '100053'")) === 0);
  check("the school account stays", (await count(db, `public.school_accounts where id = '${ACLAND}'`)) === 1);
  check("its 4 test admissions lists and 2 entry points are removed", (await count(db, `public.admissions_lists where school_account_id = '${ACLAND}'`)) === 0 && (await count(db, `public.admissions_entry_points where school_account_id = '${ACLAND}'`)) === 0);
  check("its automatic teams stay", (await count(db, `public.teams where school_account_id = '${ACLAND}'`)) === 3);
  check("another school's lists and entry points are untouched, Guy's own there included", (await count(db, `public.admissions_lists where school_account_id = '${CHASE}'`)) === 2 && (await count(db, `public.admissions_entry_points where school_account_id = '${CHASE}'`)) === 1);
  check("Guy's other membership (another school) is untouched", (await count(db, `public.school_memberships where id = '${GUY_CHASE_M}'`)) === 1);
  check("his usage at the other school is untouched", (await count(db, `public.usage_events where membership_id = '${GUY_CHASE_M}'`)) === 1);
  check("another member's rows are untouched", (await count(db, `public.school_memberships where id = '${OTHER_M}'`)) === 1 && (await count(db, `public.sign_in_events where membership_id = '${OTHER_M}'`)) === 1 && (await count(db, `public.admissions_grants where membership_id = '${OTHER_M}'`)) === 1 && (await count(db, `public.usage_events where membership_id = '${OTHER_M}'`)) === 1);
  const before = await one(db, "select (select count(*) from public.school_memberships) + (select count(*) from public.usage_events) + (select count(*) from public.sign_in_events)");
  let again = null;
  try {
    await db.exec(migration);
  } catch (e) {
    again = e;
  }
  const after = await one(db, "select (select count(*) from public.school_memberships) + (select count(*) from public.usage_events) + (select count(*) from public.sign_in_events)");
  check("a second run succeeds and changes nothing", !again && before === after, again?.message);
}

// 2. Someone else relies on the membership: kept, the link cleared.
{
  const db = await fresh({
    extra: `
      insert into public.profiles values ('00000000-0000-0000-0000-0000000000b3');
      insert into public.school_memberships values ('00000000-0000-0000-0000-0000000000a3', '${ACLAND}', '00000000-0000-0000-0000-0000000000b3', 'approved', '{teacher}', false, '${GUY_M}');
      update public.school_accounts set account_holder_membership_id = '${GUY_M}', pending_account_holder_membership_id = '${GUY_M}' where id = '${ACLAND}';`,
  });
  await db.exec(migration);
  check("with another member at the school, its lists and entry points are kept", (await count(db, `public.admissions_lists where school_account_id = '${ACLAND}'`)) === 4 && (await count(db, `public.admissions_entry_points where school_account_id = '${ACLAND}'`)) === 2);
  check("a member he approved is kept, approved_by cleared", (await one(db, "select approved_by is null from public.school_memberships where id = '00000000-0000-0000-0000-0000000000a3'")) === true);
  check("the account he held is kept, holder and pending holder cleared", (await one(db, `select account_holder_membership_id is null and pending_account_holder_membership_id is null from public.school_accounts where id = '${ACLAND}'`)) === true);
  check("and his membership is gone", (await count(db, `public.school_memberships where id = '${GUY_M}'`)) === 0);
}

// 3. Owned saved sets: stop, change nothing.
{
  const db = await fresh({ extra: `insert into public.saved_sets (school_account_id, owner_membership_id) values ('${ACLAND}', '${GUY_M}');` });
  let err = null;
  try {
    await db.exec(migration);
  } catch (e) {
    err = e;
  }
  check("owned saved sets stop the migration", /saved sets or rankings/.test(err?.message ?? ""), err?.message);
  check("and nothing was removed", (await count(db, `public.school_memberships where id = '${GUY_M}'`)) === 1 && (await count(db, "public.usage_events")) === 29 && (await count(db, `public.admissions_lists where school_account_id = '${ACLAND}'`)) === 4);
}

// 4. Not a platform admin: nothing.
{
  const db = await fresh({ admin: false });
  await db.exec(migration);
  check("a profile that isn't a platform admin is never touched", (await count(db, `public.school_memberships where id = '${GUY_M}'`)) === 1 && (await count(db, "public.usage_events")) === 29 && (await count(db, `public.admissions_lists where school_account_id = '${ACLAND}'`)) === 4);
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
