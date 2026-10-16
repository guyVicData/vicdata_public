"use client";

// VicData 0.7 admissions r2 (D4): Market share's ranked bars and donut (MarketShare.dc.html), and
// the change bars. Each rival's pupils at the entry age, its share of THIS group (R-ADM-GROUP-
// SHARE), its trend, and where it sits in its region's and England's results rankings (0.6.6's
// whole-population ranks, R-ADM-RIVAL-RANKS); a rival that isn't ranked says why.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import type { Load, MarketView, RivalsView } from "../api";
import { Empty, ViewTitle, arrow, cx, fmtN, fmtPct, fmtSigned, ordinal, yearLabel } from "../ui";
import { DivergingBar } from "./charts";

const sectorWord = (e: MarketView["extras"][number] | undefined) =>
  [e?.traits?.sector === "independent" ? "Ind" : e?.traits?.sector === "state" ? "State" : null, e?.traits?.boarding ? "boarding" : null, e?.traits?.gender === "girls" ? "girls" : e?.traits?.gender === "boys" ? "boys" : null].filter(Boolean).join(" · ");

function resultsCell(r: RivalsView | null, urn: string, which: "regional" | "national") {
  const row = r?.rows.find((x) => x.urn === urn);
  if (!r) return <span className="text-[var(--muted)]">…</span>;
  if (!row) return <span className="text-[var(--muted)]">&ndash;</span>;
  if (row.results.note === "igcse_not_ranked") return which === "regional" ? <span className="text-[var(--muted)]" title="IGCSE-heavy: listed, not ranked on GCSE (R-IGCSE-EXCL)">IGCSE</span> : <span className="text-[var(--muted)]">&ndash;</span>;
  if (row.results.note === "no_published_results") return which === "regional" ? <span className="text-[var(--muted)]" title="No published results at this stage">none</span> : <span className="text-[var(--muted)]">&ndash;</span>;
  const p = row.results[which];
  if (!p) return <span className="text-[var(--muted)]">&ndash;</span>;
  return <span title={`${ordinal(p.rank)} of ${fmtN(p.of)}${which === "regional" && "region" in p ? ` in ${(p as { region: string }).region}` : " in England"}`}>{ordinal(p.rank)}</span>;
}

export function ShareDonut({ share, size = 170, label }: { share: number | null; size?: number; label: string }) {
  const pct = share ?? 0;
  return (
    <div className="flex flex-col items-center gap-[10px]">
      <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label={`${fmtPct(share)} ${label}`}>
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--adm-grey-bar)" strokeWidth="6" />
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="25" />
      </svg>
      <div className="text-center text-[12px] leading-[1.4] text-[var(--chip-fg)]">
        <b className="text-[15px] text-[var(--adm-accent-text)]">{fmtPct(share)}</b>
        <br />
        {label}
      </div>
    </div>
  );
}

// The full row (MarketShare.dc.html) and the phone's (# · school · share · trend).
const GRID = "grid-cols-[22px_minmax(0,1fr)_110px_42px_40px_64px_64px]";
const GRID_PHONE = "grid-cols-[18px_minmax(0,1fr)_40px_28px]";

// 0.7 admissions editor s2: `show` -- "all" (the preset), "top5" (the top five and, always, you) or
// "around" (two above you and two below); `withDonut` -- the share donut beside the bars.
export function RankedBars({ m, rivals, withDonut = true, fullscreen, phone = false, show = "all" }: { m: MarketView; rivals: Load<RivalsView>; withDonut?: boolean; fullscreen: boolean; phone?: boolean; show?: "all" | "top5" | "around" }) {
  const y = m.summary.latest;
  const ranked = m.entryAge.rows.filter((r) => r.period === y).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const at = ranked.findIndex((r) => r.urn === m.urn);
  const rows = show === "top5" ? ranked.filter((r, i) => i < 5 || r.urn === m.urn) : show === "around" && at >= 0 ? ranked.slice(Math.max(0, at - 2), at + 3) : ranked;
  const max = Math.max(1, ...rows.map((r) => r.count ?? 0));
  const r = rivals.status === "ready" ? rivals.data : null;
  const age = m.entry.age;
  if (!rows.length) return <Empty>No rivals in this set.</Empty>;
  return (
    <div className="flex min-w-0 grow gap-[22px]">
      {withDonut && !fullscreen && (
        <div className="flex shrink-0 basis-[210px] flex-col items-center gap-[10px] pt-[18px]">
          <ShareDonut share={m.summary.share} label={`of ${age}-year-olds across this group`} />
        </div>
      )}
      <div className="flex min-w-0 grow flex-col gap-[3px]">
        <ViewTitle>
          {age}-year-olds by school, ranked &mdash; with where each sits in regional and national results rankings
        </ViewTitle>
        <div className={cx("grid items-center gap-2 px-[6px] py-1 text-[10.5px] text-[var(--muted)]", phone ? GRID_PHONE : GRID)}>
          <span>#</span>
          <span>School</span>
          {!phone && <span>Pupils aged {age}</span>}
          <span>Share</span>
          <span>Trend</span>
          {!phone && <span>Results: region</span>}
          {!phone && <span>Results: England</span>}
        </div>
        <div className={cx("flex flex-col gap-[3px]", !fullscreen && "overflow-y-auto")} style={fullscreen ? undefined : { maxHeight: 300 }}>
          {rows.map((row) => {
            const me = row.urn === m.urn;
            const e = m.extras.find((x) => x.urn === row.urn);
            const t = m.summary.trend[row.urn];
            return (
              <div key={row.urn} className={cx("grid items-center gap-2 rounded-[6px] px-[6px] py-1 text-[12px]", phone ? GRID_PHONE : GRID, me ? "bg-[var(--adm-tint)] font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")}>
                <span className="tabular-nums">{row.rank ?? "—"}</span>
                <span className="truncate" title={`${m.schools[row.urn]?.name ?? row.urn}${e?.distanceKm ? ` · ${e.distanceKm.toFixed(1)} km` : ""}`}>
                  {me ? m.schools[row.urn]?.name : `${m.schools[row.urn]?.name ?? row.urn}${sectorWord(e) ? ` · ${sectorWord(e)}` : ""}`}
                </span>
                {!phone && (
                  <span title={`${fmtN(row.count)} aged ${age}`}>
                    <span className="block h-[10px] rounded-[3px]" style={{ width: `${((row.count ?? 0) / max) * 100}%`, background: me ? "var(--accent)" : "var(--adm-grey-bar)" }} />
                  </span>
                )}
                <span className="tabular-nums">{fmtPct(row.share, 0)}</span>
                <span title={t === null || t === undefined ? "No figure a year ago" : `${fmtSigned(t)} since ${yearLabel(y - 1)}`}>{arrow(t, 2)}</span>
                {!phone && resultsCell(r, row.urn, "regional")}
                {!phone && resultsCell(r, row.urn, "national")}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DonutView({ m }: { m: MarketView }) {
  return (
    <>
      <ViewTitle>Your share of {m.entry.age}-year-olds across this group</ViewTitle>
      <div className="flex grow items-center justify-center gap-8">
        <ShareDonut share={m.summary.share} size={210} label={`of ${fmtN(m.summary.total)} pupils aged ${m.entry.age} in this group`} />
        <div className="max-w-[260px] text-[12px] leading-snug text-[var(--muted2)]">{ADMISSIONS_NOTES.groupShare}</div>
      </div>
    </>
  );
}

/** Change bars: each school's change in share since the first year held at the entry age (share points), diverging. */
export function ShareChange({ m }: { m: MarketView }) {
  const first = m.summary.first;
  const rows = m.extras
    .map((e) => {
      const a = m.entryAge.rows.find((r) => r.urn === e.urn && r.period === first);
      const b = m.entryAge.rows.find((r) => r.urn === e.urn && r.period === m.summary.latest);
      return { urn: e.urn, share: m.summary.shareChange[e.urn] ?? null, from: a?.share ?? null, to: b?.share ?? null };
    })
    .sort((a, b) => (b.share ?? -1e9) - (a.share ?? -1e9));
  const max = Math.max(0.1, ...rows.map((r) => Math.abs(r.share ?? 0)));
  return (
    <>
      <ViewTitle>Change in share since {yearLabel(first)}</ViewTitle>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.urn} className={cx("grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_52px] items-center gap-2 text-[11.5px]", r.urn === m.urn ? "font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")} title={`${fmtPct(r.from)} → ${fmtPct(r.to)}`}>
            <span className="truncate">{m.schools[r.urn]?.name ?? r.urn}</span>
            <DivergingBar value={r.share} max={max} positive={r.urn === m.urn ? "var(--accent)" : "var(--adm-grey-soft)"} negative={r.urn === m.urn ? "var(--adm-orange)" : "var(--adm-grey-2)"} />
            <span className="text-right tabular-nums">{fmtSigned(r.share, 1, " pts")}</span>
          </div>
        ))}
      </div>
    </>
  );
}
