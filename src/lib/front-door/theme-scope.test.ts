// Run: npx -y tsx --test --test-force-exit src/lib/front-door/theme-scope.test.ts
// VicData 0.8 front door: R-THEME-MID-SCOPE (Mid on the homes, walks and -- since front door 2b -- the dashboards;
// the sets and admin pages draw Dark under Mid) and R-PANEL-LADDER's shell half, by source scan. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dashThemeOf, effectiveTheme } from "../../components/shell/TeacherChrome";
import { MidBand, midRootProps } from "../../components/shell/MidDash";
import { ladderShellFindings, midDashFindings, midScopeFindings } from "./theme-scope";

const src = path.join(__dirname, "../..");
const files = (readdirSync(src, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."))
  .map((f) => ({ file: `src/${f}`, text: readFileSync(path.join(src, f), "utf8") }));

test("R-THEME-MID-SCOPE: Mid draws Dark on the sets and admin pages; the homes, walks and dashboards read it", () => {
  assert.equal(effectiveTheme("mid"), "dark");
  assert.equal(effectiveTheme("dark"), "dark");
  assert.equal(effectiveTheme("light"), "light");
  const { unlisted, stale } = midScopeFindings(files);
  assert.deepEqual(unlisted, [], "files reading the Mid choice outside MID_PAGES");
  assert.deepEqual(stale, [], "MID_PAGES lists a missing file");
});

test("R-THEME-MID-SCOPE: dashboards follow Mid (Light on the field, the header band Dark); sets and admin pages draw Dark", () => {
  // Front door 2b (M3, rewritten): a dashboard draws Light under Mid, Dark and Light as before.
  assert.equal(dashThemeOf("mid"), "light");
  assert.equal(dashThemeOf("dark"), "dark");
  assert.equal(dashThemeOf("light"), "light");
  assert.deepEqual(midDashFindings(files), []);
  // Outside Mid nothing is added: no attribute on the root, no band element (Dark and Light unchanged).
  assert.deepEqual(midRootProps(false, "gcse"), {});
  assert.deepEqual(midRootProps(true, "gcse"), { "data-pref": "mid", "data-mid-dash": "gcse" });
  assert.equal(renderToStaticMarkup(createElement(MidBand, { bleed: true, className: "x" } as never, createElement("i", null, "nav"))), "<i>nav</i>");
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
