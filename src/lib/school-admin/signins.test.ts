// Run: npx -y tsx --test --test-force-exit src/lib/school-admin/signins.test.ts
// 0.8 front door part 3, milestone 3: the School-Admin's Sign-ins and devices (F27; its RLS is R-SIGNINS-RLS's PGlite
// suite) and Join requests with an exception (E25, R-JOIN-DOMAIN; the database's half is the same suite).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signinsRow, signinsView } from "./signins";
import { accountRows, type AccountSummary } from "./membership";
import { approvalUpdate, joinRequestWords } from "../join-exception";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const now = new Date("2026-11-21T12:00:00Z");
const h = (n: number) => new Date(now.getTime() - n * 3_600_000).toISOString();

test("R-SIGNINS-RLS: Sign-ins and devices lists each person's signed-in devices, flagged people first, then the most recently active", () => {
  const staff = [
    { profileId: "a", membershipId: "ma", name: "Ann", email: "ann@lp.com" },
    { profileId: "b", membershipId: "mb", name: "Ben", email: "ben@lp.com" },
    { profileId: "c", membershipId: "mc", name: "Cat", email: "cat@lp.com" },
  ];
  const dev = (p: string, label: string, last: number, out = false) => ({ profile_id: p, label, form: "desktop", place: "Reading, UK", signed_in_at: h(48), signed_out_at: out ? h(1) : null, last_active_at: h(last) });
  const devices = [dev("a", "Chrome on Mac", 3), dev("a", "Safari on iPhone", 1), dev("b", "Edge on Windows", 0.1), dev("c", "Old laptop", 0.5, true)];
  const events = ["Reading", "Leeds", "York", "Bath", "Hull"].map((place, i) => ({ profile_id: "c", place, at: h(i) }));
  const v = signinsView(staff, devices, events, now);
  assert.deepEqual(v.people.map((p) => p.name), ["Cat", "Ben", "Ann"], "Cat flagged first, then Ben (active 6 minutes ago), then Ann");
  assert.deepEqual(v.people[0].flaggedPlaces, ["Bath", "Hull", "Leeds", "Reading", "York"]);
  assert.equal(v.people[0].devices.length, 0, "a signed-out device isn't listed");
  assert.deepEqual(v.people[2].devices.map((d) => d.label), ["Safari on iPhone", "Chrome on Mac"]);
  assert.equal(v.devices, 3);
  assert.equal(v.flags, 1);
});

test("R-SIGNINS-RLS: the account page's Sign-ins and devices row, its badge only when someone is flagged, and the menu's count", () => {
  assert.deepEqual(signinsRow({ devices: 58, flags: 1 }), { summary: "58 devices · 1 flag", badge: "1 flag" });
  assert.deepEqual(signinsRow({ devices: 1, flags: 0 }), { summary: "1 device", badge: null });
  assert.deepEqual(signinsRow(null), { summary: "Not set up yet", badge: null });
  const base: AccountSummary = { school: { urn: "110110", name: "Leighton Park School" }, joinRequests: 0, people: 4, roles: 3, activeThisMonth: 2, teams: 1, schoolSets: 2, headOffice: null, membership: null, membershipNotSetUp: true, signIns: { devices: 7, flags: 1 } };
  const rows = accountRows(base, "2026-11-21");
  assert.deepEqual(rows.map((r) => r.id), ["join", "people", "teams", "sets", "signins", "membership"]);
  const row = rows.find((r) => r.id === "signins")!;
  assert.equal(row.href, "/teacher/school-account/sign-ins");
  assert.equal(row.badge, "1 flag");
  assert.match(src("src/components/school-admin/SchoolAccount.tsx"), /signins: \(/, "its padlock");
});

test("R-SIGNINS-RLS: the page reads with the caller's own client (RLS), signs out only the school's approved staff, and View as can't", () => {
  const route = src("src/app/api/school-admin/sign-ins/route.ts");
  assert.match(route, /readSchoolSignins\(c\.reader/);
  assert.match(route, /if \(c\.readOnly\) return NextResponse\.json\(\{ error: "View as is read-only/);
  assert.match(route, /\.eq\("status", "approved"\)\s*\.eq\("school_accounts\.school_urn", c\.urn\)/);
  assert.match(route, /signOutDevices\(store, devices, "admin"/);
});

test("R-JOIN-DOMAIN: Join requests -- an on-domain request is ordinary, an off-domain one is an Exception approved only as one", () => {
  assert.deepEqual(joinRequestWords({ offDomain: false, email: "new@lp.com" }), { tag: null, line: "school email matched", approve: "Approve as Teacher" });
  assert.deepEqual(joinRequestWords({ offDomain: true, email: "gov@gmail.com" }), { tag: "Exception", line: "gov@gmail.com · outside your school's email domains", approve: "Approve as an exception" });
  const at = new Date("2026-11-21T10:00:00Z");
  assert.deepEqual(approvalUpdate({ offDomain: false, byMembershipId: "m-admin", now: at }), { status: "approved", approved_at: at.toISOString(), approved_by: "m-admin" });
  assert.deepEqual(approvalUpdate({ offDomain: true, byMembershipId: "m-admin", now: at, extra: { roles: ["teacher"] } }), { status: "approved", approved_at: at.toISOString(), approved_by: "m-admin", roles: ["teacher"], exception_approved_at: at.toISOString(), exception_approved_by: "m-admin" });
  // Both approve paths use it, and People shows the domains and the tag.
  const people = src("src/components/admin/PeopleScreen.tsx");
  assert.match(people, /approvalUpdate\(\{ offDomain: !!m\.off_domain/);
  assert.match(people, /<JoinDomains school=\{school\}/);
  assert.match(people, /data-exception=""/);
  assert.match(src("src/app/account/page.tsx"), /approvalUpdate\(\{ offDomain: !!c\.off_domain/);
});
