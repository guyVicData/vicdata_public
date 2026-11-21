// The national loads (server-cache.ts NATIONAL_TTL_MS): England-wide values, the same for every school and every
// caller, built once per process and kept 12 hours. Server-only.
//
// Each entry calls the very function the pages call, so it fills the same cachedReference key with the same
// loader: there is no second copy of any key or any read here. The order is the order the first SMT view waits on
// them (/api/smt/school, then the Overview), then the other pages'.
//
// Used by the boot preload (national-preload.ts) and the measurement script (scripts/national-loads-measure.ts).
import { cachedReference } from "./server-cache";
import { lookupAcademicCurrentPeriods, lookupAcademicLatestYears, lookupAcademicSubjectFamilyMap } from "./vicdata-reference";
import { population } from "./smt/population";
import { englandSchools } from "./admissions/ranks";
import { igcseEngland, igcseFamiliesOut } from "./igcse";
import { boardersByUrn } from "./smt/overview";
import { englandBirths } from "./smt/context";
import { englandPopulation } from "./smt/area-data";
import { englandSubjectAverages } from "./front-door/teacher-data";
import { regionBirths } from "./admissions/intake";
import { areaByAge } from "./admissions/screens";
import { loadThresholds } from "./admissions/thresholds";
import { REGION_NAME_TO_ONS_CODE } from "./region-crosswalk";
import { CURRENT_CENSUS_PERIOD } from "@/catalogue/years";

// England's nine regions as school_region_nation names them (englandSchools' regionName, what localBirths passes).
export const ENGLISH_REGIONS = Object.entries(REGION_NAME_TO_ONS_CODE).filter(([, c]) => c.startsWith("E12")).map(([n]) => n);

export type NationalLoad = { key: string; load: () => Promise<unknown> };

export const NATIONAL_LOADS: NationalLoad[] = [
  // /api/smt/school (smt/school.ts smtSchool) waits on these five; /api/admissions/pipeline (the Teacher home's
  // first call) on England's schools and England's ages.
  { key: "years:latest", load: () => cachedReference("years:latest", () => lookupAcademicLatestYears()) },
  { key: `adm:england-schools:${CURRENT_CENSUS_PERIOD}`, load: () => englandSchools() },
  { key: "smt:england-ages", load: () => englandPopulation() },
  { key: "smt:population:ks4", load: () => population("ks4") },
  { key: "smt:population:ks5", load: () => population("ks5") },
  { key: "igcse:england", load: () => igcseEngland() },
  // The Overview, Academic and the SMT figures' version.
  { key: `smt:boarders:${CURRENT_CENSUS_PERIOD}`, load: () => boardersByUrn(CURRENT_CENSUS_PERIOD) },
  { key: "smt:family-map:ks4", load: () => cachedReference("smt:family-map:ks4", () => lookupAcademicSubjectFamilyMap({ ksStage: "ks4" })) },
  { key: "smt:family-map:ks5", load: () => cachedReference("smt:family-map:ks5", () => lookupAcademicSubjectFamilyMap({ ksStage: "ks5" })) },
  { key: "igcse:families-out", load: () => igcseFamiliesOut() },
  // Admissions' pipeline (the Teacher home's first call) and its screens: England's schools above, then these.
  { key: "adm:flag-thresholds", load: () => loadThresholds() },
  { key: "adm:age-profile-aggregates", load: () => areaByAge() },
  ...ENGLISH_REGIONS.map((r) => ({ key: `adm:region-age0:${r}`, load: () => regionBirths(r) })),
  // Context, Pupils and Admissions' intake (England's ages are above).
  { key: "smt:england-births", load: () => englandBirths() },
  // The Teacher dashboards and the phases.
  { key: "phases:current-periods", load: () => cachedReference("phases:current-periods", () => lookupAcademicCurrentPeriods()) },
  { key: "dashboard:england:ks4", load: () => cachedReference("dashboard:england:ks4", () => englandSubjectAverages("ks4")) },
  { key: "dashboard:england:ks5", load: () => cachedReference("dashboard:england:ks5", () => englandSubjectAverages("ks5")) },
  // A primary school's SMT only.
  { key: "smt:population:ks2", load: () => population("ks2") },
];
