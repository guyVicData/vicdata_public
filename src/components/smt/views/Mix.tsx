"use client";

// VicData 0.8 SMT r1: Academic's entries mix -- each area's share of the entries (All areas) or each
// subject's share of the area's, year by year, as stacked columns. Change in entries counts from the
// first year (entries aren't graded: the 2021/22 note doesn't apply). R-SMT-VIEW-MIX.
import { Empty, Key } from "@/components/admissions/ui";
import type { StagePart } from "@/lib/smt/academic";
import { fmt, shortYear } from "../ui";

const SHADES = ["var(--accent)", "rgba(var(--accent-rgb),0.7)", "rgba(var(--accent-rgb),0.48)", "rgba(var(--accent-rgb),0.3)", "var(--adm-grey-2)", "var(--adm-grey-bar)", "var(--adm-grid)"];

export function EntriesMix({ part, height }: { part: StagePart; height: number }) {
  const { keys, years } = part.mix;
  if (!years.length) return <Empty>No entries.</Empty>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Entries mix, year by year</div>
      <div className="flex w-full items-end gap-[10px]" style={{ height }}>
        {years.map((y) => (
          <div key={y.year} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px]" style={{ height: height - 18 }}>
              {keys.map((k, i) => (
                <span key={k.key} title={`${k.label}, ${shortYear(y.year)}: ${fmt(y.shares[k.key] ?? 0, "pct")}`} style={{ height: `${y.shares[k.key] ?? 0}%`, background: SHADES[i % SHADES.length] }} />
              ))}
            </div>
            <span className="text-center text-[10px] text-[var(--muted)]">{shortYear(y.year)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {keys.map((k, i) => (
          <Key key={k.key} swatch={<span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: SHADES[i % SHADES.length] }} />}>
            {k.label}
          </Key>
        ))}
      </div>
    </>
  );
}
