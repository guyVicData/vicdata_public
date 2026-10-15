"use client";

// VicData 0.7 admissions r2 (D3): the pipeline chart (Main.dc.html's large view; Pipeline16.dc.html
// at 16+). Past pools, then the ladder by entry year with its certainty styling -- a catalogue rule
// (R-ADM-VIEW-PIPELINE, R-ADM-LADDER), not a look option:
//   counted     solid, in the accent
//   births      dashed, with the range band (R-ADM-DRIFT-RANGE)
//   projection  11+ only, off unless the member turns it on: a faint band, dotted
// Rung captions sit under the axis; "Pool ▼ x% by 2030 against 2026" and every honesty line come
// from ADMISSIONS_NOTES (passed through the route as `notes`). The figures are the route's.
import type { ReactNode } from "react";
import { ADMISSIONS_NOTES } from "@/catalogue/notes";
import type { PipelineOk } from "../api";
import { FlagPill, Key, LineSwatch, ViewTitle, Empty, fmtN, cx } from "../ui";
import { extent, scale, useWidth } from "./charts";

type PoolPoint = PipelineOk["ladder"]["past"][number];

const kindOfAge = (a: number | null) => (a === null ? null : a <= 3 ? "nurseries" : a <= 10 ? "primaries" : a <= 15 ? "secondaries" : "sixth forms");
const yearWord = (ep: { age: number; label: string }) => (ep.age === 11 ? "Year 7" : ep.age === 4 ? "Reception" : ep.age === 16 ? "Year 12" : `age ${ep.age}`);

export type Segment = { key: string; label: string; years: number; style: "past" | "counted" | "births" | "projection" };

/** The captions under the axis: one per run of years with the same source and kind of school. */
export function segmentsOf(p: PipelineOk): Segment[] {
  const out: Segment[] = [];
  const past = p.ladder.past.filter((x) => x.pool !== null);
  if (past.length) out.push({ key: "past", label: "Past pools (same method, earlier censuses)", years: past.length, style: "past" });
  const runs: { kind: string; source: string; pts: PoolPoint[] }[] = [];
  for (const f of p.ladder.future) {
    const kind = f.source === "counted" ? (kindOfAge(f.rungAge) ?? "schools") : f.source;
    const last = runs[runs.length - 1];
    if (last && last.kind === kind && last.source === f.source) last.pts.push(f);
    else runs.push({ kind, source: f.source, pts: [f] });
  }
  const countedRuns = runs.filter((r) => r.source === "counted");
  const multi = countedRuns.length > 1;
  let rung = 0;
  for (const r of runs) {
    const y0 = r.pts[0].entryYear;
    const y1 = r.pts[r.pts.length - 1].entryYear;
    const yrs = `${y0}–${String(y1).slice(2)}`;
    if (r.source === "counted") {
      rung++;
      const a0 = r.pts[0].rungAge;
      const a1 = r.pts[r.pts.length - 1].rungAge;
      const where = multi ? r.kind : "feeder schools";
      out.push({ key: `c${rung}`, label: multi ? `Rung ${rung} · ages ${a0}→${a1} in ${where} (${yrs})${rung > 1 ? ", widening range" : ""}` : `Counted now: ages ${a0} → ${a1} in ${where}`, years: r.pts.length, style: "counted" });
    } else if (r.source === "births") {
      const b0 = r.pts[0].birthYear;
      const b1 = r.pts[r.pts.length - 1].birthYear;
      out.push({ key: "births", label: `From births ${b0}–${String(b1).slice(2)} (range)`, years: r.pts.length, style: "births" });
    }
  }
  return out;
}

function tip(p: PoolPoint, schools: number | null): string {
  const range = p.low !== null && p.high !== null && (p.low !== p.pool || p.high !== p.pool) ? ` (range ${fmtN(p.low)}–${fmtN(p.high)})` : "";
  if (p.source === "counted" && p.censusPeriod !== null && p.entryYear <= p.censusPeriod + 1)
    return `September ${p.entryYear}: ${fmtN(p.pool)} aged ${p.rungAge} in ${schools ?? "the"} schools, January ${p.censusPeriod! + 1} census. Counted.`;
  if (p.source === "counted") return `September ${p.entryYear}: ${fmtN(p.pool)}${range}. Counted at age ${p.rungAge} now, followed forward ${p.yearsToGo} year${p.yearsToGo === 1 ? "" : "s"}.`;
  if (p.source === "births") return `September ${p.entryYear}: ${fmtN(p.pool)}${range}. From births ${p.birthYear} (Sept ${(p.birthYear ?? 0) - 1}–Aug ${p.birthYear}), in the LA blend. An estimate.`;
  return `September ${p.entryYear}: ${fmtN(p.pool)}${range}. ONS projection (age 10). An estimate.`;
}

// 0.7 admissions editor s2: the looks (PipelineLook) -- `pastPools` (the past pools before now),
// `rungLabels` (the captions under the axis) and `projectionMode` ("member": members can turn the
// 11+ projection on; "off": it stays off and says so). The certainty styling is a rule, not a look.
export function PipelineChart({ p, height = 225, projection, onProjection, onFeederTable, compact = false, flags: showFlags = true, pastPools = true, rungLabels = true, projectionMode = "member" }: { p: PipelineOk; height?: number; projection: boolean; onProjection?: (on: boolean) => void; onFeederTable?: () => void; compact?: boolean; flags?: boolean; pastPools?: boolean; rungLabels?: boolean; projectionMode?: "member" | "off" }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const notes = p.notes ?? ADMISSIONS_NOTES;
  const projectionOn = projectionMode === "off" ? false : projection;
  const allPast = p.ladder.past.filter((x) => x.pool !== null);
  const past = pastPools ? allPast : [];
  const future = p.ladder.future.filter((x) => x.pool !== null);
  const proj = projectionOn ? p.ladder.projection : [];
  if (!past.length && !future.length) return <Empty>No pool to draw: there are no schools with a census in this set. Choose feeders in setup, or widen the filters.</Empty>;
  const years = [...past, ...future, ...proj].map((x) => x.entryYear);
  const x0 = Math.min(...years);
  const x1 = Math.max(...years);
  const W = Math.max(w, 10);
  const H = height;
  const sx = scale([x0 - 0.4, x1 + 0.4], [0, W]);
  const yd = extent([...past.map((x) => x.pool), ...future.flatMap((x) => [x.pool, x.low, x.high]), ...proj.flatMap((x) => [x.low, x.high])], 0.15);
  const sy = scale(yd, [H - 14, 14]);
  const nowYear = past.length ? past[past.length - 1].entryYear : allPast.length && !pastPools ? allPast[allPast.length - 1].entryYear : x0;
  const counted = future.filter((x) => x.source === "counted");
  const births = future.filter((x) => x.source === "births");
  const lastCounted = counted.length ? counted[counted.length - 1] : null;
  const pastPath = past.map((x, i) => `${i ? "L" : "M"}${sx(x.entryYear).toFixed(1)},${sy(x.pool!).toFixed(1)}`).join("");
  const countedPath = counted.map((x, i) => `${i ? "L" : "M"}${sx(x.entryYear).toFixed(1)},${sy(x.pool!).toFixed(1)}`).join("");
  const birthsLine = (lastCounted ? [lastCounted, ...births] : births).map((x, i) => `${i ? "L" : "M"}${sx(x.entryYear).toFixed(1)},${sy(x.pool!).toFixed(1)}`).join("");
  const band = (pts: PoolPoint[]) => {
    const ok = pts.filter((x) => x.low !== null && x.high !== null);
    if (ok.length < 2) return "";
    return `M${ok.map((x) => `${sx(x.entryYear).toFixed(1)},${sy(x.high!).toFixed(1)}`).join("L")}L${[...ok].reverse().map((x) => `${sx(x.entryYear).toFixed(1)},${sy(x.low!).toFixed(1)}`).join("L")}Z`;
  };
  // The range band: every forward year that carries a range, in year order (the counted years'
  // drift range, then the births' range) -- R-ADM-DRIFT-RANGE.
  const rangePts = future.filter((x) => x.low !== null && x.high !== null).sort((a, b) => a.entryYear - b.entryYear);
  const schoolsAt = (age: number | null) => p.sets.find((s) => s.age === age)?.urns.length ?? null;
  const segs = segmentsOf(p).filter((s) => pastPools || s.style !== "past");
  // The boards' shading: the counted run lightly tinted, the births run fainter.
  const bandX = (pts: PoolPoint[]) => (pts.length ? [sx(pts[0].entryYear) - (sx(1) - sx(0)) / 2, sx(pts[pts.length - 1].entryYear) + (sx(1) - sx(0)) / 2] : null);
  const cb = bandX(counted);
  const bb = bandX(births);
  const labelYears = (() => {
    const all = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i);
    const step = Math.max(1, Math.round((all.length - 1) / 5));
    const picks = new Set<number>([x0, x1, nowYear]);
    for (let y = x0; y <= x1; y += step) picks.add(y);
    return [...picks].sort((a, b) => a - b).filter((y, i, a) => i === 0 || y === nowYear || y === x1 || y - a[i - 1] >= Math.max(2, step - 1));
  })();
  const change = p.change;
  const flags = p.feederTable.rows.filter((r) => r.flag);
  const focus = flags.filter((r) => r.flag!.id === "feeder_focus");
  const red = flags.filter((r) => r.flag!.id === "feeder_red");
  const names = (rows: typeof flags) => rows.slice(0, 2).map((r) => r.name.replace(/ (Primary|C ?of ?E|CofE|Church of England|Junior|Infant|Academy|School)\b.*$/i, "")).join(", ") + (rows.length > 2 ? ` +${rows.length - 2}` : "");
  const figures = (rows: typeof flags) => rows.map((r) => `${r.name}: ${fmtN(r.before)} → ${fmtN(r.pupils)} aged ${p.feederTable.age} (${(r.changePct ?? 0) > 0 ? "+" : ""}${(r.changePct ?? 0).toFixed(1)}%)`).join("\n") + `\nThe area (all ${p.feederTable.rows.length}): ${fmtN(p.feederTable.area.from)} → ${fmtN(p.feederTable.area.to)} (${(p.feederTable.area.changePct ?? 0).toFixed(1)}%)`;
  const canProject = p.entry.age === 11;

  return (
    <div className="flex min-w-0 grow flex-col gap-2">
      <ViewTitle>
        Children who will reach {yearWord(p.entry)} entry{compact ? "" : <>, by September &mdash; {p.entry.age >= 16 ? "followed back through each kind of school they're in now" : "in your feeder schools, then from births"}</>}
      </ViewTitle>
      <div ref={ref} className="w-full">
        {w > 0 && (
          <svg width={W} height={H} role="img" aria-label={`The ${p.entry.label} pool by entry year: past pools, counted, from births`}>
            {cb && <rect x={cb[0]} y={14} width={cb[1] - cb[0]} height={H - 28} fill="var(--accent)" opacity={0.07} />}
            {bb && <rect x={bb[0]} y={14} width={bb[1] - bb[0]} height={H - 28} fill="var(--accent)" opacity={0.035} />}
            <line x1={0} x2={W} y1={H - 14} y2={H - 14} stroke="var(--adm-axis)" />
            {[0.33, 0.66].map((f) => (
              <line key={f} x1={0} x2={W} y1={14 + (H - 28) * f} y2={14 + (H - 28) * f} stroke="var(--adm-grid)" />
            ))}
            {pastPath && <path d={pastPath} fill="none" stroke="var(--adm-grey-line)" strokeWidth={2.4} strokeLinejoin="round" />}
            {past.length > 0 && <line x1={(sx(nowYear) + sx(nowYear + 1)) / 2} x2={(sx(nowYear) + sx(nowYear + 1)) / 2} y1={14} y2={H - 14} stroke="var(--adm-grey-2)" strokeDasharray="3 4" />}
            {rangePts.length > 1 && <path d={band(rangePts)} fill="var(--accent)" opacity={0.14} />}
            {proj.length > 1 && (
              <>
                <path d={band(proj)} fill="var(--accent)" opacity={0.07} />
                <path d={proj.map((x, i) => `${i ? "L" : "M"}${sx(x.entryYear).toFixed(1)},${sy(x.pool!).toFixed(1)}`).join("")} fill="none" stroke="var(--adm-range-edge)" strokeWidth={2} strokeDasharray="2 4" />
              </>
            )}
            {countedPath && <path d={countedPath} fill="none" stroke="var(--accent)" strokeWidth={2.8} strokeLinejoin="round" />}
            {births.length > 0 && <path d={birthsLine} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeDasharray="6 5" strokeLinejoin="round" />}
            {past.length > 0 && <circle cx={sx(nowYear)} cy={sy(past[past.length - 1].pool!)} r={4} fill="var(--adm-grey-line)" />}
            {lastCounted && births.length > 0 && <circle cx={sx(lastCounted.entryYear)} cy={sy(lastCounted.pool!)} r={4} fill="var(--accent)" />}
            {[...past, ...future, ...proj].map((x) => (
              <circle key={`${x.source}${x.entryYear}`} cx={sx(x.entryYear)} cy={sy(x.pool!)} r={8} fill="transparent">
                <title>{tip(x, schoolsAt(x.rungAge))}</title>
              </circle>
            ))}
          </svg>
        )}
      </div>
      <div className="flex justify-between px-1 text-[10.5px] text-[var(--muted)]">
        {labelYears.map((y) => (
          <span key={y}>{y === nowYear ? `${y} · now` : y}</span>
        ))}
      </div>
      {/* Rung labels go under the axis (prompt D3). */}
      {rungLabels && (
      <div className="flex gap-[6px] text-[10.5px]">
        {segs.map((s) => (
          <span
            key={s.key}
            style={{ flex: `${s.years} 1 0` }}
            className={cx(
              "min-w-0 truncate pt-1",
              s.style === "past" ? "border-t-2 border-[var(--adm-grey-bar)] text-[var(--muted2)]" : s.style === "births" ? "border-t-2 border-dashed border-[var(--accent)] text-[var(--chip-fg)]" : "border-t-2 border-[var(--accent)] text-[var(--chip-fg)]",
            )}
            title={s.label}
          >
            {s.label}
          </span>
        ))}
      </div>
      )}
      {!compact && (
        <div className="flex flex-wrap items-center gap-4">
          <Key swatch={<LineSwatch colour="var(--accent)" />}>
            <span title={notes.counted}>Counted</span>
          </Key>
          <Key swatch={<LineSwatch colour="var(--accent)" dashed />}>
            <span title={`${p.entry.age <= 4 ? notes.births : (notes.birthsScaled ?? notes.births)} ${notes.drift}`}>From births, with range</span>
          </Key>
          {canProject && projectionMode === "off" ? (
            <Key muted swatch={<span aria-hidden="true" className="h-[9px] w-[14px] border border-dashed border-[var(--adm-range-edge)] bg-[var(--adm-tint)]" />}>
              <span title={notes.projection}>Projection: off for this view</span>
            </Key>
          ) : canProject ? (
            <button type="button" onClick={() => onProjection?.(!projection)} disabled={!onProjection} title={notes.projection} className="inline-flex items-center gap-[6px] text-[11px] text-[var(--muted)] hover:text-[var(--fg)]">
              <span aria-hidden="true" className="h-[9px] w-[14px] border border-dashed border-[var(--adm-range-edge)] bg-[var(--adm-tint)]" />
              Projection: {projection ? "on" : "off"}
            </button>
          ) : (
            <Key muted swatch={<span aria-hidden="true" className="h-[9px] w-[14px] border border-dashed border-[var(--adm-range-edge)] bg-[var(--adm-tint)]" />}>
              <span title="ONS projections we hold are for age 10 only: they suit the 11+ ladder.">Projection: 11+ only</span>
            </Key>
          )}
          <span className="grow" />
          {change && p.changeYear && (
            <span className="text-[12px] font-bold text-[var(--fg)]" title={`${fmtN(change.from)} in ${change.fromYear}, ${fmtN(change.to)} by ${p.changeYear}. ${notes.pool}`}>
              Pool {change.pct < 0 ? "▼" : "▲"} {Math.abs(change.pct).toFixed(0)}% by {p.changeYear} against {change.fromYear}
            </span>
          )}
        </div>
      )}
      {!compact && showFlags && (focus.length > 0 || red.length > 0) && (
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden border-t border-[var(--panel-border)] pt-2 [&>*]:shrink [&>*]:truncate">
          <span className="!shrink-0 text-[11px] font-bold text-[var(--muted2)]">Feeder flags</span>
          {focus.length > 0 && (
            <FlagPill tone="up" figures={figures(focus)}>
              Focus: {names(focus)} &mdash; rising or stable
            </FlagPill>
          )}
          {red.length > 0 && (
            <FlagPill tone="down" figures={figures(red)}>
              Red flag: {names(red)} &mdash; falling faster than the area
            </FlagPill>
          )}
          {onFeederTable && (
            <button type="button" onClick={onFeederTable} className="text-[11px] text-[var(--muted2)] hover:text-[var(--fg)]">
              see the feeder table
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const pipelineFooter = (p: PipelineOk): ReactNode => (p.notes ?? ADMISSIONS_NOTES).poolShort;
