"use client";

// VicData 0.7 admissions r2 (D4): Market share, row 1, column 1 (MarketShare.dc.html) -- rank at
// the entry age among the rivals, market share (a share of THIS group, R-ADM-GROUP-SHARE), the
// change in share since 2019/20, the whole-school rank by roll, and "this group" in words.
// R-ADM-VIEW-MARKET. Every figure is the route's.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import type { MarketView } from "../api";
import { Lbl, Tile, fmtN, fmtPct, yearLabel } from "../ui";

export function MarketNow({ m, setLabel, compact = false }: { m: MarketView; setLabel: string; compact?: boolean }) {
  const f = m.summary;
  const age = m.entry.age;
  if (m.fe) {
    return (
      <>
        <div className="text-[12.5px] font-bold text-[var(--fg)]">Your place among the {setLabel}, at {m.entry.label.replace(/ \(.*\)$/, "")}</div>
        <div className="rounded-[9px] border border-[var(--panel-border)] p-3 text-[12px] leading-snug text-[var(--chip-fg)]">{m.fe.label}</div>
        <div className="text-[11px] text-[var(--muted2)]">No share or rank for the college: the group&rsquo;s figures are census counts, the college&rsquo;s are ILR participation.</div>
      </>
    );
  }
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Your place among the {setLabel}, at {m.entry.label.replace(/ \(.*\)$/, "")}</div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label={`Rank at age ${age}`} value={f.rank ? `${f.rank} of ${f.of}` : "—"} sub={`by Year ${age - 4} size`} accent />
        <Tile label="Market share" value={fmtPct(f.share)} sub={`of ${age}-year-olds in this group`} />
        {!compact && <Tile label={`Since ${yearLabel(f.first)}`} value={f.changePts === null ? "—" : `${f.changePts >= 0 ? "▲" : "▼"} ${Math.abs(f.changePts).toFixed(1)} pts`} sub="share change" />}
        {!compact && <Tile small label="Whole school" value={f.rollRank ? `${f.rollRank} of ${f.rollOf}` : "—"} sub="by total roll" />}
      </div>
      {!compact && (
        <div className="flex flex-col gap-[6px] border-t border-[var(--panel-border)] pt-2">
          <Lbl>This group</Lbl>
          <div className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">
            {fmtN(f.total)} pupils aged {age} across you and {f.rivals} rivals: {f.independent} independent, {f.state} state; {f.boarding} with boarding. {ADMISSIONS_NOTES.groupShare}
          </div>
        </div>
      )}
    </>
  );
}
