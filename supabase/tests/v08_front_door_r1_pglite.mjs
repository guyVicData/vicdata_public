// Run from the repo root: npm i --no-save @electric-sql/pglite@0.2 && node supabase/tests/v08_front_door_r1_pglite.mjs
// VicData 0.8 front door, part 1 (A5, A7; R-WELCOME-ONCE's and R-WHATS-NEW's tables): the migration
// 20261123090000_v08_front_door_r1.sql over a stub of the live schema it depends on (auth.uid() from the
// request.jwt.claim.sub GUC, profiles, platform_admins and is_platform_admin as 0.6 S1 made them). Local
// only (WASM Postgres); never touches a real database.
// Checks: a person reads and writes their own front-door row only, never anyone else's, and anon nothing;
// the changelog is written by platform admins only; changelog_for_me lists published entries newest first,
// with an entry's feedback credit only for the people it credits; the migration runs twice.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const repo = new URL("../migrations/", import.meta.url).pathname;
const db = new PGlite();
const q = (sql, p) => db.query(sql, p);
const ex = (sql) => db.exec(sql);

await ex(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table public.profiles (id uuid primary key, email text);
create table public.platform_admins (profile_id uuid primary key references public.profiles (id));
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where profile_id = auth.uid()); $$;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function public.is_platform_admin() to authenticated;
`);

process.on("uncaughtException", (e) => { console.log("ERROR", e.message); process.exit(1); });
const M = "20261123090000_v08_front_door_r1.sql";
await ex(readFileSync(repo + M, "utf8"));
await ex(readFileSync(repo + M, "utf8"));
console.log("applied", M, "twice");

let fails = 0;
const check = (name, ok, extra = "") => { console.log(ok ? "PASS" : "FAIL", name, extra); if (!ok) fails++; };
const as = async (role, uid, fn) => {
  await ex(`set role ${role}`);
  await ex(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false)`);
  try { return await fn(); } finally { await ex("reset role"); await ex(`select set_config('request.jwt.claim.sub', '', false)`); }
};
const fails_ = async (fn) => { try { await fn(); return false; } catch (e) { return /permission denied|row-level security|violates/i.test(e.message); } };

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
await ex(`insert into profiles values ('${A}', 'a@x'), ('${B}', 'b@x'), ('${ADMIN}', 'admin@x'); insert into platform_admins values ('${ADMIN}');`);

console.log("\n-- front_door_state");
check("a person writes their own row (the welcome seen)", (await as("authenticated", A, () => q(`insert into front_door_state (profile_id, welcome_seen_at) values ('${A}', now()) returning profile_id`))).rows.length === 1);
check("…and updates it (the last visit, the strip seen)", (await as("authenticated", A, () => q(`update front_door_state set last_visit_at = now(), whats_new_seen_at = now() where profile_id = '${A}' returning profile_id`))).rows.length === 1);
check("can't write someone else's row", await fails_(() => as("authenticated", A, () => q(`insert into front_door_state (profile_id, welcome_seen_at) values ('${B}', now())`))));
check("can't read someone else's row", (await as("authenticated", B, () => q(`select * from front_door_state`))).rows.length === 0);
check("can't change someone else's row", (await as("authenticated", B, () => q(`update front_door_state set welcome_seen_at = null where profile_id = '${A}' returning profile_id`))).rows.length === 0);
check("anon reads nothing", await fails_(() => as("anon", null, () => q(`select * from front_door_state`))));
check("a row goes with its profile", (await q(`delete from profiles where id = '${B}' returning id`)).rows.length === 1);

console.log("\n-- changelog_entries");
const ins = (who) => as("authenticated", who, () => q(`insert into changelog_entries (title, body, credit_text, credit_profile_ids, published_at) values ('Walkthroughs', 'Every question walks you through a few screens.', 'Your feedback on the GCSE dashboard led to this.', array['${A}']::uuid[], now() - interval '1 day') returning id`));
check("a platform admin writes an entry", (await ins(ADMIN)).rows.length === 1);
check("anyone else can't", await fails_(() => ins(A)));
await as("authenticated", ADMIN, () => q(`insert into changelog_entries (title, published_at) values ('Older', now() - interval '10 days'), ('Scheduled', now() + interval '10 days')`));
check("a member can't read the table directly", (await as("authenticated", A, () => q(`select * from changelog_entries`))).rows.length === 0);
const mine = (await as("authenticated", A, () => q(`select title, credit_text from changelog_for_me()`))).rows;
check("changelog_for_me: published entries only, newest first", JSON.stringify(mine.map((r) => r.title)) === JSON.stringify(["Walkthroughs", "Older"]), JSON.stringify(mine));
check("…with the credit for the person it credits", mine[0].credit_text === "Your feedback on the GCSE dashboard led to this.");
const admins = (await as("authenticated", ADMIN, () => q(`select title, credit_text from changelog_for_me()`))).rows;
check("…and no credit for anyone else", admins[0].credit_text === null);
check("anon can't call it", await fails_(() => as("anon", null, () => q(`select * from changelog_for_me()`))));
check("a link must be a path in the app", await fails_(() => as("authenticated", ADMIN, () => q(`insert into changelog_entries (title, link) values ('x', 'https://evil.example')`))));

console.log("\n-- the shape");
check("RLS on both tables", (await q(`select bool_and(relrowsecurity) ok from pg_class where relname in ('front_door_state', 'changelog_entries')`)).rows[0].ok === true);

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
