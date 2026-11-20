// Run: npx -y tsx --test --test-force-exit src/lib/school-admin/account-waiting.test.ts
// Speed (20 Nov): the account menu's badge reads only what can carry a badge (readAccountWaiting) -- this proves
// its number is the account page's own (readAccountSummary's rows, counted the same way) for the same school, and
// that the menus drawn together on one page share one request (the fetch cache).
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

type Row = Record<string, unknown>;

/** A stand-in for the caller's reader: eq filters, maybeSingle, and head counts, over plain rows. */
function fakeReader(tables: Record<string, Row[]>) {
  const calls: string[] = [];
  const from = (table: string) => {
    calls.push(table);
    const filters: [string, unknown][] = [];
    let head = false;
    const rows = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const q = {
      select: (_cols: string, o?: { count?: string; head?: boolean }) => ((head = !!o?.head), q),
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      is: () => q,
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(head ? { data: null, count: rows().length, error: null } : { data: rows(), count: null, error: null }).then(ok, bad),
    };
    return q;
  };
  return { reader: { from } as never, calls };
}

const plan = { code: "secondary", name: "School membership", applies_to: "secondary", price_month_pence: 1000, price_year_pence: 12000, per_school_month_pence: null, pilot_months: 6 };
const record = (o: Row = {}): Row => ({ id: "m1", school_account_id: "acc1", status: "pilot", joined_on: "2027-01-01", pilot_ends_on: "2027-06-30", renews_on: "2027-07-01", auto_renew: true, covered_by_group_account_id: null, billing_contact_name: null, billing_contact_email: null, purchase_order: null, invoice_address: null, card_brand: null, card_last4: null, card_exp_month: null, card_exp_year: null, membership_plans: plan, membership_invoices: [], ...o });
const member = (id: string, status: string): Row => ({ id, school_account_id: "acc1", status, roles: ["teacher"], is_admin: false });

const scenarios: { name: string; tables: Record<string, Row[]>; today: string; want: number }[] = [
  { name: "no account", tables: {}, today: "2027-02-01", want: 0 },
  { name: "nothing waiting", tables: { school_accounts: [{ id: "acc1", school_urn: "110110" }], school_memberships: [member("a", "approved")], account_memberships: [record()] }, today: "2027-02-01", want: 0 },
  { name: "3 join requests", tables: { school_accounts: [{ id: "acc1", school_urn: "110110" }], school_memberships: [member("a", "approved"), member("b", "pending_approval"), member("c", "pending_approval"), member("d", "pending_approval")], account_memberships: [record()] }, today: "2027-02-01", want: 3 },
  { name: "a pilot's card from month 4, and a request", tables: { school_accounts: [{ id: "acc1", school_urn: "110110" }], school_memberships: [member("b", "pending_approval")], account_memberships: [record()] }, today: "2027-04-15", want: 2 },
  { name: "a card on file", tables: { school_accounts: [{ id: "acc1", school_urn: "110110" }], school_memberships: [], account_memberships: [record({ card_brand: "Visa", card_last4: "4417" })] }, today: "2027-04-15", want: 0 },
  { name: "active, not a pilot", tables: { school_accounts: [{ id: "acc1", school_urn: "110110" }], school_memberships: [], account_memberships: [record({ status: "active" })] }, today: "2027-04-15", want: 0 },
  { name: "a record without its plan", tables: { school_accounts: [{ id: "acc1", school_urn: "110110" }], school_memberships: [], account_memberships: [record({ membership_plans: null })] }, today: "2027-04-15", want: 0 },
];

test("speed (20 Nov): the badge's count-only read gives the account page's own number", async () => {
  const { readAccountSummary, readAccountWaiting } = await import("./account-server");
  const { accountRows, waitingCount } = await import("./membership");
  // The full summary's service-role reads (usage, head office): nothing there.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    for (const s of scenarios) {
      const full = waitingCount(accountRows(await readAccountSummary(fakeReader(s.tables).reader, { urn: "110110", today: s.today }), s.today));
      const lean = fakeReader(s.tables);
      const fast = waitingCount(accountRows(await readAccountWaiting(lean.reader, { urn: "110110" }), s.today));
      assert.equal(full, s.want, `${s.name}: the page`);
      assert.equal(fast, full, `${s.name}: the badge is the page's number`);
      assert.ok(lean.calls.every((t) => ["school_accounts", "school_memberships", "account_memberships"].includes(t)), `${s.name}: no other reads (${lean.calls})`);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("speed (20 Nov): two menus asking at once share one request; a later page asks again; errors aren't kept", async () => {
  const { cachedFetchJson } = await import("../fetch-cache");
  const realFetch = globalThis.fetch;
  let n = 0;
  let status = 200;
  globalThis.fetch = (async () => (n++, new Response(JSON.stringify({ isSchoolAdmin: true, waiting: 2 }), { status }))) as typeof fetch;
  const token = "t-badge";
  const url = "/api/school-admin/account?urn=110110&waiting=1";
  try {
    const [a, b] = await Promise.all([cachedFetchJson(url, { token, ttlMs: 10_000 }), cachedFetchJson(url, { token, ttlMs: 10_000 })]);
    assert.equal(n, 1, "desktop and phone menus: one request");
    assert.deepEqual(a.body, { isSchoolAdmin: true, waiting: 2 });
    assert.equal(a, b, "the same answer");
    await cachedFetchJson(url, { token, ttlMs: 0 });
    assert.equal(n, 2, "past the window: asked again");
    status = 500;
    await cachedFetchJson("/api/front-door/teacher?urn=1&phase=ks4&ticked=", { token });
    await cachedFetchJson("/api/front-door/teacher?urn=1&phase=ks4&ticked=", { token });
    assert.equal(n, 4, "a failed answer is never shared: Try again asks the route");
  } finally {
    globalThis.fetch = realFetch;
  }
});
