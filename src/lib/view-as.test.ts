// Run: npx -y tsx --test src/lib/view-as.test.ts
// 0.6 snagging round 4: View as -- who may enter it, which school and role a page is for,
// where its state goes, and that its comparator sets stay its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseViewAsCookie,
  pickMembership,
  serializeViewAsCookie,
  VIEW_AS_COOKIE,
  viewAsForRequest,
  viewAsMembership,
  viewAsSetsKey,
  viewAsStateKey,
} from "./view-as";
import { visibleRolesOf } from "./roles";
import { deleteComparatorSet, readViewAsStore, saveComparatorSet, saveRanking } from "./teacher-view-saved-sets";

const cookie = (urn: string, role: string, name = "The Chase") => `${VIEW_AS_COOKIE}=${serializeViewAsCookie({ urn, role: role as "teacher", schoolName: name })}`;

test("the cookie round-trips and refuses anything malformed", () => {
  assert.deepEqual(parseViewAsCookie(`a=1; ${cookie("137625", "smt")}; b=2`), { urn: "137625", role: "smt", schoolName: "The Chase" });
  assert.equal(parseViewAsCookie(null), null);
  assert.equal(parseViewAsCookie("a=1"), null);
  assert.equal(parseViewAsCookie(cookie("137625", "finance")), null, "not a View as role");
  assert.equal(parseViewAsCookie(cookie("13'; drop", "teacher")), null, "not a URN");
  assert.equal(parseViewAsCookie(`${VIEW_AS_COOKIE}=%7Bnot json`), null);
});

// A per-request client whose caller is (or isn't) a platform admin.
const client = (admin: boolean | "error") =>
  ({ rpc: async (name: string) => (name === "is_platform_admin" ? (admin === "error" ? { data: null, error: { message: "x" } } : { data: admin, error: null }) : { data: null, error: null }) }) as unknown as SupabaseClient;
const req = (c?: string) => new Request("http://x/api/teacher/dashboard?urn=137625", { headers: c ? { cookie: c } : {} });

test("only a platform admin can be in View as (server side)", async () => {
  assert.deepEqual(await viewAsForRequest(client(true), req(cookie("137625", "teacher")), "137625"), { urn: "137625", role: "teacher", stateKey: "137625~trial~teacher" });
  assert.equal(await viewAsForRequest(client(false), req(cookie("137625", "teacher")), "137625"), null, "a planted cookie does nothing for anyone else");
  assert.equal(await viewAsForRequest(client("error"), req(cookie("137625", "teacher")), "137625"), null, "an error reads as no");
  assert.equal(await viewAsForRequest(client(true), req(cookie("137625", "teacher")), "100053"), null, "only for the school it names");
  assert.equal(await viewAsForRequest(client(true), req(), "137625"), null);
});

test("View as gets a real single-membership member's roles", () => {
  assert.deepEqual(visibleRolesOf(viewAsMembership("teacher")), ["teacher"]);
  assert.deepEqual(visibleRolesOf(viewAsMembership("smt")), ["smt"]);
  assert.deepEqual(visibleRolesOf(viewAsMembership("admissions")), ["admissions"]);
  // A School-Admin holds Teacher too (memberships default to it).
  assert.deepEqual(visibleRolesOf(viewAsMembership("school_admin")), ["teacher", "school_admin"]);
});

test("its state keys never equal a URN or each other", () => {
  const key = viewAsStateKey("100053", "teacher");
  assert.equal(key, "100053~trial~teacher");
  assert.notEqual(viewAsSetsKey(key), key);
  assert.notEqual(viewAsSetsKey(key), "100053");
  assert.notEqual(viewAsStateKey("100053", "smt"), key);
});

test("two memberships: the school shown, never the first row", () => {
  const rows = [
    { id: "b", approved_at: "2026-02-01", school_accounts: { school_urn: "137625" } },
    { id: "a", approved_at: "2026-01-01", school_accounts: { school_urn: "100053" } },
  ];
  assert.equal(pickMembership(rows, null)?.id, "a", "no choice: the earliest approved");
  assert.equal(pickMembership(rows, "137625")?.id, "b");
  assert.equal(pickMembership(rows, "999999")?.id, "a", "a school you're not a member of falls back");
  assert.equal(pickMembership([rows[0]], null)?.id, "b", "one membership: that one");
  assert.equal(pickMembership([], "137625"), null);
});

// A recording client: what a View as save writes, and where.
function recorder(uid = "guy") {
  const writes: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];
  const rows: { chart_key: string; body: string; school_urn: string }[] = [];
  const builder = (table: string) => {
    const w = { table, op: "select", payload: undefined as unknown, filters: [] as [string, unknown][] };
    const b = {
      select: () => b,
      insert: (p: unknown) => ((w.op = "insert"), (w.payload = p), b),
      upsert: (p: unknown) => ((w.op = "upsert"), (w.payload = p), b),
      update: (p: unknown) => ((w.op = "update"), (w.payload = p), b),
      delete: () => ((w.op = "delete"), b),
      eq: (c: string, v: unknown) => (w.filters.push([c, v]), b),
      single: () => b,
      then: (res: (r: unknown) => unknown) => {
        if (w.op !== "select") writes.push(w);
        if (w.op === "upsert") rows.push(w.payload as { chart_key: string; body: string; school_urn: string });
        const urn = w.filters.find(([c]) => c === "school_urn")?.[1];
        return Promise.resolve({ data: w.op === "select" ? rows.filter((r) => r.school_urn === urn) : null, error: null }).then(res);
      },
    };
    return b;
  };
  const supabase = { from: builder, auth: { getUser: async () => ({ data: { user: { id: uid } } }) } } as never;
  return { supabase, writes };
}

test("a comparator set saved in View as is the View as's own: never saved_sets", async () => {
  const { supabase, writes } = recorder();
  const viewAs = { stateKey: viewAsStateKey("100053", "teacher") };
  const r = await saveComparatorSet(supabase, { id: null, schoolAccountId: "acc", ownerMembershipId: "", name: "Rivals", urns: ["100050"], config: {}, viewAs });
  assert.ok("id" in r && r.id.startsWith("va-"));
  await saveRanking(supabase, { id: null, schoolAccountId: "acc", ownerMembershipId: "", name: "Top", phase: "ks4", filters: { sectors: [], gender: null, boarding: "any", qualification: null, scope: { kind: "nation", nation: "england" }, sizes: [] }, viewAs });
  assert.deepEqual([...new Set(writes.map((w) => w.table))], ["teacher_view_notes"]);
  for (const w of writes) assert.equal((w.payload as { school_urn: string }).school_urn, "100053~trial~teacher~sets");
  const store = await readViewAsStore(supabase as never, "guy", viewAs.stateKey);
  assert.deepEqual(store.sets.map((x) => x.name), ["Rivals"]);
  assert.deepEqual(store.rankings.map((x) => x.name), ["Top"]);
  await deleteComparatorSet(supabase, (r as { id: string }).id, viewAs);
  const del = writes.at(-1)!;
  assert.equal(del.table, "teacher_view_notes");
  assert.deepEqual(del.filters, [["profile_id", "guy"], ["school_urn", "100053~trial~teacher~sets"], ["chart_key", `set:${(r as { id: string }).id}`]]);
});

test("outside View as, sets still go to saved_sets as before", async () => {
  const { supabase, writes } = recorder();
  await saveComparatorSet(supabase, { id: null, schoolAccountId: "acc", ownerMembershipId: "m1", name: "Rivals", urns: [], config: {} });
  assert.equal(writes[0].table, "saved_sets");
});
