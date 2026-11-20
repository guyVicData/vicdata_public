// VicData speed plan §4.2 item 1, extended to SMT's Overview: the Overview's set schools read from census figures
// built ahead, not from every set school's whole census. Server-only.
//
// smt_school_figures (migrations 20261125100000, 20261125110000) holds, at stage 'census', one row per school:
// overview-figures.ts overviewFigures, worked out from the same reads the Overview makes today (school.ts
// schoolCensuses, admissions/data.ts cachedCensus), built by scripts/build-smt-figures.ts --stage census. A page
// asks for its schools' figures in one call, and the Overview draws from them exactly as from today's reads
// (overview.ts reads every school through OverviewMembers).
//
// The switch: SMT_OVERVIEW_FIGURES=on, apart from SMT Academic's SMT_FIGURES (already on live) so the Overview
// can be switched on, and back off, on its own. Off (the default), or whenever the figures can't answer -- no
// complete build for the census as it is now, a school the build didn't cover, any failure -- the Overview makes
// today's reads instead. Never a mix: every row read carries the one data version, and the version is what the
// data is now:
//   - the stamps of the sources the figures come from (dfe_school_census; gias and gias_links, which the reference
//     lookups' lineage rule follows), and the last school sync;
//   - what the figures are worked out with (the age bands, the entry age, the census's first year);
//   - CENSUS_FORMAT, bumped by hand whenever what is stored, or how it is worked out, changes.
import { createHash } from "node:crypto";
import { cachedReference } from "../server-cache";
import { schoolSyncStamp } from "../school-sync-stamp";
import { referenceSourceStamp } from "../vicdata-reference";
import { AGE_BANDS } from "../roll-data";
import { CENSUS_FIRST_PERIOD } from "@/catalogue/years";
import type { RollSnapshot } from "../roll-data";
import { cachedCensus, type SchoolCensus } from "../admissions/data";
import { schoolCensuses } from "./school";
import { figuresRpc } from "./smt-figures-store";
import { ENTRY_AGE, overviewFigures, overviewMembers, overviewMembersFromRaw, type OverviewFigures, type OverviewMembers } from "./overview-figures";

export const CENSUS_STAGE = "census";
/** Bump whenever what is stored, or how it is worked out (overview-figures.ts, buildRollTrend, fetchCensus,
 * sizeByBand's totals, cohortSeries), changes: the old build then stops answering. */
export const CENSUS_FORMAT = "smt-census-1";
export const CENSUS_SOURCES = ["dfe_school_census", "gias", "gias_links"];

export const overviewFiguresOn = () => process.env.SMT_OVERVIEW_FIGURES === "on";

const hashOf = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

/** The data version census figures must carry to be read now. */
export async function censusVersion(): Promise<string> {
  const [stamps, sync] = await Promise.all([Promise.all(CENSUS_SOURCES.map(async (s) => [s, await referenceSourceStamp(s)])), schoolSyncStamp()]);
  return `census-${hashOf({ CENSUS_FORMAT, stamps, sync, AGE_BANDS, ENTRY_AGE, CENSUS_FIRST_PERIOD }).slice(0, 24)}`;
}

/** One stored row: the school's figures at period 0. */
export type CensusRow = { urn: string; period: 0; figures: OverviewFigures; subjects: null; va: null };

/** A school's row to store, from its own reads (its census by year; its age-by-age census, absent: none). */
export function encodeCensusSchool(urn: string, census: readonly RollSnapshot[], adm: Pick<SchoolCensus, "table" | "ageGender"> | undefined): CensusRow {
  return { urn, period: 0, figures: overviewFigures(census, adm), subjects: null, va: null };
}

// null: no complete build carries this version.
function read(version: string, urns: string[]): Promise<Map<string, OverviewFigures> | null> {
  const asked = Array.from(new Set(urns)).sort();
  return cachedReference(`smt:census-figures:${version}:${asked.join(",")}`, async () => {
    const got = (await figuresRpc("smt_school_figures_read", { p_stage: CENSUS_STAGE, p_version: version, p_urns: asked, p_period_min: 0, p_subject_period: null, p_full_urn: null, p_drop: null })) as { u: string; p: number; f: OverviewFigures }[] | null;
    if (!got) return null;
    return new Map(got.filter((g) => g.p === 0).map((g) => [g.u, g.f]));
  });
}

/** How many Overview builds read each way since the process started (scripts and the parity harness). */
export const overviewReads = { store: 0, live: 0 };

/** Every school the Overview compares (the school and its set) as members: from the figures when they can
 * answer, else from today's reads. */
export async function overviewInputs(urns: string[]): Promise<{ members: OverviewMembers; source: "store" | "live" }> {
  const all = Array.from(new Set(urns));
  const live = async () => {
    // One after the other, as before: the age-by-age census, then the census by year (each limits itself).
    const adm = await cachedCensus(all);
    const censusBy = await schoolCensuses(all);
    overviewReads.live++;
    return { members: overviewMembersFromRaw(censusBy, adm), source: "live" as const };
  };
  if (!overviewFiguresOn()) return live();
  try {
    const got = await read(await censusVersion(), all);
    if (!got) return live();
    const missing = all.filter((u) => !got.has(u));
    if (missing.length) {
      console.info(`[smt figures] census: ${missing.length} school(s) not built (${missing.slice(0, 3).join(", ")}…): today's reads`);
      return live();
    }
    overviewReads.store++;
    return { members: overviewMembers((u) => got.get(u)!), source: "store" };
  } catch (e) {
    console.warn("[smt figures] census: today's reads instead:", e instanceof Error ? e.message : e);
    return live();
  }
}
