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
import type { ReactNode } from "react";
import { CardBox } from "./CardBox";
import { ChevronDown, IconButton } from "./PanelIcons";
import { PanelExport, PanelNote } from "./PanelFooter";
import { PANEL_ORDER, togglePanel, type PanelId } from "@/lib/teacher-view-panels";
import { usePlanColumn } from "@/components/dashboard-config/plan";
import { PanelBoundary, PlannedPanel } from "@/components/dashboard-config/ConfigDashboard";

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
  panels,
  onPanelsChange,
  controls,
  notes,
  render,
}: {
  columnId: string;
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
    return (
      <div>
        {controls && <div className="mt-2.5 print:hidden">{controls}</div>}
        {column.rows.map(({ row, panel: cfg }) => {
          if (!cfg) return null;
          if (cfg.dataviews.every((v) => v.kind === "placeholder")) return plan.superAdmin ? <PlannedPanel key={cfg.id} panel={cfg} /> : null;
          const id = cfg.legacy?.panelId ?? row.legacyPanelId;
          const panel = id ? render[id] : undefined;
          if (!id || !panel) return null;
          const toggle = independent
            ? () => onPanelsChange(panels.includes(id) ? panels.filter((p) => p !== id) : [...panels, id])
            : undefined;
          return (
            <div key={cfg.id} data-panel-id={cfg.id} data-row-time={row.time} data-override={cfg.override?.badge}>
              <PanelBoundary panelId={cfg.id} title={panel.tag}>
                {card(id, panel, toggle)}
              </PanelBoundary>
            </div>
          );
        })}
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
