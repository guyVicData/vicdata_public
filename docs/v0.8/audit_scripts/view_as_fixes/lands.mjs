// VicData 0.8 View as fixes: the browser tests, against the local production build pointing at the real
// app database (read-only; see harness.mjs and server-preload.mjs). From the repo root:
//   npx next build
//   ACCESS_GATE_ENABLED=false NODE_OPTIONS="--import ./docs/v0.8/audit_scripts/view_as_fixes/server-preload.mjs" npx next start -p 3410
//   node docs/v0.8/audit_scripts/view_as_fixes/lands.mjs            (BASE=http://127.0.0.1:3410, OUT=<screenshots dir>)
// Every is_platform_admin the browser asks takes 300 ms (ADMIN_MS), as it does from a browser to the live
// database: long enough for the navigation after "Open their home page" to cancel it, which is what
// sent Guy to his own school (18 Oct).
//   R-VIEW-AS-LANDS            every entry point lands on the chosen school and role, every time
//   R-VIEW-AS-TRANSIENT        an is_platform_admin error keeps View as and shows Retry
//   R-VIEW-AS-ANY-GROUP        head office of Harris and Dukes (no group account) opens read-only
//   R-PLATFORM-NO-MEMBERSHIP   Back to me goes to /platform for an admin with no membership
import { mkdirSync } from "node:fs";
import { harness, BASE, decode } from "./harness.mjs";

const OUT = process.env.OUT ?? "docs/v0.8/view_as_screenshots_fixes";
const ADMIN_MS = Number(process.env.ADMIN_MS ?? 300);
mkdirSync(OUT, { recursive: true });
const results = [];
const pass = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` -- ${detail}`}`);
};

const LEIGHTON = { urn: "110110", name: "Leighton Park School" };
const CHASE = { urn: "137625", name: "The Chase" };
const ROLE = { teacher: "Teacher", smt: "SMT", admissions: "Admissions", school_admin: "School-Admin" };
// The Platform page's list (its RPC re-checks platform admin, which the stub session can't pass).
const PLATFORM_ROWS = [LEIGHTON, CHASE].map((s) => ({ school_urn: s.urn, school_name: s.name, establishment_type_group: null, establishment_type: null, members: 0, roles_in_use: [], has_admins: false, vc_sets_visible: 0, vc_sets_total: 0, school_admin_name: null, last_active: null }));
const supa = async (route, req, url) => {
  if (url.pathname === "/rest/v1/rpc/platform_school_overview") {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PLATFORM_ROWS) });
    return true;
  }
  return undefined;
};

async function session(opts = {}) {
  const h = await harness({ adminDelayMs: ADMIN_MS, supa, ...opts });
  h.page.on("pageerror", (e) => console.log("  page error:", e.message.slice(0, 160)));
  return h;
}

// Landed on /teacher as `role` at `school`: the address, the cookie, the banner and the page's school.
async function landed(h, school, role, shot) {
  const { page } = h;
  await page.waitForURL((u) => new URL(u).pathname === "/teacher", { timeout: 30000 });
  const label = `Viewing as ${ROLE[role]} · ${school.name}`;
  await page.locator("[data-view-as-banner]", { hasText: label }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.locator("main p.mt-0\\.5").first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const cookie = decode(await h.cookie());
  const banner = await page.locator("[data-view-as-banner]").first().textContent({ timeout: 2000 }).catch(() => null);
  const shown = await page.locator("main p.mt-0\\.5").first().textContent({ timeout: 2000 }).catch(() => null);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png` });
  const ok = cookie?.u === school.urn && cookie?.r === role && (banner ?? "").includes(label) && shown === school.name;
  return { ok, detail: `cookie ${JSON.stringify(cookie)}, banner ${JSON.stringify(banner)}, school ${JSON.stringify(shown)}` };
}

async function pick(panel, page, school, role) {
  await panel.locator("input[aria-label='Search for a school']").fill(school.name.split(" ").slice(0, 2).join(" "));
  await panel.locator("button", { hasText: school.name }).first().click({ timeout: 20000 });
  await panel.locator("[role=group][aria-label=Role] button", { hasText: new RegExp(`^${ROLE[role]}`) }).first().click();
}
// Some pages draw the nav twice (wide and narrow); the visible one.
const popover = (page) => page.locator("[data-view-as-pill] [data-view-as-panel]").filter({ visible: true }).first();

// ------------------------------------------------------------------ R-VIEW-AS-LANDS

{
  // 1. The account card, Guy's flow: Leighton Park, SMT, Open their home page; then the SMT dashboards.
  const h = await session();
  const { page } = h;
  await page.goto(`${BASE}/account`);
  const card = page.locator("#view-as [data-view-as-panel]");
  await card.waitFor({ timeout: 30000 });
  await pick(card, page, LEIGHTON, "smt");
  await card.locator("button", { hasText: "Open their home page" }).click();
  const r = await landed(h, LEIGHTON, "smt", "01_account_card_leighton_smt");
  pass("R-VIEW-AS-LANDS: the account card (Leighton Park, SMT)", r.ok, r.detail);

  await page.goto(`${BASE}/teacher/smt`);
  await page.locator("[data-view-as-banner]", { hasText: "SMT · Leighton Park School" }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/02_smt_dashboards_leighton.png` });
  const smtBanner = await page.locator("[data-view-as-banner]").first().textContent({ timeout: 2000 }).catch(() => "");
  pass("R-VIEW-AS-LANDS: then the SMT dashboards, still Leighton Park as SMT", smtBanner.includes("SMT · Leighton Park School") && decode(await h.cookie())?.u === LEIGHTON.urn, smtBanner);

  // 2. The banner's Change: the switcher opens pre-filled; pick Teacher, open.
  await page.locator("[data-view-as-change]").filter({ visible: true }).first().click();
  const pop = popover(page);
  await pop.waitFor({ timeout: 10000 });
  const prefilled = await pop.textContent();
  await pop.locator("[role=group][aria-label=Role] button", { hasText: /^Teacher/ }).first().click();
  await pop.locator("button", { hasText: "Open their home page" }).click();
  const c = await landed(h, LEIGHTON, "teacher", "03_banner_change_leighton_teacher");
  pass("R-VIEW-AS-LANDS: the banner's Change (pre-filled, Leighton Park, Teacher)", c.ok && prefilled.includes("Leighton Park School"), c.detail);

  // 3. The nav pill's popover: a recent View as, Open (The Chase, Admissions).
  await page.locator("[data-view-as-pill] > button").filter({ visible: true }).first().click();
  await popover(page).waitFor({ timeout: 10000 });
  const row = popover(page).locator("li", { hasText: "The Chase" }).filter({ hasText: "Admissions" }).first();
  await row.locator("button", { hasText: /^Open$/ }).click();
  const p = await landed(h, CHASE, "admissions", "04_pill_recent_chase_admissions");
  pass("R-VIEW-AS-LANDS: the nav pill's popover, a recent View as (The Chase, Admissions)", p.ok, p.detail);

  // 4. A recent View as's Start fresh, from the popover (Leighton Park, SMT).
  await page.locator("[data-view-as-pill] > button").filter({ visible: true }).first().click();
  await popover(page).waitFor({ timeout: 10000 });
  const row2 = popover(page).locator("li", { hasText: "Leighton Park School" }).filter({ hasText: "SMT" }).first();
  await row2.locator("button", { hasText: "Start fresh" }).click();
  const f = await landed(h, LEIGHTON, "smt", "05_start_fresh_leighton_smt");
  pass("R-VIEW-AS-LANDS: Start fresh (Leighton Park, SMT)", f.ok && h.writes.some((w) => /reset_trial/.test(w)), f.detail);
  await h.browser.close();
}

{
  // 5. The recent links on the account card (Guy's (b)): each lands on its own school, not his.
  const h = await session();
  const { page } = h;
  for (const [school, role, shot] of [[CHASE, "admissions", "06_account_recent_chase_admissions"], [LEIGHTON, "smt", "07_account_recent_leighton_smt"]]) {
    await page.goto(`${BASE}/account`);
    const card = page.locator("#view-as [data-view-as-panel]");
    await card.waitFor({ timeout: 30000 });
    const row = card.locator("li", { hasText: school.name }).filter({ hasText: ROLE[role] }).first();
    await row.waitFor({ timeout: 20000 });
    await row.locator("button", { hasText: /^Open$/ }).click();
    const r = await landed(h, school, role, shot);
    pass(`R-VIEW-AS-LANDS: a Recently viewed as link on the account card (${school.name}, ${ROLE[role]})`, r.ok, r.detail);
  }
  await h.browser.close();
}

{
  // 6. The account menu's "View as…" (the nav popover), from a member page. 7. Platform's pre-fill.
  const h = await session();
  const { page } = h;
  await page.goto(`${BASE}/teacher`);
  await page.locator("button[aria-label=Account]").filter({ visible: true }).first().click();
  await page.locator("[data-view-as-open]").filter({ visible: true }).first().click();
  const pop = popover(page);
  await pop.waitFor({ timeout: 10000 });
  await pick(pop, page, CHASE, "school_admin");
  await pop.locator("button", { hasText: "Open their home page" }).click();
  const m = await landed(h, CHASE, "school_admin", "08_account_menu_chase_school_admin");
  pass("R-VIEW-AS-LANDS: the account menu's View as… (The Chase, School-Admin)", m.ok, m.detail);

  await page.goto(`${BASE}/platform`);
  await page.locator("tr, button", { hasText: LEIGHTON.name }).first().click({ timeout: 30000 });
  await page.locator("aside button", { hasText: /^Admissions$/ }).first().click();
  const pre = popover(page);
  await pre.waitFor({ timeout: 10000 });
  const filled = await pre.textContent();
  await pre.locator("button", { hasText: "Open their home page" }).click();
  const pl = await landed(h, LEIGHTON, "admissions", "09_platform_prefill_leighton_admissions");
  pass("R-VIEW-AS-LANDS: Platform's pre-fill (Leighton Park, Admissions)", pl.ok && filled.includes("Leighton Park School"), pl.detail);
  await h.browser.close();
}

// ------------------------------------------------------------------ R-VIEW-AS-TRANSIENT

{
  // Start Leighton Park as SMT, then reload with every is_platform_admin failing: View as stays, Retry shows.
  let failing = false;
  const h = await session({ admin: () => (failing ? "error" : "ok") });
  const { page } = h;
  await page.goto(`${BASE}/account`);
  const card = page.locator("#view-as [data-view-as-panel]");
  await card.waitFor({ timeout: 30000 });
  await pick(card, page, LEIGHTON, "smt");
  await card.locator("button", { hasText: "Open their home page" }).click();
  await landed(h, LEIGHTON, "smt");
  failing = true;
  await page.reload();
  await page.locator("[data-view-as-retry]").first().waitFor({ timeout: 30000 }).catch(() => {});
  const r = await landed(h, LEIGHTON, "smt", "10_transient_error_keeps_view_as");
  const retry = await page.locator("[data-view-as-retry]").count();
  pass("R-VIEW-AS-TRANSIENT: an is_platform_admin error keeps View as (Leighton Park, SMT) and shows Retry", r.ok && retry > 0, `${r.detail}, retry buttons ${retry}`);
  failing = false;
  await page.locator("[data-view-as-retry]").first().click();
  await page.waitForTimeout(3000);
  const after = await page.locator("[data-view-as-retry]").count();
  pass("R-VIEW-AS-TRANSIENT: Retry reloads; once answered, no Retry", after === 0 && decode(await h.cookie())?.u === LEIGHTON.urn);
  await h.browser.close();
}

// ------------------------------------------------------------------ R-PLATFORM-NO-MEMBERSHIP

{
  // After the migration: no membership. Back to me goes to Platform.
  const h = await session({ memberships: [] });
  const { page } = h;
  await page.goto(`${BASE}/account`);
  const card = page.locator("#view-as [data-view-as-panel]");
  await card.waitFor({ timeout: 30000 });
  await pick(card, page, LEIGHTON, "smt");
  await card.locator("button", { hasText: "Open their home page" }).click();
  await landed(h, LEIGHTON, "smt");
  await page.locator("[data-view-as-banner] button", { hasText: "Back to me" }).first().click();
  await page.waitForURL(/\/platform/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/11_back_to_me_platform.png` });
  pass("R-PLATFORM-NO-MEMBERSHIP: Back to me goes to /platform", new URL(page.url()).pathname === "/platform" && !(await h.cookie()), page.url());
  // /teacher, with nothing to show, sends a platform admin to Platform too.
  await page.goto(`${BASE}/teacher`);
  await page.waitForURL(/\/platform/, { timeout: 30000 }).catch(() => {});
  pass("R-PLATFORM-NO-MEMBERSHIP: /teacher with no membership goes to /platform", new URL(page.url()).pathname === "/platform", page.url());
  await h.browser.close();
}
{
  // Before the migration (a membership at Acland Burghley): Back to me is the admin's own school, as a member.
  const h = await session();
  const { page } = h;
  await page.goto(`${BASE}/account`);
  const card = page.locator("#view-as [data-view-as-panel]");
  await card.waitFor({ timeout: 30000 });
  await pick(card, page, CHASE, "teacher");
  await card.locator("button", { hasText: "Open their home page" }).click();
  await landed(h, CHASE, "teacher");
  await page.locator("[data-view-as-banner] button", { hasText: "Back to me" }).first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/teacher", { timeout: 30000 });
  await page.waitForTimeout(2500);
  const shown = await page.locator("main p.mt-0\\.5").first().textContent({ timeout: 5000 }).catch(() => null);
  pass("R-PLATFORM-NO-MEMBERSHIP: with a membership, Back to me is the admin's own home", shown === "Acland Burghley School" && !(await h.cookie()), String(shown));
  await h.browser.close();
}

// ------------------------------------------------------------------ R-VIEW-AS-ANY-GROUP

for (const [query, name, shot] of [["Harris Federation", "Harris Federation", "12_head_office_harris_no_account"], ["Dukes", "Dukes Education", "14_head_office_dukes_no_account"]]) {
  const h = await session();
  const { page } = h;
  await page.goto(`${BASE}/account`);
  const card = page.locator("#view-as [data-view-as-panel]");
  await card.waitFor({ timeout: 30000 });
  await card.locator("[data-view-as-role=head_office]").click();
  await card.locator("[data-view-as-group-search]").fill(query);
  const hit = card.locator("[data-view-as-group]", { hasText: name }).first();
  await hit.waitFor({ timeout: 120000 });
  const line = await hit.locator("xpath=..").textContent();
  await hit.click();
  await card.locator("button", { hasText: "Open its head-office home" }).click();
  await page.waitForURL(/\/teacher\/group/, { timeout: 30000 });
  await page.locator("[data-group-no-account]").first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
  const noAccount = await page.locator("[data-group-no-account]").count();
  const banner = await page.locator("[data-view-as-banner]").first().textContent({ timeout: 2000 }).catch(() => "");
  // The Access card (its title exactly; the no-account line itself mentions Access).
  const access = await page.getByText("Access", { exact: true }).count();
  const cookie = decode(await h.cookie());
  pass(`R-VIEW-AS-ANY-GROUP: head office of ${name} (no group account) opens, says so, read-only, no Access`, noAccount > 0 && /no account yet/.test(line ?? "") && banner.includes(`Head office · ${name}`) && banner.includes("read-only") && cookie?.g?.startsWith("group:") && access === 0, `line ${JSON.stringify(line)}, banner ${JSON.stringify(banner)}, cookie ${JSON.stringify(cookie)}, access ${access}`);
  // Its dashboards, from the group lookups.
  const chip = page.locator("[data-group-dash]").first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForURL(/\/teacher\/group\/overview/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${OUT}/${shot.replace(/^(\d+)/, (n) => String(Number(n) + 1).padStart(2, "0")).replace("no_account", "overview")}.png`, fullPage: true });
    const err = await page.locator("text=/Not found|Could not build/").count();
    pass(`R-VIEW-AS-ANY-GROUP: ${name}'s Overview dashboard draws`, err === 0 && new URL(page.url()).pathname === "/teacher/group/overview", page.url());
  } else pass(`R-VIEW-AS-ANY-GROUP: ${name}'s Overview dashboard draws`, false, "no dashboard chips");
  await h.browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
