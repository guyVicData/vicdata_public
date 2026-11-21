// Run: npx tsx --test src/lib/public-school-links.test.ts
// R-NO-PUBLIC-SCHOOL-LINKS (Guy, 21 Nov, private beta): /schools/** redirects, and no signed-in surface
// builds a URL to a public school page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import nextConfig, { HIDDEN_SCHOOL_PAGES_DESTINATION, HIDDEN_SCHOOL_PAGES_SOURCE } from "../../next.config";
import sitemap from "../app/sitemap";
import { PUBLIC_PAGE_ONLY, publicSchoolLinkFindings, publicSchoolLinks } from "./public-school-links";

const ROOT = path.resolve(__dirname, "../..");
const src = path.join(ROOT, "src");
const files = (readdirSync(src, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f))
  .map((f) => ({ file: `src/${f.split(path.sep).join("/")}`, text: readFileSync(path.join(src, f), "utf8") }));

// The redirect's source, as Next matches it (path-to-regexp; `:path*` is zero or more segments).
const sourceMatches = (p: string) => new RegExp(`^${HIDDEN_SCHOOL_PAGES_SOURCE.replace("/:path*", "(?:/.*)?")}$`).test(p);

test("R-NO-PUBLIC-SCHOOL-LINKS: every /schools route redirects, temporarily, to /member, before the filesystem", async () => {
  const redirects = await nextConfig.redirects!();
  const r = redirects.find((x) => x.source === HIDDEN_SCHOOL_PAGES_SOURCE);
  assert.ok(r, "next.config.ts redirects /schools/:path*");
  assert.equal(r.destination, "/member");
  assert.equal(HIDDEN_SCHOOL_PAGES_DESTINATION, "/member");
  assert.equal(r.permanent, false, "temporary: the pages come back after the beta");
  for (const p of ["/schools", "/schools/110110", "/schools/110110/data", "/schools/110110/anything/later"]) assert.ok(sourceMatches(p), p);
  for (const p of ["/api/schools", "/teacher/group/schools", "/schoolsx", "/member"]) assert.ok(!sourceMatches(p), p);
});

test("R-NO-PUBLIC-SCHOOL-LINKS: /member sends a signed-in member to /teacher and a signed-out visitor to /", () => {
  const member = readFileSync(path.join(src, "app/member/page.tsx"), "utf8");
  assert.match(member, /router\.replace\("\/teacher"\)/);
  assert.match(member, /router\.replace\("\/"\)/);
  assert.equal(publicSchoolLinks([{ file: "member", text: member }]).length, 0);
});

test("R-NO-PUBLIC-SCHOOL-LINKS: the sitemap lists no school page", () => {
  assert.ok(sitemap().every((e) => !/\/schools(\/|$)/.test(new URL(e.url, "https://vicdata.co.uk").pathname)));
});

test("R-NO-PUBLIC-SCHOOL-LINKS: the scan finds each way of building the URL, and not the look-alikes", () => {
  const hits = (text: string) => publicSchoolLinks([{ file: "x.tsx", text }]).length;
  assert.equal(publicSchoolLinks([{ file: "x.test.tsx", text: '"/schools/1"' }]).length, 0, "tests are not surfaces");
  assert.equal(hits('<Link href={`/schools/${urn}`}>'), 1);
  assert.equal(hits('router.push("/schools/" + urn)'), 1);
  assert.equal(hits("window.location.href = '/schools?q=1'"), 1);
  assert.equal(hits('const u = "/schools";'), 1);
  assert.equal(hits('fetch(`/api/schools/${urn}`)'), 0);
  assert.equal(hits('{ Schools: "/teacher/group/schools" }'), 0);
  assert.equal(hits("// a direct /schools/<urn> visit"), 0);
});

test("R-NO-PUBLIC-SCHOOL-LINKS: no file in src builds a /schools URL unless it renders only on the hidden pages", () => {
  const { links, unlisted, reachable, stale } = publicSchoolLinkFindings(files);
  assert.deepEqual(unlisted.map((l) => `${l.file}:${l.line} ${l.text}`), [], "a /schools URL outside the allow-list");
  assert.deepEqual(reachable, [], "an allow-listed file is imported from outside src/app/schools");
  assert.deepEqual(stale, [], "an allow-listed file no longer builds a /schools URL: drop it from PUBLIC_PAGE_ONLY");
  assert.ok(links.length >= PUBLIC_PAGE_ONLY.length);
});
