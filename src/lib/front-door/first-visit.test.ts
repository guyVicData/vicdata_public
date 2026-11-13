// Run: npx -y tsx --test --test-force-exit src/lib/front-door/first-visit.test.ts
// VicData 0.8 front door: R-WELCOME-ONCE, R-SETUP-ONE-SCREEN and R-WHATS-NEW. The decisions are pure
// (visit.ts, setup.ts); the screens are checked in their source (they render after a session). The
// tables' RLS is proved in PGlite (supabase/tests/v08_front_door_r1_pglite.mjs). No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterWelcome, shouldShowWelcome, whatsNew, type ChangelogEntry, type StateLoad } from "./visit";
import { setupPhases, setupTotals } from "./setup";

const src = (f: string) => readFileSync(path.join(__dirname, "../..", f), "utf8");
const ready = (s: Partial<{ welcomeSeenAt: string | null; lastVisitAt: string | null; whatsNewSeenAt: string | null }> | null): StateLoad => ({ status: "ready", state: s ? { welcomeSeenAt: null, lastVisitAt: null, whatsNewSeenAt: null, ...s } : null });

test("R-WELCOME-ONCE: the welcome shows to a person who hasn't seen it, once, never in View as", () => {
  assert.equal(shouldShowWelcome(ready(null), { viewingAs: false }), true, "first login: no row yet");
  assert.equal(shouldShowWelcome(ready({ welcomeSeenAt: null }), { viewingAs: false }), true);
  assert.equal(shouldShowWelcome(ready({ welcomeSeenAt: "2026-11-13T09:00:00Z" }), { viewingAs: false }), false, "seen: never again");
  assert.equal(shouldShowWelcome(ready(null), { viewingAs: true }), false, "View as and peeks are read-only");
  assert.equal(shouldShowWelcome({ status: "unavailable" }, { viewingAs: false }), false, "before the migration: no loop to the welcome");
  // The welcome marks itself seen as the person leaves it (and counts as seeing what's new).
  const w = src("components/front-door/first-visit.tsx");
  assert.match(w, /if \(user && !viewingAs\) await markWelcomeSeen\(supabase, user\.id\)/);
  assert.match(src("lib/front-door/visit.ts"), /welcome_seen_at: now, whats_new_seen_at: now/);
  // Every home asks: /teacher and head office's.
  assert.match(src("app/teacher/page.tsx"), /useFirstVisit\(/);
  assert.match(src("components/groups/GroupHome.tsx"), /useFirstVisit\(/);
  // The welcome names the private beta and where feedback lives.
  assert.match(w, /private beta/);
  assert.match(w, /Feedback on this page/);
});

test("R-SETUP-ONE-SCREEN: one screen, every phase the school has, the live count; roles without subjects skip it", () => {
  assert.deepEqual(setupPhases(["ks4", "ks5"]), ["ks4", "ks5"], "a two-phase school: both lists on the one screen");
  assert.deepEqual(setupPhases(["ks5"]), ["ks5"]);
  assert.deepEqual(setupPhases(["ks2"]), [], "KS2 has no subjects to pick");
  const subjects = [{ key: "a", entries: 84 }, { key: "b", entries: 92 }, { key: "c", entries: 10 }];
  assert.deepEqual(setupTotals(subjects, []), { entries: 0, subjects: 0 });
  assert.deepEqual(setupTotals(subjects, ["a", "b"]), { entries: 176, subjects: 2 }, "the live count moves with each tick");
  assert.equal(afterWelcome({ needsSetup: true }), "/teacher/setup?from=welcome");
  assert.equal(afterWelcome({ needsSetup: false }), "/teacher", "SMT, Admissions, head office, School-Admin: welcome then home");
  const w = src("components/front-door/first-visit.tsx");
  assert.match(w, /Which subjects do you teach\?/);
  assert.match(w, /data-live-count=/);
  assert.match(w, /lensesOf\(.*\)\.includes\("teacher"\)/, "only a Teacher role needs setup");
  // Qualifications are headings within the list, not a step; the old four steps are gone from the dashboard.
  assert.match(w, /QUALIFICATION_FAMILIES\[list\.phase\]/);
  const dash = src("components/dashboard-config/TeacherDashboard.tsx");
  assert.match(dash, /if \(!onboarded\) return <GoToSetup phase=\{phase\} \/>;/);
  assert.doesNotMatch(dash, /Step \{step \+ 1\} of 4/, "no GCSE/Post-16 step screens");
  assert.doesNotMatch(dash, /Here's what you can look at/, "the question screen is the home now");
});

const entry = (title: string, at: string): ChangelogEntry => ({ id: title, published_at: at, title, body: null, credit_text: null, link: null });
test("R-WHATS-NEW: the strip shows entries newer than the last visit, and not after they're seen", () => {
  const entries = [entry("Walkthroughs", "2026-11-12T09:00:00Z"), entry("Older", "2026-11-01T09:00:00Z"), entry("Scheduled", "2026-12-01T09:00:00Z")];
  const now = new Date("2026-11-13T09:00:00Z");
  const before = ready({ welcomeSeenAt: "2026-10-20T09:00:00Z", whatsNewSeenAt: "2026-11-05T09:00:00Z" });
  assert.deepEqual(whatsNew(entries, before, { viewingAs: false, now }).map((e) => e.title), ["Walkthroughs"], "newer than the last visit, published already");
  const after = ready({ welcomeSeenAt: "2026-10-20T09:00:00Z", whatsNewSeenAt: "2026-11-13T08:00:00Z" });
  assert.deepEqual(whatsNew(entries, after, { viewingAs: false, now }), [], "once seen, it goes");
  assert.deepEqual(whatsNew(entries, ready({ welcomeSeenAt: "2026-10-31T09:00:00Z" }), { viewingAs: false, now }).map((e) => e.title), ["Walkthroughs", "Older"], "before the strip was ever seen: since the welcome");
  assert.deepEqual(whatsNew(entries, ready(null), { viewingAs: false, now }), [], "a first visit gets the welcome, not the strip");
  assert.deepEqual(whatsNew(entries, before, { viewingAs: true, now }), [], "never in View as");
  assert.deepEqual(whatsNew(entries, { status: "unavailable" }, { viewingAs: false, now }), []);
  // The visit is recorded after the strip is worked out, so it shows for this visit and not the next.
  assert.match(src("components/front-door/first-visit.tsx"), /if \(live\) setEntries\(shown\);\s*if \(load\.status === "ready" && load\.state\) await recordVisit/);
});
