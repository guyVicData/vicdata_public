// FE-sector-branch-only cards (Prompt A): genuine FE colleges never have DfE census
// roll data, so almost every mainstream card on this page (RollCard, PhaseBreakdownCard,
// BoardingCard, ShapeCard) doesn't apply to them at all -- these are the real,
// ILR-sourced content that replaces those slots on the FE-sector branch specifically.
// Mainstream schools' own cards are untouched.

import Link from "next/link";
import { Card, CardDivider, CardHeading, Caption, Eyebrow } from "./Card";
import type { LaSectorComposition } from "@/lib/la-sector-composition";
import { renderFeCollegeCountSentence, paragraphFeCollegeLocalShare } from "@/lib/narrative";
import { sizeBadgeForValue, type SizeBadge } from "@/lib/age-band-distributions";
import type { FeParticipationDistribution } from "@/lib/fe-participation-distributions";

// 2026-09-15: Prompt A item 1 -- "where this college sits locally in 16+ provision",
// FE-only half. The paired State+Independent sixth-form half and the three-way pie
// both need a new sector-split, sixth-form-age aggregate that doesn't exist yet
// (deliberately not built this round, no placeholder fabricated). Reuses
// laComposition.bySector.FE.schools/.pupils -- the same real, under-19-only ILR
// figures already feeding the mainstream RollCard's own FE sentence and this LA's
// pie-chart FE slice, no new query.
export function FeCollegeLocalContextCard({
  collegeName,
  laComposition,
  ownUnder19Total,
}: {
  collegeName: string;
  laComposition: LaSectorComposition | null;
  ownUnder19Total: number | null;
}) {
  const countSentence = laComposition
    ? renderFeCollegeCountSentence(laComposition.bySector.FE.schools, laComposition.bySector.FE.pupils)
    : null;
  // FE.schools === 0 -- nothing meaningful to show at all (no count, no possible
  // share), so the whole card renders nothing, not an empty shell.
  if (!countSentence) return null;

  const shareSentence = paragraphFeCollegeLocalShare(collegeName, laComposition, ownUnder19Total);

  return (
    <Card size="medium" className="flex flex-col gap-3">
      <div>
        <h3 className="mb-2 font-[family-name:var(--font-newsreader)] text-[15px] font-medium text-stone-900 dark:text-stone-100">
          Where this college sits locally in 16+ provision
        </h3>
        <p className="text-[13px] leading-relaxed text-stone-700 dark:text-stone-300">{countSentence}</p>
      </div>
      {shareSentence && (
        <>
          <CardDivider />
          <Caption>{shareSentence}</Caption>
        </>
      )}
      {/* Deliberately names ILR, not GIAS -- unlike RollCard's own caption, every
          figure in THIS card (both sentences) comes from the ILR fallback, not
          GIAS's number_of_pupils (structurally always null for FE, confirmed last
          round). */}
      <Caption className="italic">
        Source:{" "}
        <Link href="/sources" className="underline hover:text-stone-700 dark:hover:text-stone-300">
          DfE ILR
        </Link>{" "}
        (Individualised Learner Record) participation data — a different measurement from GIAS&rsquo;s own school
        register, kept separate.
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
