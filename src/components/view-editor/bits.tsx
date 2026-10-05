"use client";

// VicData 0.6.1 S4: the boards' classes (AddView1-3, AddView2Table / Rank / Bar / Spread,
// EditView, EditWide) as one stylesheet, every size, radius and weight copied from their
// <style> blocks. Colours are the chooser's tokens (.cc-root, src/components/teacher/chooser/
// ui.tsx): the boards' light hexes verbatim, each mapped to the dashboard's own dark token in
// the dark theme. The live preview box is a real panel (--panel-bg), in the page's theme.
import type { ReactNode } from "react";
import * as Icons from "@/components/teacher/PanelIcons";
import type { ViewKind } from "@/catalogue/viewspec";

export const VE_CSS = `
.ve button{font-family:inherit}
.ve .label{font-size:10.5px;font-weight:700;color:var(--cc-sub);text-transform:uppercase;letter-spacing:0.4px}
.ve .box{border:1px solid var(--cc-border);border-radius:10px;background:var(--cc-soft);padding:10px;display:flex;flex-direction:column;gap:8px}
.ve .row{display:flex;align-items:center;gap:9px;background:var(--cc-panel);border:1px solid var(--cc-border);border-radius:8px;padding:7px 8px}
.ve .sw{width:18px;height:18px;border-radius:5px;border:1px solid rgba(0,0,0,0.12);flex:0 0 18px;padding:0;cursor:pointer;box-sizing:border-box}
.ve .sw.open{outline:2px solid var(--cc-ink);outline-offset:1px}
.ve .nm{font-size:12.5px;font-weight:600;color:var(--cc-ink)}
.ve .sub{font-size:11px;color:var(--cc-sub)}
.ve .x{margin-left:auto;width:26px;height:26px;border-radius:50%;border:none;background:var(--cc-chipbg);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 26px;padding:0}
.ve .chip{border:1px solid var(--cc-border2);border-radius:20px;padding:4px 9px;font-size:11.5px;font-weight:600;color:var(--cc-label);background:var(--cc-panel);white-space:nowrap;cursor:pointer;line-height:normal}
.ve .chip.active{border-color:var(--cc-primary);background:var(--cc-primary);color:var(--cc-on-primary)}
.ve .chip.picked{border-color:var(--cc-primary);color:var(--cc-ink)}
.ve .chip.off{border-style:dashed;color:var(--cc-faint);background:transparent;cursor:not-allowed}
.ve .chip.sm{padding:3px 8px}
.ve .fact{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--cc-ink)}
.ve .fact .k{width:64px;font-size:11px;color:var(--cc-sub);flex:0 0 64px}
.ve .link{margin-left:auto;font-size:11.5px;font-weight:600;color:var(--cc-blue);background:none;border:none;cursor:pointer;padding:0}
.ve .link:disabled{color:var(--cc-faint);cursor:not-allowed}
.ve .kind{border:1px solid var(--cc-border);border-radius:10px;background:var(--cc-panel);padding:9px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;font-size:11.5px;font-weight:600;color:var(--cc-label)}
.ve .kind.on{border:1.5px solid var(--cc-primary);color:var(--cc-ink)}
.ve .kind.off{border-style:dashed;background:transparent;color:var(--cc-faint);cursor:not-allowed}
.ve .kind svg{width:22px;height:22px;display:block}
.ve.wide .kind svg{width:18px;height:18px}
.ve .toggle{width:34px;height:20px;border-radius:999px;background:var(--cc-primary);position:relative;flex:0 0 34px;display:inline-block;border:none;padding:0;cursor:pointer}
.ve .toggle span{position:absolute;top:3px;right:3px;width:14px;height:14px;border-radius:50%;background:var(--cc-on-primary)}
.ve .toggle.offt{background:var(--cc-border2)}
.ve .toggle.offt span{right:auto;left:3px;background:var(--cc-panel)}
.ve .opt{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--cc-label)}
.ve .opt .k{width:62px;font-size:11px;color:var(--cc-sub);flex:0 0 62px}
.ve.wide .opt .k{width:72px;flex:0 0 72px}
.ve .dashed{font-size:11px;color:var(--cc-sub);line-height:1.4;background:var(--cc-panel);border:1px dashed var(--cc-border2);border-radius:8px;padding:7px 9px}
.ve .res{border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-panel);padding:6px 7px;display:flex;flex-direction:column;gap:4px;cursor:pointer;text-align:left;min-width:0}
.ve .res.on{border:1.5px solid var(--cc-primary)}
.ve .res.no{border-style:dashed;background:transparent;cursor:not-allowed}
.ve .rh{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--cc-ink)}
.ve .tick{width:15px;height:15px;border-radius:4px;background:var(--cc-primary);display:flex;align-items:center;justify-content:center;flex:0 0 15px;box-sizing:border-box}
.ve .tick.offb{background:var(--cc-panel);border:1.5px solid var(--cc-radio)}
.ve .mini{border-radius:6px;height:46px;overflow:hidden;background:var(--panel-bg);border:1px solid var(--panel-border)}
.ve .mini.cant{display:flex;align-items:center;justify-content:center;background:var(--cc-chipbg);border:none;font-size:10.5px;color:var(--cc-faint)}
.ve .note{font-size:10.5px;color:var(--cc-sub);line-height:1.35}
.ve .note.warn{color:var(--cc-banner-fg)}
.ve .ri{width:30px;height:30px;border-radius:7px;border:1px solid var(--cc-border2);background:var(--cc-panel);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--cc-label);padding:0}
.ve .ri.on{border:1.5px solid var(--cc-primary);color:var(--cc-ink);background:var(--cc-chipbg)}
.ve .ri svg{width:16px;height:16px;display:block}
.ve .tok{display:inline-flex;align-items:center;border-radius:6px;background:var(--cc-blue-badge);color:var(--cc-blue);font-size:12px;font-weight:700;padding:1px 6px;line-height:1.5}
.ve .seg{flex:1 1 0;height:4px;border-radius:2px;background:var(--cc-border)}
.ve .seg.done{background:var(--cc-primary)}
.ve .btn{border:none;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;line-height:normal}
.ve .btn.primary{background:var(--cc-primary);color:var(--cc-on-primary)}
.ve .btn.primary:disabled{opacity:0.4;cursor:default}
.ve .btn.secondary{background:var(--cc-panel);color:var(--cc-ink);border:1px solid var(--cc-border2)}
.ve .iconbtn{width:32px;height:32px;border-radius:50%;background:var(--cc-chipbg);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 32px;padding:0}
.ve .seg3{display:flex;border:1px solid var(--cc-border2);border-radius:8px;overflow:hidden;font-size:11.5px;font-weight:600}
.ve .seg3 button{flex:1 1 0;border:none;padding:6px 8px;background:var(--cc-panel);color:var(--cc-label);cursor:pointer}
.ve .seg3 button.on{background:var(--cc-primary);color:var(--cc-on-primary)}
.ve .seg3 button:disabled{color:var(--cc-faint);background:var(--cc-soft);cursor:not-allowed}
.ve .tabs{display:flex;background:var(--cc-chipbg);border-radius:9px;padding:3px;gap:3px}
.ve .tabs button{flex:1 1 0;text-align:center;padding:6px 4px;border-radius:7px;font-size:12px;font-weight:600;color:var(--cc-label);border:none;background:none;cursor:pointer}
.ve.wide .tabs button{padding:7px 4px;font-size:12.5px}
.ve .tabs button[aria-selected="true"]{font-weight:700;color:var(--cc-ink);background:var(--cc-panel);box-shadow:0 1px 2px rgba(0,0,0,0.08)}
.ve .changes{display:flex;align-items:center;gap:8px;background:var(--cc-banner-bg);border:1px solid var(--cc-banner-border);border-radius:10px;padding:8px 11px;font-size:12px;color:var(--cc-banner-fg)}
.ve .changes button,.ve .changepill button{border:none;background:none;color:inherit;font-weight:700;font-size:12px;text-decoration:underline;cursor:pointer;padding:0;font-family:inherit}
.ve .changepill{font-size:12px;color:var(--cc-banner-fg);background:var(--cc-banner-bg);border-radius:999px;padding:4px 10px;white-space:nowrap}
.ve .quiet{font-size:11.5px;color:var(--cc-sub);background:none;border:none;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px;align-self:flex-start;font-family:inherit}
.ve .pv{background:var(--panel-bg);border:1px solid var(--panel-border);border-radius:10px;display:flex;flex-direction:column;gap:5px;color:var(--fg)}
.ve .pvh{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:10.5px;color:var(--muted)}
.ve .pvh b{color:var(--fg);font-weight:600}
.ve .pvmenu{border:none;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:3px;white-space:nowrap}
.ve .pvt{font-size:12px;font-weight:600;color:var(--fg);line-height:1.3}
.ve .scroll{scrollbar-width:thin}
`;

export function VeStyles() {
  return <style>{VE_CSS}</style>;
}

// The real panel glyphs on the View tiles (the icon the view later shows in the rail) --
// PanelIcons' own, SlopeIcon included (S3c).
export function glyph(name: string): ReactNode {
  const g = (Icons as unknown as Record<string, ReactNode>)[name];
  return g && typeof g === "object" ? g : Icons.TilesIcon;
}

export const KIND_GLYPH: Record<ViewKind, string> = {
  line: "TrendLineIcon",
  bar: "HorizontalBarsIcon",
  table: "TableIcon",
  ranking: "RankListIcon",
  numbers: "TilesIcon",
  spread: "GradesIcon",
  slope: "SlopeIcon",
  donut: "DonutIcon",
  map: "MapPinIcon",
};

export const CloseGlyph = ({ size = 16, width = 2 }: { size?: number; width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--cc-label)" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const BackGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cc-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const TickGlyph = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--cc-on-primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="5 12 10 17 19 7" />
  </svg>
);

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? "" : " offt"}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

// A chip that may be greyed: a real disabled button with its reason as the tooltip.
export function Chip({ on, picked, off, reason, sm, onClick, children }: { on?: boolean; picked?: boolean; off?: boolean; reason?: string; sm?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`chip${on ? " active" : ""}${picked ? " picked" : ""}${off ? " off" : ""}${sm ? " sm" : ""}`}
      disabled={off}
      title={off ? reason : undefined}
      aria-pressed={off ? undefined : !!(on || picked)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Opt({ k, children, top }: { k: string; children: ReactNode; top?: boolean }) {
  return (
    <div className="opt" style={top ? { alignItems: "flex-start" } : undefined}>
      <span className="k" style={top ? { paddingTop: 4 } : undefined}>
        {k}
      </span>
      {children}
    </div>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{children}</div>;
}

// A toggle row: "Trend line [switch] a straight line of best fit".
export function ToggleOpt({ k, on, onChange, hint }: { k: string; on: boolean; onChange: (on: boolean) => void; hint: string }) {
  return (
    <div className="opt">
      <span className="k">{k}</span>
      <Toggle on={on} label={k} onChange={onChange} />
      <span style={{ fontSize: 11 }}>{hint}</span>
    </div>
  );
}

// Title templates drawn with their placeholders as tokens.
export function Tokens({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} className="tok">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
