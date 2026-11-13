// Run: npx -y tsx --test --test-force-exit src/lib/school-admin/membership.test.ts
// VicData 0.8 front door, part 2 (F26, F28-F29): the membership page's states from the record (R-MEMBERSHIP)
// and the account page's waiting items and the account menu's badge (R-ADMIN-BADGE). The tables' RLS and
// "no card number column" are proved in PGlite (supabase/tests/v08_front_door_r2_membership_pglite.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountRows, membershipView, needsCard, PAYMENTS_LATER, phasesWords, priceWords, showAdminBadge, waitingCount, type AccountSummary, type MembershipRecord, type Plan } from "./membership";

const secondary: Plan = { code: "secondary", name: "School membership", appliesTo: "secondary", priceMonthPence: 1000, priceYearPence: 12000, perSchoolMonthPence: null, pilotMonths: 6 };
const primary: Plan = { code: "primary", name: "Primary membership", appliesTo: "primary", priceMonthPence: 500, priceYearPence: 6000, perSchoolMonthPence: null, pilotMonths: 6 };
const rec = (o: Partial<MembershipRecord> = {}): MembershipRecord => ({
  status: "pilot",
  plan: secondary,
  joinedOn: "2027-01-01",
  pilotEndsOn: "2027-06-30",
  renewsOn: "2027-07-01",
  autoRenew: true,
  coveredBy: null,
  billingContactName: "Bursar",
  billingContactEmail: "bursar@school.example",
  purchaseOrder: null,
  invoiceAddress: "1 School Lane",
  card: null,
  invoices: [],
  ...o,
});
const opts = { phases: "GCSE and Post-16", today: "2027-02-01" };

test("R-MEMBERSHIP: prices -- secondary £10 a month (£120 a year), primary £5 (£60)", () => {
  assert.deepEqual(priceWords(secondary), { month: "£10 a month", year: "£120 a year, billed annually" });
  assert.deepEqual(priceWords(primary), { month: "£5 a month", year: "£60 a year, billed annually" });
  assert.equal(phasesWords(11, 18), "GCSE and Post-16");
  assert.equal(phasesWords(3, 11), "Key stage 2");
  assert.equal(phasesWords(4, 18), "Key stage 2, GCSE and Post-16");
});

test("R-MEMBERSHIP: a pilot school -- free for 6 months until the date, the price it will be; from month 4 without a card, add one", () => {
  const v = membershipView(rec(), opts);
  assert.equal(v.banner?.title, "Pilot · free for 6 months, until 30 Jun 2027");
  assert.match(v.banner!.body, /£10 a month \(£120 a year\)/);
  assert.equal(v.addCard, null, "month 2: not yet");
  assert.equal(needsCard(rec(), "2027-03-31"), false);
  assert.equal(needsCard(rec(), "2027-04-01"), true, "month 4");
  assert.equal(membershipView(rec(), { ...opts, today: "2027-04-02" }).addCard, "Add a card to keep VicData after 30 Jun 2027");
  assert.equal(needsCard(rec({ card: { brand: "Visa", last4: "4417", expMonth: 8, expYear: 2029 } }), "2027-05-01"), false, "a card on file: nothing to add");
  assert.deepEqual(v.included, ["Unlimited staff", "GCSE and Post-16", "SMT, Admissions and Teacher dashboards", "Walkthroughs, sets and meetings"]);
  assert.equal(v.billing?.card, "No card yet");
  assert.equal(v.billing?.purchaseOrder, "Optional, printed on the invoice");
});

test("R-MEMBERSHIP: an active school -- renewal date, renews automatically, the amount and the card, the reminders", () => {
  const v = membershipView(rec({ status: "active", pilotEndsOn: null, renewsOn: "2028-07-01", card: { brand: "Visa", last4: "4417", expMonth: 8, expYear: 2029 }, invoices: [{ periodStart: "2027-07-01", periodEnd: "2028-07-01", amountPence: 12000, status: "paid", pdf: false }, { periodStart: "2027-01-01", periodEnd: "2027-06-30", amountPence: 0, status: "free", pdf: false }] }), opts);
  assert.equal(v.banner, null);
  assert.deepEqual(v.renewal, { date: "1 Jul 2028", auto: "renews automatically", charge: "£120 will be charged to Visa ending 4417.", reminders: "We'll email the billing contact 14 days and 3 days before." });
  assert.equal(v.billing?.card, "Visa ending 4417 · expires 08/29");
  assert.deepEqual(v.invoices.map((i) => [i.period, i.amount, i.status]), [["Jul 2027 – Jul 2028", "£120.00", "Paid"], ["Jan 2027 – Jun 2027", "£0.00", "Free"]]);
});

test("R-MEMBERSHIP: a primary school, a school covered by its group, a lapsed school", () => {
  const p = membershipView(rec({ plan: primary }), { ...opts, phases: "Key stage 2" });
  assert.equal(p.planName, "Primary membership");
  assert.equal(p.price.month, "£5 a month");
  assert.match(p.planLine, /^Primary school/);
  const c = membershipView(rec({ status: "covered_by_group", coveredBy: { name: "Harris Federation", billingContactName: "Finance", billingContactEmail: "finance@harris.example" } }), opts);
  assert.equal(c.banner?.title, "Covered by Harris Federation");
  assert.equal(c.renewal, null, "no billing here");
  assert.equal(c.billing, null);
  assert.equal(c.coveredContact, "Finance · finance@harris.example", "the group's billing contact");
  assert.deepEqual(c.actions, [], "no payment actions for a covered school");
  const l = membershipView(rec({ status: "lapsed", renewsOn: "2027-07-01" }), opts);
  assert.equal(l.banner?.title, "Lapsed on 1 Jul 2027");
  assert.equal(l.renewal?.auto, "lapsed");
});

test("R-MEMBERSHIP: payment actions are visible but disabled, saying why", () => {
  const v = membershipView(rec(), opts);
  assert.deepEqual(v.actions.map((a) => a.label), ["Add a card", "Cancel renewal", "Invoice PDFs"]);
  assert.ok(v.actions.every((a) => a.disabled && a.why === PAYMENTS_LATER && PAYMENTS_LATER === "Coming before the pilot ends"));
  assert.equal(membershipView(rec({ card: { brand: "Visa", last4: "4417", expMonth: null, expYear: null } }), opts).actions[0].label, "Update card");
  const page = readFileSync(new URL("../../components/school-admin/SchoolAccount.tsx", import.meta.url), "utf8");
  assert.match(page, /disabled aria-disabled="true" title=\{why\}/, "the buttons are disabled with their reason");
  assert.doesNotMatch(page, /card_?number|cardNumber/i, "the page never asks for a card number");
});

const summary = (o: Partial<AccountSummary> = {}): AccountSummary => ({ school: { urn: "110110", name: "Leighton Park School" }, joinRequests: 0, people: 42, roles: 4, activeThisMonth: 31, teams: 6, schoolSets: 5, headOffice: null, membership: rec(), membershipNotSetUp: false, ...o });

test("R-ADMIN-BADGE: the account page's rows, and what waits on them", () => {
  const rows = accountRows(summary({ joinRequests: 3 }), "2027-02-01");
  assert.deepEqual(rows.map((r) => r.id), ["join", "people", "teams", "sets", "membership"], "no head office row without a group; no Sign-ins row (Part 3)");
  assert.equal(rows[0].badge, "3 new");
  assert.equal(rows[1].summary, "42 people · 4 roles");
  assert.equal(rows[4].summary, "Pilot · free until 30 Jun 2027");
  assert.equal(waitingCount(rows), 3);
  assert.equal(waitingCount(accountRows(summary(), "2027-02-01")), 0, "nothing waiting");
  assert.equal(waitingCount(accountRows(summary(), "2027-04-15")), 1, "a pilot's card from month 4");
  const ho = accountRows(summary({ headOffice: { name: "Harris Federation", groupView: true, admissionsShared: false } }), "2027-02-01");
  assert.deepEqual(ho.map((r) => r.id), ["join", "people", "teams", "sets", "head_office", "membership"]);
  assert.equal(ho.find((r) => r.id === "head_office")!.href, "/teacher/school-account/head-office");
});

test("R-ADMIN-BADGE: the account menu shows the badge exactly when something waits, and only to a School-Admin", () => {
  assert.equal(showAdminBadge({ isSchoolAdmin: true, waiting: 3 }), true);
  assert.equal(showAdminBadge({ isSchoolAdmin: true, waiting: 0 }), false);
  assert.equal(showAdminBadge({ isSchoolAdmin: false, waiting: 3 }), false);
  const nav = readFileSync(new URL("../../components/shell/TeacherNav.tsx", import.meta.url), "utf8");
  assert.match(nav, /if \(school\.status === "ready" && school\.school\.canManage\) \{\s*const r = await fetch\(`\/api\/school-admin\/account\?urn=/, "asked only for a School-Admin (canManage)");
  assert.match(nav, /setWaiting\(w && showAdminBadge\(w\) \? w\.waiting : 0\)/, "the shared rule decides");
  assert.match(nav, /\{canManage && waiting > 0 && \(\s*<span data-admin-menu-badge/, "drawn only when something waits");
  const route = readFileSync(new URL("../../app/api/school-admin/account/route.ts", import.meta.url), "utf8");
  assert.match(route, /isSchoolAdmin: false, waiting: 0/, "anyone else: no badge");
  assert.match(route, /const waiting = waitingCount\(rows\)/, "the menu's number is the page's own rows");
});
