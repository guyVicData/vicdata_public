// Run: node --import tsx --test src/lib/front-door/teacher-viewing-setup.test.ts
// R-TEACHER-VIEWING-NO-SETUP (review pack 22 Nov, issue 1): a platform admin's peek or View as of a school's
// Teacher dashboards is never sent to /teacher/setup (which showed, and would have saved, the admin's own
// school), and setup never saves under a peek. The rules are pure (setup.ts); the screens use them (source).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { setupModeFor, teacherDashboardGate, viewingTicked } from "./setup";

const src = (f: string) => readFileSync(path.join(__dirname, "../..", f), "utf8");

test("R-TEACHER-VIEWING-NO-SETUP: a peek or View as at 110110 opens the dashboard, on the school's phases", () => {
  // The preview account has onboarding rows for its own schools only, none for 110110.
  const peek = teacherDashboardGate({ viewingAs: true, fromSmt: false, done: [], phase: "ks4", schoolPhases: ["ks4", "ks5"] });
  assert.deepEqual(peek, { onboarded: true, phases: ["ks4", "ks5"] });
  // The phases route failing still opens the phase asked for.
  assert.deepEqual(teacherDashboardGate({ viewingAs: true, fromSmt: false, done: [], phase: "ks5", schoolPhases: [] }), { onboarded: true, phases: ["ks5"] });
  // A member is unchanged: gated on their own setup, the SMT shortcut excepted.
  assert.deepEqual(teacherDashboardGate({ viewingAs: false, fromSmt: false, done: [], phase: "ks4", schoolPhases: ["ks4"] }), { onboarded: false, phases: [] });
  assert.equal(teacherDashboardGate({ viewingAs: false, fromSmt: false, done: ["ks4"], phase: "ks4", schoolPhases: [] }).onboarded, true);
  assert.equal(teacherDashboardGate({ viewingAs: false, fromSmt: true, done: [], phase: "ks4", schoolPhases: [] }).onboarded, true);
});

test("R-TEACHER-VIEWING-NO-SETUP: nothing ticked in a peek or View as shows the school's subjects", () => {
  assert.deepEqual(viewingTicked([], ["Biology::GCSE", "Chemistry::GCSE"], true), ["Biology::GCSE", "Chemistry::GCSE"]);
  assert.deepEqual(viewingTicked(["Biology::GCSE"], ["Biology::GCSE", "Chemistry::GCSE"], true), ["Biology::GCSE"]);
  assert.deepEqual(viewingTicked([], ["Biology::GCSE"], false), [], "a member's empty setup stays empty");
});

test("R-TEACHER-VIEWING-NO-SETUP: setup is only ever the signed-in person's own, never saved under a peek", () => {
  assert.equal(setupModeFor({ signedIn: true, viewingAs: false, peek: false }), "own");
  assert.equal(setupModeFor({ signedIn: true, viewingAs: false, peek: true }), "skip");
  assert.equal(setupModeFor({ signedIn: true, viewingAs: true, peek: false }), "skip");
  assert.equal(setupModeFor({ signedIn: false, viewingAs: false, peek: false }), "skip");
  const fv = src("components/front-door/first-visit.tsx");
  const save = fv.slice(fv.indexOf("const save = async"), fv.indexOf("if (state.status !== \"ready\") return <FirstVisitFrame"));
  assert.match(save, /setupModeFor\(\{[^}]*peek: !!readPeek\(/, "save() re-checks the peek before writing");
  assert.ok(save.indexOf("setupModeFor") < save.indexOf("savePreferences"), "the check comes before any write");
  // The dashboard: the gate, read-only peek (no ticks, pills or last-seen written).
  const dash = src("components/dashboard-config/TeacherDashboard.tsx");
  assert.match(dash, /teacherDashboardGate\(\{ viewingAs: viewing,/);
  assert.match(dash, /const canWrite = !embed && !peekReadOnly;/);
  assert.match(dash, /if \(!\(peekOk && requestedPeek\)\) await markPeriodSeen/);
  // Nor does the dashboard's "Updated" line record what a peek has seen.
  assert.match(src("components/editor/UpdatedNotice.tsx"), /if \(!peeking\(\)\) await saveUserState/);
  assert.match(src("components/editor/DashboardUpdates.tsx"), /if \(!schoolUrn \|\| readPeek\(/);
});
