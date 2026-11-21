// Warm vicdata.co.uk for a demo, and time it (speed plan §3.1, docs/v0.8/speed_plan_v1.md).
//
// Every deploy restarts the server, and the first visit to a school after a restart pays the national loads
// (populations, the IGCSE list, England's figures): 6-10 s where a warm page takes under 2 s. This opens the
// pages a demo shows, ONE AT A TIME in a headless browser, so the server's caches hold their answers -- and
// prints how long each took. One at a time on purpose: a parallel warm-up (bc6d8b0, reverted) broke the next
// request. National values are kept 12 hours (server-cache.ts NATIONAL_TTL_MS), a school's own for 1, so run it
// after the last deploy and again within the hour before the demo.
//
// It signs in through the preview route and looks at the school with the platform-admin peek (read-only, never
// logged as usage; AGENTS.md), so the preview account must be a platform admin.
//
// Setup, once (outside the repo, nothing is added to package.json):
//   mkdir -p ~/vicdata-warm && cd ~/vicdata-warm && npm init -y && npm i playwright-core@1.49.1
//   PLAYWRIGHT_BROWSERS_PATH=~/vicdata-warm/browsers npx -y playwright@1.49.1 install chromium-headless-shell
// Run:
//   PW_DIR=~/vicdata-warm PREVIEW_ACCESS_TOKEN=… node scripts/warm-demo.mjs [urn=110110] [--sets]
// --sets also warms SMT against the regional and national sets (independent schools in the region and in
// England, all sixth forms in the region): 10-20 s each when cold.
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const SITE = process.env.SITE ?? "https://vicdata.co.uk";
const TOKEN = process.env.PREVIEW_ACCESS_TOKEN;
const PW_DIR = process.env.PW_DIR;
const args = process.argv.slice(2);
const URN = args.find((a) => /^\d{5,7}$/.test(a)) ?? "110110";
const WITH_SETS = args.includes("--sets");
if (!TOKEN || !PW_DIR) {
  console.error("Set PREVIEW_ACCESS_TOKEN and PW_DIR (see the setup at the top of this file).");
  process.exit(2);
}
const { chromium } = createRequire(join(PW_DIR, "package.json"))("playwright-core");
const browsers = join(PW_DIR, "browsers");
const shell = readdirSync(browsers).find((d) => d.startsWith("chromium_headless_shell-"));
const executablePath = join(browsers, shell, "chrome-mac", "headless_shell");

const peek = (path, as) => `${path}${path.includes("?") ? "&" : "?"}lookAs=${URN}&peek=1&as=${as}`;
const PAGES = [
  ["Teacher home (as SMT)", peek("/teacher", "smt")],
  ["Teacher home (as Teacher)", peek("/teacher", "teacher")],
  ["SMT home", peek("/teacher/smt", "smt")],
  ["SMT Academic", peek("/teacher/smt/academic", "smt")],
  ["SMT Pupils", peek("/teacher/smt/pupils", "smt")],
  ["SMT Context", peek("/teacher/smt/context", "smt")],
  ["Admissions home", peek("/teacher/admissions", "admissions")],
];

const browser = await chromium.launch({ executablePath });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
let smtSchoolSeen = null;
page.on("response", async (r) => {
  if (new URL(r.url()).pathname === "/api/smt/school" && r.ok()) smtSchoolSeen = await r.json().catch(() => smtSchoolSeen);
});

// Signed in: the preview route redeems a real magic link on the server and sets the session cookie on its
// redirect (cookie sessions, front door part 3). Wait for that cookie (an older deploy kept the session in
// localStorage instead: either will do).
await page.goto(`${SITE}/api/testing/preview-session?token=${encodeURIComponent(TOKEN)}&redirect=/teacher`, { waitUntil: "load", timeout: 60_000 });
const signedIn = async () => (await page.context().cookies()).some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name)) || (await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes("auth-token"))).catch(() => false));
for (let t0 = Date.now(); !(await signedIn()); await page.waitForTimeout(250)) {
  if (Date.now() - t0 > 30_000) throw new Error(`Not signed in after the preview route (at ${page.url()}).`);
}
await page.waitForTimeout(1000);
if (page.url().includes("/welcome")) await page.getByRole("button", { name: "Let's start" }).click().catch(() => {});

// One page: open it, then wait until no request has started for 3 s and no spinner shows (60 s at most).
async function visit(label, path) {
  const t0 = Date.now();
  const api = [];
  const onDone = (r) => {
    const u = r.url();
    if (u.includes("/api/")) api.push({ path: new URL(u).pathname, status: r.status(), ms: Date.now() - t0 });
  };
  page.on("response", onDone);
  let last = Date.now();
  const onReq = () => (last = Date.now());
  page.on("request", onReq);
  try {
    await page.goto(`${SITE}${path}`, { waitUntil: "load", timeout: 60_000 });
    while (Date.now() - t0 < 60_000) {
      const busy = await page.locator('[aria-busy="true"], .animate-spin, .animate-pulse').count().catch(() => 0);
      if (!busy && Date.now() - last > 3000) break;
      await page.waitForTimeout(250);
    }
  } catch (e) {
    console.log(`  ${label}: failed to open (${e.message.split("\n")[0]})`);
  }
  page.off("response", onDone);
  page.off("request", onReq);
  const done = api.length ? Math.max(...api.map((a) => a.ms)) : Date.now() - t0;
  const errs = api.filter((a) => a.status >= 400).map((a) => `${a.status} ${a.path}`);
  const slow = api.slice().sort((a, b) => b.ms - a.ms)[0];
  console.log(`${(done / 1000).toFixed(1).padStart(6)} s  ${label}${slow ? `  (last: ${slow.path})` : ""}${errs.length ? `  !! ${errs.join(", ")}` : ""}`);
  return done;
}

console.log(`Warming ${SITE} for school ${URN}, one page at a time${WITH_SETS ? ", with the regional and national sets" : ""}.`);
const t = Date.now();
for (const [label, path] of PAGES) await visit(label, path);

if (WITH_SETS) {
  // The SMT set choice is remembered per school in the browser (useSmtSet.ts); pick each default ranking there.
  // The school's region and sector, from the SMT home's own /api/smt/school answer (captured above).
  const school = smtSchoolSeen;
  if (!school) {
    console.log("  The SMT home didn't return the school, so the sets weren't warmed.");
    await browser.close();
    process.exit(1);
  }
  const independent = !!school?.independent;
  const region = school?.regionCode && school?.regionName ? { kind: "region", code: school.regionCode, name: school.regionName } : null;
  const f = (scope, sectors) => ({ sectors, gender: null, boarding: "any", qualification: null, scope, sizes: [] });
  const sector = independent ? "Independent" : "State";
  const sets = [
    ...(region ? [[`${sector} schools in the ${region.name}`, f(region, [sector])]] : []),
    // A state school's England-wide set (3,000+ schools at GCSE) takes minutes: only independents warm it.
    ...(independent ? [[`${sector} schools in England`, f({ kind: "nation", nation: "england" }, [sector])]] : []),
    ...(region ? [[`All sixth forms and colleges in the ${region.name}`, f(region, [])]] : []),
  ];
  for (const [label, filters] of sets) {
    await page.evaluate(([urn, c]) => localStorage.setItem(`vicdata.smt.set:${urn}`, JSON.stringify(c)), [URN, { kind: "ranking", label, filters, rankingId: null }]);
    await visit(`SMT home, ${label}`, peek("/teacher/smt", "smt"));
    await visit(`SMT Academic, ${label}`, peek("/teacher/smt/academic", "smt"));
  }
  await page.evaluate((urn) => localStorage.removeItem(`vicdata.smt.set:${urn}`), URN);
}
console.log(`Done in ${Math.round((Date.now() - t) / 1000)} s. Run it again to see the warm times.`);
await browser.close();
