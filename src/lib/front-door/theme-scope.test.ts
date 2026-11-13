// Run: npx -y tsx --test --test-force-exit src/lib/front-door/theme-scope.test.ts
// VicData 0.8 front door: R-THEME-MID-SCOPE (Mid on the homes and walks only) and R-PANEL-LADDER's shell
// half, by source scan. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { effectiveTheme } from "../../components/shell/TeacherChrome";
import { ladderShellFindings, midScopeFindings } from "./theme-scope";

const src = path.join(__dirname, "../..");
const files = (readdirSync(src, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."))
  .map((f) => ({ file: `src/${f}`, text: readFileSync(path.join(src, f), "utf8") }));

test("R-THEME-MID-SCOPE: Mid draws Dark everywhere but the homes and walks", () => {
  assert.equal(effectiveTheme("mid"), "dark");
  assert.equal(effectiveTheme("dark"), "dark");
  assert.equal(effectiveTheme("light"), "light");
  const { unlisted, stale } = midScopeFindings(files);
  assert.deepEqual(unlisted, [], "files reading the Mid choice outside MID_PAGES");
  assert.deepEqual(stale, [], "MID_PAGES lists a missing file");
});

test("R-THEME-MID-SCOPE: dashboards, sets and admin pages take their theme from useTeacherTheme", () => {
  for (const f of [
    "src/components/smt/SmtDashboard.tsx",
    "src/components/groups/dash/GroupDashboard.tsx",
    "src/components/library/LibraryScreen.tsx",
    "src/components/admin/PeopleScreen.tsx",
    "src/app/sets/edit/page.tsx",
  ]) {
    const text = files.find((x) => x.file === f)?.text ?? "";
    assert.ok(text, `${f} exists`);
    assert.ok(!/useThemePref/.test(text), `${f} must not read Mid`);
  }
});

test("R-PANEL-LADDER: the shell marks every dashboard and draws the shut bar with its tokens", () => {
  assert.deepEqual(ladderShellFindings(files), []);
});
