// VicData 0.6 S6: every size the library, role homes, Icon dialog and Copy this view use
// that isn't already a shared token, in one place so Guy can iterate (night 2 prompt:
// "keep layout and interaction constants in one place"). Literal from the boards:
// docs/wireframes/v0.6/Main, HomeSMT, Icon, CopyTo, CopyToMeeting (.dc.html).
//
// Colours are never here: the dark/light theme variables (#teacher-root), the comparator
// chooser's --cc-* palette for the dialogs, and the real accent tokens.

// Main.dc.html: the library page.
export const LIB = {
  // Page padding 20px 20px 28px, sections 16px apart.
  pad: "20px 20px 28px",
  gap: 16,
  // Tabs pill: 3px padding, 6px gap, buttons 7px 16px at 13px bold.
  tabsGap: 6,
  // Filter chips 5px 12px at 12px; colour dots 26px with a 10px dot; divider 1 x 22.
  chipPad: "5px 12px",
  dot: 26,
  dotInner: 10,
  // The grid: 2 columns, 10px gap; cards 14px radius, 1.5px border, 14px padding, 128 tall
  // at least, 10px between icon row and text.
  gridCols: 2,
  gridGap: 10,
  cardRadius: 14,
  cardPad: 14,
  cardMinHeight: 128,
  icon: 38,
  // The "+ New dashboard" card's 18px plus inside a 38px square.
  plus: 18,
} as const;

// HomeSMT.dc.html: the role home.
export const HOME = {
  // The role switch: 4px gap, buttons 7px 14px.
  switchGap: 4,
  switchPad: "7px 14px",
  // Key-dashboards tile when there are none yet (dashed, 16px padding, 12px gap).
  tilePad: 16,
  tileGap: 12,
} as const;

// Icon.dc.html.
export const ICON_UI = {
  previewTile: 52,
  previewPad: 14,
  viewGridCols: 3,
  viewGlyphHeight: 36,
  swatch: 26,
  swatchGap: 10,
  // The set's grid: same tiles as the view grid, the glyph on its colour tile.
  setTile: 38,
} as const;

// CopyTo.dc.html / CopyToMeeting.dc.html.
export const COPY_UI = {
  // Destination rows (.dest): 9px 12px, radius 10, 28px icon square (radius 8).
  destPad: "9px 12px",
  destIcon: 28,
  // The slot map (dark box, 10px padding, 6px gaps). Slots are drawn at the board's 44px
  // height, not the panel unit's aspect: at 390 wide a unit-shaped 2-column map is ~400px
  // tall and pushes the fit check below the fold. Logged in OPEN_QUESTIONS for Guy; set
  // `slotShape: "unit"` to draw each slot at PANEL_UNIT's aspect instead.
  mapPad: 10,
  mapGap: 6,
  slotHeight: 44,
  slotShape: "board" as "board" | "unit",
  // Meeting slide thumbnails (.slide): 150 x 84, radius 7, padding 6.
  slideW: 150,
  slideH: 84,
  // How long "Copied" shows before the dialog closes on Copy and stay.
  stayCloseMs: 1400,
} as const;
