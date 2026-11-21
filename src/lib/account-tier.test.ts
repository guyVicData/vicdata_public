// Run: node --import tsx --test src/lib/account-tier.test.ts
// R-TIER-ADMIN-ONLY (review pack 22 Nov, issue 4): only a platform admin can set a school's plan on /account.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { tierRowFor } from "./account-tier";

test("R-TIER-ADMIN-ONLY: the account holder reads the plan; only a platform admin sets it", () => {
  assert.deepEqual(tierRowFor({ platformAdmin: false, isAccountHolder: true, tier: "school" }), { kind: "read", label: "School-wide" });
  assert.deepEqual(tierRowFor({ platformAdmin: false, isAccountHolder: false, tier: "individual" }), { kind: "read", label: "Individual" });
  assert.deepEqual(tierRowFor({ platformAdmin: false, isAccountHolder: true, tier: null }), { kind: "none" });
  assert.deepEqual(tierRowFor({ platformAdmin: false, isAccountHolder: true, tier: "" }), { kind: "none" });
  assert.deepEqual(tierRowFor({ platformAdmin: true, isAccountHolder: true, tier: "school" }), { kind: "edit" });
  const page = readFileSync(path.join(__dirname, "../app/account/page.tsx"), "utf8");
  assert.doesNotMatch(page, /no Stripe yet/);
  assert.match(page, /tierRow\.kind === "edit" && \(/, "the dropdown is drawn only for the edit row");
  assert.doesNotMatch(page, /\{isAccountHolder && \(\s*<div className="mt-4 flex items-center gap-2 text-sm">/);
});
