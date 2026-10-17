"use client";

// VicData 0.7 admissions r2 (D3, D4): the tables -- the feeder table (each school with its pupils
// at the age, trend, flag, distance, sector, gender and XS-XL: R-ADM-VIEW-FEEDERS), the rivals
// table, and the year tables on row 2's rails. Every cell is the route's figure.
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import type { Load, MarketView, PipelineOk, RivalsView } from "../api";
import { Empty, FlagPill, ViewTitle, cx, fmtN, fmtPct, fmtSigned, ordinal, yearLabel } from "../ui";
import { cohortWord } from "../panels/EntryNow";
import { ARROW, signedValue } from "@/lib/signed-delta";

const TH = "px-1 py-1 text-[10.5px] font-normal text-[var(--muted)]";
const TD = "px-1 py-[5px] text-[12px]";

const flagFigures = (f: { figures: Record<string, number | string | null> }) =>
  Object.entries(f.figures)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? signedValue(v, Number.isInteger(v) ? 0 : 1) : v ?? "—"}`)
    .join("\n");

export function FeederFlag({ flag, compact = false }: { flag: { id: string; label: string; figures: Record<string, number | string | null> } | null; compact?: boolean }) {
  if (!flag) return null;
  const up = flag.id === "feeder_focus";
  if (compact) return <span title={flagFigures(flag)} className={cx("text-[10px] font-bold", up ? "text-[var(--adm-up-fg)]" : "text-[var(--adm-down-fg)]")}>{up ? (flag.label === "Stable" ? `${ARROW.flat} focus` : `${ARROW.up} focus`) : `${ARROW.down} red flag`}</span>;
  return (
    <FlagPill tone={up ? "up" : "down"} small figures={flagFigures(flag)}>
      {up ? `Focus · ${flag.label.toLowerCase()}` : "Red flag"}
    </FlagPill>
  );
}

const SECTOR = { state: "State", independent: "Independent" } as const;

// 0.7 admissions editor s2: the looks -- `sort` ("listed": the route's order; "latest": most pupils
// first; "change": the biggest rise first) and which of the km / sector / gender / size columns show.
// The flag column always shows (R-ADM-FLAG-FEEDER).
export type FeederTableLook = { sort?: "listed" | "latest" | "change"; showKm?: boolean; showSector?: boolean; showGender?: boolean; showSize?: boolean };
export function FeederTable({ p, fullscreen, look = {} }: { p: PipelineOk; fullscreen: boolean; look?: FeederTableLook }) {
  const t = p.feederTable;
  const { sort = "listed", showKm = true, showSector = true, showGender = true, showSize = true } = look;
  const rows = sort === "latest" ? [...t.rows].sort((a, b) => (b.pupils ?? -1) - (a.pupils ?? -1)) : sort === "change" ? [...t.rows].sort((a, b) => (b.changePct ?? -1e9) - (a.changePct ?? -1e9)) : t.rows;
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
              {showKm && <th className={cx(TH, "text-right")}>km</th>}
              {showSector && <th className={TH}>Sector</th>}
              {showGender && <th className={TH}>Gender</th>}
              {showSize && <th className={TH}>Size</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
                {showKm && <td className={cx(TD, "text-right")}>{r.distanceKm === null ? "—" : r.distanceKm.toFixed(1)}</td>}
                {showSector && <td className={TD}>{r.sector ? SECTOR[r.sector] : "—"}</td>}
                {showGender && <td className={cx(TD, "capitalize")}>{r.gender ?? "—"}</td>}
                {showSize && <td className={TD}>{r.size ?? "—"}</td>}
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

// 0.7 admissions editor s2: `sort` -- "latest" (by pupils at the entry age: the rank) or "listed"
// (nearest first; the school itself at the top).
export function RivalsTable({ m, rivals, fullscreen, sort = "latest" }: { m: MarketView; rivals: Load<RivalsView>; fullscreen: boolean; sort?: "latest" | "listed" }) {
  const y = m.summary.latest;
  const r = rivals.status === "ready" ? rivals.data : null;
  const km = (urn: string) => (urn === m.urn ? -1 : (m.extras.find((x) => x.urn === urn)?.distanceKm ?? 1e9));
  const rows = m.entryAge.rows.filter((x) => x.period === y).sort(sort === "listed" ? (a, b) => km(a.urn) - km(b.urn) : (a, b) => (a.rank ?? 999) - (b.rank ?? 999));
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

// 0.7 admissions editor s2: `years` -- "down" (a row per year, the preset) or "across" (a column per year).
export function EntryTable({ p, years = "down" }: { p: PipelineOk; years?: "down" | "across" }) {
  if (years === "across")
    return (
      <>
        <ViewTitle>Your {cohortWord(p.entry.age)} cohort, year by year</ViewTitle>
        <Across
          years={p.now.series.map((s) => s.period)}
          rows={[
            { label: `Pupils aged ${p.entry.age}`, strong: true, at: (y) => fmtN(p.now.series.find((s) => s.period === y)?.cohort) },
            { label: "Girls", at: (y) => fmtN(p.now.series.find((s) => s.period === y)?.female) },
            { label: "Boys", at: (y) => fmtN(p.now.series.find((s) => s.period === y)?.male) },
          ]}
        />
      </>
    );
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

export function ShareTable({ m, ranks = false, years = "down" }: { m: MarketView; ranks?: boolean; years?: "down" | "across" }) {
  const mine = m.entryAge.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  const last = (r: (typeof mine)[number]) => (ranks ? (r.rank ? `${r.rank} of ${m.entryAge.rows.filter((x) => x.period === r.period && x.count !== null).length}` : "—") : fmtPct(r.share));
  if (years === "across")
    return (
      <>
        <ViewTitle>{ranks ? `Your rank at ${m.entry.label.replace(/ \(.*\)$/, "")}, year by year` : `Your market share at ${m.entry.label.replace(/ \(.*\)$/, "")}, year by year`}</ViewTitle>
        <Across
          years={mine.map((r) => r.period)}
          rows={[
            { label: "You", at: (y) => fmtN(mine.find((r) => r.period === y)?.count) },
            { label: "Group", at: (y) => fmtN(m.entryAge.totals[y]) },
            { label: ranks ? "Rank" : "Share", strong: true, at: (y) => { const r = mine.find((x) => x.period === y); return r ? last(r) : "—"; } },
          ]}
        />
      </>
    );
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

/** A year table turned across: a column per year, a row per figure (the `years: "across"` look). */
function Across({ years, rows }: { years: number[]; rows: { label: string; strong?: boolean; at: (y: number) => string }[] }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full tabular-nums">
        <thead>
          <tr className="text-left">
            <th className={TH} />
            {years.map((y) => (
              <th key={y} className={cx(TH, "text-right")}>
                {yearLabel(y).replace(/^20/, "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-[var(--panel-border)] text-[var(--chip-fg)]">
              <td className={cx(TD, "whitespace-nowrap")}>{r.label}</td>
              {years.map((y) => (
                <td key={y} className={cx(TD, "text-right", r.strong && "font-semibold text-[var(--fg)]")}>
                  {r.at(y)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
