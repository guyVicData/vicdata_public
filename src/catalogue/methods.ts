// VicData 0.8 SMT round 4 (stage I): every catalogue view says exactly how it was calculated. A standing
// rule from this round (R-METHOD-PRESENT, R-METHOD-SETTINGS).
//
// One method per registered dataview (Teacher's DV-C*, Admissions' DV-ADM-*, SMT's DV-SMT-*; groups'
// views are SMT's), kept here rather than on the dataview objects so the pages don't carry ~100 KB of
// text: the footer's source (i) loads this module only when it is opened (MethodNote). Each method
// holds:
//   - the sources, with their editions or years where the data carries them ({placeholders} the host
//     fills from the data it drew);
//   - the geography;
//   - the years used, and any left out with the reason;
//   - the calculation as numbered plain-English steps;
//   - any rounding or suppression.
// The forward view's method is generated from the projection's stored settings (projectionMethod), so
// changing a setting changes the text. Written from the code (the audit in docs/v0.8/smt_r4_report_v1.md).
import { CURRENT_CENSUS_PERIOD, periodLabel } from "./years";
import { METHODS_ADMISSIONS } from "./methods-admissions";
import { METHODS_SMT } from "./methods-smt";
import { METHODS_TEACHER } from "./methods-teacher";

export type ViewMethod = {
  sources: string[];
  geography: string;
  years: string;
  leftOut: string[];
  steps: string[];
  rounding: string[];
  // Set when the text is built from stored settings (the forward view): each value appears in it.
  settings?: Record<string, unknown>;
  // 0.8 audit fixes (5, A1): the notes that describe this view (shown first in its (i)), only where they apply.
  notes?: string[];
};

export const METHODS: Record<string, ViewMethod> = { ...METHODS_TEACHER, ...METHODS_ADMISSIONS, ...METHODS_SMT };

// What a {placeholder} says when the host drawing the view doesn't know it (never a bare brace).
const FALLBACK: Record<string, string> = {
  year: "the latest year held",
  latestYear: "the latest year held",
  from: "the first year held",
  base: "the first year held",
  setLabel: "the comparison set",
  radius: "the school's catchment",
  la: "the local authority",
  ages: "the level's ages",
  subject: "the subject",
  entry: "the entry point",
  phase: "the phase",
  edition: "the latest edition",
};
const fillOne = (s: string, vars: Record<string, string | number | null | undefined>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? (FALLBACK[k] ?? "as shown") : String(v);
  });

// The census years every method may name, from years.ts (CURRENT_CENSUS_PERIOD), so the text moves on
// when DfE publishes a census and the constant moves.
const CENSUS_VARS = {
  census: periodLabel(CURRENT_CENSUS_PERIOD),
  censusPrev: periodLabel(CURRENT_CENSUS_PERIOD - 1),
  census2Before: periodLabel(CURRENT_CENSUS_PERIOD - 2),
  censusJanuary: CURRENT_CENSUS_PERIOD + 1,
  censusPrevJanuary: CURRENT_CENSUS_PERIOD,
};

/** A view's method with its {placeholders} filled from what the host drew (unknown ones say so). */
export function methodOf(id: string, given: Record<string, string | number | null | undefined> = {}): ViewMethod | null {
  const m = METHODS[id];
  if (!m) return null;
  const vars = { ...CENSUS_VARS, ...given };
  return {
    sources: m.sources.map((s) => fillOne(s, vars)),
    geography: fillOne(m.geography, vars),
    years: fillOne(m.years, vars),
    leftOut: m.leftOut.map((s) => fillOne(s, vars)),
    steps: m.steps.map((s) => fillOne(s, vars)),
    rounding: m.rounding.map((s) => fillOne(s, vars)),
    settings: m.settings,
    ...(m.notes ? { notes: m.notes } : {}),
  };
}

/** The method as plain text (the rule tests, the export, print). */
export function methodText(m: ViewMethod): string {
  return [
    `Sources. ${m.sources.join("; ")}.`,
    `Area. ${m.geography}`,
    `Years. ${m.years}`,
    ...(m.leftOut.length ? [`Left out. ${m.leftOut.join(" ")}`] : []),
    `How it is calculated. ${m.steps.map((s, i) => `${i + 1}. ${s}`).join(" ")}`,
    ...(m.rounding.length ? [`Rounding. ${m.rounding.join(" ")}`] : []),
  ].join("\n");
}

// ----------------------------------------------------------------------------- the forward view

// What projectionMethod reads (Context's Forward, as /api/smt/context returns it).
export type ProjectionMethodInput = {
  scope: "around" | "la";
  radius: string | null; // "5 km"
  laName: string | null;
  ages: string; // "11–15"
  lsoaCount: number | null;
  mixLine: string | null; // "Within 5 km: Reading 47%, ..."
  latestYear: number;
  horizonEnd: number;
  bandMissing: boolean;
  settingsVersion: number;
  settings: {
    exceptional_years: number[];
    exceptional_reason: string;
    first_rate_year: number;
    middle_pre_years: number;
    weight_pre: number;
    weight_post: number;
    band_includes_exceptional?: boolean;
    scenario_years: number[];
    scenario_label: string;
    horizon_years: number;
  };
  yearsUsed: { normal: number[]; middle_weights: Record<string, number>; band: number[]; scenario: number[] };
  sources: Record<string, { edition?: string; first?: number; latest?: number; editions_by_year?: Record<string, string> }>;
};

// "2020, 2021, 2022, 2023 and 2024"; "2025 on"
const list = (ys: (number | string)[]) => (ys.length <= 1 ? ys.join("") : `${ys.slice(0, -1).join(", ")} and ${ys[ys.length - 1]}`);
const toMid = (ys: number[]) => list(ys.map((y) => `mid-${y}`));

/** The forward view's method, from the stored settings, in the shape of the method note's (i)
 * (docs/v0.8/vicdata_area_projection_method_v1.md, "The (i), word for word in shape"). Every setting
 * value appears in the text (R-METHOD-SETTINGS). */
export function projectionMethod(p: ProjectionMethodInput): ViewMethod {
  const s = p.settings;
  const la = p.sources.la_estimates ?? {};
  const lsoa = p.sources.lsoa_estimates ?? {};
  // Every year and weight from the settings and the latest year (never the result's own list), so the
  // text follows a change of setting.
  const exc = new Set(s.exceptional_years);
  const normal: number[] = [];
  for (let y = s.first_rate_year; y <= p.latestYear; y++) if (!exc.has(y)) normal.push(y);
  const pre = normal.filter((y) => y < Math.min(...s.exceptional_years)).slice(-s.middle_pre_years);
  const recent = normal.filter((y) => y > Math.max(...s.exceptional_years));
  const weightWords = s.weight_post === 2 * s.weight_pre ? `double weight (weight ${s.weight_post})` : `weight ${s.weight_post}`;
  const bandWords = s.band_includes_exceptional ? `any single year's rates since ${s.first_rate_year}, including ${list(s.exceptional_years)}` : `any single normal year's rates since ${s.first_rate_year}`;
  return {
    sources: [
      `ONS mid-year population estimates by single year of age: local authorities ${la.first ?? ""}–${la.latest ?? ""}${la.edition ? ` (${la.edition})` : ""}`,
      ...(p.scope === "around" ? [`neighbourhoods (LSOA 2021) ${lsoa.first ?? ""}–${lsoa.latest ?? ""}${lsoa.edition ? ` (${lsoa.edition})` : ""}`] : []),
      "births not yet counted: ONS 2022-based subnational projections, percentage change only",
      `the projection's settings, version ${p.settingsVersion}`,
    ],
    geography:
      p.scope === "around"
        ? `Within ${p.radius} of the school: neighbourhoods whose population-weighted centre lies within ${p.radius} (${p.lsoaCount ?? "—"} neighbourhoods${p.mixLine ? `; ${p.mixLine.replace(/^Within [^:]+: /, "authority mix ")}` : ""}).`
        : `The local authority, ${p.laName ?? "the LA"}${p.laName ? "" : ""} (a county is its districts, each projected at its own rates, added together).`,
    years: `Counted to mid-${p.latestYear}; projected to ${p.horizonEnd} (${s.horizon_years} years on). Ages ${p.ages}.`,
    leftOut: [`From the middle line: the years to ${toMid(s.exceptional_years)} (${s.exceptional_reason}).`],
    steps: [
      "For each age, we measure how each authority's children changed in number from one year to the next as they got a year older: families moving in and out, and very rarely deaths.",
      `We leave out ${list(s.exceptional_years)}: ${s.exceptional_reason}. We average the other years${pre.length ? ` (the ${s.middle_pre_years} before them, ${list(pre)}, at weight ${s.weight_pre})` : ""}${recent.length ? `, giving ${list(recent)} ${weightWords}` : ""}.`,
      ...(p.scope === "around" ? [`The neighbourhoods' children are counted by authority and stepped to mid-${p.latestYear} at each authority's actual rates; each authority's part is then aged at its own rates.`] : []),
      "We age today's children forward a year at a time, at those rates.",
      p.bandMissing ? `The band isn't shown for ages ${p.ages} yet; it shows the lowest and highest results from using ${bandWords}.` : `The band shows the lowest and highest results from using ${bandWords}. It is a range of real years' patterns, not a confidence interval.`,
      "Children not yet born start from the latest count of babies, moved by ONS's projected change in births. They are drawn lighter.",
      `The scenario line, "${s.scenario_label}", uses the rates of ${list(s.scenario_years)}.`,
    ],
    rounding: ["Whole children.", ...(p.scope === "around" ? ["A neighbourhood on its own shows no figure below 5."] : []), "A projection of children living in the area, not a forecast for the school."],
    settings: { ...s, version: p.settingsVersion },
  };
}
