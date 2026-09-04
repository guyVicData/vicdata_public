import { Card, CardHeading, Caption } from "./Card";
import BirthsChart from "@/components/BirthsChart";
import {
  POPULATION_TREND_LABELS,
  displayPopulationTrendPct,
  type PopulationTrend,
  type AgeProfileSeries,
  type PopulationTrendTier,
  type BirthsTrend,
} from "@/lib/population-trend";

const TIER_COLOUR: Record<PopulationTrendTier, string> = {
  growing: "#2f7d4f",
  stable: "#6b6455",
  decline: "#a97a1f",
  steep_decline: "#c2542f",
  severe_decline: "#a63244",
};

// One consistent glyph family (viewBox 0 0 24 24, stroke=currentColor) -- a single
// up/flat/down arrow whose weight and colour intensity ramps with tier, rather than
// five unrelated icons, so "Steep" and "Severe" read as a heavier version of
// "Decline," not a completely different signal.
function TrendIcon({ tier }: { tier: PopulationTrendTier }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tier === "growing") {
    return <svg {...common} strokeWidth={2}><path d="M4 16l8-8 8 8" /></svg>;
  }
  if (tier === "stable") {
    return <svg {...common} strokeWidth={2}><path d="M4 12h16" /></svg>;
  }
  if (tier === "decline") {
    return <svg {...common} strokeWidth={2}><path d="M6 8l6 8 6-8" /></svg>;
  }
  if (tier === "steep_decline") {
    return (
      <svg {...common} strokeWidth={2.2}>
        <path d="M5 5l7 9 7-9" />
        <path d="M5 13l7 6 7-6" opacity={0.55} />
      </svg>
    );
  }
  return (
    <svg {...common} strokeWidth={2.5}>
      <path d="M5 3l7 9 7-9" />
      <path d="M5 10l7 7 7-7" opacity={0.7} />
      <path d="M5 17l7 4 7-4" opacity={0.4} />
    </svg>
  );
}

// Shared trend readout (tier icon + label + signed %) -- used by both the age-profile
// columns and the births column below, so "Decline" reads identically everywhere on
// this panel: same icon family, same colour ramp, same POPULATION_TREND_LABELS text,
// only the trailing caption (what the % is actually comparing) differs per metric.
function TrendReadout({ tier, pct, captionSuffix }: { tier: PopulationTrendTier; pct: number; captionSuffix: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-1.5" style={{ color: TIER_COLOUR[tier] }}>
      <TrendIcon tier={tier} />
      <span className="text-[13px] font-semibold">{POPULATION_TREND_LABELS[tier]}</span>
      <span className="text-[12px] text-stone-500 dark:text-stone-400">
        {/* displayPopulationTrendPct: display-only sign flip, see population-trend.ts's
            own comment -- kept in sync with the narrative generator's Paragraph 4,
            the only other place this metric is shown to a user. */}
        ({displayPopulationTrendPct(pct) >= 0 ? "+" : ""}
        {displayPopulationTrendPct(pct).toFixed(1)}% {captionSuffix})
      </span>
    </div>
  );
}

function MiniAgeChart({ series, colour }: { series: AgeProfileSeries; colour: string }) {
  const max = Math.max(1, ...series.map((r) => r.total));
  return (
    <div className="flex flex-col gap-[3px]">
      {series.map((r) => (
        <div key={r.age} className="grid grid-cols-[20px_1fr] items-center gap-2">
          <span className="text-right text-[9.5px] text-stone-500 dark:text-stone-400">{r.age}</span>
          <div
            className="h-2 rounded-sm"
            style={{ width: `${Math.max(2, (r.total / max) * 100)}%`, background: colour, opacity: 0.75 }}
          />
        </div>
      ))}
    </div>
  );
}

// 2026-09-27: header is now a fixed, generic label ("Local Authority school
// population" / "Region school population"), not the specific area name -- Guy's own
// call, matching how e.g. RollCard's own section headers describe the KIND of figure,
// not the place. The actual area name (Herefordshire, West Midlands, etc.) stays real
// and visible, just demoted to a subline under the header -- a reader still needs to
// know which LA/region this is, just not as the primary label.
function TrendColumn({
  header,
  areaName,
  ageLabel,
  trend,
  series,
}: {
  header: string;
  areaName: string;
  ageLabel: string;
  trend: PopulationTrend | null;
  series: AgeProfileSeries | null;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">{header}</span>
          <span className="text-[11px] text-stone-400">{ageLabel}</span>
        </div>
        <div className="text-[11.5px] text-stone-500 dark:text-stone-400">{areaName}</div>
      </div>
      {series ? (
        <MiniAgeChart series={series} colour={trend ? TIER_COLOUR[trend.tier] : "#a3a3a3"} />
      ) : (
        <Caption>No data.</Caption>
      )}
      {trend ? (
        <TrendReadout tier={trend.tier} pct={trend.pct} captionSuffix="age 5 vs age 15" />
      ) : (
        series && <Caption className="mt-2.5">Not enough data for a reliable trend.</Caption>
      )}
    </div>
  );
}

// Births column (2026-09-27) -- real ONS births, last 5 real years, bars + an
// overlaid trend line (BirthsChart, its own distinct colour, not the tier ramp the
// two age-profile columns use for their bars). Same TrendReadout system as those two
// columns underneath -- classifyPopulationTrend/POPULATION_TREND_LABELS/TrendIcon,
// unchanged -- so "Decline" here means the same thing as "Decline" for the age
// profile above, a deliberate choice (see population-trend.ts's own comment on
// computeBirthsTrend for the real-distribution check behind it).
function BirthsColumn({
  areaName,
  trend,
  series,
}: {
  areaName: string;
  trend: BirthsTrend | null;
  series: { year: number; count: number }[] | null;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">Births in the Local Authority</span>
          <span className="text-[11px] text-stone-400">last 5 years</span>
        </div>
        <div className="text-[11.5px] text-stone-500 dark:text-stone-400">{areaName}</div>
      </div>
      {series ? <BirthsChart series={series} /> : <Caption>No data.</Caption>}
      {trend ? (
        <TrendReadout tier={trend.tier} pct={trend.pct} captionSuffix={`births ${trend.earliestYear} vs ${trend.latestYear}`} />
      ) : (
        series && <Caption className="mt-2.5">Not enough data for a reliable trend.</Caption>
      )}
    </div>
  );
}

// "Population trends in the area" -- ages 5-15 real DfE census school-enrolment
// figures (NOT true population data -- see population-trend.ts's own comment),
// deliberately a different classification system from the school-level Tube/Pyramid/
// Top Step/Funnel/Mushroom/Wineglass/Irregular taxonomy ShapeCard uses: a population
// profile reflects birth-rate history across years, a structurally different thing
// from one institution's own enrolment shape. Real ONS births (BirthsColumn) is a
// third, independent source alongside the two DfE-census-derived age-profile columns.
//
// 2026-09-27: extracted out of ShapeCard into its own full-width panel (own Card +
// CardHeading, previously a CardSubheading-only block at the bottom of Shape) --
// Guy's own call, equal visual weight to Shape/Roll/etc rather than a footnote.
// Retitled plural ("trends," was "trend") since this panel now covers three real
// series (LA age profile, region age profile, LA births), not two.
export function PopulationTrendSection({
  laName,
  laTrend,
  laSeries,
  region,
  regionTrend,
  regionSeries,
  laBirthsTrend,
  laBirthsSeries,
}: {
  laName: string;
  laTrend: PopulationTrend | null;
  laSeries: AgeProfileSeries | null;
  region: string | null;
  regionTrend: PopulationTrend | null;
  regionSeries: AgeProfileSeries | null;
  laBirthsTrend: BirthsTrend | null;
  laBirthsSeries: { year: number; count: number }[] | null;
}) {
  if (!laSeries && !regionSeries && !laBirthsSeries) return null;
  return (
    <Card size="full">
      <CardHeading
        title="Population trends in the area"
        subtitle="Real school-enrolment counts, ages 5-15, not a school's own shape -- reflects birth-rate history across years in the area, not one institution's admissions pattern. Undercounts true local population the same way school census always does (home-educated/not-yet-enrolled children), same accepted limitation as every other figure on this page."
      />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {laSeries && (
          <TrendColumn header="Local Authority school population" areaName={laName} ageLabel="ages 5-15" trend={laTrend} series={laSeries} />
        )}
        {region && regionSeries && (
          <TrendColumn header="Region school population" areaName={region} ageLabel="ages 5-15" trend={regionTrend} series={regionSeries} />
        )}
        {laBirthsSeries && <BirthsColumn areaName={laName} trend={laBirthsTrend} series={laBirthsSeries} />}
      </div>
    </Card>
  );
}
