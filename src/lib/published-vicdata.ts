// 0.6 snagging round 1, item 00: the Teacher page draws the PUBLISHED version of its
// VicData dashboard (scope brief §4.8, G1: a publish reaches every school's Teacher page,
// like a software upgrade), never the editor's draft, and falls back to the copy built
// into src/catalogue/dashboards whenever the store can't give a usable one.
//
// Only the dashboard's structure comes from here (columns, rows, panels, view lists,
// defaults, names). Everything decided per school stays in the hosts and the lib rules.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONFIG_SCHEMA_VERSION, type DashboardConfig, type DataviewId } from "@/catalogue/types";
import { validateConfig } from "@/catalogue/config";
import { DATAVIEWS } from "@/catalogue";
import { isMissingTable } from "./dashboards-store";

export type PublishedLoad = { config: DashboardConfig; source: "store" | "code"; version: number | null; reason?: string };

const KNOWN = new Set<DataviewId>(DATAVIEWS.map((d) => d.id));

export async function loadPublishedVicData(supabase: SupabaseClient, slug: string, fallback: DashboardConfig): Promise<PublishedLoad> {
  const fall = (reason: string): PublishedLoad => {
    console.warn(`[dashboards] ${slug}: drawing the copy in code (${reason})`);
    return { config: fallback, source: "code", version: null, reason };
  };
  try {
    const { data: row, error } = await supabase
      .from("dashboards")
      .select("id, owner_scope, published_version_id")
      .eq("slug", slug)
      .maybeSingle<{ id: string; owner_scope: string; published_version_id: string | null }>();
    if (isMissingTable(error)) return fall("the dashboards tables aren't there yet");
    if (error) return fall(`load error: ${error.message}`);
    if (!row) return fall("no stored dashboard");
    if (row.owner_scope !== "vicdata") return fall("the stored dashboard isn't VicData's");
    if (!row.published_version_id) return fall("no published version");
    const { data: version, error: vError } = await supabase
      .from("dashboard_versions")
      .select("version, schema_version, config")
      .eq("id", row.published_version_id)
      .maybeSingle<{ version: number; schema_version: number; config: DashboardConfig }>();
    if (vError) return fall(`load error: ${vError.message}`);
    if (!version) return fall("published version not readable");
    if (version.schema_version !== CONFIG_SCHEMA_VERSION || version.config?.schema_version !== CONFIG_SCHEMA_VERSION) {
      return fall(`schema_version ${version.config?.schema_version ?? version.schema_version} isn't one this renderer reads`);
    }
    // The page, the Edit link and the Updated line all key on the slug, so the drawn
    // config carries it whatever id the editor wrote into the JSON.
    const config: DashboardConfig = { ...version.config, id: slug };
    const problems = validateConfig(config, KNOWN);
    if (problems.length) return fall(`invalid config: ${problems.map((p) => `${p.path} ${p.message}`).join("; ")}`);
    return { config, source: "store", version: version.version };
  } catch (e) {
    return fall(`load error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
