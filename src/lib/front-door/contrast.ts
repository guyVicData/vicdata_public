// VicData 0.8 front door (C18-C20): WCAG contrast, the theme's token blocks read from globals.css, and the
// contrast table the report logs. Used by the rule runners (R-THEME-CONTRAST, R-PANEL-LADDER,
// R-ROLE-COLOURS) and the unit tests, so the logged table and the stylesheet can't drift apart.

/** WCAG 2 relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** AA: 4.5:1 for small text, 3:1 for large text and for marks (icons, bars, edges that carry meaning). */
export type PairKind = "small" | "large" | "mark";
export const AA: Record<PairKind, number> = { small: 4.5, large: 3, mark: 3 };

/** Every `--token: #hex` declared in the rules whose selector is exactly `selector` (later ones win). */
export function tokensOf(css: string, selector: string): Record<string, string> {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out: Record<string, string> = {};
  for (const m of flat.matchAll(new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`, "g"))) {
    for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out[d[1]] = d[2].toLowerCase();
  }
  return out;
}

// The selectors that hold each theme's tokens (globals.css).
export const SEL = {
  light: "#teacher-root, body > [data-feedback-window]",
  dark: '#teacher-root[data-theme="dark"]',
  ladderLight: "#teacher-root:has([data-dash-ladder])",
  ladderDark: '#teacher-root[data-theme="dark"]:has([data-dash-ladder])',
  shutLight: "#teacher-root",
  shutDark: '#teacher-root[data-theme="dark"]',
  midField: '#teacher-root[data-pref="mid"] [data-field]',
  field: (f: MidField) => `#teacher-root[data-pref="mid"] [data-field="${f}"]`,
} as const;

/** The parts of the site with their own colour in Mid (C18), and their two gradient stops. */
export type MidField = "gcse" | "post16" | "top" | "group" | "admissions";
export const MID_FIELDS: Record<MidField, { label: string; from: string; to: string; glow: string }> = {
  gcse: { label: "GCSE", from: "#86e3ae", to: "#1e9e5e", glow: "#4cd98a" },
  post16: { label: "Post-16", from: "#c1b0ff", to: "#7a5bef", glow: "#a48cff" },
  top: { label: "Top level: SMT, whole school", from: "#ffb74d", to: "#f57c00", glow: "#ff9f0a" },
  group: { label: "Head office (orange field, bronze accent)", from: "#ffb74d", to: "#f57c00", glow: "#ff9f0a" },
  admissions: { label: "Admissions", from: "#8bd8fb", to: "#1596db", glow: "#5ac8fa" },
};

export type Pair = { name: string; fg: string; bg: string; kind: PairKind };

/**
 * The contrast table (R-THEME-CONTRAST), built from the stylesheet itself. Mid: the field's charcoal ink
 * on both gradient stops (large text only: nothing small sits on a bare field -- small text, keys and
 * charts are on the near-white tiles and plates), the tile accent on white (small text) and on its tint
 * (the badge glyph, a mark), white on the accent (the arrow button, a mark), and the tile's text. The
 * ladder: text and the shut bar's figure on the shut bar, Dark and Light.
 */
export function contrastTable(css: string): Pair[] {
  const pairs: Pair[] = [];
  const mid = tokensOf(css, SEL.midField);
  for (const f of Object.keys(MID_FIELDS) as MidField[]) {
    const t = tokensOf(css, SEL.field(f));
    const { from, to, label } = MID_FIELDS[f];
    pairs.push({ name: `Mid ${label}: heading on the light stop`, fg: t["--field-ink"], bg: from, kind: "large" });
    pairs.push({ name: `Mid ${label}: heading on the dark stop`, fg: t["--field-ink"], bg: to, kind: "large" });
    pairs.push({ name: `Mid ${label}: accent text on the tile`, fg: t["--tile-accent-text"], bg: "#ffffff", kind: "small" });
    pairs.push({ name: `Mid ${label}: accent text on the tint`, fg: t["--tile-accent-text"], bg: t["--tile-tint"], kind: "small" });
    pairs.push({ name: `Mid ${label}: white arrow on the accent button`, fg: "#ffffff", bg: t["--tile-accent"], kind: "mark" });
  }
  pairs.push({ name: "Mid tile: text", fg: mid["--fg"], bg: "#ffffff", kind: "small" });
  pairs.push({ name: "Mid tile: muted text", fg: mid["--muted"], bg: "#ffffff", kind: "small" });
  pairs.push({ name: "Mid tile: muted2 text", fg: mid["--muted2"], bg: "#ffffff", kind: "small" });
  const light = tokensOf(css, SEL.light);
  const dark = tokensOf(css, SEL.dark);
  const sl = tokensOf(css, SEL.shutLight);
  const sd = tokensOf(css, SEL.shutDark);
  pairs.push({ name: "Ladder Light: shut bar title", fg: light["--fg"], bg: sl["--shut-bg"], kind: "small" });
  pairs.push({ name: "Ladder Dark: shut bar title", fg: dark["--fg"], bg: sd["--shut-bg"], kind: "small" });
  const ll = tokensOf(css, SEL.ladderLight);
  const ld = tokensOf(css, SEL.ladderDark);
  pairs.push({ name: "Ladder Light: text in the well", fg: light["--fg"], bg: ll["--box-bg"], kind: "small" });
  pairs.push({ name: "Ladder Light: muted text in the well", fg: ll["--muted"] ?? light["--muted"], bg: ll["--box-bg"], kind: "small" });
  pairs.push({ name: "Ladder Dark: text in the well", fg: dark["--fg"], bg: ld["--box-bg"], kind: "small" });
  pairs.push({ name: "Ladder Dark: muted text in the well", fg: dark["--muted"], bg: ld["--box-bg"], kind: "small" });
  pairs.push({ name: "Ladder Dark: muted text in the column", fg: dark["--muted"], bg: ld["--panel-bg"], kind: "small" });
  pairs.push({ name: "Ladder Light: muted text in the column", fg: ll["--muted"] ?? light["--muted"], bg: ll["--panel-bg"], kind: "small" });
  pairs.push({ name: "Ladder Light: muted text on the page", fg: ll["--muted"] ?? light["--muted"], bg: ll["--bg"], kind: "small" });
  pairs.push({ name: "Ladder Dark: muted text on the page", fg: ld["--muted"] ?? dark["--muted"], bg: ld["--bg"], kind: "small" });
  pairs.push({ name: "Ladder Light: muted2 text on the page", fg: light["--muted2"], bg: ll["--bg"], kind: "small" });
  return pairs;
}

/** A shut figure's colour on the shut bar: the accent mixed toward --fg (color-mix in srgb). */
export function mix(a: string, b: string, aShare: number): string {
  const p = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v * aShare + y[i] * (1 - aShare)).toString(16).padStart(2, "0")).join("");
}

/**
 * The ladder's logged steps (R-PANEL-LADDER): a shut bar against its column. Dark: the fill itself steps
 * (at least 1.2:1) and the border more (1.4:1). Light: the fill is white on a near-white column, so the
 * border carries the step (1.4:1) with the shadow.
 */
export const LADDER_STEP = { darkFill: 1.2, darkBorder: 1.4, lightBorder: 1.4 } as const;

export function ladderSteps(css: string) {
  const ll = tokensOf(css, SEL.ladderLight);
  const ld = tokensOf(css, SEL.ladderDark);
  const sl = tokensOf(css, SEL.shutLight);
  const sd = tokensOf(css, SEL.shutDark);
  return {
    darkFill: contrast(sd["--shut-bg"], ld["--panel-bg"]),
    darkBorder: contrast(sd["--shut-border"], ld["--panel-bg"]),
    lightFill: contrast(sl["--shut-bg"], ll["--panel-bg"]),
    lightBorder: contrast(sl["--shut-border"], ll["--panel-bg"]),
    tokens: { ll, ld, sl, sd },
  };
}
