// Run: node --env-file=.env --env-file=.env.local --import tsx --test --test-force-exit src/lib/peek-admin-readonly.test.tsx
// R-PEEK-ADMIN-READONLY (review pack 22 Nov, issue 6): under a peek (or View as), People, Teams and the role homes
// show the VIEWED school, read-only. They used to ignore the peek and show the platform admin's own school with
// Invite, Add domain, Remove and New team all working. No write control renders live: every one is disabled.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { People } from "../components/admin/PeopleScreen";
import { Teams } from "../components/admin/TeamsScreen";
import { viewedAdminSchool } from "../components/admin/AdminChrome";
import { viewedAsSchoolAdmin } from "@/lib/view-as";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

// Leighton Park through ?lookAs=110110&as=school_admin&peek=1.
const school = viewedAdminSchool("admin-uid", { urn: "110110", role: "school_admin", schoolName: "110110" }, { name: "Leighton Park School", accountId: "acc-110110" });
const person = (id: string, status: string, roles: string[], is_admin = false) => ({ id, status, role: roles[0] ?? null, roles, job_title: null, is_admin, profiles: { email: `${id}@leightonpark.com`, full_name: id } });

/** Every <button> and <input> in the markup that is neither disabled nor read-only, as its text (or its aria-label). */
function liveControls(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(button|input|select|textarea)\b([^>]*)>([\s\S]*?)(?:<\/\1>|(?=<))/g)) {
    const attrs = m[2];
    if (/\s(disabled|readOnly|readonly)(=""|\s|>|$)/.test(attrs + ">")) continue;
    const label = /aria-label="([^"]*)"/.exec(attrs)?.[1] ?? m[3].replace(/<[^>]+>/g, "").trim();
    out.push(`${m[1]}:${label}`);
  }
  return out;
}

test("R-PEEK-ADMIN-READONLY: a peek's School-Admin screens are the viewed school, read-only", () => {
  assert.equal(school.schoolUrn, "110110");
  assert.equal(school.schoolName, "Leighton Park School");
  assert.equal(school.readOnly, true);
  assert.equal(school.canManage, true, "as School-Admin: the screens open (read-only)");
  assert.equal(viewedAdminSchool("u", { urn: "110110", role: "teacher", schoolName: "110110" }, null).canManage, false, "a Teacher peek isn't let in");
  // The read path serves View as and the peek, as School-Admin, and no one else.
  assert.equal(viewedAsSchoolAdmin({ access: "peek", viewAsRole: "school_admin" }), true);
  assert.equal(viewedAsSchoolAdmin({ access: "viewAs", viewAsRole: "school_admin" }), true);
  assert.equal(viewedAsSchoolAdmin({ access: "peek", viewAsRole: "smt" }), false);
  assert.equal(viewedAsSchoolAdmin({ access: "member", viewAsRole: null }), false);
  assert.match(src("app/api/teacher/view-as-people/route.ts"), /resolveCaller\(request, urn/);
  // loadAdminSchool reads the peek; the home treats it as View as and writes nothing.
  assert.match(src("components/admin/AdminChrome.tsx"), /getActiveViewAs\(\) \?\? \(await resolvePeek\(supabase\)\)/);
  const home = src("app/teacher/page.tsx");
  assert.match(home, /await resolvePeek\(supabase\)/);
  assert.match(home, /labelsUrn=\{peeking \? null : schoolUrn\}/);
});

test("R-PEEK-ADMIN-READONLY: no write control renders live on People under a peek", () => {
  const members = [person("asha", "pending_approval", []), person("ben", "approved", ["smt"], true), person("cara", "approved", ["teacher"])];
  const html = renderToStaticMarkup(createElement(People, { school, seed: { members } }));
  assert.match(html, /People at Leighton Park School/);
  assert.match(html, /nothing here is saved/);
  assert.match(html, /asha/, "the join request is drawn");
  // What stays live only looks: the filter chips, search, and opening a row's roles (themselves disabled).
  const live = liveControls(html).filter((c) => !/^button:(All|Teacher|SMT|Admissions|School-Admin|Waiting.*|Edit roles|Edit \w+|ben|cara|asha)\b/.test(c) && !/^input:/.test(c) && !/^button:\d/.test(c));
  assert.deepEqual(live, [], `live controls under a peek: ${live.join(", ")}`);
  assert.doesNotMatch(html, /data-admin-write=""(?![^>]*disabled)/, "Invite is off");
  assert.doesNotMatch(html, /Add domain|>Add</, "Join domains (Add, Remove) isn't drawn");
  // Approve and Decline are drawn, and disabled.
  for (const m of html.matchAll(/<button\b([^>]*)>(Approve|Decline)[^<]*<\/button>/g)) assert.match(m[1], /disabled/);
});

test("R-PEEK-ADMIN-READONLY: no write control renders live on Teams under a peek, with a team open", () => {
  const members = [person("ben", "approved", ["smt"]), person("cara", "approved", ["teacher"])];
  const teams = [{ id: "t1", name: "Sixth form", auto_key: null, created_at: "2026-11-01T00:00:00Z", team_members: [{ membership_id: "ben" }] }];
  const html = renderToStaticMarkup(createElement(Teams, { school, seed: { teams, members, openId: "t1" } }));
  assert.match(html, /Sixth form/);
  const writes = liveControls(html).filter((c) => /New team|Delete team|Remove .* from team|Add people|input:/.test(c));
  assert.deepEqual(writes, [], `live write controls under a peek: ${writes.join(", ")}`);
  assert.match(html, /Add people[^<]*·|Add people &middot;|Add people ·/);
});
