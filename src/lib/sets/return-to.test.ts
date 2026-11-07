// Run: npx -y tsx --test src/lib/sets/return-to.test.ts
// The set editor's return address (safeReturnTo): only a path on this site, on a page that opens the
// editor. The breadcrumb, Save, Archive and Delete all go through it (src/app/sets/edit/page.tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "./return-to";

test("accepts every page that opens the editor, keeping its query and hash", () => {
  const ok = [
    "/teacher/admissions",
    "/teacher/admissions?view=pipelines&entry=11%2B&fset=set%3Aabc",
    "/teacher/admissions?view=market-share&entry=16+&rset=adm:nearest-sector",
    "/teacher/ks4",
    "/teacher/ks5?x=1#comparisons",
    "/teacher/smt?phase=ks4",
    "/teacher/smt/academic?headOffice=110110&lookAs=abc&as=head_office&peek=1",
    "/sets",
    "/sets?urn=110110&kind=feeders",
    "/sets/8a3c1d9e-0000-4000-8000-000000000000?urn=110110",
    "/sets/default?urn=110110&kind=feeders&entry=11%2B&from=default:day-all&name=Day&urns=1,2",
  ];
  for (const p of ok) assert.equal(safeReturnTo(p), p, p);
});

test("normalises the path before checking it", () => {
  assert.equal(safeReturnTo("/sets/./abc"), "/sets/abc");
  assert.equal(safeReturnTo("/teacher/x/../ks4"), "/teacher/ks4");
  assert.equal(safeReturnTo("/sets/../platform/feedback"), null, ".. out of an allowed page");
  assert.equal(safeReturnTo("/teacher/admissions/../../api/whoami"), null);
});

test("refuses other sites", () => {
  for (const p of [
    "https://evil.example",
    "https://evil.example/teacher/admissions",
    "http:/evil.example",
    "//evil.example",
    "//evil.example/sets",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "\\/evil.example",
    "/%2F%2Fevil.example",
    "/%5Cevil.example",
    "/@evil.example",
    "/sets@evil.example",
    "evil.example",
  ]) assert.equal(safeReturnTo(p), null, p);
});

test("refuses script and data URLs, however they're written", () => {
  for (const p of [
    "javascript:alert(document.cookie)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "java\nscript:alert(1)",
    "javascript://%0aalert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ]) assert.equal(safeReturnTo(p), null, JSON.stringify(p));
});

test("refuses control characters the URL parser would quietly drop", () => {
  for (const p of ["/\t/evil.example", "/\n/evil.example", "/sets\r\n", "/sets\u0000", "/sets\u007f"]) assert.equal(safeReturnTo(p), null, JSON.stringify(p));
});

test("refuses pages that don't open the editor, look-alikes, and the editor itself", () => {
  for (const p of ["/", "/platform/feedback", "/api/sets/editor", "/account", "/teacher", "/teacher/admissionsX", "/teacher/ks44", "/setsX", "/sets-old", "/sets/edit", "/sets/edit?urn=110110&back=/sets", "/sets/edit/x"]) {
    assert.equal(safeReturnTo(p), null, p);
  }
});

test("refuses nothing, empty, non-strings and very long values", () => {
  assert.equal(safeReturnTo(null), null);
  assert.equal(safeReturnTo(undefined), null);
  assert.equal(safeReturnTo(""), null);
  assert.equal(safeReturnTo(42 as unknown as string), null);
  assert.equal(safeReturnTo(`/sets?x=${"a".repeat(2000)}`), null);
  assert.ok(safeReturnTo(`/sets?x=${"a".repeat(1900)}`));
});
