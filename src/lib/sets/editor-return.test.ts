// Run: npx -y tsx --test src/lib/sets/editor-return.test.ts
// The origin's side of the set editor's way back (savedSetFromEditor): once per page load, so every
// reader on the page agrees and a refresh finds nothing; useSet in the address counts too.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HANDOVER_KEY, writeHandover } from "./return-to";
import { resetSavedSetForTests, savedSetFromEditor } from "./editor-return";

const ID = "8a3c1d9e-0000-4000-8000-000000000001";
const store = new Map<string, string>();
const sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const g = globalThis as unknown as { window: { location: { pathname: string; search: string }; sessionStorage: typeof sessionStorage } };
const go = (pathname: string, search = "") => (g.window = { location: { pathname, search }, sessionStorage });

beforeEach(() => {
  store.clear();
  resetSavedSetForTests();
});

test("the handover is read once per page load, and every reader on the page gets it", () => {
  go("/teacher/admissions", "?view=pipelines&entry=11%2B");
  writeHandover(sessionStorage, "/teacher/admissions?view=pipelines&entry=11%2B&school=110110", ID);
  assert.equal(savedSetFromEditor(), ID);
  assert.equal(store.has(HANDOVER_KEY), false, "taken");
  assert.equal(savedSetFromEditor(), ID, "a second reader (or React's double run) still gets it");
});

test("refresh on the origin: a new page load finds nothing", () => {
  go("/teacher/ks4");
  writeHandover(sessionStorage, "/teacher/ks4?school=110110", ID);
  assert.equal(savedSetFromEditor(), ID);
  resetSavedSetForTests(); // the reload
  assert.equal(savedSetFromEditor(), null);
});

test("useSet in the address counts (the editor replaced itself), and the handover for another page is left", () => {
  go("/teacher/ks5", `?useSet=${ID}`);
  writeHandover(sessionStorage, "/teacher/ks4", "8a3c1d9e-0000-4000-8000-000000000002");
  assert.equal(savedSetFromEditor(), ID);
  assert.ok(store.has(HANDOVER_KEY), "not this page's");
});

test("a malformed useSet is ignored", () => {
  go("/teacher/ks5", "?useSet=javascript:alert(1)");
  assert.equal(savedSetFromEditor(), null);
});
