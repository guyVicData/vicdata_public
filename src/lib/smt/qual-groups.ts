// VicData 0.8 SMT Academic by qualification (docs/v0.8/smt_value_added_plan_v1.md §2, §3; prompt §2):
// Academic's level chips (GCSE, Post-16), its mode switch (Results · Entries · Value added), the Post-16
// qualification groups and the value-added bands. Pure and client-safe: the page, the route and the
// tests all read this.
//
//   ?level=gcse|post16  &mode=results|entries|va  &group=all|alevel|applied|epq|coremaths|as|ib|tlevel
//   &applied=ag|tl  (DfE's two applied headline types)   &area=<family id>  (GCSE only)

export type AcademicPhase = "gcse" | "post16";
export type AcademicMode = "results" | "entries" | "va";
export type QualGroup = "all" | "alevel" | "applied" | "epq" | "coremaths" | "as" | "ib" | "tlevel";
export type RealGroup = Exclude<QualGroup, "all">;
export type AppliedType = "ag" | "tl";

export const MODES: AcademicMode[] = ["results", "entries", "va"];
export const MODE_LABEL: Record<AcademicMode, string> = { results: "Results", entries: "Entries", va: "Value added" };
export const ACADEMIC_PHASE_LABEL: Record<AcademicPhase, string> = { gcse: "GCSE", post16: "Post-16" };

// The order of the row-2 chips (prompt §2): All first, wherever the school offers more than one group.
export const GROUP_ORDER: QualGroup[] = ["all", "alevel", "applied", "epq", "coremaths", "as", "ib", "tlevel"];
export const GROUP_LABEL: Record<QualGroup, string> = { all: "All", alevel: "A level", applied: "Applied", epq: "EPQ", coremaths: "Core Maths", as: "AS", ib: "IB", tlevel: "T level" };

// DfE's two applied headline types (Option 1, Guy 8 Nov), as the headline snapshot names them.
export const APPLIED_TYPES: AppliedType[] = ["ag", "tl"];
export const APPLIED_LABEL: Record<AppliedType, string> = { ag: "Applied general", tl: "Tech level" };
export const APPLIED_KEY: Record<AppliedType, string> = { ag: "Applied general", tl: "Tech level" };

/** The group a DfE qualification type belongs to; null for the few that sit in no group (Pre-U, the
 * Advanced Extension Award, free-standing maths, other general qualifications): those appear only under
 * "All", in the subject areas. */
export function groupOfQualification(q: string): RealGroup | null {
  if (q === "GCE A level") return "alevel";
  if (/^GCE AS level/.test(q)) return "as";
  if (/^Extended Project/.test(q)) return "epq";
  if (/^Core Maths/.test(q)) return "coremaths";
  if (/^(International Baccalaureate|IBO )/.test(q)) return "ib";
  if (/^T Level/i.test(q)) return "tlevel";
  if (/^(BTEC|OCR Cambridge Technical|VRQ)/.test(q)) return "applied";
  return null;
}

/** A qualification's short name for the subject-area view's sub-heads ("BTEC Ext. Certificate"). */
export function shortQualification(q: string): string {
  if (q === "GCE A level") return "A level";
  if (/^GCE AS level/.test(q)) return "AS";
  if (/^Extended Project/.test(q)) return "EPQ";
  if (/^Core Maths/.test(q)) return "Core Maths";
  if (q === "IBO Higher level component") return "IB Higher level";
  if (q === "IBO Standard level component") return "IB Standard level";
  if (/^International Baccalaureate/.test(q)) return "IB";
  if (/^T Level/i.test(q)) return "T level";
  const size = (s: string) =>
    s
      .replace(/Extended Certificate/, "Ext. Certificate")
      .replace(/Extended Diploma/, "Ext. Diploma")
      .replace(/Foundation Diploma/, "Foundation Diploma")
      .replace(/Introductory Diploma/, "Intro. Diploma");
  let m = q.match(/^BTEC (?:Level 3 )?National ([A-Za-z ]+?)(?: L3| \(|$)/);
  if (m) return `BTEC ${size(m[1].trim())}`;
  m = q.match(/^BTEC Technical ([A-Za-z]+) L2/);
  if (m) return `BTEC Technical ${m[1]} (L2)`;
  m = q.match(/^OCR Cambridge Technical ([A-Za-z ]+?) at Level (\d)/);
  if (m) return `OCR ${size(m[1].trim())}${m[2] === "2" ? " (L2)" : ""}`;
  m = q.match(/^VRQ Level (\d)/);
  if (m) return `VRQ${m[1] === "2" ? " (L2)" : ""}`;
  return q;
}

// ------------------------------------------------------------------------------- the address

export type AcademicState = { phase: AcademicPhase; mode: AcademicMode; group: QualGroup; applied: AppliedType; area: string | null };
export type AcademicOffer = {
  phases: { gcse: boolean; post16: boolean };
  // The school's main exam level (Overview's set rule, levels.ts setPhaseOf): what Academic opens on.
  main: AcademicPhase;
  groups: RealGroup[]; // the Post-16 groups the school offers, in GROUP_ORDER
  applied: AppliedType[]; // DfE's applied types it has a figure for
  areas: { gcse: string[] }; // its GCSE subject areas
};

/** The Post-16 chips a school sees: All (where it offers more than one group), then its groups. */
export function groupChips(groups: RealGroup[]): QualGroup[] {
  const ordered = GROUP_ORDER.filter((g): g is RealGroup => g !== "all" && groups.includes(g as RealGroup));
  return ordered.length > 1 ? ["all", ...ordered] : ordered;
}

const AREA = /^[a-z_]{2,60}$/;

/** Academic's state in an address, checked against what the school offers. Anything it can't show falls
 * back: an old ?level=whole (or primary) to the main level, a group it doesn't offer to its first chip. */
export function parseAcademic(search: URLSearchParams, offer: AcademicOffer | null): AcademicState {
  const rawLevel = search.get("level");
  let phase: AcademicPhase = rawLevel === "gcse" || rawLevel === "post16" ? rawLevel : (offer?.main ?? "gcse");
  if (offer && !offer.phases[phase]) phase = offer.main;
  const m = search.get("mode");
  const mode: AcademicMode = m === "entries" || m === "va" ? m : "results";
  const chips = offer ? groupChips(offer.groups) : GROUP_ORDER;
  const g = search.get("group") as QualGroup | null;
  const group: QualGroup = g && chips.includes(g) ? g : (chips.includes("alevel") ? "alevel" : (chips[0] ?? "alevel"));
  const a = search.get("applied");
  const appliedOffer = offer?.applied.length ? offer.applied : APPLIED_TYPES;
  const applied: AppliedType = a === "ag" || a === "tl" ? (appliedOffer.includes(a) ? a : appliedOffer[0]) : appliedOffer[0];
  const ar = search.get("area");
  const area = phase === "gcse" && mode !== "va" && ar && AREA.test(ar) && (!offer || offer.areas.gcse.includes(ar)) ? ar : null;
  return { phase, mode, group, applied, area };
}

/** The address's query for a state (the defaults are written too, so a shared link is exact). */
export function academicQuery(s: AcademicState): Record<string, string> {
  const q: Record<string, string> = { level: s.phase, mode: s.mode };
  if (s.phase === "post16") {
    q.group = s.group;
    if (s.group === "applied") q.applied = s.applied;
  } else if (s.area && s.mode !== "va") q.area = s.area;
  return q;
}

// ------------------------------------------------------------------------------- value-added bands

// R-SMT-VA-BANDS. Three bands, worded unlike DfE's five so they're never mistaken for DfE's, for every
// value-added figure DfE doesn't band itself (EPQ, Core Maths, AS, IB, every by-area subject row): from
// the 95% range alone.
export type RangeBand = "Clearly above" | "In line" | "Clearly below";
export function rangeBand(lo: number | null, hi: number | null): RangeBand | null {
  if (lo === null || hi === null) return null;
  if (lo > 0) return "Clearly above";
  if (hi < 0) return "Clearly below";
  return "In line";
}

// Progress 8: DfE's five bands, derived exactly from DfE's definition (secondary accountability measures
// guide): well above average = score above +0.5 and the whole 95% range above 0; above average = range
// entirely above 0; average = the range includes 0; below = range entirely below 0; well below = score
// below -0.5 and the whole range below 0.
export type DfeBand = "Well above average" | "Above average" | "Average" | "Below average" | "Well below average";
export const DFE_BANDS: DfeBand[] = ["Well above average", "Above average", "Average", "Below average", "Well below average"];
export function p8Band(value: number | null, lo: number | null, hi: number | null): DfeBand | null {
  if (value === null || lo === null || hi === null) return null;
  if (lo > 0) return value > 0.5 ? "Well above average" : "Above average";
  if (hi < 0) return value < -0.5 ? "Well below average" : "Below average";
  return "Average";
}

/** DfE's own Post-16 banding text, normalised to the five ("Well above average", …), or null. */
export function dfeBandOf(text: unknown): DfeBand | null {
  if (typeof text !== "string") return null;
  const t = text.trim().toLowerCase();
  return DFE_BANDS.find((b) => b.toLowerCase() === t) ?? null;
}

/** Which side of 0 a band sits: the colour (blue above, orange below; lightness by strength). */
export type BandTone = "above2" | "above" | "mid" | "below" | "below2" | "none";
export function toneOf(band: DfeBand | RangeBand | null): BandTone {
  switch (band) {
    case "Well above average":
      return "above2";
    case "Above average":
    case "Clearly above":
      return "above";
    case "Average":
    case "In line":
      return "mid";
    case "Below average":
    case "Clearly below":
      return "below";
    case "Well below average":
      return "below2";
  }
  return "none";
}

/** Short band words for a dense line ("Well above", "Average", "In line"). */
export const bandShort = (b: DfeBand | RangeBand | null): string => (b ? b.replace(/ average$/, "") : "No band");
