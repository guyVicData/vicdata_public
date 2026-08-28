import { Card, CardHeading } from "./Card";
import type { AgeBandKey } from "@/lib/roll-data";
import { sizeBadgeForValue, type BandDistribution, type SizeBadge } from "@/lib/age-band-distributions";

const BAND_COLOUR: Record<AgeBandKey, string> = {
  early_years: "#3f8f7a",
  primary: "#2c8f4f",
  secondary: "#3f5f8a",
  sixth_form: "#a8437a",
  nineteen_plus: "#7a5ba0",
};

const BADGE_ORDER: SizeBadge[] = ["XS", "S", "M", "L", "XL"];
const ACTIVE_BG = "#a97a1f";
const MUTED_BG_LIGHT = "#f0ece0";
const MUTED_FG_LIGHT = "#b3ab99";

function comparisonCaption(
  schoolValue: number,
  regionalMean: number | null,
  regionalLabel: string | null,
  nationalMean: number,
): string {
  const nat = Math.round(nationalMean);
  const reg = regionalMean !== null ? Math.round(regionalMean) : null;
  const direction = (v: number) => (schoolValue > v * 1.1 ? "Larger than" : schoolValue < v * 0.9 ? "Smaller than" : "About the same as");
  if (reg !== null && regionalLabel) {
    // One comparison word covers both when they agree; otherwise state each plainly.
    const sameDirection = direction(reg) === direction(nat);
    if (sameDirection) {
      return `${direction(nat)} the ${regionalLabel} (${reg.toLocaleString()}) and national (${nat.toLocaleString()}) average`;
    }
    return `${direction(reg)} the ${regionalLabel} average (${reg.toLocaleString()}), ${direction(nat).toLowerCase()} the national average (${nat.toLocaleString()})`;
  }
  return `${direction(nat)} the national average (${nat.toLocaleString()})`;
}

export function PhaseBreakdownCard({
  laName,
  bands,
}: {
  laName: string | null;
  bands: { key: AgeBandKey; label: string; total: number; distribution: BandDistribution | null }[];
}) {
  const withData = bands.filter((b) => b.total > 0);
  if (withData.length === 0) return null;

  return (
    <Card size="wide">
      <CardHeading
        title="Roll by phase"
        subtitle={`How this school's phases size up against other schools of that phase, ${laName ?? "regionally"} & nationally — XS to XL`}
      />
      <div>
        {withData.map((b) => {
          const badge = b.distribution ? sizeBadgeForValue(b.total, b.distribution.quintiles) : null;
          return (
            <div key={b.key} className="flex items-center gap-3.5 border-b border-stone-100 py-2.5 last:border-b-0 dark:border-stone-800">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BAND_COLOUR[b.key] }} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-stone-900 dark:text-stone-100">{b.label}</div>
                <div className="text-[12.5px] leading-relaxed text-stone-500 dark:text-stone-400">
                  {b.distribution
                    ? comparisonCaption(b.total, b.distribution.regionalMean, laName, b.distribution.nationalMean)
                    : "Not enough data yet to compare"}
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
              <div className="w-11 shrink-0 text-right text-[15px] font-semibold text-stone-900 dark:text-stone-100">
                {b.total.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
