// Run: node --env-file=.env --env-file=.env.local --import tsx --test --test-force-exit src/lib/front-door/welcome-role.test.ts
// 0.8 beta (Guy, 21 Nov): the welcome in the person's role colour -- which role, and that every role's colours
// pass AA in Light, Mid and Dark. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { primaryRole, WELCOME_ROLE_ORDER, WELCOME_ROLES, welcomeRole } from "./welcome-role";
import { AA, contrast, welcomePairs, WELCOME_ROLE_KEYS } from "./contrast";
import { viewAsMembership } from "../view-as";

const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");
const member = (roles: string[], extra: { is_admin?: boolean; isAccountHolder?: boolean } = {}) => ({ roles, role: roles[0] ?? null, is_admin: extra.is_admin ?? false, isAccountHolder: extra.isAccountHolder ?? false });
const own = (m: ReturnType<typeof member>) => welcomeRole({ viewed: null, membership: m, headOffice: false });

test("welcome role: one role is that role", () => {
  assert.equal(own(member(["teacher"])), "teacher");
  assert.equal(own(member(["smt"])), "smt");
  assert.equal(own(member(["admissions"])), "admissions");
  assert.equal(own(member(["teacher"], { is_admin: true })), "school_admin", "a School-Admin holds Teacher too (memberships default to it)");
  assert.equal(own(member(["teacher"], { isAccountHolder: true })), "school_admin", "the account holder is the School-Admin");
  assert.equal(welcomeRole({ viewed: null, membership: null, headOffice: true }), "head_office", "head office, no school");
  assert.equal(welcomeRole({ viewed: null, membership: null, headOffice: false }), "teacher", "nothing known: the base role");
});

test("welcome role: several roles -- School-Admin, then the homes' order (SMT, Teacher, Admissions)", () => {
  assert.deepEqual(WELCOME_ROLE_ORDER, ["school_admin", "smt", "teacher", "admissions"]);
  assert.equal(own(member(["teacher", "smt"])), "smt");
  assert.equal(own(member(["admissions", "teacher"])), "teacher", "the homes open on Teacher before Admissions (initialLens)");
  assert.equal(own(member(["admissions", "smt", "teacher"])), "smt");
  assert.equal(own(member(["smt", "admissions"], { is_admin: true })), "school_admin");
  assert.equal(primaryRole({ roles: ["director_of_studies"], role: null }), "smt", "a legacy value, folded as the homes fold it");
  assert.equal(primaryRole({ roles: ["hod"], role: null }), "teacher", "a hidden role only: the base role");
  // A school membership wins over head office, as the home does (it sends to the group only without a school).
  assert.equal(welcomeRole({ viewed: null, membership: member(["admissions"]), headOffice: true }), "admissions");
});

test("welcome role: a platform admin's peek or View as is the viewed role's colour", () => {
  for (const r of ["teacher", "smt", "admissions", "school_admin"] as const) {
    assert.equal(welcomeRole({ viewed: r, membership: member(["smt"]), headOffice: false }), r);
    // And the membership View as stands for gives the same answer.
    assert.equal(own(member(viewAsMembership(r).roles, { is_admin: viewAsMembership(r).is_admin })), r, `${r}'s View as membership`);
  }
  assert.equal(welcomeRole({ viewed: "head_office", membership: member(["teacher"]), headOffice: false }), "head_office");
});

test("welcome role: each role's field, chip and words", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(WELCOME_ROLES).map(([k, v]) => [k, v.field])),
    { teacher: "gcse", smt: "top", admissions: "admissions", school_admin: "school_admin", head_office: "group" },
  );
  assert.equal(WELCOME_ROLES.smt.forWhom, "SMT", "Welcome to VicData for SMT");
  const src = readFileSync(path.join(__dirname, "../../components/front-door/first-visit.tsx"), "utf8");
  assert.match(src, /Welcome to VicData for <span[^>]*>\{r\.forWhom\}<\/span>/);
  assert.match(src, /data-welcome-role=\{role\}/);
  // Read the way the homes read it: pickMembership, the peek and View as helpers.
  assert.match(src, /pickMembership\(\(data \?\? \[\]\) as unknown as MembershipRow\[\]\)/);
  assert.match(src, /resolvePeek\(supabase\)/);
  assert.match(src, /resolveViewAsGroup\(supabase\)/);
});

test("welcome role: every role's colours pass AA in Light, Mid and Dark (R-THEME-CONTRAST)", () => {
  const rows = welcomePairs(css);
  assert.equal(rows.length, WELCOME_ROLE_KEYS.length * (2 * 5 + 2 + 4) + 5);
  for (const p of rows) {
    assert.match(p.fg ?? "", /^#[0-9a-f]{6}$/, `${p.name}: fg read from the stylesheet`);
    assert.match(p.bg ?? "", /^#[0-9a-f]{6}$/, `${p.name}: bg read from the stylesheet`);
    assert.ok(contrast(p.fg, p.bg) >= AA[p.kind], `${p.name}: ${p.fg} on ${p.bg} = ${contrast(p.fg, p.bg).toFixed(2)} < ${AA[p.kind]}`);
  }
});

test("welcome role: School-Admin's button is never a bright amber fill like Send feedback", () => {
  const fb = "#ffbf00";
  for (const sel of ['#teacher-root[data-theme="light"] [data-welcome-role="school_admin"]', '#teacher-root[data-theme="dark"]:not([data-pref="mid"]) [data-welcome-role="school_admin"]', '#teacher-root[data-pref="mid"] [data-welcome-role="school_admin"]']) {
    const m = css.replace(/\/\*[\s\S]*?\*\//g, "").match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
    const fill = m?.[1].match(/--wr-fill:\s*(#[0-9a-f]{6})/)?.[1];
    assert.ok(fill, sel);
    // Far darker than the pill (it carries white text, the pill dark text).
    assert.ok(contrast(fill!, fb) >= 3, `${sel}: ${fill} against the feedback amber`);
  }
});
