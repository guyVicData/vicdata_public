#!/usr/bin/env -S npx tsx
// Victoria Consultancy Sets: Guy's v1 tool for the comparator sets VC authors and switches
// on per school (supabase/migrations/20261102100000_victoria_consultancy_sets.sql).
//
// The three vc_* tables have read-only RLS -- no insert/update/delete policies -- so this
// script, on the service role, is the only way to write them. Nothing a school's own
// members or admins can do reaches these tables. See docs/OPEN_QUESTIONS.md (2026-09-27)
// for why a script rather than an in-app operator role.
//
// Usage: npx tsx --env-file=.env scripts/vc-sets.ts <command> ...
//   list                                   every VC set, its size, and which schools see it
//   create "<name>" <urn> [<urn> ...]      a new VC set with these member schools
//   rename <set-id> "<name>"
//   set-members <set-id> <urn> [<urn> ...] replace a set's members
//   delete <set-id>                        remove a set (and every school's switch for it)
//   show <school-urn> <set-id>             switch the set ON for that school's account
//   hide <school-urn> <set-id>             switch it OFF again
import { createServiceRoleSupabaseClient } from "../src/lib/supabase";

const supabase = createServiceRoleSupabaseClient();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function schoolAccountFor(urn: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase.from("school_accounts").select("id, school_urn, schools(current_name)").eq("school_urn", urn).maybeSingle();
  if (error) fail(error.message);
  if (!data) fail(`No school account for URN ${urn} -- the school must have signed up first.`);
  const name = (data as unknown as { schools: { current_name: string } | null }).schools?.current_name ?? urn;
  return { id: (data as { id: string }).id, name };
}

async function checkUrns(urns: string[]) {
  if (!urns.length) fail("Give at least one member URN.");
  const { data, error } = await supabase.from("schools").select("urn").in("urn", urns);
  if (error) fail(error.message);
  const found = new Set((data ?? []).map((r) => r.urn as string));
  const missing = urns.filter((u) => !found.has(u));
  if (missing.length) fail(`Unknown URNs: ${missing.join(", ")}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "list": {
      const { data, error } = await supabase
        .from("vc_comparator_sets")
        .select("id, name, vc_comparator_set_members(school_urn), vc_set_school_visibility(school_accounts(school_urn, schools(current_name)))")
        .order("created_at");
      if (error) fail(error.message);
      if (!data?.length) return console.log("No Victoria Consultancy sets yet.");
      for (const s of data as unknown as { id: string; name: string; vc_comparator_set_members: unknown[]; vc_set_school_visibility: { school_accounts: { school_urn: string; schools: { current_name: string } | null } | null }[] }[]) {
        const shown = s.vc_set_school_visibility.map((v) => `${v.school_accounts?.schools?.current_name ?? "?"} (${v.school_accounts?.school_urn})`);
        console.log(`${s.id}  ${s.name}  -- ${s.vc_comparator_set_members.length} schools; on for: ${shown.length ? shown.join(", ") : "no school yet"}`);
      }
      return;
    }
    case "create": {
      const [name, ...urns] = args;
      if (!name?.trim()) fail('Usage: create "<name>" <urn> [<urn> ...]');
      await checkUrns(urns);
      const { data, error } = await supabase.from("vc_comparator_sets").insert({ name: name.trim() }).select("id").single();
      if (error || !data) fail(error?.message ?? "Could not create the set.");
      const { error: mErr } = await supabase.from("vc_comparator_set_members").insert(urns.map((u) => ({ vc_set_id: data.id, school_urn: u })));
      if (mErr) fail(mErr.message);
      return console.log(`Created ${data.id}  "${name.trim()}"  with ${urns.length} schools. Switch it on for a school with: show <school-urn> ${data.id}`);
    }
    case "rename": {
      const [id, name] = args;
      if (!id || !name?.trim()) fail('Usage: rename <set-id> "<name>"');
      const { error } = await supabase.from("vc_comparator_sets").update({ name: name.trim(), updated_at: new Date().toISOString() }).eq("id", id);
      if (error) fail(error.message);
      return console.log(`Renamed ${id} to "${name.trim()}".`);
    }
    case "set-members": {
      const [id, ...urns] = args;
      if (!id) fail("Usage: set-members <set-id> <urn> [<urn> ...]");
      await checkUrns(urns);
      const { error: dErr } = await supabase.from("vc_comparator_set_members").delete().eq("vc_set_id", id);
      if (dErr) fail(dErr.message);
      const { error } = await supabase.from("vc_comparator_set_members").insert(urns.map((u) => ({ vc_set_id: id, school_urn: u })));
      if (error) fail(error.message);
      return console.log(`${id} now has ${urns.length} schools.`);
    }
    case "delete": {
      const [id] = args;
      if (!id) fail("Usage: delete <set-id>");
      const { error } = await supabase.from("vc_comparator_sets").delete().eq("id", id);
      if (error) fail(error.message);
      return console.log(`Deleted ${id} (and every school's switch for it).`);
    }
    case "show":
    case "hide": {
      const [urn, id] = args;
      if (!urn || !id) fail(`Usage: ${command} <school-urn> <set-id>`);
      const account = await schoolAccountFor(urn);
      if (command === "show") {
        const { error } = await supabase.from("vc_set_school_visibility").upsert({ school_account_id: account.id, vc_set_id: id });
        if (error) fail(error.message);
        return console.log(`Switched ON for ${account.name} (${urn}).`);
      }
      const { error } = await supabase.from("vc_set_school_visibility").delete().eq("school_account_id", account.id).eq("vc_set_id", id);
      if (error) fail(error.message);
      return console.log(`Switched OFF for ${account.name} (${urn}).`);
    }
    default:
      fail("Commands: list | create | rename | set-members | delete | show | hide  (see the header of this file)");
  }
}

void main();
