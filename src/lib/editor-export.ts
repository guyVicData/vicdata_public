// VicData 0.6 S5: "Export planned views" (scope brief §4.6a; combinations doc §6.3). Every
// placeholder on a dashboard, plus users' "Ask for this view" requests (view_requests, S4),
// as a markdown list in catalogue terms -- the next Claude Code brief. Read the requests
// as a platform admin; when the table isn't there yet, placeholders only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTable } from "./dashboards-store";
import { DATA_LABEL, FOCUS_LABEL, PHASE_LABEL, VIEW_TYPE_LABEL, resultsLabel, summaryLine, type PickPanelContext } from "@/catalogue/pick";
import type { DashboardConfig, PlaceholderContext } from "@/catalogue/types";

export type ViewRequestRow = {
  description: string;
  context: PickPanelContext;
  created_at: string;
  dashboard_slug: string | null;
  panel_id: string | null;
  status: string;
};

export async function loadViewRequests(supabase: SupabaseClient): Promise<{ available: boolean; rows: ViewRequestRow[] }> {
  const { data, error } = await supabase
    .from("view_requests")
    .select("description, context, created_at, dashboard_slug, panel_id, status")
    .in("status", ["open", "planned"])
    .order("created_at", { ascending: false });
  if (isMissingTable(error)) return { available: false, rows: [] };
  if (error) throw error;
  return { available: true, rows: (data ?? []) as ViewRequestRow[] };
}

const TIME: Record<string, string> = { latest: "latest", over_time: "over_time", either: "either" };

function contextLine(c: PlaceholderContext): string {
  const parts = [
    `data: \`${c.data}\` (${DATA_LABEL[c.data]})`,
    `phase: \`${c.phase}\` (${PHASE_LABEL[c.phase]})`,
    ...(c.results ? [`measure: \`${c.results}\` (${resultsLabel(c.results, c.phase)})`] : []),
    `focus: \`${c.focus}\` (${FOCUS_LABEL[c.focus]})`,
    `compare: ${c.compare.length ? c.compare.map((k) => `\`${k}\``).join(" + ") : "none"}`,
    `time: \`${TIME[c.time] ?? c.time}\``,
  ];
  return parts.join(" · ");
}

function fromPick(ctx: PickPanelContext): PlaceholderContext {
  return {
    data: ctx.data,
    phase: ctx.phase,
    ...(ctx.data === "academic.results" ? { results: ctx.results ?? "points" } : {}),
    focus: ctx.focus.kind,
    compare: [...ctx.compare.kinds],
    time: ctx.time,
    summary: summaryLine(ctx, true),
    where: [ctx.labels?.dashboard, ctx.labels?.column, ctx.labels?.row].filter(Boolean).join(" · "),
  };
}

export function plannedMarkdown(config: DashboardConfig, requests: ViewRequestRow[] | null, today = new Date().toISOString().slice(0, 10)): string {
  const out: string[] = [`# Planned views: ${config.name}`, ""];
  const placeholders = config.panels.flatMap((p) =>
    p.dataviews.flatMap((v) => {
      if (v.kind !== "placeholder") return [];
      const col = config.columns.find((c) => c.id === p.column)?.title ?? p.column;
      const row = config.rows.find((r) => r.id === p.row)?.name ?? p.row;
      return [{ v, where: `${col} · ${row}`, panel: p.id }];
    }),
  );
  out.push(`Exported ${today} from \`${config.id}\`. ${placeholders.length} placeholder${placeholders.length === 1 ? "" : "s"}${requests ? `, ${requests.length} request${requests.length === 1 ? "" : "s"}` : ""}. Build each as a \`draft\` dataview with the context below; the editor shows "Ready to swap in" when one matches.`, "");
  out.push(`## Placeholders (${placeholders.length})`, "");
  if (!placeholders.length) out.push("None on this dashboard.", "");
  placeholders.forEach(({ v, where, panel }, i) => {
    if (v.kind !== "placeholder") return;
    out.push(`${i + 1}. **${v.description}** (${where}, panel \`${panel}\`)`);
    if (v.context) {
      out.push(`   - Context: ${contextLine(v.context)}`);
      if (v.context.summary) out.push(`   - In words: ${v.context.summary}`);
    } else out.push("   - Context: not saved (planned before S5)");
    out.push(`   - Shape: ${v.shape ? VIEW_TYPE_LABEL[v.shape].toLowerCase() : "not sure"}`);
    if (v.notes) out.push(`   - Notes: ${v.notes}`);
  });
  if (requests) {
    out.push("", `## Asked for by users (${requests.length})`, "");
    if (!requests.length) out.push("No open requests.");
    requests.forEach((r, i) => {
      const c = fromPick(r.context);
      out.push(`${i + 1}. **${r.description.trim() || "(no description)"}** (asked ${r.created_at.slice(0, 10)}${c.where ? `, from ${c.where}` : ""}${r.panel_id ? `, panel \`${r.panel_id}\`` : ""})`);
      out.push(`   - Context: ${contextLine(c)}`);
      if (c.summary) out.push(`   - In words: ${c.summary}`);
    });
  } else out.push("", "_Requests: the view_requests table isn't there yet (S4 migration not applied), so this lists placeholders only._");
  return out.join("\n") + "\n";
}
