// Item 6: regional stacked bar (16-18 State/Independent/FE, every region, ranked) +
// two pie charts (this college's own region split, and the national split). Built on
// the same sixth_form_sector_aggregates table item 1's local pie reads -- see that
// table's own migration comment for the scope-naming rationale and the
// state/independent-vs-fe measurement caveat, carried into this card's own caption
// too (every render here mixes census-sourced and ILR-sourced totals).

import { Card, CardHeading, Caption } from "./Card";
import Link from "next/link";
import type { SixthFormSectorTotals } from "@/lib/sixth-form-sector-aggregates";
import { SECTOR_COLOUR, threeWayDonutGradient } from "./FeCollegeCards";

function sectorTotal(t: SixthFormSectorTotals) {
  return (t.state?.total ?? 0) + (t.independent?.total ?? 0) + (t.fe?.total ?? 0);
}

function StackedBarRow({
  region,
  totals,
  maxTotal,
  isOwnRegion,
}: {
  region: string;
  totals: SixthFormSectorTotals;
  maxTotal: number;
  isOwnRegion: boolean;
}) {
  const total = sectorTotal(totals);
  if (total <= 0) return null;
  const widthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const state = totals.state?.total ?? 0;
  const independent = totals.independent?.total ?? 0;
  const fe = totals.fe?.total ?? 0;

  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span
        className={`w-32 shrink-0 truncate ${isOwnRegion ? "font-semibold text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"}`}
      >
        {region}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex h-3.5 overflow-hidden rounded-sm" style={{ width: `${widthPct}%` }}>
          {state > 0 && <div style={{ width: `${(state / total) * 100}%`, background: SECTOR_COLOUR.State }} />}
          {independent > 0 && (
            <div style={{ width: `${(independent / total) * 100}%`, background: SECTOR_COLOUR.Independent }} />
          )}
          {fe > 0 && <div style={{ width: `${(fe / total) * 100}%`, background: SECTOR_COLOUR.FE }} />}
        </div>
      </div>
      <span className="w-16 shrink-0 text-right text-stone-500 [font-variant-numeric:tabular-nums] dark:text-stone-400">
        {total.toLocaleString()}
      </span>
    </div>
  );
}

function SectorPie({ label, totals }: { label: string; totals: SixthFormSectorTotals }) {
  const state = totals.state?.total ?? 0;
  const independent = totals.independent?.total ?? 0;
  const fe = totals.fe?.total ?? 0;
  const total = state + independent + fe;
  if (total <= 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-20 w-20 shrink-0 rounded-full" style={{ background: threeWayDonutGradient(state, independent, fe) }} />
      <div className="text-center text-[11.5px] text-stone-500 dark:text-stone-400">{label}</div>
      <div className="flex flex-col gap-0.5 text-[11px] text-stone-600 dark:text-stone-400">
        {([
          ["State", state],
          ["Independent", independent],
          ["FE", fe],
        ] as const)
          .filter(([, v]) => v > 0)
          .map(([sector, v]) => (
            <div key={sector} className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SECTOR_COLOUR[sector] }} />
              {sector} — {((v / total) * 100).toFixed(0)}%
            </div>
          ))}
      </div>
    </div>
  );
}

export function RegionalSixthFormCard({
  ownRegion,
  ownRegionTotals,
  nationalTotals,
  allRegions,
}: {
  ownRegion: string | null;
  ownRegionTotals: SixthFormSectorTotals | null;
  nationalTotals: SixthFormSectorTotals | null;
  allRegions: Map<string, SixthFormSectorTotals>;
}) {
  const regionRows = Array.from(allRegions.entries())
    .map(([region, totals]) => ({ region, totals, total: sectorTotal(totals) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const hasPies = (ownRegionTotals && sectorTotal(ownRegionTotals) > 0) || (nationalTotals && sectorTotal(nationalTotals) > 0);
  if (regionRows.length === 0 && !hasPies) return null;

  const maxTotal = regionRows[0]?.total ?? 0;

  return (
    <Card size="wide">
      <CardHeading
        title="16-18 provision by region"
        subtitle="State, Independent and FE colleges' 16-18/under-19 students, region by region"
      />
      {regionRows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {regionRows.map((r) => (
            <StackedBarRow key={r.region} region={r.region} totals={r.totals} maxTotal={maxTotal} isOwnRegion={r.region === ownRegion} />
          ))}
        </div>
      )}
      {hasPies && (
        <div className="mt-5 flex flex-wrap gap-8 border-t border-stone-100 pt-5 dark:border-stone-800">
          {ownRegionTotals && <SectorPie label={ownRegion ?? "This region"} totals={ownRegionTotals} />}
          {nationalTotals && <SectorPie label="England" totals={nationalTotals} />}
        </div>
      )}
      <Caption className="mt-3 italic">
        State/Independent figures are DfE school census 16-18 sixth-form rolls; FE colleges&rsquo; figure is{" "}
        <Link href="/sources" className="underline hover:text-stone-700 dark:hover:text-stone-300">
          DfE ILR
        </Link>{" "}
        under-19 participation — a slightly broader age net than 16-18, not directly equivalent, shown alongside
        rather than blended into one number.
      </Caption>
    </Card>
  );
}
