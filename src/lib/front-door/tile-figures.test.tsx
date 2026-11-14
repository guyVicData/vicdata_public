// Run: npx -y tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/tile-figures.test.tsx
// VicData 0.8 front door 2b (M1): R-HOME-TILES -- SMT Context's tile, fetched late through its walk's own
// read, equals the walk's first screen (DV-SMT-C-NOW, ContextNow's projection tile) on real schools:
// Leighton Park (110110) and The Chase (137625), read live and read-only, as the route builds it.
// Also offline: the late figure's session cache key keeps people and peeks apart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { smtSchool } from "../smt/school";
import { buildContext } from "../smt/context";
import { resolveCatchment } from "../smt/catchment";
import { withDensity } from "../smt/catchment-density";
import { ContextNow } from "../../components/smt/views/Context";
import { lateFigureKey } from "../../components/front-door/late-figure";
import { projectionWord, smtContextFigure, smtContextUrl } from "./tile-figures";
import { walksFor } from "./walks";

const ROOT = path.join(__dirname, "../../..");
const src = (f: string) => readFileSync(path.join(ROOT, f), "utf8");

test("R-HOME-TILES: the SMT Context tile and its walk ask one address", () => {
  for (const product of ["smt", "smt_primary"] as const) {
    const w = walksFor(product).find((x) => x.id.endsWith("-context"))!;
    assert.equal(w.screens[0].view, "DV-SMT-C-NOW");
  }
  assert.equal(smtContextUrl("110110"), "/api/smt/context?urn=110110&area=around&level=whole");
  assert.match(src("src/components/front-door/role-walks.tsx"), /smtContextUrl\(member\.schoolUrn\)/);
  assert.match(src("src/components/front-door/sections.tsx"), /useLateTileFigure<Context>\(s \? smtContextUrl\(member\.schoolUrn\)/);
  assert.match(src("src/components/groups/GroupHome.tsx"), /groupWalkDashUrl\("academic", office\.id, groupWalkCompare\("academic"\)\)/);
  assert.match(src("src/components/front-door/role-walks.tsx"), /groupWalkDashUrl\(dash, account, compare\)/);
});

test("R-HOME-TILES: a late figure is never a placeholder, and none without a projection", () => {
  assert.equal(smtContextFigure(null), null);
  assert.equal(smtContextFigure({ now: { projection: null } } as never), null);
  const f = smtContextFigure({ now: { projection: { agesWord: "4-10", from: 2024, to: 2029, changePct: 4.12, lowPct: null, highPct: null, caption: "" } } } as never);
  assert.deepEqual(f, { figure: projectionWord(4.12), unit: "children nearby, next 5 years" });
});

test("R-HOME-TILES: the session cache keeps people and peeks apart", () => {
  const u = smtContextUrl("110110");
  assert.notEqual(lateFigureKey(u, "a", ""), lateFigureKey(u, "b", ""));
  assert.notEqual(lateFigureKey(u, "a", ""), lateFigureKey(u, "a", "?lookAs=110110&as=smt&peek=1"));
  assert.equal(lateFigureKey(u, "a", "?x=1"), lateFigureKey(u, "a", ""));
});

for (const urn of ["110110", "137625"]) {
  test(`R-HOME-TILES: SMT Context's tile equals its walk's first screen (${urn}, live)`, async () => {
    const school = await smtSchool(urn);
    assert.ok(school, "the school");
    // As the route builds it for the walk's address (area=around, level=whole), with no saved radius.
    const c = await buildContext(school!, "around", "whole" as never, resolveCatchment(await withDensity(urn, school!), null, null));
    const fig = smtContextFigure(c);
    const html = renderToStaticMarkup(createElement(ContextNow, { c }));
    if (!c.now.projection) {
      assert.equal(fig, null, "no projection: no figure");
      return;
    }
    assert.ok(fig, "a figure");
    // ContextNow's projection tile value, as drawn on the walk's first screen.
    assert.ok(html.includes(`>${fig.figure}<`), `ContextNow draws ${fig.figure}`);
    assert.ok(html.includes("data-projection-tile"), "the projection tile");
    assert.equal(fig.figure, projectionWord(c.now.projection.changePct));
    console.log(`  ${school!.name}: ${fig.figure} ${fig.unit} (${c.now.projection.agesWord} ${c.now.projection.from} to ${c.now.projection.to})`);
  });
}
