// FE-sector-branch-only cards (Prompt A): genuine FE colleges never have DfE census
// roll data, so almost every mainstream card on this page (RollCard, PhaseBreakdownCard,
// BoardingCard, ShapeCard) doesn't apply to them at all -- these are the real,
// ILR-sourced content that replaces those slots on the FE-sector branch specifically.
// Mainstream schools' own cards are untouched.

import Link from "next/link";
import { Card, CardDivider, CardHeading, Caption, Eyebrow, StatNumber } from "./Card";
import type { LaSectorComposition } from "@/lib/la-sector-composition";
import { paragraphFeCollegeLocalShare, renderLocalSixthFormProvisionSentence } from "@/lib/narrative";
import { sizeBadgeForValue, type SizeBadge } from "@/lib/age-band-distributions";
import type { FeParticipationDistribution } from "@/lib/fe-participation-distributions";
import type { SectorTotal } from "@/lib/sixth-form-sector-aggregates";
import type { IlrParticipationSnapshot } from "@/lib/ilr-participation-data";
import { TAG_COLOURS } from "@/lib/tag-colours";

// Same State/Independent/FE hex values RollCard's own LA pie-chart already uses --
// one shared visual vocabulary for "sector" across the whole page, not a second,
// possibly-drifting copy.
// Exported for RegionalSixthFormCard.tsx (item 6's own pies reuse this exact
// vocabulary/gradient rather than a second copy).
export const SECTOR_COLOUR: Record<"State" | "Independent" | "FE", string> = {
  State: TAG_COLOURS.State.light[1],
  Independent: TAG_COLOURS.Independent.light[1],
  FE: TAG_COLOURS.FE.light[1],
};

export function threeWayDonutGradient(state: number, independent: number, fe: number): string {
  const total = state + independent + fe;
  if (total <= 0) return "conic-gradient(#e7e2d9 0% 100%)";
  let acc = 0;
  const stops: string[] = [];
  for (const [label, value] of [
    ["State", state],
    ["Independent", independent],
    ["FE", fe],
  ] as const) {
    if (value <= 0) continue;
    const start = (acc / total) * 100;
    acc += value;
    const end = (acc / total) * 100;
    stops.push(`${SECTOR_COLOUR[label]} ${start.toFixed(1)}% ${end.toFixed(1)}%`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

// 2026-09-20: compact under-19/adult stat, side by side at the top of
// FeCollegeLocalContextCard (folded in from what used to be two standalone
// IlrParticipationCard renders -- see that card's own file for the full-size
// version, still used by the academy-fallback call site). Carries the same real
// content those cards showed, just laid out to fit two side by side: the total, the
// male/female breakdown when both are real, and the DfE-rounding disclosure note
// when the two don't sum to the total (same ~22-29%-of-institutions finding
// IlrParticipationCard's own comment documents) -- none of that is decoration, all
// of it survives the move.
function CompactIlrStat({
  eyebrow,
  total,
  period,
  female,
  male,
  sexLabels,
}: {
  eyebrow: string;
  total: number;
  period: number;
  female: number | null;
  male: number | null;
  sexLabels: { female: string; male: string };
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">{eyebrow}</div>
      <StatNumber size="md">{total.toLocaleString()}</StatNumber>
      <p className="mt-0.5 text-[12px] text-stone-500 dark:text-stone-400">
        learners, {period}/{String(period + 1).slice(2)}
      </p>
      {female !== null && male !== null && (
        <p className="mt-1 text-[12px] text-stone-700 dark:text-stone-300">
          {female.toLocaleString()} {sexLabels.female}, {male.toLocaleString()} {sexLabels.male}
        </p>
      )}
      {female !== null && male !== null && female + male !== total && (
        <p className="mt-1 text-[10.5px] leading-snug text-stone-400 dark:text-stone-600">
          DfE rounds each figure to the nearest 10 independently, so this split may not sum exactly to the total.
        </p>
      )}
    </div>
  );
}

// 2026-09-15/16/20: "where this college sits locally in 16+ provision" -- built
// across several passes. Prompt A's item 1 shipped the FE-only half
// (laComposition.bySector.FE, the same real ILR figures already feeding RollCard's
// own FE sentence and this LA's pie-chart FE slice -- no new query for that half,
// still true). A later pass added the paired State+Independent sixth-form half and
// the three-way pie (sixth_form_sector_aggregates). This pass folds this college's
// own under-19/adult ILR totals into the top of the card (previously two standalone
// IlrParticipationCard renders in the right-column stack) -- Guy wanted one card
// reading like RollCard does for mainstream (a prominent stat up top, then "where
// this sits locally" below), with two stats instead of one.
export function FeCollegeLocalContextCard({
  collegeName,
  laComposition,
  ownUnder19Total,
  sixthFormLa,
  under19Snapshot,
  adultSnapshot,
  aggregateSnapshot,
}: {
  collegeName: string;
  laComposition: LaSectorComposition | null;
  ownUnder19Total: number | null;
  // State/independent sixth-form (16-18) totals for this college's own LA, from the
  // new sixth_form_sector_aggregates table -- `fe` is deliberately absent from this
  // type: FE's own LA-level figure stays laComposition.bySector.FE, read live, never
  // duplicated into that table (see sync-fe-participation-region-national.ts's own
  // comment on why LA scope is out of its job).
  sixthFormLa: { state: SectorTotal | null; independent: SectorTotal | null };
  // This college's own participation snapshots -- the same feUnder19Snapshot/
  // feAdultSnapshot page.tsx already fetches, previously rendered as two standalone
  // IlrParticipationCard cards.
  under19Snapshot: IlrParticipationSnapshot | null;
  adultSnapshot: IlrParticipationSnapshot | null;
  // 2026-09-28: the real dfe_fe_participation_academy figure (page.tsx's own
  // `ilrSnapshot`) -- the headline stat for a showFeTemplate institution that isn't
  // crosswalk-scoped (Hereford, Rochdale, Solihull and others like them: under19Snapshot/
  // adultSnapshot are both null for these, since they never go through the
  // dfe_fe_participation/_adult fetch at all). Rendered as a fallback ONLY when neither
  // of those two exist -- a crosswalk-scoped college's real under-19/adult split always
  // takes priority, unchanged.
  aggregateSnapshot: IlrParticipationSnapshot | null;
}) {
  const feSchools = laComposition?.bySector.FE.schools ?? 0;
  const fePupils = laComposition?.bySector.FE.pupils ?? 0;
  const statePupils = sixthFormLa.state?.total ?? 0;
  const independentPupils = sixthFormLa.independent?.total ?? 0;
  const sixthFormSchoolCount = (sixthFormLa.state?.schoolCount ?? 0) + (sixthFormLa.independent?.schoolCount ?? 0);
  const sixthFormPupilTotal = statePupils + independentPupils;

  const provisionSentence = laComposition
    ? renderLocalSixthFormProvisionSentence(laComposition.laName, sixthFormSchoolCount, sixthFormPupilTotal, feSchools, fePupils)
    : null;
  // Neither the local-context sentence NOR this college's own participation totals
  // have anything real to show -- nothing meaningful at all, so the whole card
  // renders nothing, not an empty shell. provisionSentence alone going null while
  // under19/adult are real shouldn't happen in practice (a genuine open FE college
  // always counts within its own LA's laComposition.bySector.FE tally), but this
  // stays robust to it rather than silently dropping real participation data.
  if (!provisionSentence && !under19Snapshot && !adultSnapshot && !aggregateSnapshot) return null;

  const shareSentence = paragraphFeCollegeLocalShare(collegeName, laComposition, ownUnder19Total);
  const pieTotal = statePupils + independentPupils + fePupils;

  return (
    <Card size="medium" className="flex flex-col gap-3">
      {(under19Snapshot || adultSnapshot) && (
        <div className="flex gap-6">
          {under19Snapshot && (
            <CompactIlrStat
              eyebrow="Under-19 (ILR)"
              total={under19Snapshot.total}
              period={under19Snapshot.period}
              female={under19Snapshot.female}
              male={under19Snapshot.male}
              sexLabels={{ female: "girls", male: "boys" }}
            />
          )}
          {adultSnapshot && (
            <CompactIlrStat
              eyebrow="Adult 19+ (ILR)"
              total={adultSnapshot.total}
              period={adultSnapshot.period}
              female={adultSnapshot.female}
              male={adultSnapshot.male}
              sexLabels={{ female: "female", male: "male" }}
            />
          )}
        </div>
      )}
      {/* 2026-09-28: headline stat for the non-crosswalk showFeTemplate case (Hereford
          and others like it) -- the real dfe_fe_participation_academy total, the only
          figure that source has. Deliberately NOT labelled "Under-19": this source's
          own age split isn't known the way the crosswalk-scoped under19Snapshot/
          adultSnapshot sources' is, so "Participation (ILR)" is the honest, neutral
          eyebrow -- checked against the old standalone IlrParticipationCard's own
          default ("FE participation data (ILR)") for consistency, shortened to match
          this card's terser "Under-19 (ILR)"/"Adult 19+ (ILR)" style. Only renders when
          neither of the two real crosswalk-scoped stats above exist -- never both. */}
      {!under19Snapshot && !adultSnapshot && aggregateSnapshot && (
        <div className="flex gap-6">
          <CompactIlrStat
            eyebrow="Participation (ILR)"
            total={aggregateSnapshot.total}
            period={aggregateSnapshot.period}
            female={aggregateSnapshot.female}
            male={aggregateSnapshot.male}
            sexLabels={{ female: "girls", male: "boys" }}
          />
        </div>
      )}
      {(under19Snapshot || adultSnapshot || aggregateSnapshot) && provisionSentence && <CardDivider />}
      {provisionSentence && (
        <div>
          <h3 className="mb-2 font-[family-name:var(--font-newsreader)] text-[15px] font-medium text-stone-900 dark:text-stone-100">
            Where this college sits locally in 16+ provision
          </h3>
          <p className="text-[13px] leading-relaxed text-stone-700 dark:text-stone-300">{provisionSentence}</p>
        </div>
      )}
      {pieTotal > 0 && (
        <div className="flex items-center gap-5">
          <div
            className="h-20 w-20 shrink-0 rounded-full"
            style={{ background: threeWayDonutGradient(statePupils, independentPupils, fePupils) }}
          />
          <div className="flex flex-col gap-1.5">
            {([
              ["State", statePupils, "State sixth forms (16-18)"],
              ["Independent", independentPupils, "Independent sixth forms (16-18)"],
              ["FE", fePupils, "FE colleges (under-19)"],
            ] as const)
              .filter(([, value]) => value > 0)
              .map(([sector, value, label]) => (
                <div key={sector} className="flex items-center gap-2 text-[13px] text-stone-700 dark:text-stone-300">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SECTOR_COLOUR[sector] }} />
                  {label} — {((value / pieTotal) * 100).toFixed(0)}%
                </div>
              ))}
          </div>
        </div>
      )}
      {shareSentence && (
        <>
          <CardDivider />
          <Caption>{shareSentence}</Caption>
        </>
      )}
      <Caption className="italic">
        Sixth-form (16-18) figures are DfE school census data; FE colleges&rsquo; figure is{" "}
        <Link href="/sources" className="underline hover:text-stone-700 dark:hover:text-stone-300">
          DfE ILR
        </Link>{" "}
        under-19 participation — a slightly broader age net than 16-18, not directly equivalent, shown alongside
        rather than blended into one number.
      </Caption>
    </Card>
  );
}

const BADGE_ORDER: SizeBadge[] = ["XS", "S", "M", "L", "XL"];
const ACTIVE_BG = "#a97a1f";
const MUTED_BG_LIGHT = "#f0ece0";
const MUTED_FG_LIGHT = "#b3ab99";
const UNDER_19_DOT = "#86198f"; // FE fuchsia (TAG_COLOURS.FE) -- this figure is the closest ILR analogue to a roll
const ADULT_DOT = "#a97a1f"; // gold (TAG_COLOURS.Focus) -- a distinct, adjacent-but-different population

function nationalComparisonCaption(value: number, nationalMean: number): string {
  const nat = Math.round(nationalMean);
  const direction = value > nationalMean * 1.1 ? "Larger than" : value < nationalMean * 0.9 ? "Smaller than" : "About the same as";
  return `${direction} the national average (${nat.toLocaleString()})`;
}

// 2026-09-15: Prompt A item 3 -- roll-by-phase replacement. Not a phase breakdown --
// ILR carries no age-band data at all -- two separate size placements instead:
// under-19 total and adult (19+) total, each bucketed against a real national-only
// distribution of FE colleges (scripts/sync-fe-participation-distributions.ts, new
// rows in the SAME age_band_pupil_distributions table the mainstream phase-breakdown
// card reads, band_key "fe_under_19"/"fe_19_plus"). sizeBadgeForValue reused directly,
// not reimplemented.
export function FeParticipationSizeCard({
  under19Total,
  adultTotal,
  under19Distribution,
  adultDistribution,
}: {
  under19Total: number | null;
  adultTotal: number | null;
  under19Distribution: FeParticipationDistribution | null;
  adultDistribution: FeParticipationDistribution | null;
}) {
  const rows: { key: "under19" | "adult"; dot: string; label: string; total: number; distribution: FeParticipationDistribution | null }[] = [];
  if (under19Total !== null) rows.push({ key: "under19", dot: UNDER_19_DOT, label: "Under-19 participation", total: under19Total, distribution: under19Distribution });
  if (adultTotal !== null) rows.push({ key: "adult", dot: ADULT_DOT, label: "Adult (19+) participation", total: adultTotal, distribution: adultDistribution });
  if (rows.length === 0) return null;

  return (
    <Card size="wide">
      <CardHeading
        title="FE participation size"
        subtitle="How this college's ILR participation figures size up against other real FE colleges nationally — XS to XL"
      />
      <div>
        {rows.map((r) => {
          const badge = r.distribution ? sizeBadgeForValue(r.total, r.distribution.quintiles) : null;
          return (
            <div key={r.key} className="flex items-center gap-3.5 border-b border-stone-100 py-2.5 last:border-b-0 dark:border-stone-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.dot }} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-stone-900 dark:text-stone-100">{r.label}</div>
                <div className="text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400">
                  {r.distribution ? nationalComparisonCaption(r.total, r.distribution.meanTotal) : "Not enough data yet to compare"}
                </div>
              </div>
              {badge && (
                <div className="flex gap-1">
                  {BADGE_ORDER.map((size) => (
                    <div
                      key={size}
                      className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-[7px] text-[10.5px] font-bold"
                      style={{
                        background: size === badge ? ACTIVE_BG : MUTED_BG_LIGHT,
                        color: size === badge ? "#ffffff" : MUTED_FG_LIGHT,
                      }}
                    >
                      {size}
                    </div>
                  ))}
                </div>
              )}
              <div className="w-14 shrink-0 text-right text-[15px] font-semibold text-stone-900 dark:text-stone-100">
                {r.total.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function splitDonut(under19Pct: number): string {
  return `conic-gradient(${UNDER_19_DOT} 0% ${under19Pct}%, ${ADULT_DOT} ${under19Pct}% 100%)`;
}

// 2026-09-15: Prompt A item 4 -- boarding-panel replacement, FE-sector branch only
// (mainstream BoardingCard untouched). Both totals are already fetched in page.tsx
// today for the two IlrParticipationCards -- reused here, not re-queried. A null
// figure means "no data for this college" (e.g. City Lit has no real under-19 total
// at all), NOT a genuine zero -- rendered as a single, undiluted slice rather than
// silently implying a confirmed 0.
export function FeParticipationSplitCard({
  under19Total,
  adultTotal,
}: {
  under19Total: number | null;
  adultTotal: number | null;
}) {
  if (under19Total === null && adultTotal === null) return null;
  const total = (under19Total ?? 0) + (adultTotal ?? 0);
  const under19Pct = total > 0 ? ((under19Total ?? 0) / total) * 100 : 0;

  return (
    <Card size="small">
      <Eyebrow>Under-19 / adult split</Eyebrow>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 rounded-full" style={{ background: splitDonut(under19Pct) }} />
        <p className="text-[14px] text-stone-800 dark:text-stone-200">
          {under19Total !== null ? `${under19Total.toLocaleString()} under-19` : "no under-19 data"},{" "}
          {adultTotal !== null ? `${adultTotal.toLocaleString()} adult (19+)` : "no adult data"}
        </p>
      </div>
      {under19Total !== null && adultTotal !== null && (
        <div className="mt-2.5 flex flex-col gap-1 text-[12px] text-stone-600 dark:text-stone-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: UNDER_19_DOT }} />
            Under-19 — {under19Pct.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: ADULT_DOT }} />
            Adult (19+) — {(100 - under19Pct).toFixed(0)}%
          </span>
        </div>
      )}
      <Caption className="mt-2">DfE ILR participation over the academic year, not a single-day headcount.</Caption>
    </Card>
  );
}

// 2026-09-17: the rare real case -- a genuine FE-sector institution with neither
// census (structural, always true for this branch) NOR any real ILR data of its own
// from either source (feUnder19Snapshot and feAdultSnapshot both null). Harrow
// Collegiate (urn 135469, an established anchor in this thread) is exactly this: a
// genuine sixth-form centre that reports its ILR activity under a parent
// institution's own URN rather than its own, confirmed real, not a bug. NoCensusDataCard
// no longer covers this branch at all (gated off for isGenuineFeSector, its own census-
// framed wording doesn't fit here anyway -- ILR IS the applicable source, it's just
// this specific institution missing from it), so without this card the page would go
// genuinely silent on "do we have anything about THIS institution itself" -- an honest
// gap needs an honest, explicit statement, not silence just because every other card
// on the page happens to be LA/region/national context rather than this college's own.
export function FeNoParticipationDataCard() {
  return (
    <Card size="full" ghost>
      <Caption>
        No DfE ILR participation data is available for this institution — this can happen when a sixth-form centre
        reports its activity under a parent institution&rsquo;s own URN rather than its own, or for an institution
        outside ILR&rsquo;s current coverage window. A confirmed, honest gap, not a bug.
      </Caption>
    </Card>
  );
}
