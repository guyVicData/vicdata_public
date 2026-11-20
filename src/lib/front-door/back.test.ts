// Run: npx tsx --test src/lib/front-door/back.test.ts
// Guy, 20 Nov (navigation): every walk and dashboard goes back where it began -- ?back=, safe, in plain words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { backFrom, backLabel, safeBack, withBack } from "./back";
import { homeOf } from "@/components/front-door/WalkPage";

test("safeBack: paths on this site under /teacher or /sets only; no hosts, schemes, editors or chains", () => {
  assert.equal(safeBack("/teacher#smt"), "/teacher#smt");
  assert.equal(safeBack("/teacher/group?account=abc"), "/teacher/group?account=abc");
  for (const bad of ["https://evil.example/teacher", "//evil.example", "/\\evil.example", "/admin", "/sets/edit?x=1", "/teacher/smt?back=%2Fteacher", "javascript:alert(1)", "", null]) assert.equal(safeBack(bad as string | null), null, String(bad));
});

test("backLabel: where it goes, in words", () => {
  assert.equal(backLabel("/teacher#smt"), "Back to the SMT home");
  assert.equal(backLabel("/teacher#admissions"), "Back to the Admissions home");
  assert.equal(backLabel("/teacher#gcse"), "Back to your GCSE home");
  assert.equal(backLabel("/teacher/group?account=1"), "Back to the group");
  assert.equal(backLabel("/teacher"), "Back to your home");
});

test("withBack and backFrom: carried on a link, read on arrival, else the natural parent", () => {
  const href = withBack("/teacher/ks4?subject=Biology&from=smt", "/teacher#smt");
  assert.equal(href, "/teacher/ks4?subject=Biology&from=smt&back=%2Fteacher%23smt");
  assert.deepEqual(backFrom(href.split("?")[1], "/teacher"), { href: "/teacher#smt", label: "Back to the SMT home", given: true });
  assert.deepEqual(backFrom("subject=x", "/teacher#gcse"), { href: "/teacher#gcse", label: "Back to your GCSE home", given: false });
  assert.equal(withBack("/teacher/smt", "https://evil.example"), "/teacher/smt");
});

test("a walk's natural parent is its own role's section of the home (or the group's home)", () => {
  assert.equal(homeOf({ product: "smt" }), "/teacher#smt");
  assert.equal(homeOf({ product: "admissions" }), "/teacher#admissions");
  assert.equal(homeOf({ product: "gcse" }), "/teacher#gcse");
  assert.equal(homeOf({ product: "post16" }), "/teacher#post-16");
  assert.equal(homeOf({ product: "group" }), "/teacher/group");
});
