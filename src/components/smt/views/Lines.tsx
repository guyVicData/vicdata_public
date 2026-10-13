"use client";

// VicData 0.8 SMT r1: row 2's line charts (R-SMT-VIEW-TRENDS), on Admissions' chart kit.
//   RollIndexed   the roll indexed to 100 against the LA and England (day and boarding lines at a
//                 boarding school), with SMT_NOTES.rollIndexed behind the caption
//   ResultsBand   a headline (or an area's average) against the set's middle half, 2021/22 shaded
//                 with the trend note (R-TREND-FROM-2223), the direction measured from 2022/23
//   MarketLine    market share at 11+ against the largest rival, from Admissions (read-only)
import Link from "next/link";
import { Empty, Key, LineSwatch, fillHeight } from "@/components/admissions/ui";
import { LineChart, extent, path, scale, useWidth } from "@/components/admissions/views/charts";
import { GRADING_2122_PERIOD, TREND_BASE_PERIOD, TREND_LINE_MIN_YEARS, periodLabel } from "@/catalogue/years";
import { TREND_BASE_NOTE } from "@/catalogue/notes";
import type { Overview } from "../api";
import { dirClass, fmt, shortYear, type Unit } from "../ui";

type Pt = { year: number; value: number | null };
type Band = { year: number; p25: number | null; p75: number | null; n: number };

const yr = (p: number) => periodLabel(p);

/** The direction word since 2022/23 (R-TREND-FROM-2223): Rising / Falling / Steady. */
export function direction(pts: Pt[], flat: number): { word: string; change: number | null } {
  const from = pts.find((p) => p.year === TREND_BASE_PERIOD)?.value ?? null;
  const last = [...pts].reverse().find((p) => p.value !== null);
  if (from === null || !last || last.value === null || last.year <= TREND_BASE_PERIOD) return { word: "", change: null };
  const c = last.value - from;
  return { word: c > flat ? "Rising" : c < -flat ? "Falling" : "Steady", change: c };
}

export function Direction({ pts, flat, up = "Rising", down = "Falling" }: { pts: Pt[]; flat: number; up?: string; down?: string }) {
  const d = direction(pts, flat);
  if (!d.word) return null;
  const word = d.word === "Rising" ? up : d.word === "Falling" ? down : "Steady";
  return <span className={`text-[12px] font-bold ${dirClass(d.change, flat)}`} data-direction="">{d.change! > flat ? "▲" : d.change! < -flat ? "▼" : "▬"} {word}</span>;
}

export function RollIndexed({ o, fullscreen, room }: { o: Overview; fullscreen: boolean; room?: number }) {
  const lines = o.trends.roll.lines;
  if (!lines.length || lines[0].pts.filter((p) => p.value !== null).length < 2) return <Empty>Not enough census years to draw a trend.</Empty>;
  const colour = (k: string) => (k === "school" || k === "day" ? "var(--accent)" : k === "boarding" ? "var(--accent)" : k === "la" ? "var(--adm-grey-soft)" : "var(--adm-grey-2)");
  const dash = (k: string) => (k === "boarding" ? "5 4" : k === "england" ? "4 3" : undefined);
  const years = lines[0].pts.map((p) => p.year);
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">{lines.some((l) => l.key === "boarding") ? "Roll, day and boarding, indexed" : "Roll, indexed"}</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 150}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={[yr(years[0]), yr(years[years.length - 1])]}
        series={lines.map((l) => ({ id: l.key, label: l.label, colour: colour(l.key), width: l.key === "la" || l.key === "england" ? 1.6 : 2.6, dashed: dash(l.key), points: l.pts.map((p) => ({ x: p.year, y: p.value })), title: (pt) => `${l.label} ${yr(pt.x)}: ${pt.y?.toFixed(0)}` }))}
      />
      <div className="flex flex-wrap gap-3">
        {lines.map((l) => (
          <Key key={l.key} swatch={<LineSwatch colour={colour(l.key)} width={14} weight={l.key === "la" || l.key === "england" ? 2 : 2.5} dashed={!!dash(l.key)} />}>
            {l.label}
          </Key>
        ))}
      </div>
    </>
  );
}

/** A line against a band (the set's middle half), the 2021/22 year shaded. */
export function BandChart({ school, band, height, unit, label, setLabel, valueKey }: { school: Pt[]; band: Band[]; height: number; unit: Unit; label: string; setLabel: string; valueKey?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const xs = school.map((p) => p.year);
  const xd: [number, number] = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
  const yd = extent([...school.map((p) => p.value), ...band.flatMap((b) => [b.p25, b.p75])], 0.12);
  const W = Math.max(w, 10);
  const pad = { l: 10, r: 10, t: 8, b: 10 };
  const sx = scale(xd, [pad.l, W - pad.r]);
  const sy = scale(yd, [height - pad.b, pad.t]);
  const pts = band.filter((b) => b.p25 !== null && b.p75 !== null);
  const area = pts.length >= 2 ? `M${pts.map((b) => `${sx(b.year).toFixed(1)},${sy(b.p75!).toFixed(1)}`).join("L")}L${[...pts].reverse().map((b) => `${sx(b.year).toFixed(1)},${sy(b.p25!).toFixed(1)}`).join("L")}Z` : "";
  const step = xs.length > 1 ? (sx(xd[1]) - sx(xd[0])) / (xs.length - 1) : 0;
  const shade = xs.includes(GRADING_2122_PERIOD) ? { x: Math.max(0, sx(GRADING_2122_PERIOD) - step / 2), w: step } : null;
  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <svg width={W} height={height} role="img" aria-label={`${label} against ${setLabel}`}>
          {shade && (
            <rect x={shade.x} y={0} width={shade.w} height={height} fill="var(--adm-grid)" data-shaded-year={GRADING_2122_PERIOD}>
              <title>{TREND_BASE_NOTE}</title>
            </rect>
          )}
          <line x1={0} x2={W} y1={height - 1} y2={height - 1} stroke="var(--adm-axis)" />
          {area && (
            <path d={area} fill="var(--adm-grey-bar)" opacity={0.75} data-band="">
              <title>{`${setLabel}, middle half`}</title>
            </path>
          )}
          <path d={path(school.map((p) => ({ x: p.year, y: p.value })), sx, sy)} fill="none" stroke="var(--accent)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
          {school.map((p) =>
            p.value === null ? null : (
              <circle key={p.year} cx={sx(p.year)} cy={sy(p.value)} r={7} fill="transparent">
                <title>{`${yr(p.year)}: ${fmt(p.value, unit, valueKey)}${(() => { const b = band.find((x) => x.year === p.year); return b && b.p25 !== null ? `; ${setLabel} middle half ${fmt(b.p25, unit, valueKey)}–${fmt(b.p75, unit, valueKey)} (${b.n} schools)` : ""; })()}`}</title>
              </circle>
            ),
          )}
        </svg>
      )}
      {xs.length > 0 && (
        <div className="flex justify-between text-[10px] text-[var(--muted)]">
          {xs.map((x) => (
            <span key={x}>{shortYear(x)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Overview's results trend: each headline against the set (chips to switch where there are two). */
export function ResultsBand({ trend, setLabel, fullscreen, room, title, schoolName }: { trend: { label: string; school: Pt[]; band: Band[] }; setLabel: string; fullscreen: boolean; room?: number; title?: string; schoolName?: string }) {
  const real = trend.school.filter((p) => p.value !== null).length;
  if (real < 2) return <Empty>Not enough published years to draw a trend.</Empty>;
  const unit: Unit = /grade/i.test(trend.label) ? "grade" : "points";
  const key = /A level/.test(trend.label) ? "A level::aps_per_entry" : undefined;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">{title ?? `${trend.label} against ${setLabel}`}</div>
      <BandChart school={trend.school} band={trend.band} height={fullscreen ? fillHeight(room, 150, 300) : 140} unit={unit} label={trend.label} setLabel={setLabel} valueKey={key} />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>{schoolName ?? "The school"}</Key>
        <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px] bg-[var(--adm-grey-bar)]" />}>{setLabel}, middle half</Key>
        {trend.school.some((p) => p.year === GRADING_2122_PERIOD) && <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px] bg-[var(--adm-grid)]" />}>{periodLabel(GRADING_2122_PERIOD)}: generous grading</Key>}
      </div>
      {real < TREND_LINE_MIN_YEARS && <div className="text-[10.5px] text-[var(--muted)]">Fewer than {TREND_LINE_MIN_YEARS} years: the points are drawn, not a trend.</div>}
    </>
  );
}

export function MarketLine({ o, fullscreen, room }: { o: Overview; fullscreen: boolean; room?: number }) {
  const m = o.trends.market;
  if (m.status === "empty")
    return (
      <>
        <div className="text-[12.5px] font-bold text-[var(--fg)]">Market share at 11+, against your rivals</div>
        <Empty>{m.reason}</Empty>
        <Link href="/teacher/admissions" className="text-[11.5px] font-bold text-[var(--adm-accent-text)]">
          Open in Admissions &rarr;
        </Link>
      </>
    );
  const years = m.school.map((p) => p.year);
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Market share at 11+, against your rivals</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 130}
        yFormat={(v) => `${v.toFixed(1)}%`}
        xLabels={years.length ? [yr(years[0]), yr(years[years.length - 1])] : null}
        series={[
          { id: "you", label: "You", colour: "var(--accent)", points: m.school.map((p) => ({ x: p.year, y: p.value })) },
          ...(m.rival.length ? [{ id: "rival", label: m.rivalName ?? "Largest rival", colour: "var(--adm-grey-soft)", width: 1.6, points: m.rival.map((p) => ({ x: p.year, y: p.value })) }] : []),
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>{o.schools[o.urn]?.name ?? "You"}</Key>
        {m.rival.length > 0 && <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} weight={2} />}>Largest rival{m.rivalName ? ` (${m.rivalName})` : ""}</Key>}
      </div>
      <Link href="/teacher/admissions?view=market-share&entry=11%2B" className="text-[11.5px] font-bold text-[var(--adm-accent-text)]">
        Open in Admissions &rarr;
      </Link>
    </>
  );
}
