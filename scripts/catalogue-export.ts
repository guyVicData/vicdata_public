import { execFileSync } from "node:child_process";
// Generates docs/catalogue/*.md from src/catalogue (catalogue doc §2.5 output 2).
//
//   npx -y tsx scripts/catalogue-export.ts
//
// Writes rules.md, measures.md, renderers.md, dataviews.md, README.md and, once
// src/catalogue/dashboards/index.ts exists, dashboards.md. Tables follow the card formats
// of docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md §2.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DATAVIEWS, MEASURES, RENDERERS, RULES, measureById, type DashboardConfig, type Dataview, type Geography } from "../src/catalogue";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs/catalogue");
const HEADER = "<!-- Generated from src/catalogue by scripts/catalogue-export.ts — do not edit. -->\n\n";

// Markdown table cell: pipes escaped, newlines flattened.
const cell = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "—";
  const s = Array.isArray(v) ? (v.length ? v.join(", ") : "—") : String(v);
  return s.replace(/\|/g, "\\|").replace(/\n+/g, " ");
};
const table = (headers: string[], rows: unknown[][]) =>
  [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");
const card = (title: string, fields: [string, unknown][]) => `### ${title}\n\n${table(["Field", "Content"], fields.map(([k, v]) => [k, v]))}\n`;
const bullets = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("<br>") : "—");

function write(name: string, body: string) {
  writeFileSync(path.join(OUT, name), HEADER + body.trimEnd() + "\n");
  console.log(`wrote docs/catalogue/${name}`);
}

// Where each dataview is placed on the seeded dashboards ("Used on", generated).
function usedOn(dashboards: DashboardConfig[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const d of dashboards) {
    for (const p of d.panels) {
      const col = d.columns.find((c) => c.id === p.column)?.title ?? p.column;
      const row = d.rows.find((r) => r.id === p.row)?.name ?? p.row;
      for (const v of p.dataviews) {
        if (v.kind !== "view") continue;
        const list = out.get(v.dataview) ?? [];
        list.push(`${d.name} › ${col} › ${row}`);
        out.set(v.dataview, list);
      }
    }
  }
  return out;
}

async function loadDashboards(): Promise<DashboardConfig[] | null> {
  const file = path.join(ROOT, "src/catalogue/dashboards/index.ts");
  if (!existsSync(file)) return null;
  try {
    const mod = (await import(pathToFileURL(file).href)) as { DASHBOARDS?: DashboardConfig[] };
    return mod.DASHBOARDS ?? null;
  } catch (e) {
    console.warn(`dashboards: could not load src/catalogue/dashboards/index.ts (${(e as Error).message}); skipping dashboards.md`);
    return null;
  }
}

function taggedAt(id: string): string[] {
  try {
    const out = execFileSync("grep", ["-rlw", "--include=*.ts", "--include=*.tsx", id, "src"], { encoding: "utf8" });
    return out.split("\n").filter((f) => f && !f.startsWith("src/catalogue/")).sort();
  } catch {
    return []; // grep exits 1 when nothing matches
  }
}

function rulesMd() {
  const active = RULES.filter((r) => r.status === "active");
  const mustLift = RULES.filter((r) => r.lift);
  const summary = table(
    ["ID", "Status", "Statement", "Must lift", "Test", "Open issue"],
    RULES.map((r) => [
      r.id,
      r.status === "superseded" ? `superseded by ${r.supersededBy}` : r.status,
      r.statement,
      r.lift ? (r.lift.lifted ? "lifted" : "yes, not yet lifted") : "no",
      r.testCase ? (r.testCase.check ? `auto: ${r.testCase.check}` : "manual") : "none yet",
      r.openIssue ? "yes" : "",
    ]),
  );
  const cards = RULES.map((r) =>
    card(r.id, [
      ["Statement", r.statement],
      ["Why", r.why],
      ["Applies to", r.appliesTo],
      ["Enforced in", bullets(r.enforcedIn)],
      // Found by grepping src/ for the rule's ID tag, so the list can't go stale.
      ["Tagged at", bullets(taggedAt(r.id))],
      [
        "Test case",
        r.testCase
          ? `${r.testCase.school} (${r.testCase.urn})${r.testCase.phase ? `, ${r.testCase.phase}` : ""}${r.testCase.subject ? `, ${r.testCase.subject}` : ""}${r.testCase.year ? `, ${r.testCase.year}` : ""}: ${r.testCase.expect}${r.testCase.check ? ` [runner: ${r.testCase.check}]` : " [manual]"}`
          : "—",
      ],
      ["Origin", r.origin],
      ["Status", r.status === "superseded" ? `superseded by ${r.supersededBy}` : r.status],
      ["Must lift", r.lift ? `${r.lift.from} → ${r.lift.to} (${r.lift.lifted ? "lifted" : "not yet lifted"})${r.lift.note ? `. ${r.lift.note}` : ""}` : "—"],
      ["Open issue", r.openIssue ?? "—"],
    ]),
  ).join("\n");
  write(
    "rules.md",
    `# Rules\n\nWhat a number is allowed to be. ${RULES.length} rules: ${active.length} active, ${RULES.length - active.length} superseded; ${mustLift.length} must lift (enforced only in UI code before 0.6).\n\n## Summary\n\n${summary}\n\n## Cards\n\n${cards}`,
  );
}

const GEOS: Geography[] = ["school", "subject_area", "set", "la", "region", "england"];
const GEO_LABEL: Record<Geography, string> = { school: "School", subject_area: "Subject area", set: "Set", la: "LA", region: "Region", england: "England" };

function measuresMd() {
  const summary = table(
    ["ID", "Name", "Data", "Phase", "Years", ...GEOS.map((g) => GEO_LABEL[g]), "Number types"],
    MEASURES.map((m) => [m.id, m.name, m.results ? `${m.data} (${m.results})` : m.data, m.phase ?? "—", `${m.years.from}–${m.years.to}`, ...GEOS.map((g) => (m.geographies[g].ok ? "✓" : "✗")), m.numberTypes]),
  );
  const cards = MEASURES.map((m) =>
    card(`${m.id} — ${m.name}`, [
      ["Definition", m.definition],
      ["Data", m.results ? `${m.data} · ${m.results}` : m.data],
      ["Grain", m.grain],
      ["Sources", m.sources],
      ["Keying", m.keying],
      ["Years", `${m.years.from} → ${m.years.to}${m.years.note ? `. ${m.years.note}` : ""}`],
      ...GEOS.map((g): [string, unknown] => [GEO_LABEL[g], `${m.geographies[g].ok ? "✓" : "✗"}${m.geographies[g].reason ? ` ${m.geographies[g].reason}` : ""}`]),
      ["Honest number types", m.numberTypes],
      ["Rules", m.rules],
      ["Fetched by", bullets(m.fetchedBy)],
      ["Known gaps", bullets(m.knownGaps)],
      ["Briefing", m.briefing ?? "none"],
      ["Citation", m.citation],
    ]),
  ).join("\n");
  write("measures.md", `# Measures\n\nWhat is counted, at what grain, where, with which honest number types. ${MEASURES.length} measures.\n\n## Summary\n\n${summary}\n\n## Cards\n\n${cards}`);
}

function renderersMd() {
  const cards = RENDERERS.map((r) =>
    card(`${r.id} — ${r.component}`, [
      ["File", r.file],
      ["Accepts", r.accepts],
      ["Empty", r.states.empty],
      ["Suppressed", r.states.suppressed],
      ["Partial", r.states.partial],
      ["Loading", r.states.loading],
      ["Min height", r.minHeight],
      ["Fullscreen", r.fullscreen],
      ["Phone", r.phone],
      ["Used by", DATAVIEWS.filter((d) => d.renderer === r.id).map((d) => d.id)],
    ]),
  ).join("\n");
  write("renderers.md", `# Renderers\n\nShape requirements only, no rules. ${RENDERERS.length} renderers.\n\n${cards}`);
}

function dataviewsMd(used: Map<string, string[]> | null) {
  const supports = (d: Dataview) => d.supports;
  const summary = table(
    ["ID", "Status", "Host / rail", "Data", "Focus", "Compare", "Numbers", "Date", "View", "Renderer"],
    DATAVIEWS.map((d) => [
      d.id,
      d.status,
      `${d.host.id} · ${d.host.panel} · ${d.host.rail ?? "(no rail)"}`,
      supports(d).results ? `${supports(d).data.join(", ")} (${supports(d).results!.join(", ")})` : supports(d).data,
      supports(d).focus,
      supports(d).compare.length ? supports(d).compare : "none",
      supports(d).numberType,
      supports(d).dateMode,
      supports(d).viewType,
      d.renderer,
    ]),
  );
  const cards = DATAVIEWS.map((d) =>
    card(`${d.id} — ${d.label}`, [
      ["Measures", d.measures.map((m) => `${m} (${measureById(m)?.name ?? "?"})`)],
      ["Data", d.supports.data],
      ["Results sub-measures", d.supports.results ?? "—"],
      ["Phases", d.supports.phases],
      ["Focus", d.supports.focus],
      ["Compare", d.supports.compare.length ? d.supports.compare : "none"],
      ["Number types", d.supports.numberType],
      ["Date mode", d.supports.dateMode],
      ["View type", d.supports.viewType],
      ["Renderer", d.renderer],
      ["Title template", d.titleTemplate || "(none)"],
      ["Title fallback", d.titleFallback],
      ["Requires (card warning)", d.requires],
      ["Params", d.params],
      ["Rail icon", d.railIcon],
      ["Host", `${d.host.id}, ${d.host.panel}, rail "${d.host.rail ?? "(none)"}" (${d.host.file})`],
      ["Audience", d.audience],
      ["Status", d.status],
      ["Verified at", d.verifiedAt.length ? d.verifiedAt : "not yet"],
      ["Origin", d.origin],
      ["Rules", d.rules],
      ["Used on", used ? (used.get(d.id) ?? ["not placed"]) : "(dashboards not seeded yet)"],
      ["Note", d.note],
    ]),
  ).join("\n");
  const live = DATAVIEWS.filter((d) => d.status === "live").length;
  write(
    "dataviews.md",
    `# Dataviews\n\nThe registered recipes the chooser offers and dashboards place, in host then rail order. ${DATAVIEWS.length} dataviews: ${live} live, ${DATAVIEWS.length - live} draft.\n\n## Summary\n\n${summary}\n\n## Cards\n\n${cards}`,
  );
}

function dashboardsMd(dashboards: DashboardConfig[]) {
  const sections = dashboards.map((d) => {
    const cols = table(
      ["Column", "Title", "Data", "Focus", "Compare", "Host"],
      d.columns.map((c) => [
        c.id,
        c.title,
        `${c.data.data} · ${c.data.phase}${c.data.results ? ` · ${c.data.results}` : ""}`,
        c.focus.kind,
        c.compare ? c.compare.kinds : "none",
        c.host ?? "—",
      ]),
    );
    const rows = table(["Row", "Name", "Time", "Open by default"], d.rows.map((r) => [r.id, r.name, r.time, r.openByDefault ? "yes" : "no"]));
    const panels = table(
      ["Panel", "Column", "Row", "Override", "Dataviews (rail order)", "Default"],
      d.panels.map((p) => [
        p.id,
        p.column,
        p.row,
        p.override ? `${p.override.badge} (${p.override.reason})` : "",
        p.dataviews.map((v) => (v.kind === "view" ? v.dataview : `placeholder: ${v.description}`)),
        p.defaultView?.split("/").pop() ?? "",
      ]),
    );
    return `## ${d.name} (\`${d.id}\`)\n\nOwner ${d.owner} · ${d.kind} · layout ${d.layout.preset} (${d.layout.accordion})${d.group ? ` · group ${d.group.label} #${d.group.order}` : ""}\n\n### Columns\n\n${cols}\n\n### Rows\n\n${rows}\n\n### Panels\n\n${panels}\n`;
  });
  write("dashboards.md", `# Dashboards\n\nSeeded dashboard configs (src/catalogue/dashboards). ${dashboards.length} dashboards.\n\n${sections.join("\n")}`);
}

function readmeMd(dashboards: DashboardConfig[] | null) {
  const lifted = RULES.filter((r) => r.lift?.lifted).length;
  const mustLift = RULES.filter((r) => r.lift).length;
  const automated = RULES.filter((r) => r.testCase?.check).length;
  write(
    "README.md",
    `# VicData catalogue

The four-layer catalogue (docs/v0.6/vicdata_0_6_view_catalogue_and_offer_design_v1.md): rules → measures → renderers → dataviews. The code in \`src/catalogue/\` is the source of truth; these files are generated from it.

| File | Contents |
| --- | --- |
| [rules.md](rules.md) | ${RULES.length} rules (${mustLift} must lift, ${lifted} lifted; ${automated} with an automated real-data check in \`scripts/catalogue-rule-tests.ts\`) |
| [measures.md](measures.md) | ${MEASURES.length} measures |
| [renderers.md](renderers.md) | ${RENDERERS.length} renderers |
| [dataviews.md](dataviews.md) | ${DATAVIEWS.length} dataviews (${DATAVIEWS.filter((d) => d.status === "live").length} live) |
${dashboards ? `| [dashboards.md](dashboards.md) | ${dashboards.length} seeded dashboards |\n` : ""}
Regenerate: \`npx -y tsx scripts/catalogue-export.ts\`. Unit tests: \`npx -y tsx --test scripts/catalogue-unit-tests.ts\`. Rule tests against real data: \`npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts\`.
`,
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const dashboards = await loadDashboards();
  rulesMd();
  measuresMd();
  renderersMd();
  dataviewsMd(dashboards ? usedOn(dashboards) : null);
  if (dashboards) dashboardsMd(dashboards);
  readmeMd(dashboards);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
