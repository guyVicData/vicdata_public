// VicData 0.6.1 S3c: a compare series' colour token (CompareSeries.colour), drawn for the
// theme. The tokens are the editor's (src/components/view-editor/model.ts DEFAULT_COLOUR,
// DataStep's swatches): "accent" (the phase accent), "muted" (pale grey), "fg", "england"
// and "palette" / "palette:<n>" (the categorical line palette, light or dark), or a hex.
// One mapping, so a swatch in 1 · Data and the line it draws are the same colour.
import { PALETTE_DARK, PALETTE_LIGHT } from "@/lib/school-series-colours";

export function compareColour(token: string, theme: "dark" | "light"): string {
  const pal = theme === "light" ? PALETTE_LIGHT : PALETTE_DARK;
  if (token === "accent") return "var(--accent, var(--fg))";
  if (token === "muted") return "var(--muted3)";
  if (token === "fg") return "var(--fg)";
  if (token === "england") return pal[3];
  const m = /^palette:(\d)$/.exec(token);
  if (m) return pal[Number(m[1])] ?? pal[0];
  if (token === "palette") return pal[0];
  return token;
}
