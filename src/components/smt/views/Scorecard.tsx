"use client";

// VicData 0.8 SMT r1: Overview's large view, Scorecard (the default; Main.dc.html). Each headline:
// you, your rank among the comparison set's schools with that result (the count says how many),
// in the region and in England (0.6.6's ranking), and the change since 2022/23 (years.ts). An IGCSE
// school's GCSE rows say "not ranked", never a zero (R-IGCSE-EXCL). The flags line underneath.
// R-SMT-VIEW-SCORECARD, R-SMT-SET-RANKS.
import { FlagPill } from "@/components/admissions/ui";
import { figuresOf } from "@/components/admissions/views/Momentum";
import { CENSUS_FIRST_PERIOD, periodLabel, TREND_BASE_PERIOD } from "@/catalogue/years";
import type { Overview, SmtSchool } from "../api";
import { Td, Th, arrowOf, changeDp, dirClass, fmt, fmtChange, rankText } from "../ui";

export function Scorecard({ o, school, phone = false }: { o: Overview; school: SmtSchool; phone?: boolean }) {
  const region = o.rows.find((r) => r.region)?.region?.name ?? school.regionName;
  if (phone) {
    return (
      <>
        <div className="text-[12.5px] font-bold text-[var(--fg)]">Rank in {o.set.label}</div>
        <div className="flex flex-col">
          {o.rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between border-b border-[var(--panel-border)] py-[7px] text-[12.5px]">
              <span className="text-[var(--chip-fg)]">{r.label}</span>
              <span className="font-bold text-[var(--fg)]">
                {r.note === "igcse" ? <i className="font-normal text-[var(--muted2)]">not ranked</i> : r.set ? `${r.set.rank} of ${r.set.of}` : "—"} <span className={r.since ? dirClass(r.since.change, 0, changeDp(r.since)) : dirClass(null)}>{r.since ? arrowOf(r.since.change, 0, changeDp(r.since)) : ""}</span>
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">How {school.name.replace(/ School$/, "")} compares, headline by headline</div>
      <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--panel-border)]">
            <tr>
              <Th>Measure</Th>
              <Th>You</Th>
              <Th>{o.set.label}</Th>
              <Th>{region ?? "Region"}</Th>
              <Th>England</Th>
              <Th>Since {periodLabel(TREND_BASE_PERIOD)}</Th>
            </tr>
          </thead>
          <tbody>
            {o.rows.map((r) => {
              const igcse = r.note === "igcse";
              const since = r.since;
              return (
                <tr key={r.key} className="border-b border-[var(--panel-border)] last:border-0" data-score-row={r.key}>
                  <Td className="text-[var(--fg)]">{r.label}</Td>
                  <Td className="font-bold text-[var(--fg)]">{igcse ? <i className="font-normal text-[var(--muted2)]">IGCSE</i> : fmt(r.value, r.unit === "share" ? "share" : r.unit, r.key)}</Td>
                  <Td title={r.set ? `${rankText(r.set)} ${r.set.label}` : undefined}>{igcse ? <i className="text-[var(--muted2)]">not ranked</i> : r.set ? `${r.set.rank} of ${r.set.of}` : "—"}</Td>
                  <Td>{igcse ? "—" : r.region ? `${r.region.rank.toLocaleString("en-GB")} of ${r.region.of.toLocaleString("en-GB")}` : "—"}</Td>
                  <Td>{igcse ? "—" : r.england ? `${r.england.rank.toLocaleString("en-GB")} of ${r.england.of.toLocaleString("en-GB")}` : "—"}</Td>
                  <Td className={`font-bold ${since ? dirClass(since.change, 0, changeDp(since)) : dirClass(null)}`} title={since ? `since ${periodLabel(since.from)}` : r.unit === "va" ? "Value added has two published years: no change is measured" : undefined}>
                    {igcse ? "—" : fmtChange(since)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--panel-border)] pt-2">
        <span className="text-[11.5px] font-bold text-[var(--muted2)]">Flags</span>
        {o.flags.length ? (
          o.flags.map((f) => (
            <FlagPill key={f.id} tone={f.tone} figures={figuresOf(f as never)}>
              {f.label}
            </FlagPill>
          ))
        ) : (
          <span className="text-[11.5px] text-[var(--muted2)]">{o.flagsLoaded ? "None" : "Not available yet"}</span>
        )}
        <span className="text-[11px] text-[var(--muted)]">counts show how many schools in each set have that result; roll and boarders since {periodLabel(CENSUS_FIRST_PERIOD)}</span>
      </div>
    </>
  );
}
