// Teacher view comparator chooser (docs/wireframes/comparator-chooser-v29): the shared,
// client-safe core -- the shapes the screens and the routes agree on, the ranking filter
// spec and how a population row is matched against it, and the palette.
//
// Nothing here re-derives a school fact. Sector is typology.ts's sectorTag(), gender its
// genderTag(), boarding the census boarders/total ratio via boardingRatio(), size the
// national quintile SizeBadge from age-band-distributions.ts -- all computed server-side
// (see /api/teacher/ranking-population) and only MATCHED here.
import { KS5_BUCKET_LABEL, type Ks5Bucket } from "./dfe-qualification-buckets";
import { TAG_COLOURS } from "./tag-colours";
import type { GenderTag, SectorTag } from "./typology";
import type { SizeBadge } from "./age-band-distributions";

// ------------------------------------------------------------------ schools in a list

// One school as the list screens draw it: the sector colours its circle, `boarders` picks
// the bed glyph over the building (the wireframe's "glyph shows boarding, fill colour
// shows sector").
export type ChooserSchool = {
  urn: string;
  name: string;
  distanceKm: number | null;
  sector: SectorTag | null;
  boarders: boolean;
  laName: string | null;
};

// "2.1km", "14km" -- the wireframe's distance forms: one decimal under 10km, whole
// kilometres beyond.
export function formatKm(km: number | null): string {
  if (km === null) return "";
  return km >= 10 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`;
}

// -------------------------------------------------------------------- rankings (3a/3b)

export type RankingScope = { kind: "nation"; nation: "england" } | { kind: "region"; code: string; name: string };

// The wireframe's Boarding filterbox: Any, 100% Day, then four boarding-% bands. A
// school's share is the census boarders / total roll (typology.ts's boardingRatio, the
// one choke point), rounded to a whole per cent before banding so 19.6% reads as 20%.
export type BoardingChoice = "any" | "day" | "b1" | "b2" | "b3" | "b4";
export const BOARDING_BANDS: { id: Exclude<BoardingChoice, "any" | "day">; label: string; min: number; max: number }[] = [
  { id: "b1", label: "1–19%", min: 1, max: 19 },
  { id: "b2", label: "20–49%", min: 20, max: 49 },
  { id: "b3", label: "50–79%", min: 50, max: 79 },
  { id: "b4", label: "80%+", min: 80, max: 100 },
];

export const RANKING_SECTORS: { tag: SectorTag; label: string }[] = [
  { tag: "State", label: "State" },
  { tag: "Independent", label: "Independent" },
  { tag: "FE", label: "FE" },
  { tag: "Special Schools", label: "Special" },
];
export const RANKING_GENDERS: GenderTag[] = ["Girls", "Boys", "Co-ed"];

// The Qualification chips: KS5_BUCKETS' real buckets minus "other" (not a qualification
// a population is chosen by), with the wireframe's compact chip label for the third --
// the real name, "BTec, OCR, VRQ", is what an aria-label or tooltip carries.
export const RANKING_QUALIFICATIONS: { bucket: Ks5Bucket; chip: string; name: string }[] = [
  { bucket: "alevel", chip: "A-level", name: KS5_BUCKET_LABEL.alevel },
  { bucket: "ib", chip: "IB", name: KS5_BUCKET_LABEL.ib },
  { bucket: "btec_ocr", chip: "BTEC/OCR/VRQ", name: KS5_BUCKET_LABEL.btec_ocr },
  { bucket: "tlevel", chip: "T Level", name: KS5_BUCKET_LABEL.tlevel },
];
export const SIZE_BADGES: SizeBadge[] = ["XS", "S", "M", "L", "XL"];

// Filterbox state. An empty list means "All"/"Any" (sector, size); null the same for a
// single-choice box. Chips within Sector and Size combine as OR; every filterbox
// combines with every other as AND -- the wireframe's single running count.
export type RankingFilters = {
  sectors: SectorTag[];
  gender: GenderTag | null;
  boarding: BoardingChoice;
  qualification: Ks5Bucket | null;
  scope: RankingScope;
  sizes: SizeBadge[];
};

export const NATIONAL: RankingScope = { kind: "nation", nation: "england" };

export function defaultRankingFilters(scope: RankingScope): RankingFilters {
  return { sectors: [], gender: null, boarding: "any", qualification: null, scope, sizes: [] };
}

export const sameScope = (a: RankingScope, b: RankingScope) =>
  a.kind === b.kind && (a.kind === "nation" || (b.kind === "region" && a.code === b.code));

// Has this ranking been narrowed from a default one? The two defaults are the whole
// nation and the school's own region with nothing else set; anything else -- a filter
// chip, or a region that is not the school's own -- is a custom ranking (3b), which is
// what makes the fork banner and the Save/Save as/Delete footer appear.
export function isCustomRanking(f: RankingFilters, ownRegion: RankingScope | null): boolean {
  const defaultScope = f.scope.kind === "nation" || (ownRegion !== null && sameScope(f.scope, ownRegion));
  return f.sectors.length > 0 || f.gender !== null || f.boarding !== "any" || f.qualification !== null || f.sizes.length > 0 || !defaultScope;
}

// One school of a population, as /api/teacher/ranking-population sends it: positional,
// like region_nation_set's own rows, for the same payload reason (thousands of rows).
export type PopulationRow = [
  urn: string,
  name: string,
  sector: SectorTag | null,
  gender: GenderTag | null,
  boardingPercent: number | null, // null = no census boarding figure (counted as day)
  size: SizeBadge | null, // null = no roll in the size band
];

export function matchesBoarding(percent: number | null, choice: BoardingChoice): boolean {
  if (choice === "any") return true;
  const p = percent ?? 0;
  if (choice === "day") return p === 0;
  const band = BOARDING_BANDS.find((b) => b.id === choice)!;
  return p >= band.min && p <= band.max;
}

// Qualification is deliberately NOT applied: a school's KS5 qualification mix is a
// per-school, per-subject fact today, with no population-scale path to filter by
// (docs/OPEN_QUESTIONS.md, 2026-11-02). The chip is kept, saved and described; the
// screen says the count does not reflect it yet rather than pretending it does.
export function matchesRanking(row: PopulationRow, f: RankingFilters): boolean {
  const [, , sector, gender, boardingPercent, size] = row;
  if (f.sectors.length && (sector === null || !f.sectors.includes(sector))) return false;
  if (f.gender && gender !== f.gender) return false;
  if (!matchesBoarding(boardingPercent, f.boarding)) return false;
  if (f.sizes.length && (size === null || !f.sizes.includes(size))) return false;
  return true;
}

export const scopeLabel = (s: RankingScope) => (s.kind === "nation" ? "National" : s.name);

// The header subtitle: 3a's default wording, or 3b's "Independent · Boarding · Girls ·
// National" list of whatever is set.
export function describeRanking(f: RankingFilters, ownRegion: RankingScope | null): string {
  if (!isCustomRanking(f, ownRegion)) {
    return f.scope.kind === "nation"
      ? "National — all England schools · same qualification & phase"
      : `Regional — all ${f.scope.name} schools · same qualification & phase`;
  }
  const parts: string[] = [];
  if (f.sectors.length) parts.push(f.sectors.map((s) => RANKING_SECTORS.find((r) => r.tag === s)?.label ?? s).join(" & "));
  if (f.boarding === "day") parts.push("Day");
  else if (f.boarding === "b4") parts.push("Boarding");
  else if (f.boarding !== "any") parts.push(`Boarding ${BOARDING_BANDS.find((b) => b.id === f.boarding)!.label}`);
  if (f.gender) parts.push(f.gender);
  if (f.qualification) parts.push(RANKING_QUALIFICATIONS.find((q) => q.bucket === f.qualification)?.chip ?? f.qualification);
  if (f.sizes.length) parts.push(`Size ${f.sizes.join("/")}`);
  parts.push(scopeLabel(f.scope));
  return parts.join(" · ");
}

// What the "includes" card lists, in the wireframe's four lines.
export function includesLines(f: RankingFilters): string[] {
  const sectors = f.sectors.length ? f.sectors.map((s) => RANKING_SECTORS.find((r) => r.tag === s)?.label ?? s).join(", ") : "State, Independent, FE & Special";
  const boarding =
    f.boarding === "any" ? "Boarding & day" : f.boarding === "day" ? "100% day" : `Boarding ${BOARDING_BANDS.find((b) => b.id === f.boarding)!.label}`;
  const gender = f.gender ? `${f.gender} only` : "all genders";
  const size = f.sizes.length ? `Size ${f.sizes.join("/")}` : "Any size";
  const qual = f.qualification ? RANKING_QUALIFICATIONS.find((q) => q.bucket === f.qualification)!.chip : "all qualifications";
  const scope = f.scope.kind === "nation" ? "National — every region" : `${f.scope.name} only`;
  return [sectors, `${boarding}, ${gender}`, `${size}, ${qual}`, scope];
}

// ---------------------------------------------------------------------------- colour

type Pair = { light: [string, string]; dark: [string, string] };

// Active chip colours: the brand typology palette (tag-colours.ts) for sector, gender and
// the Day / 80%+ boarding endpoints, exactly as the wireframe specifies them. The three
// middle boarding bands are the wireframe's own provisional ramp between those two
// endpoints -- not (yet) in tag-colours.ts -- with dark pairs of mine built the same way
// every dark pair there is (a dark tint of the hue, a lighter text colour).
const BOARDING_RAMP: Record<"b1" | "b2" | "b3", Pair> = {
  b1: { light: ["#fff8f5", "#c2703f"], dark: ["#3f2517", "#f0b48b"] },
  b2: { light: ["#fff1ea", "#b1592f"], dark: ["#44221a", "#eea07e"] },
  b3: { light: ["#ffe6db", "#a03f28"], dark: ["#48201a", "#f19a86"] },
};

export function sectorPair(tag: SectorTag): Pair {
  return TAG_COLOURS[tag];
}
export function genderPair(tag: GenderTag): Pair {
  return TAG_COLOURS[tag];
}
export function boardingPair(choice: Exclude<BoardingChoice, "any">): Pair {
  if (choice === "day") return TAG_COLOURS.Day;
  if (choice === "b4") return TAG_COLOURS.Boarding;
  return BOARDING_RAMP[choice];
}

// A sector's solid colour for a school's circle and a legend dot: the saturated half of
// its light pair, as the wireframe draws it (#15803d, #F37521, #86198f, #b91c1c).
export const sectorSolid = (tag: SectorTag | null) => (tag ? TAG_COLOURS[tag].light[1] : "#9aa0a8");
