"use client";

// Step 3, Pick (Ch3Pick.dc.html; Either rows: PickEither.dc.html) and its second tab,
// "Browse VicData dashboards" (scope brief §3; no board -- drawn in the same language).
import type { ReactNode } from "react";
import type { PickResult } from "@/catalogue/matching";
import { PHASE_ACCENT } from "@/lib/teacher-view-theme";
import type { BrowseCell, PickPanelContext } from "@/catalogue/pick";
import { browseMap, headerLine, metaLine, summaryLine, viewTitle, VIEW_TYPE_LABEL } from "@/catalogue/pick";
import type { Dataview } from "@/catalogue/types";
import { Body, Footer, PrimaryButton } from "@/components/teacher/chooser/ui";
import { AvHeader, ContextBox, GroupHeading, Seg2, StepLabel, ViewCard, WarnTag, railGlyph } from "./bits";
import { PickPreview } from "./PickPreview";
import type { LivePreviewContext } from "./LiveViewPreview";
import { L, PANEL_ASPECT } from "./layout";
import { useChooserWords } from "./words";

export type PickTab = "suggested" | "browse";
export type BrowsePick = { cell: BrowseCell; dv: Dataview; fits: boolean; badge: string | null; title: string };

const TIER_HEADING = {
  familiar: "Familiar — from VicData dashboards",
  vicdata: "On other VicData dashboards",
  also: "Also fits",
} as const;

export function accentFor(ctx: PickPanelContext): string {
  return PHASE_ACCENT[ctx.phase]?.hex ?? "#34d399";
}

function Tags({ r }: { r: PickResult }) {
  if (!r.warnings.length && r.dataview.status === "live") return null;
  return (
    <>
      {r.dataview.status === "draft" && (
        <span style={{ display: "block" }}>
          <WarnTag>Draft: only super-admins see it until it&apos;s live</WarnTag>
        </span>
      )}
      {r.warnings.map((w) => (
        <span key={w} style={{ display: "block" }}>
          {/* The registry's `requires` can cite a rule ID for builders; the card drops it. */}
          <WarnTag>{w.replace(/\s*\(R-[A-Z0-9-]+\)/g, "")}</WarnTag>
        </span>
      ))}
    </>
  );
}

function CustomiseLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", color: "var(--cc-blue)", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
      </svg>
      Customise the picked view
    </button>
  );
}

export function PickScreen({
  ctx,
  results,
  tab,
  onTab,
  selected,
  onSelect,
  browse,
  onBrowse,
  onChange,
  onBack,
  onClose,
  onCustomise,
  onAdd,
  liveFor,
}: {
  ctx: PickPanelContext;
  results: PickResult[];
  tab: PickTab;
  onTab: (t: PickTab) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  browse: BrowsePick | null;
  onBrowse: (cell: BrowseCell, dv: Dataview) => void;
  onChange: () => void;
  onBack: () => void;
  onClose: () => void;
  onCustomise: () => void;
  onAdd: () => void;
  // 0.6 integration: with a school context, each card's preview draws the real view.
  liveFor?: (dv: Dataview, ctx: PickPanelContext) => LivePreviewContext | null;
}) {
  const words = useChooserWords();
  const accent = accentFor(ctx);
  const card = (r: PickResult) => (
    <ViewCard
      key={r.dataview.id}
      on={selected === r.dataview.id}
      title={viewTitle(r.dataview, ctx)}
      meta={metaLine(r, ctx)}
      tags={<Tags r={r} />}
      icon={r.dataview.railIcon}
      preview={<PickPreview dataview={r.dataview} accent={accent} live={liveFor?.(r.dataview, ctx) ?? null} />}
      onClick={() => onSelect(r.dataview.id)}
    />
  );

  let list: ReactNode;
  if (ctx.time === "either") {
    // PickEither: grouped by date mode, familiar first inside each group.
    const latest = results.filter((r) => r.group === "latest");
    const over = results.filter((r) => r.group === "over_time");
    list = (
      <>
        {latest.length > 0 && <GroupHeading top={4}>Latest year</GroupHeading>}
        {latest.map(card)}
        {over.length > 0 && <GroupHeading top={4}>Over time</GroupHeading>}
        {over.map(card)}
      </>
    );
  } else {
    const tiers = (["familiar", "vicdata", "also"] as const).map((t) => ({ t, rs: results.filter((r) => r.tier === t) })).filter((x) => x.rs.length);
    list = tiers.map(({ t, rs }, i) => (
      <div key={t} style={{ display: "contents" }}>
        <GroupHeading colour={t === "familiar" ? "var(--av-familiar)" : "var(--cc-sub)"} top={i === 0 ? 2 : 4}>
          {TIER_HEADING[t]}
        </GroupHeading>
        {rs.map(card)}
      </div>
    ));
  }

  const canAdd = tab === "suggested" ? !!selected : !!browse;
  return (
    <>
      <AvHeader title="Add a view" subtitle={headerLine(ctx)} segs={3} onBack={onBack} onClose={onClose} />
      <Body gap={10}>
        <ContextBox label={words.from} line={summaryLine(ctx)} onChange={onChange} />
        <StepLabel top={2}>Step 3 of 3 &middot; Pick a view</StepLabel>
        <Seg2
          ariaLabel="Where to pick from"
          size="tab"
          value={tab}
          onChange={onTab}
          options={[
            { id: "suggested", label: "Suggested" },
            { id: "browse", label: "Browse VicData dashboards" },
          ]}
        />
        {tab === "suggested" ? (
          <>
            {list}
            <CustomiseLink onClick={onCustomise} />
          </>
        ) : (
          <BrowseTab ctx={ctx} pick={browse} onPick={onBrowse} liveFor={liveFor} />
        )}
      </Body>
      <Footer>
        <div style={{ fontSize: 12, color: "var(--cc-label)" }}>
          {tab === "suggested" ? `${results.length} ${results.length === 1 ? "view fits" : "views fit"}` : browse ? (browse.fits ? "Fits this column" : "Comes in overridden") : "Pick any view"}
        </div>
        <PrimaryButton onClick={onAdd} disabled={!canAdd}>{words.add}</PrimaryButton>
      </Footer>
    </>
  );
}

// ------------------------------------------------------------------ Browse VicData dashboards

function BrowseTab({ ctx, pick, onPick, liveFor }: { ctx: PickPanelContext; pick: BrowsePick | null; onPick: (cell: BrowseCell, dv: Dataview) => void; liveFor?: (dv: Dataview, ctx: PickPanelContext) => LivePreviewContext | null }) {
  const map = browseMap();
  return (
    <>
      <div style={{ fontSize: 11.5, color: "var(--cc-sub)", lineHeight: 1.45, padding: "0 2px" }}>
        Every view on the VicData dashboards, where you know it from. One that doesn&apos;t fit this column comes in marked &ldquo;overridden&rdquo;.
      </div>
      {pick && (
        <ViewCard
          on
          title={pick.title}
          meta={`${VIEW_TYPE_LABEL[pick.dv.supports.viewType]} · on ${pick.cell.dashboard.name}, ${pick.cell.column.title} · ${pick.cell.rowName}`}
          tags={
            pick.badge ? (
              <span style={{ display: "inline-block", marginTop: 5, fontSize: 10.5, fontWeight: 600, color: "var(--cc-blue)", background: "var(--cc-blue-badge)", borderRadius: 6, padding: "2px 6px" }}>{pick.badge}</span>
            ) : null
          }
          icon={pick.dv.railIcon}
          preview={<PickPreview dataview={pick.dv} accent={accentFor(ctx)} live={liveFor?.(pick.dv, ctx) ?? null} />}
          onClick={() => {}}
        />
      )}
      {map.map(({ dashboard, cells }) => {
        const accent = PHASE_ACCENT[dashboard.colour.key === "neutral" ? "ks4" : dashboard.colour.key]?.hex ?? "var(--cc-ink)";
        const cols = dashboard.columns;
        return (
          <div key={dashboard.id} style={{ border: "1px solid var(--cc-border)", borderRadius: 12, padding: "10px 10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flex: "0 0 8px" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-ink)" }}>{dashboard.name}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: 6 }}>
              {cols.map((c) => (
                <div key={c.id} style={{ fontSize: 10, fontWeight: 700, color: "var(--cc-sub)", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.title}
                </div>
              ))}
              {cells.map((cell) => (
                <div
                  key={cell.panel.id}
                  title={`${cell.column.title} · ${cell.rowName}`}
                  style={{ aspectRatio: String(PANEL_ASPECT), border: "1px solid var(--cc-border)", borderRadius: 6, background: "var(--av-thumb-bg)", padding: 5, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--cc-faint)" }}>{cell.rowName}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {cell.views.map((dv) => {
                      const on = !!pick && pick.cell.panel.id === cell.panel.id && pick.dv.id === dv.id;
                      return (
                        <button
                          key={dv.id}
                          type="button"
                          className="av-mini"
                          aria-label={`${dv.label} (${dashboard.name}, ${cell.column.title}, ${cell.rowName})`}
                          aria-pressed={on}
                          title={dv.label}
                          onClick={() => onPick(cell, dv)}
                          style={{ width: L.miniIcon, height: L.miniIcon, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on ? "var(--cc-blue)" : "transparent"}`, background: on ? "var(--cc-blue)" : "var(--cc-chipbg)", color: on ? "#ffffff" : "var(--cc-label)", cursor: "pointer", padding: 0 }}
                        >
                          {railGlyph(dv.railIcon)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
