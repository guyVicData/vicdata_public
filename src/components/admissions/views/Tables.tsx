"use client";

// VicData 0.7 admissions r2 (D3, D4): the tables -- the feeder table (each school with its pupils
// at the age, trend, flag, distance, sector, gender and XS-XL: R-ADM-VIEW-FEEDERS), the rivals
// table, and the year tables on row 2's rails. Every cell is the route's figure.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import type { Load, MarketView, PipelineOk, RivalsView } from "../api";
import { Empty, FlagPill, ViewTitle, cx, fmtN, fmtPct, fmtSigned, ordinal, yearLabel } from "../ui";
import { cohortWord } from "../panels/EntryNow";

const TH = "py-1 text-[10.5px] font-normal text-[var(--muted)]";
const TD = "py-[5px] text-[12px]";

const flagFigures = (f: { figures: Record<string, number | string | null> }) =>
  Object.entries(f.figures)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(1)) : v ?? "—"}`)
    .join("\n");

export function FeederFlag({ flag, compact = false }: { flag: { id: string; label: string; figures: Record<string, number | string | null> } | null; compact?: boolean }) {
  if (!flag) return null;
  const up = flag.id === "feeder_focus";
  if (compact) return <span title={flagFigures(flag)} className={cx("text-[10px] font-bold", up ? "text-[var(--adm-up-fg)]" : "text-[var(--adm-down-fg)]")}>{up ? (flag.label === "Stable" ? "▬ focus" : "▲ focus") : "▼ red flag"}</span>;
  return (
    <FlagPill tone={up ? "up" : "down"} small figures={flagFigures(flag)}>
      {up ? `Focus · ${flag.label.toLowerCase()}` : "Red flag"}
    </FlagPill>
  );
}

const SECTOR = { state: "State", independent: "Independent" } as const;

export function FeederTable({ p, fullscreen }: { p: PipelineOk; fullscreen: boolean }) {
  const t = p.feederTable;
  if (!t.rows.length) return <Empty>No feeder schools in this set. The Admissions lead builds the lists in setup.</Empty>;
  return (
    <>
      <ViewTitle>
        Your feeders: pupils aged {t.age}, their trend since {yearLabel(p.censusPeriod - 2)} and flags
      </ViewTitle>
      <div className={cx("min-h-0", !fullscreen && "overflow-y-auto")} style={fullscreen ? undefined : { maxHeight: 330 }}>
        <table className="w-full tabular-nums">
          <thead className="sticky top-0 bg-[var(--panel-bg)]">
            <tr className="text-left">
              <th className={TH}>School</th>
              <th className={cx(TH, "text-right")}>Aged {t.age}</th>
              <th className={cx(TH, "text-right")}>Trend</th>
              <th className={TH}>Flag</th>
              <th className={cx(TH, "text-right")}>km</th>
              <th className={TH}>Sector</th>
              <th className={TH}>Gender</th>
              <th className={TH}>Size</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.urn} className="border-t border-[var(--panel-border)] text-[var(--chip-fg)]">
                <td className={cx(TD, "max-w-[240px] truncate")} title={`${r.name}${r.laName ? ` · ${r.laName}` : ""}${r.inLists.length ? ` · on the ${r.inLists.join(" and ")} list` : ""}`}>
                  {r.name}
                </td>
                <td className={cx(TD, "text-right font-semibold text-[var(--fg)]")}>{fmtN(r.pupils)}</td>
                <td className={cx(TD, "text-right")} title={`${fmtN(r.before)} → ${fmtN(r.pupils)}`}>
                  {fmtSigned(r.changePct, 0)}
                </td>
                <td className={TD}>
                  <FeederFlag flag={r.flag} />
                </td>
                <td className={cx(TD, "text-right")}>{r.distanceKm === null ? "—" : r.distanceKm.toFixed(1)}</td>
                <td className={TD}>{r.sector ? SECTOR[r.sector] : "—"}</td>
                <td className={cx(TD, "capitalize")}>{r.gender ?? "—"}</td>
                <td className={TD}>{r.size ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">
        The whole set: {fmtN(t.area.from)} → {fmtN(t.area.to)} aged {t.age} ({fmtSigned(t.area.changePct, 1)}). {ADMISSIONS_NOTES.feederFlags}
      </div>
    </>
  );
}

export function RivalsTable({ m, rivals, fullscreen }: { m: MarketView; rivals: Load<RivalsView>; fullscreen: boolean }) {
  const y = m.summary.latest;
  const r = rivals.status === "ready" ? rivals.data : null;
  const rows = m.entryAge.rows.filter((x) => x.period === y).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return (
    <>
      <ViewTitle>Your rivals at {m.entry.label.replace(/ \(.*\)$/, "")}</ViewTitle>
      <div className={cx("min-h-0", !fullscreen && "overflow-y-auto")} style={fullscreen ? undefined : { maxHeight: 340 }}>
        <table className="w-full tabular-nums">
          <thead className="sticky top-0 bg-[var(--panel-bg)]">
            <tr className="text-left">
              <th className={TH}>#</th>
              <th className={TH}>School</th>
              <th className={cx(TH, "text-right")}>Aged {m.entry.age}</th>
              <th className={cx(TH, "text-right")}>Share</th>
              <th className={cx(TH, "text-right")}>Roll</th>
              <th className={TH}>Size</th>
              <th className={cx(TH, "text-right")}>km</th>
              <th className={cx(TH, "text-right")}>Results</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const e = m.extras.find((x) => x.urn === row.urn);
              const rr = r?.rows.find((x) => x.urn === row.urn);
              return (
                <tr key={row.urn} className={cx("border-t border-[var(--panel-border)]", row.urn === m.urn ? "font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")}>
                  <td className={TD}>{row.rank ?? "—"}</td>
                  <td className={cx(TD, "max-w-[220px] truncate")}>{m.schools[row.urn]?.name ?? row.urn}</td>
                  <td className={cx(TD, "text-right")}>{fmtN(row.count)}</td>
                  <td className={cx(TD, "text-right")}>{fmtPct(row.share)}</td>
                  <td className={cx(TD, "text-right")}>{fmtN(e?.roll)}</td>
                  <td className={TD}>{rr?.size?.badge ?? "—"}</td>
                  <td className={cx(TD, "text-right")}>{e?.distanceKm ? e.distanceKm.toFixed(1) : "—"}</td>
                  <td className={cx(TD, "text-right")}>{rr ? (rr.results.note === "igcse_not_ranked" ? "IGCSE" : rr.results.note === "no_published_results" ? "none" : `${ordinal(rr.results.national?.rank)} in England`) : "…"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function EntryTable({ p }: { p: PipelineOk }) {
  return (
    <>
      <ViewTitle>Your {cohortWord(p.entry.age)} cohort, year by year</ViewTitle>
      <table className="w-full tabular-nums">
        <thead>
          <tr className="text-left">
            <th className={TH}>Year</th>
            <th className={cx(TH, "text-right")}>Pupils aged {p.entry.age}</th>
            <th className={cx(TH, "text-right")}>Girls</th>
            <th className={cx(TH, "text-right")}>Boys</th>
          </tr>
        </thead>
        <tbody>
          {p.now.series.map((s) => (
            <tr key={s.period} className="border-t border-[var(--panel-border)] text-[var(--chip-fg)]">
              <td className={TD}>{yearLabel(s.period)}</td>
              <td className={cx(TD, "text-right font-semibold text-[var(--fg)]")}>{fmtN(s.cohort)}</td>
              <td className={cx(TD, "text-right")}>{fmtN(s.female)}</td>
              <td className={cx(TD, "text-right")}>{fmtN(s.male)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function ShareTable({ m, ranks = false }: { m: MarketView; ranks?: boolean }) {
  const mine = m.entryAge.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  return (
    <>
      <ViewTitle>{ranks ? `Your rank at ${m.entry.label.replace(/ \(.*\)$/, "")}, year by year` : `Your market share at ${m.entry.label.replace(/ \(.*\)$/, "")}, year by year`}</ViewTitle>
      <table className="w-full tabular-nums">
        <thead>
          <tr className="text-left">
            <th className={TH}>Year</th>
            <th className={cx(TH, "text-right")}>You</th>
            <th className={cx(TH, "text-right")}>Group</th>
            <th className={cx(TH, "text-right")}>{ranks ? "Rank" : "Share"}</th>
          </tr>
        </thead>
        <tbody>
          {mine.map((r) => (
            <tr key={r.period} className="border-t border-[var(--panel-border)] text-[var(--chip-fg)]">
              <td className={TD}>{yearLabel(r.period)}</td>
              <td className={cx(TD, "text-right")}>{fmtN(r.count)}</td>
              <td className={cx(TD, "text-right")}>{fmtN(m.entryAge.totals[r.period])}</td>
              <td className={cx(TD, "text-right font-semibold text-[var(--fg)]")}>{ranks ? (r.rank ? `${r.rank} of ${m.entryAge.rows.filter((x) => x.period === r.period && x.count !== null).length}` : "—") : fmtPct(r.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
