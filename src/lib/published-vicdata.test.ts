// Snag 1 item 00: loadPublishedVicData draws the published version and falls back to the
// copy in code otherwise. Run: npx -y tsx --test src/lib/published-vicdata.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPublishedVicData } from "./published-vicdata";
import { teacherDashboardFor } from "../catalogue/dashboards";
import { viewInstance } from "../catalogue/viewspec";
import { CONFIG_SCHEMA_VERSION, type DashboardConfig } from "../catalogue/types";

type Tables = { dashboards: Record<string, unknown>[]; dashboard_versions: Record<string, unknown>[] };

// A tiny chainable fake of the two reads the loader makes.
function fakeClient(tables: Tables | "missing"): SupabaseClient {
  return {
    from(table: keyof Tables) {
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => (filters.push([col, val]), q),
        maybeSingle: async () => {
          if (tables === "missing") return { data: null, error: { code: "42P01", message: 'relation "dashboards" does not exist' } };
          const row = tables[table].find((r) => filters.every(([c, v]) => r[c] === v)) ?? null;
          return { data: row, error: null };
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

const code = teacherDashboardFor("ks4", "candidates");
// The seed script stores JSON.stringify(config): the stored copy is the code copy, JSON round-tripped.
const seeded = (): DashboardConfig => JSON.parse(JSON.stringify(code));
const tablesWith = (config: DashboardConfig | null, schema: number = CONFIG_SCHEMA_VERSION): Tables => ({
  dashboards: [{ id: "d1", slug: code.id, owner_scope: "vicdata", published_version_id: config ? "v1" : null }],
  dashboard_versions: config ? [{ id: "v1", version: 3, schema_version: schema, config }] : [],
});

const quiet = () => {
  const warn = console.warn;
  const seen: string[] = [];
  console.warn = (m: string) => void seen.push(m);
  return { seen, restore: () => void (console.warn = warn) };
};

describe("loadPublishedVicData (snag 1 item 00)", () => {
  it("draws the seeded published version, identical to the copy in code", async () => {
    const out = await loadPublishedVicData(fakeClient(tablesWith(seeded())), code.id, code);
    assert.equal(out.source, "store");
    assert.equal(out.version, 3);
    assert.equal(JSON.stringify(out.config), JSON.stringify(code));
  });

  it("an edit in the published version reaches the page (a renamed panel)", async () => {
    const edited = seeded();
    edited.panels[0].name = "Renamed by Guy";
    const out = await loadPublishedVicData(fakeClient(tablesWith(edited)), code.id, code);
    assert.equal(out.source, "store");
    assert.equal(out.config.panels[0].name, "Renamed by Guy");
  });

  it("keeps the slug as the config id whatever id the editor wrote", async () => {
    const edited = { ...seeded(), id: "0b9c1c1e-0000-4000-8000-000000000000" };
    const out = await loadPublishedVicData(fakeClient(tablesWith(edited)), code.id, code);
    assert.equal(out.config.id, code.id);
  });

  for (const [name, tables] of [
    ["no stored row", { dashboards: [], dashboard_versions: [] } as Tables],
    ["no published version (removed)", tablesWith(null)],
    // 0.6.1 S2 (D9): a v1 published version (live before the re-seed) draws the code copy.
    ["a schema_version it can't read (v1, before the re-seed)", tablesWith({ ...seeded(), schema_version: 1 as never }, 1)],
    ["a schema_version from the future", tablesWith({ ...seeded(), schema_version: 3 as never }, 3)],
    ["an invalid config", tablesWith({ ...seeded(), panels: [{ ...seeded().panels[0], dataviews: [{ ...viewInstance("x", "DV-C2-CUR-BARS"), dataview: "DV-NOPE" }] }] })],
    ["the tables not there yet", "missing" as const],
  ] as const) {
    it(`falls back to the copy in code, with a warning: ${name}`, async () => {
      const q = quiet();
      try {
        const out = await loadPublishedVicData(fakeClient(tables), code.id, code);
        assert.equal(out.source, "code");
        assert.equal(out.config, code);
        assert.equal(q.seen.length, 1);
        assert.match(q.seen[0], /drawing the copy in code/);
      } finally {
        q.restore();
      }
    });
  }
});
