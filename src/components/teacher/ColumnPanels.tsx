"use client";

// Teacher view, round 6: the card mechanism (brief §3, §6.6). Content round S10 replaced
// its Add/remove pair with an open/shut toggle per panel.
//
// Rules this component owns, so no column can implement them differently:
//   1. PANEL_ORDER is the render order, and every panel is always there -- there is
//      nothing to add back, so there is no "+ Add" and no remove "x". Two since the Trends
//      row merge round: Current, then Trends (Trend's and % change's views in one rail).
//   2. A standard accordion (accordion round, revising S10's independent toggles):
//      opening a panel closes the other, and closing the open one leaves both
//      collapsed. The one open panel gets the room -- see PANEL_HEIGHT. A collapsed panel
//      is a one-line header bar carrying the panel's own headline figure, not a bare title.
//   3. The open set is what the page persists, under the key the present set used to use
//      -- see panelsFrom for why that keeps everyone's saved panels.
//
// Each column supplies its own panel contents through `render`; this file knows nothing
// about measures, subjects or schools.
import { useEffect, useRef, type ReactNode } from "react";
import { CardBox } from "./CardBox";
import { ChevronDown, IconButton } from "./PanelIcons";
import { PanelExport, PanelNote } from "./PanelFooter";
import { PANEL_ORDER, togglePanel, type PanelId } from "@/lib/teacher-view-panels";
import { usePlanColumn } from "@/components/dashboard-config/plan";
import { PanelBoundary, PlannedPanel } from "@/components/dashboard-config/ConfigDashboard";
import { configuredRail, defaultEntry, offRailEntry, railEntries, type RailEntry } from "@/components/dashboard-config/rail";
import { followsResultsPill } from "@/catalogue/results";
import { DATAVIEWS } from "@/catalogue/dataviews";
import type { DashboardConfig, HostId, PanelConfig } from "@/catalogue/types";
import { useDashboardRuntime, type DashboardRuntime } from "@/components/dashboard-config/runtime";
import { CopyViewSourceContext, type CopyViewSourceValue } from "@/components/copy-view/CopyViewSourceContext";
import { copySourceFor } from "@/lib/pin-context";

// What each panel is called in its toggle's label.
const PANEL_NAME: Record<PanelId, string> = { current: "current", trend: "trends" };

// Round 8 §6: one private note per person per panel. The page owns the school and the
// Supabase client, so it supplies the reader and the writer and this only routes them.
export type PanelNotes = {
  bodyFor: (panelId: PanelId) => string | null;
  onSave: (panelId: PanelId, body: string) => Promise<void> | void;
};

export type PanelRender = {
  // The pill at the top-left of the panel: "Current — 2024/25", "Candidates — 2021/22 to
  // 2024/25".
  tag: string;
  // Controls that sit before the pill rather than in the icon row -- Context's year
  // prev/next pair, which the wireframe puts either side of the tag.
  beforeTag?: ReactNode;
  // Controls that sit straight after the title -- S11's "From {year} ▾" start-year menu
  // on Trends and % Change.
  afterTag?: ReactNode;
  // The full natural-language question, used as the fullscreen modal's heading (§14).
  question: string;
  // View-toggle icons, which sit before the fullscreen button.
  actions?: ReactNode;
  // The chip row and pill row under the header.
  controls?: ReactNode;
  body: (fullscreen: boolean) => ReactNode;
  summary?: ReactNode;
  source?: ReactNode;
  // S10: the figure a COLLAPSED panel shows in its header bar -- the panel's own lead
  // value (the focused subject's figure, the trend's direction, its % change), reused
  // rather than computed again for the bar.
  headline?: ReactNode;
  // S12: the footer's own leading control (Trend's "Trend line") and right-aligned flag
  // (Trend's growth/decline word) -- see CardBox.
  footerLead?: ReactNode;
  flag?: ReactNode;
  // Trend map/legend round: the fullscreen rail's first section -- Trend's per-subject
  // show/hide list ("Subjects shown"). Rail-only; the card never renders it.
  legend?: ReactNode;
  // Column 3 round Part 1 -- see CardBox: a caption shown without a click, and a visible
  // "Full screen" invitation.
  visibleCaption?: ReactNode;
  suggestFullscreen?: boolean;
};

export function ColumnPanels({
  columnId,
  host,
  panels,
  onPanelsChange,
  controls,
  notes,
  render,
}: {
  columnId: string;
  // VicData 0.6 E: which registered column host is drawing (catalogue HostId), so under a
  // config each rail entry maps to its dataview id (rail.tsx). Unused without a plan.
  host?: HostId;
  panels: PanelId[];
  onPanelsChange: (next: PanelId[]) => void;
  // The column's own data controls -- Results' measure pill, Context's and Comparisons'
  // pills. They sit under the card header, above the panels.
  controls?: ReactNode;
  // Round 8 §6: the private note, one per person per PANEL. Owned by the page, which holds
  // the school and the Supabase client; this just gives each panel its own slot.
  notes?: PanelNotes;
  render: Partial<Record<PanelId, PanelRender>>;
}) {
  // VicData 0.6: under ?renderer=config the dashboard's config decides the rows -- their
  // order, which of them this column draws, the accordion behaviour -- and each panel
  // gets its own error boundary. With no plan (every unflagged page) this is skipped and
  // the column renders exactly as before.
  const planned = usePlanColumn(columnId);
  // VicData 0.6 integration: the dashboard's runtime state (school, focus, measure, sets),
  // provided only under a plan -- each panel tells its Export menu what to copy.
  const runtime = useDashboardRuntime();

  // VicData 0.6 E: under a config, each panel's rail is the config's views in config
  // order, and the panel opens on its defaultView -- switched to once, on first show, by
  // the host's own rail button (so the host keeps owning its view state). Seeded Teacher
  // configs list today's full rails with today's defaults, so nothing is switched there.
  //
  // 0.6 snag 3 / 03: on a Results dashboard the rail is the views shown on the current pill
  // (catalogue/results.ts), and a pill state with its own default opens on it the first
  // time that state shows. Configs without the new fields give exactly the hosts' rails.
  const results = planned && runtime && followsResultsPill(planned.plan.config) ? runtime.results : null;
  const pendingDefaults: { key: string; first: RailEntry | null; off: RailEntry | null }[] = [];
  if (planned && host) {
    const seen = new Set<PanelId>();
    for (const { row, panel: cfg } of planned.column.rows) {
      if (!cfg || cfg.dataviews.every((v) => v.kind === "placeholder")) continue;
      const id = cfg.legacy?.panelId ?? row.legacyPanelId ?? hostPanelOf(cfg);
      const raw = id ? render[id] : undefined;
      if (!id || !raw || seen.has(id)) continue;
      seen.add(id);
      const entries = railEntries(raw.actions, host, id);
      const ownKey = results && cfg.defaultViewByResults?.[results] ? `${cfg.id}:${results}` : cfg.id;
      pendingDefaults.push({ key: ownKey, first: defaultEntry(entries, cfg, results), off: offRailEntry(entries, cfg, results) });
    }
  }
  const applied = useRef(new Set<string>());
  useEffect(() => {
    for (const { key, first, off } of pendingDefaults) {
      if (first && !applied.current.has(key)) {
        applied.current.add(key);
        first.onClick?.();
        continue;
      }
      // Its view was taken off this pill: move to one that's on it.
      off?.onClick?.();
    }
  });

  const card = (id: PanelId, panel: PanelRender, toggleOverride?: () => void) => {
        const open = panels.includes(id);
        const toggle = toggleOverride ?? (() => onPanelsChange(togglePanel(panels, id)));
        return (
          <CardBox
            key={`${columnId}-${id}`}
            collapsed={!open}
            onExpand={toggle}
            headline={panel.headline}
            footerLead={panel.footerLead}
            flag={panel.flag}
            legend={panel.legend}
            visibleCaption={panel.visibleCaption}
            suggestFullscreen={panel.suggestFullscreen}
            title={panel.tag}
            question={panel.question}
            tag={
              // Round 7 §2: plain text, no pill. The tinted pill it replaced read as a
              // button on the real dashboard, and nothing about a panel heading is
              // clickable. Scaled up from 11px so dropping the background is not read as
              // a demotion.
              <span className="flex flex-wrap items-center gap-1.5">
                {panel.beforeTag}
                <span className="text-[13px] font-semibold text-[var(--fg)]">{panel.tag}</span>
                {panel.afterTag}
              </span>
            }
            actions={panel.actions}
            trailingActions={
              <IconButton label={`Collapse ${PANEL_NAME[id]}`} onClick={toggle}>
                <span className="flex rotate-180">{ChevronDown}</span>
              </IconButton>
            }
            controls={panel.controls}
            caption={panel.summary}
            source={panel.source}
            footerActions={({ print, fullscreen }) => (
              <>
                {/* In fullscreen the note has its own place in the side rail (Part 4). */}
                {notes && !fullscreen && (
                  <PanelNote body={notes.bodyFor(id)} onSave={(body) => notes.onSave(id, body)} />
                )}
                <PanelExport onPrint={print} />
              </>
            )}
            note={notes ? { body: notes.bodyFor(id), onSave: (body) => notes.onSave(id, body) } : undefined}
            // Round 8 §2: every panel the same height, so the three columns read as one
            // 3x3 grid rather than three ragged stacks.
            fixedHeight
          >
            {({ fullscreen }) => panel.body(fullscreen)}
          </CardBox>
        );
  };

  if (planned) {
    const { plan, column } = planned;
    // D10: per layout. auto-close is today's standard accordion (togglePanel);
    // independent opens and closes each panel on its own.
    const independent = plan.config.layout.accordion === "independent";
    const embed = plan.embed;
    const drawn = new Set<PanelId>();
    const panelsShown = column.rows.map(({ row, panel: cfg }) => {
          if (!cfg) return null;
          if (cfg.dataviews.every((v) => v.kind === "placeholder")) return plan.superAdmin ? <PlannedPanel key={cfg.id} panel={cfg} /> : null;
          // A config written by the editor need not carry today's legacy ids: the panel is
          // whichever of the host's two panels its views are registered under.
          const id = cfg.legacy?.panelId ?? row.legacyPanelId ?? hostPanelOf(cfg);
          const raw = id ? render[id] : undefined;
          if (!id || !raw) return null;
          // Each host draws one Current and one Trends panel per column (0.6 limitation).
          if (drawn.has(id)) return <PanelLimitNote key={cfg.id} panelId={cfg.id} text="This column already shows this panel. For now a column can show each of its Current and Trends panels once." />;
          drawn.add(id);
          // Snag 1 item 00: a panel renamed in the editor shows its name in place of the
          // host's own tag. Seeded configs carry no name, so they draw the host's tag as before.
          let panel = cfg.name ? { ...raw, tag: cfg.name } : raw;
          if (host) {
            panel = { ...panel, actions: configuredRail(railEntries(raw.actions, host, id), cfg, results) };
          }
          if (embed?.frame === "figure") {
            // A meeting slot (or another frame that brings its own card): the figure alone,
            // filling the room it is given. Title, source, note and export are the slot's.
            return (
              <div key={cfg.id} data-panel-id={cfg.id} data-embed="figure" className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto">
                <PanelBoundary panelId={cfg.id} title={panel.tag}>
                  {panel.body(embed.fullscreen)}
                </PanelBoundary>
              </div>
            );
          }
          const toggle = independent
            ? () => onPanelsChange(panels.includes(id) ? panels.filter((p) => p !== id) : [...panels, id])
            : undefined;
          const copy = runtime && host ? copyValueFor(plan.config, cfg, railEntries(raw.actions, host, id), runtime) : null;
          return (
            <div key={cfg.id} data-panel-id={cfg.id} data-row-time={row.time} data-override={cfg.override?.badge}>
              <PanelBoundary panelId={cfg.id} title={panel.tag}>
                {copy ? <CopyViewSourceContext.Provider value={copy}>{card(id, panel, toggle)}</CopyViewSourceContext.Provider> : card(id, panel, toggle)}
              </PanelBoundary>
            </div>
          );
        });
    if (embed?.frame === "figure") return <>{panelsShown}</>;
    return (
      <div>
        {/* An embedded view's settings are pinned, so the column's own pills stay off. */}
        {controls && !embed && <div className="mt-2.5 print:hidden">{controls}</div>}
        {panelsShown}
      </div>
    );
  }

  return (
    <div>
      {controls && <div className="mt-2.5 print:hidden">{controls}</div>}

      {PANEL_ORDER.map((id) => {
        const panel = render[id];
        if (!panel) return null;
        return card(id, panel);
      })}
    </div>
  );
}

// VicData 0.6 integration: what "Copy this view…" copies from a configured panel -- the
// view its rail has selected (else its default view), in the panel's context resolved
// with the page's real labels, pinned from the dashboard's runtime state.
function copyValueFor(config: DashboardConfig, cfg: PanelConfig, entries: RailEntry[], runtime: DashboardRuntime): CopyViewSourceValue | null {
  const views = cfg.dataviews.flatMap((v) => (v.kind === "view" ? [v] : []));
  const active = entries.find((e) => e.active)?.dataview;
  const instance = views.find((v) => v.dataview === active) ?? views.find((v) => v.id === cfg.defaultView) ?? views[0];
  if (!instance) return null;
  try {
    return { source: copySourceFor(config, cfg.id, instance, runtime), superAdmin: runtime.superAdmin };
  } catch {
    return null;
  }
}

// Current panel rework round 1: every Current tag is the fixed word "Current", and the year
// its figures are for sits after it as plain, regular-weight text ("Data 2024/25") -- the
// panel's afterTag. `children` is the year: a formatted label, or Context's year menu.
export function DataDate({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-[13px] font-normal text-[var(--muted2)]">
      Data {children}
    </span>
  );
}

// The summary strip under a panel's figure -- the wireframe's own grey box. Trend's
// variant leads with a coloured direction word and arrow; everything else is one
// sentence. Shared so all four columns phrase their conclusion in the same shape.
export function PanelSummary({ lead, leadColour, children }: { lead?: string; leadColour?: string; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-baseline gap-1.5 rounded-lg bg-[var(--box-bg)] px-2.5 py-2 text-xs leading-relaxed text-[var(--muted2)]">
      {lead && <span className="font-bold whitespace-nowrap" style={{ color: leadColour }}>{lead}</span>}
      <span>{children}</span>
    </span>
  );
}

// Which of a host's two panels (Current, Trends) a configured panel is: the panel its
// first registered view is drawn in.
function hostPanelOf(cfg: PanelConfig): PanelId | undefined {
  for (const v of cfg.dataviews) {
    if (v.kind !== "view") continue;
    const dv = DATAVIEWS.find((d) => d.id === v.dataview);
    if (dv) return dv.host.panel;
  }
  return undefined;
}

// A clear note where a config asks for something the 0.6 renderer can't draw yet, at the
// panel's own size.
export function PanelLimitNote({ panelId, text }: { panelId: string; text: string }) {
  return (
    <div
      data-panel-id={panelId}
      data-panel-limit=""
      className="mt-3 flex items-center justify-center rounded-[10px] border border-dashed border-[var(--panel-border2)] p-4 text-center text-[12.5px] leading-relaxed text-[var(--muted2)]"
    >
      {text}
    </div>
  );
}
