// VicData 0.6.1 S1 (pinch point 1): the words a version's change summary uses for a view,
// as members read it in "Updated — what's changed" -- never a raw placeholder
// ("[subject] results from [from-year]") and never a catalogue-internal view name ("Area
// chart"). One summary serves every school, so placeholders resolve to neutral words
// ("This subject") where no member context is known.
//
//   summaryViewName   the name diffConfigs (editor-ops) writes for a view: its title as
//                     the page resolves it for the panel, with no school
//   memberSummary     a stored summary made member-facing at display: summaries published
//                     before this fix still carry placeholders and internal names, and a
//                     member can read only the published version (RLS), not the one it was
//                     diffed against, so it is rewritten from its own words and the current
//                     config
//
// Tests: src/lib/change-summary.test.ts
import { DATAVIEWS } from "@/catalogue/dataviews";
import { contextFromPanel, instanceTitle, titleTemplateOf, VIEW_TYPE_LABEL } from "@/catalogue/pick";
import { effectiveResults, followsResultsPill } from "@/catalogue/results";
import type { DashboardConfig, Dataview, DataviewInstance, HostId, PanelConfig, ResultsMeasure } from "@/catalogue/types";
import { viewInstance } from "@/catalogue/viewspec";

// Plain words for a placeholder no context can fill (as resolveTitle and fillTileLabel
// fall back) -- never a bracketed token.
const NEUTRAL: Record<string, string> = {
  subject: "this subject",
  category: "its category",
  "comparison-group": "its category",
  set: "comparator schools",
  "comparison-set": "comparator schools",
  versus: "comparator schools",
  school: "this school",
  measure: "the measure",
  year: "the chosen year",
  "from-year": "the first year",
  "compare year": "the latest year",
  "change year": "the latest year",
  "change-word": "change",
  "change-of-measure": "change",
  "Entries|Results": "entries",
  range: "the range",
};

// Fill any [token] with neutral words; a token that opens the text or a quoted title opens
// capitalised.
export function neutralWords(text: string): string {
  return text.replace(/\[([^\]]*)\]/g, (_, t: string, at: number) => {
    const w = NEUTRAL[t] ?? (t.trim() || "this");
    return at === 0 || /[“"]$/.test(text.slice(0, at)) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
}

const RESULTS_WORDS: [RegExp, ResultsMeasure][] = [
  [/Average points/, "points"],
  [/Grade 4\+ rate|A\*–E rate/, "threshold"],
  [/Grade bands/, "bands"],
  [/Grade counts/, "counts"],
];

// A view's name in a summary: its own title or its dataview's, resolved for the panel's
// context with no school. On a Results dashboard, a view not drawn on Average points reads
// with the first measure it is drawn on (`results` overrides).
export function summaryViewName(config: DashboardConfig, panel: PanelConfig, v: DataviewInstance, results?: ResultsMeasure): string {
  if (v.kind === "placeholder") return neutralWords(v.description);
  let measure = results;
  if (!measure && followsResultsPill(config)) {
    const on = effectiveResults(v);
    if (on.length && !on.includes("points")) measure = on[0];
  }
  try {
    return neutralWords(instanceTitle(v, contextFromPanel(config, panel.id, measure ? { results: measure } : {})));
  } catch {
    const dv = DATAVIEWS.find((d) => d.id === v.dataview);
    return neutralWords(v.title ?? (dv ? titleTemplateOf(dv) : "a view"));
  }
}

const isInternalLabel = (s: string) => DATAVIEWS.some((d) => d.label === s);

// The hosts a configured column's views can be registered under: Results' Column 1 also
// draws Grade counts' own panels.
function hostsOf(host: HostId | undefined): HostId[] {
  if (!host) return [];
  return host === "teacher.c1.results" ? [host, "teacher.c1.counts"] : [host];
}

// Where a clause's view sits: the first "Column · Row" of the config named in it.
function placeIn(config: DashboardConfig, text: string): PanelConfig | null {
  let best: { at: number; p: PanelConfig } | null = null;
  for (const p of config.panels) {
    const col = config.columns.find((c) => c.id === p.column)?.title;
    const row = config.rows.find((r) => r.id === p.row)?.name;
    if (!col || !row) continue;
    const at = text.indexOf(`${col} · ${row}`);
    if (at >= 0 && (!best || at < best.at)) best = { at, p };
  }
  return best?.p ?? null;
}

// A plain description for an internal name no place pins down: the one dataview's
// neutral title when the name is unique, else its kind of view ("a table").
function plainForLabel(label: string): string {
  const dvs = DATAVIEWS.filter((d) => d.label === label);
  const titles = new Set(dvs.map((d) => neutralWords(titleTemplateOf(d))));
  if (titles.size === 1) return [...titles][0];
  const kinds = new Set(dvs.map((d) => d.supports.viewType));
  if (kinds.size === 1) {
    const k = VIEW_TYPE_LABEL[[...kinds][0]].toLowerCase();
    return `a ${k === "numerical" ? "set of numbers" : k}`;
  }
  return "a view";
}

function nameFor(config: DashboardConfig | null, name: string, clause: string): string {
  if (!name.includes("[") && !isInternalLabel(name)) return name;
  if (!isInternalLabel(name)) return neutralWords(name);
  const panel = config ? placeIn(config, clause) : null;
  if (config && panel) {
    const results = RESULTS_WORDS.find(([re]) => re.test(clause))?.[1];
    const own = panel.dataviews.find((v) => v.kind === "view" && DATAVIEWS.find((d) => d.id === v.dataview)?.label === name);
    if (own) return summaryViewName(config, panel, own, results);
    // A view no longer in the panel (removed): the catalogue's view of that label on the
    // panel's host, read in the panel's context.
    const host = config.columns.find((c) => c.id === panel.column)?.host;
    const row = config.rows.find((r) => r.id === panel.row);
    const which = row?.legacyPanelId ?? (row?.time === "latest" ? "current" : "trend");
    const dv: Dataview | undefined = DATAVIEWS.find((d) => hostsOf(host).includes(d.host.id) && d.host.panel === which && d.label === name);
    if (dv) return summaryViewName(config, panel, viewInstance(`${panel.id}/${dv.id}`, dv.id), results);
  }
  return plainForLabel(name);
}

// A stored change summary as members read it. `config`: the version it was published with
// (to place and resolve the views it names); null = words only.
export function memberSummary(summary: string, config: DashboardConfig | null): string {
  const parts = summary.split(/(\*[^*]+\*)/g);
  return parts
    .map((part, i) => {
      if (!(part.startsWith("*") && part.endsWith("*") && part.length > 2)) return neutralWords(part);
      // The clause the name sits in: from the last "; " before it to the next one after.
      const before = parts.slice(0, i).join("");
      const after = parts.slice(i + 1).join("");
      const clause = before.slice(before.lastIndexOf("; ") + 1) + part + after.split("; ")[0];
      return `*${nameFor(config, part.slice(1, -1), clause)}*`;
    })
    .join("");
}
