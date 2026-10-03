"use client";

"use client";

// The chooser's preview of a view: a data-free drawing of its look, at the panel unit's
// real shape (351 x 384, PANEL_UNIT). One component, so night 2's editor can swap in a
// live render without touching the cards that hold it.
// 0.6 E: pass `live` (a school context) and the same box draws the real view instead
// (LiveViewPreview, loaded on demand); without it, the data-free drawing as before.
//
// Marks follow the boards' thumbnails (Ch3Pick, PickEither): muted marks plus one in the
// phase accent (PHASE_ACCENT -- the board's #34d399 is GCSE's accent). The frame is the
// panel's own theme colours, not the board's always-dark thumb: a preview stands for a
// panel, and a panel in the light theme is light (logged in OPEN_QUESTIONS).
import dynamic from "next/dynamic";
import type { Dataview, NumberType, ViewType } from "@/catalogue/types";
import { L, thumbWidth } from "./layout";
import type { LivePreviewContext } from "./LiveViewPreview";

// Loaded only when a live preview is asked for, so the chooser's own bundle stays small.
const LiveViewPreview = dynamic(() => import("./LiveViewPreview").then((m) => m.LiveViewPreview), { ssr: false });

const W = 88;
const H = 96;

function Marks({ look, numberType, accent }: { look: ViewType; numberType?: NumberType; accent: string }) {
  const mute = "var(--av-thumb-mark)";
  const line = "var(--av-thumb-line)";
  const change = numberType === "pct_change" || numberType === "change_points" || numberType === "change_pp";
  switch (look) {
    case "graph":
      if (numberType === "index100")
        return (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" y1="62" x2="80" y2="62" stroke={line} strokeDasharray="2 2" />
            <polyline points="10,62 33,66 56,64 80,70" stroke={mute} strokeWidth="2" />
            <polyline points="10,62 33,58 56,60 80,56" stroke={mute} strokeWidth="2" />
            <polyline points="10,62 33,52 56,44 80,34" stroke={accent} strokeWidth="2.8" />
          </g>
        );
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="82" x2="82" y2="82" stroke={line} />
          <polyline points="10,66 33,64 56,62 80,58" stroke={mute} strokeWidth="2" />
          <polyline points="10,56 33,62 56,60 80,64" stroke={mute} strokeWidth="2" />
          <polyline points="10,72 33,60 56,50 80,38" stroke={accent} strokeWidth="2.8" />
        </g>
      );
    case "ranking":
      if (change)
        return (
          <g>
            <line x1="45" y1="34" x2="45" y2="86" stroke={line} />
            <rect x="45" y="36" width="30" height="7" rx="2" fill={mute} />
            <rect x="45" y="47" width="20" height="7" rx="2" fill={accent} />
            <rect x="45" y="58" width="9" height="7" rx="2" fill={mute} />
            <rect x="31" y="69" width="14" height="7" rx="2" fill={mute} />
            <rect x="20" y="80" width="25" height="6" rx="2" fill={mute} />
          </g>
        );
      return (
        <g>
          <rect x="10" y="36" width="68" height="8" rx="2" fill={mute} />
          <rect x="10" y="49" width="56" height="8" rx="2" fill={accent} />
          <rect x="10" y="62" width="44" height="8" rx="2" fill={mute} />
          <rect x="10" y="75" width="30" height="8" rx="2" fill={mute} />
        </g>
      );
    case "map":
      return (
        <g>
          <path d="M14 40 L38 34 L60 40 L78 36 L76 78 L52 84 L30 78 L12 82 Z" fill="none" stroke={line} strokeWidth="1.2" />
          <circle cx="38" cy="54" r="7" fill={accent} />
          <circle cx="60" cy="64" r="5" fill={mute} />
          <circle cx="26" cy="70" r="4" fill={mute} />
          <circle cx="66" cy="46" r="4" fill={mute} />
          <circle cx="50" cy="74" r="3" fill={mute} />
        </g>
      );
    case "table":
      return (
        <g fill="none" stroke={mute} strokeWidth="1.3">
          <rect x="9" y="34" width="72" height="52" rx="3" />
          <line x1="9" y1="45" x2="81" y2="45" />
          <line x1="9" y1="56" x2="81" y2="56" />
          <line x1="9" y1="67" x2="81" y2="67" />
          <line x1="9" y1="78" x2="81" y2="78" />
          <line x1="36" y1="34" x2="36" y2="86" />
          <line x1="58" y1="34" x2="58" y2="86" />
          <rect x="10" y="46" width="70" height="9" fill={accent} stroke="none" opacity="0.28" />
        </g>
      );
    case "donut":
      return (
        <g fill="none" strokeWidth="11">
          <circle cx="45" cy="60" r="20" stroke={mute} />
          <circle cx="45" cy="60" r="20" stroke={accent} strokeDasharray="38 200" transform="rotate(-90 45 60)" />
        </g>
      );
    case "numerical":
      return (
        <g>
          {[
            [9, 34],
            [47, 34],
            [9, 62],
            [47, 62],
          ].map(([x, y], i) => (
            <g key={i}>
              <rect x={x} y={y} width="34" height="24" rx="4" fill="none" stroke={mute} strokeWidth="1.2" />
              <rect x={x + 6} y={y + 7} width={i === 0 ? 16 : 12} height="6" rx="1.5" fill={i === 0 ? accent : mute} />
              <rect x={x + 6} y={y + 16} width="20" height="2.5" rx="1" fill={mute} opacity="0.6" />
            </g>
          ))}
        </g>
      );
  }
}

export function PickPreview({
  dataview,
  look,
  numberType,
  accent,
  height = L.thumbHeight,
  live = null,
}: {
  dataview?: Dataview | null;
  // Override the dataview's own look (Customise).
  look?: ViewType;
  numberType?: NumberType;
  accent: string;
  height?: number;
  // A school context: draw the real view live in this box (not with a `look` override,
  // which Customise uses for shapes no registered view has yet).
  live?: LivePreviewContext | null;
}) {
  const v = look ?? dataview?.supports.viewType ?? "graph";
  const n = numberType ?? dataview?.supports.numberType[0];
  const width = thumbWidth(height);
  return (
    <span
      aria-hidden="true"
      data-preview={v}
      style={{ width, height, flex: `0 0 ${width}px`, borderRadius: L.thumbRadius, background: "var(--av-thumb-bg)", border: "1px solid var(--av-thumb-border)", display: "flex", overflow: "hidden", boxSizing: "border-box" }}
    >
      {live && dataview && !look ? (
        <LiveViewPreview dataview={dataview} context={live} width={width - 2} height={height - 2} />
      ) : (
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* The panel's title line and its rail, as on every panel. */}
        <rect x="9" y="11" width="44" height="5" rx="2" fill="var(--av-thumb-mark)" />
        <rect x="9" y="20" width="28" height="3" rx="1.5" fill="var(--av-thumb-mark)" opacity="0.6" />
        <Marks look={v} numberType={n} accent={accent} />
      </svg>
      )}
    </span>
  );
}
