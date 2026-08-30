import { CardSubheading, Caption } from "./Card";
import { POPULATION_TREND_LABELS, type PopulationTrend, type AgeProfileSeries, type PopulationTrendTier } from "@/lib/population-trend";

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

function TrendColumn({
  label,
  ageLabel,
  trend,
  series,
}: {
  label: string;
  ageLabel: string;
  trend: PopulationTrend | null;
  series: AgeProfileSeries | null;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">{label}</span>
        <span className="text-[11px] text-stone-400">{ageLabel}</span>
      </div>
      {series ? (
        <MiniAgeChart series={series} colour={trend ? TIER_COLOUR[trend.tier] : "#a3a3a3"} />
      ) : (
        <Caption>No data.</Caption>
      )}
      {trend ? (
        <div className="mt-2.5 flex items-center gap-1.5" style={{ color: TIER_COLOUR[trend.tier] }}>
          <TrendIcon tier={trend.tier} />
          <span className="text-[13px] font-semibold">{POPULATION_TREND_LABELS[trend.tier]}</span>
          <span className="text-[12px] text-stone-500 dark:text-stone-400">
            ({trend.pct >= 0 ? "+" : ""}
            {trend.pct.toFixed(1)}% age 5 vs age 15)
          </span>
        </div>
      ) : (
        series && <Caption className="mt-2.5">Not enough data for a reliable trend.</Caption>
      )}
    </div>
  );
}

// "Population trend in the area" -- ages 5-15 real DfE census school-enrolment
// figures (NOT true population data -- see population-trend.ts's own comment),
// deliberately a different classification system from the school-level Tube/Pyramid/
// Top Step/Funnel/Mushroom/Wineglass/Irregular taxonomy above: a population profile
// reflects birth-rate history across years, a structurally different thing from one
// institution's own enrolment shape.
export function PopulationTrendSection({
  laName,
  laTrend,
  laSeries,
  region,
  regionTrend,
  regionSeries,
}: {
  laName: string;
  laTrend: PopulationTrend | null;
  laSeries: AgeProfileSeries | null;
  region: string | null;
  regionTrend: PopulationTrend | null;
  regionSeries: AgeProfileSeries | null;
}) {
  if (!laSeries && !regionSeries) return null;
  return (
    <div className="pt-5">
      <CardSubheading
        title="Population trend in the area"
        subtitle="Real school-enrolment counts, ages 5-15, not a school's own shape -- reflects birth-rate history across years in the area, not one institution's admissions pattern. Undercounts true local population the same way school census always does (home-educated/not-yet-enrolled children), same accepted limitation as every other figure on this page."
      />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {laSeries && <TrendColumn label={laName} ageLabel="ages 5-15" trend={laTrend} series={laSeries} />}
        {region && regionSeries && <TrendColumn label={region} ageLabel="ages 5-15" trend={regionTrend} series={regionSeries} />}
      </div>
    </div>
  );
}
