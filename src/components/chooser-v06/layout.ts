// VicData 0.6 S4: every size and colour the "Add a view" chooser uses that isn't already
// a shared token, in one place so Guy can iterate on it (night 2 prompt: "keep layout and
// interaction constants in one place").
//
// Sizes are literal from the boards (docs/wireframes/v0.6/Ch3Pick, Ch3Adjust, Ch3Empty,
// PickEither, Ch1Data, Ch2Focus, Ch2Subject, Ch2Custom). The chooser's palette is the
// comparator chooser's --cc-* variables (src/components/teacher/chooser/ui.tsx), which map
// every board hex to the dashboard's dark theme; the few board colours that palette lacks
// are the --av-* variables below, light = the board's hex.
import { PANEL_UNIT } from "@/catalogue/config";

// The panel unit's aspect (351 x 384). The boards' 72 x 48 (1.5:1) thumbnails were drawn
// for the old, wrong 385 x 256 unit (S0 audit §5); previews use the real shape.
export const PANEL_ASPECT = PANEL_UNIT.width / PANEL_UNIT.height;

export const L = {
  // Pick card (.card): board padding 10/12, gap 12 (Ch3Pick) -- PickEither draws 10.
  cardGap: 12,
  cardPad: "10px 12px",
  cardRadius: 10,
  // .rail: 22px square, radius 6, glyph 12px.
  rail: 22,
  railRadius: 6,
  railGlyph: 12,
  // The preview: the board's 48px-tall thumb, at the real panel aspect (44 x 48).
  thumbHeight: 48,
  thumbRadius: 7,
  // Customise's live preview: the board's box, holding a panel-shaped preview.
  livePreviewHeight: 100,
  // Mini map (Browse): one cell per panel at the real aspect; 18px view buttons.
  miniIcon: 18,
  // .seg progress bars.
  segHeight: 4,
  // Toggles: Customise's 34 x 20 (.toggle), Step 2's 38 x 22 switch.
  toggleSm: { w: 34, h: 20, knob: 14 },
  toggleMd: { w: 38, h: 22, knob: 16 },
} as const;

export const thumbWidth = (h: number) => Math.round(h * PANEL_ASPECT);

// Step 1's data families (Ch1Data). No app token exists for these three meanings, so the
// board's pairs are the light values; the dark values are the same hues at the app's
// 400 level over a tint (as PHASE_ACCENT / ROLE_ACCENT are drawn).
export const DATA_FAMILY = {
  academic: { label: "Academic", sub: "Exam entries and results", light: ["#dbeafe", "#1d4ed8"], dark: ["rgba(96,165,250,0.16)", "#60a5fa"] },
  rolls: { label: "Rolls", sub: "Pupil numbers, by year group", light: ["#cffafe", "#0e7490"], dark: ["rgba(34,211,238,0.16)", "#22d3ee"] },
  social: { label: "Social context", sub: "Live births · more to follow", light: ["#ffedd5", "#c2410c"], dark: ["rgba(251,146,60,0.16)", "#fb923c"] },
} as const;

export type FamilyId = keyof typeof DATA_FAMILY;

// The --av-* variables: board colours the comparator palette doesn't carry. Also: the
// boards' line-height is the browser's `normal` (the app's preflight sets 1.5), and no
// row in a scrolling body may shrink (a flex item with overflow:hidden otherwise
// collapses to 0 -- the tab strip did).
//   familiar   Ch3Pick's "Familiar — from VicData dashboards" heading (#047857)
//   soft2      Ch1Data's "which result" band (#fafbfc)
//   plan-*     Ch3Empty's super-admin placeholder box (#fffaf0, #7a5a14)
//   thumb-*    the preview's ink: muted marks (#3f3f46 on the board's dark thumb)
export const AV_STYLES = `
.av-root{--av-familiar:#047857;--av-soft2:#fafbfc;--av-plan-bg:#fffaf0;--av-plan-ink:#7a5a14;--av-thumb-bg:var(--panel-bg,#ffffff);--av-thumb-border:var(--panel-border,#e3e5e9);--av-thumb-mark:#c9ccd1;--av-thumb-line:#e3e5e9}
#teacher-root[data-theme="dark"] .av-root{--av-familiar:#34d399;--av-soft2:rgba(255,255,255,0.03);--av-plan-bg:rgba(224,178,61,0.07);--av-plan-ink:#e0b23d;--av-thumb-mark:#3f3f46;--av-thumb-line:#2a2a2a}
.av-root{line-height:normal}
.av-root .cc-scroll>*{flex-shrink:0}
.av-root input::placeholder,.av-root textarea::placeholder{color:var(--cc-faint)}
`;
