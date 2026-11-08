"use client";

// VicData 0.8 SMT Academic by qualification: Academic's views in all three modes (Results · Entries ·
// Value added). Wireframes docs/wireframes/smt-value-added (Main, AC-LP-Chart, AC-PM-Table, AC-PM-Areas,
// AC-SV-Map, AC-PM-Entries, LP-GCSE, LP-NoState, AB-Areas, AB-GCSE-Map, PM-Option1, Phone). Nothing here
// computes a figure: every value arrives from /api/smt/academic (src/lib/smt/academic.ts).
//   AcademicNow     column 1: one line per qualification group (Post-16), GCSE lines at GCSE
//   RankChart       the set's schools, ranked: dot and 95% range (value added), dot (points, share);
//                   a line at 0 or the set's median; the axis fits the data
//   RankTable       the same schools, figure by figure, with the place in the set, region and England
//   AcademicMap     the set on the map, coloured by band (value added) or quarter of the set
//   AreasView       subject areas, each area's subjects by qualification
//   GradesView      the grade profile (Results)
//   TrendBand / TrendTable / EveryLine / Moves / MixBars / Against   row 2
import dynamic from "next/dynamic";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { Empty, EntryChip, Key, fillHeight } from "@/components/admissions/ui";
import { scale, useWidth } from "@/components/admissions/views/charts";
import { productAccent } from "@/components/shell/accent";
import { periodLabel } from "@/catalogue/years";
import { signedDelta } from "@/lib/signed-delta";
import type { Theme } from "@/components/shell/TeacherChrome";
import { APPLIED_LABEL, bandShort, toneOf, type AppliedType, type BandTone } from "@/lib/smt/qual-groups";
import type { Academic, AreaSubject, Board, BoardRow, Line, Unit } from "@/lib/smt/academic";
import { BandChart } from "./Lines";
import { BandTable } from "./Tables";
import { ord, rankText, Td, Th } from "../ui";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });
const SMT_HEX = productAccent("smt")!.hex;

// ------------------------------------------------------------------------------- colours
// The boards' band colours: blue above, orange below, lightness by strength (README: lightness differs as
// well as hue); your school is the SMT accent. Theme tokens, set on the Academic page root (acVars).
export function acVars(theme: Theme): CSSProperties {
  const dark = theme === "dark";
  return {
    "--ac-above2": dark ? "#60a5fa" : "#1d4ed8",
    "--ac-above": dark ? "#a9cdf7" : "#60a5fa",
    "--ac-mid": dark ? "#8b8b94" : "#8b8b94",
    "--ac-below": dark ? "#f5b97a" : "#fb923c",
    "--ac-below2": dark ? "#f97316" : "#c2410c",
    "--ac-none": dark ? "#3f3f46" : "#d4d4d8",
    "--ac-you-row": dark ? "#1d1730" : "#f1ecff",
    "--ac-zero": dark ? "#4a4a50" : "#a1a1aa",
  } as CSSProperties;
}
// Leaflet sets marker colours as SVG attributes, where CSS variables don't resolve: hex, on the light basemap.
const TONE_HEX: Record<BandTone, string> = { above2: "#1d4ed8", above: "#60a5fa", mid: "#8b8b94", below: "#fb923c", below2: "#c2410c", none: "#a1a1aa" };
const TONE_VAR: Record<BandTone, string> = { above2: "var(--ac-above2)", above: "var(--ac-above)", mid: "var(--ac-mid)", below: "var(--ac-below)", below2: "var(--ac-below2)", none: "var(--ac-none)" };
const QUARTER_TONE: Record<"top" | "middle" | "bottom", BandTone> = { top: "above2", middle: "mid", bottom: "below2" };
const toneOfRow = (r: { band: BoardRow["band"]; quarter: BoardRow["quarter"] }, unit: Unit): BandTone => (unit === "va" ? toneOf(r.band) : r.quarter ? QUARTER_TONE[r.quarter] : "none");

// ------------------------------------------------------------------------------- figures
export function fmtAc(v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  switch (unit) {
    case "va":
      return signedDelta(v, (x) => Math.abs(x).toFixed(2), { zero: "" });
    case "share":
    case "pct":
      return `${v.toFixed(1)}%`;
    case "entries":
      return Math.round(v).toLocaleString("en-GB");
    case "grade":
      return v.toFixed(2);
    default:
      return v.toFixed(2);
  }
}
const fmtChangeAc = (v: number | null | undefined, unit: Unit) => (v === null || v === undefined ? "—" : signedDelta(v, (x) => { const a = Math.abs(x); return unit === "entries" ? Math.round(a).toLocaleString("en-GB") : unit === "share" || unit === "pct" ? `${a.toFixed(1)} pp` : a.toFixed(unit === "points" ? 1 : 2); }, { zero: "±" }));
const fmtShort = (v: number | null | undefined, unit: Unit) => (unit === "points" && v !== null && v !== undefined ? v.toFixed(1) : fmtAc(v, unit));

function BandPill({ band, unit }: { band: BoardRow["band"]; unit?: Unit }) {
  void unit;
  if (!band) return null;
  const c = TONE_VAR[toneOf(band)];
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-bold" style={{ border: `1px solid ${c}`, color: c }}>
      {bandShort(band)}
    </span>
  );
}

const Vt = ({ children }: { children: ReactNode }) => <div className="text-[12.5px] font-bold text-[var(--fg)]">{children}</div>;
const Tl = ({ children, className = "" }: { children: ReactNode; className?: string }) => <span className={`text-[10.5px] text-[var(--muted2)] ${className}`}>{children}</span>;

// ------------------------------------------------------------------------------- column 1

export function AcademicNow({ a }: { a: Academic }) {
  const va = a.state.mode === "va";
  const entries = a.state.mode === "entries";
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-ac-col1="">
      <Vt>{a.col1.title}</Vt>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">{a.col1.sub}</div>
        {a.col1.note && <p className="mt-2 text-[12px] leading-snug text-[var(--chip-fg)]">{a.col1.note}</p>}
        {a.lines.map((l) => (
          <LineRow key={l.key} l={l} va={va} entries={entries} />
        ))}
        {a.col1.summary.length > 0 && (
          <div className="mt-3 flex flex-col gap-[6px] border-t border-[var(--panel-border)] pt-2" data-ac-summary="">
            {a.state.phase === "gcse" && a.independent !== undefined && a.col1.note && <div className="text-[12px] font-bold text-[var(--fg)]">The local state schools</div>}
            {a.col1.summary.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-2">
                <Tl>{s.label}</Tl>
                <span className="text-right text-[12.5px] font-bold text-[var(--fg)]">{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LineRow({ l, va, entries }: { l: Line; va: boolean; entries: boolean }) {
  const right = va ? <BandPill band={l.band} /> : entries ? (l.typical !== null ? <Tl>set&rsquo;s typical {fmtAc(l.typical, "share")}</Tl> : null) : l.grade ? <span className="text-[12px] font-bold text-[var(--chip-fg)]">{l.grade}</span> : null;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-[2px] border-t border-[var(--panel-border)] py-[7px] first-of-type:border-t-0" data-ac-line={l.key}>
      <span className="text-[12.5px] font-bold text-[var(--fg)]">{l.label}</span>
      <span className="text-right text-[16px] font-extrabold text-[var(--fg)]">{l.value === null ? <span className="text-[12px] font-bold text-[var(--muted2)]">{entries ? "—" : "not ranked"}</span> : entries ? (l.series.at(-1)?.value ?? 0).toLocaleString("en-GB") : fmtAc(l.value, l.unit)}</span>
      <Tl>{entries ? `${fmtAc(l.share, "share")} of entries` : l.sub}</Tl>
      <span className="text-right">{right}</span>
      {l.value === null && l.why ? (
        <Tl className="col-span-2">{l.why}</Tl>
      ) : entries ? (
        <Tl className="col-span-2">{l.series.map((p) => (p.value ?? 0).toLocaleString("en-GB")).join(" → ")} since {l.series[0] ? periodLabel(l.series[0].period) : ""}</Tl>
      ) : (
        <>
          <Tl>{l.place ? `${ord(l.place.rank)} of ${l.place.of} · ${l.placeLabel}` : "not ranked"}</Tl>
          <Tl className="text-right">{l.last !== null ? `${fmtShort(l.last, l.unit)} last year` : ""}</Tl>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------- the applied switch

export function AppliedSwitch({ a, onApplied }: { a: Academic; onApplied: (t: AppliedType) => void }) {
  if (a.state.phase !== "post16" || a.state.group !== "applied" || a.state.mode === "entries" || a.offer.applied.length < 2) return null;
  return (
    <div className="flex gap-2" role="group" aria-label="DfE's applied type">
      {a.offer.applied.map((t) => (
        <EntryChip key={t} label={APPLIED_LABEL[t]} active={a.state.applied === t} onClick={() => onApplied(t)} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------- the ranked chart

/** Whether a board has anything to rank, and if not the message for the middle of the view. */
const boardEmpty = (b: Board) => b.empty;

function Centre({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-1 items-center justify-center px-6 text-center text-[12.5px] leading-snug text-[var(--muted2)]" data-ac-empty="">
      {children}
    </div>
  );
}

export function RankChart({ a, fullscreen, room }: { a: Academic; fullscreen: boolean; room?: number }) {
  const b = a.board;
  const [ref, w] = useWidth<HTMLDivElement>();
  if (boardEmpty(b)) return <Centre>{b.empty}</Centre>;
  const va = b.unit === "va";
  const rows = b.rows;
  const rowH = 27;
  const top = 22;
  const H = top + rows.length * rowH + 6;
  // Narrow (a phone, a column): no km column, names take what's left.
  const W = Math.max(w, 10);
  const narrow = W < 520;
  const nameW = narrow ? W * 0.38 : Math.min(240, W * 0.3);
  const kmX = narrow ? nameW : nameW + 22;
  const valX = narrow ? nameW + 44 : kmX + 50;
  const plot: [number, number] = [valX + 18, W - 12];
  // The axis fits the data (no clamp): every value and range end, with 0 in view for value added.
  const vals = rows.flatMap((r) => [r.value, va ? r.lo : null, va ? r.hi : null]).filter((v): v is number => v !== null);
  if (va) vals.push(0);
  if (b.median !== null) vals.push(b.median);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.06;
  lo -= pad;
  hi += pad;
  const sx = scale([lo, hi], plot);
  const ticks = niceTicks(lo, hi, narrow ? 3 : 5);
  const height = fullscreen && room ? Math.max(H, fillHeight(room, 120, H)) : H;
  return (
    <div ref={ref} className="flex w-full flex-col gap-2" data-ac-chart="">
      <Vt>{b.subtitle}</Vt>
      {w > 0 && (
        <svg width={W} height={height} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={b.subtitle}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={top} y2={H - 6} style={{ stroke: va && t === 0 ? "var(--ac-zero)" : "var(--adm-grid)" }} strokeWidth={va && t === 0 ? 1.4 : 1} />
              <text x={sx(t)} y={14} fontSize={10} textAnchor="middle" style={{ fill: "var(--muted)" }}>
                {va && t === 0 ? (narrow ? "0" : "0 = England average") : fmtTick(t, b.unit)}
              </text>
            </g>
          ))}
          {b.median !== null && (
            <g>
              <line x1={sx(b.median)} x2={sx(b.median)} y1={top} y2={H - 6} strokeDasharray="4 3" style={{ stroke: "var(--adm-grey-soft)" }} />
              <text x={sx(b.median) + 4} y={top + 10} fontSize={10} style={{ fill: "var(--muted)" }}>
                set median {fmtShort(b.median, b.unit)}
              </text>
            </g>
          )}
          <text x={0} y={14} fontSize={10} fontWeight={700} style={{ fill: "var(--muted)" }}>SCHOOL</text>
          {!narrow && <text x={kmX} y={14} fontSize={10} fontWeight={700} textAnchor="end" style={{ fill: "var(--muted)" }}>KM</text>}
          <text x={valX} y={14} fontSize={10} fontWeight={700} textAnchor="end" style={{ fill: "var(--muted)" }}>{va ? "VA" : b.unit === "share" ? "SHARE" : b.unit === "entries" ? "ENTRIES" : "PTS"}</text>
          {rows.map((r, i) => {
            const y = top + i * rowH + 19;
            const tone = toneOfRow(r, b.unit);
            const c = TONE_VAR[tone];
            const label = `${r.name}: ${fmtAc(r.value, b.unit)}${va && r.lo !== null ? ` (95% range ${fmtAc(r.lo, "va")} to ${fmtAc(r.hi, "va")})` : ""}${r.band ? `, ${r.band}` : ""}${r.entries !== null && b.unit === "share" ? `, ${r.entries} entries` : ""}`;
            return (
              <g key={r.urn} data-ac-row={r.you ? "you" : ""}>
                {r.you && <rect x={0} y={y - 17} width={W} height={25} rx={5} style={{ fill: "var(--ac-you-row)" }} />}
                <text x={8} y={y} fontSize={12} fontWeight={r.you ? 700 : 500} style={{ fill: r.you ? "var(--fg)" : "var(--chip-fg)" }}>
                  <title>{r.name}</title>
                  {clip(r.name, nameW)}
                </text>
                {!narrow && <text x={kmX} y={y} fontSize={11} textAnchor="end" style={{ fill: "var(--muted)" }}>{r.km === null ? "—" : r.km < 10 ? r.km.toFixed(1) : Math.round(r.km)}</text>}
                <text x={valX} y={y} fontSize={12} fontWeight={700} textAnchor="end" style={{ fill: "var(--fg)" }}>{fmtShort(r.value, b.unit)}</text>
                {r.value === null ? (
                  <text x={plot[0]} y={y} fontSize={11} style={{ fill: "var(--muted2)" }}>
                    <title>{r.why ?? ""}</title>
                    {r.you && r.why ? clip(r.why, plot[1] - plot[0]) : "no figure"}
                  </text>
                ) : (
                  <>
                    {va && r.lo !== null && r.hi !== null && <line x1={sx(r.lo)} x2={sx(r.hi)} y1={y - 4} y2={y - 4} strokeWidth={2.4} opacity={0.55} style={{ stroke: c }} />}
                    <circle cx={sx(r.value)} cy={y - 4} r={r.you ? 6 : 5} strokeWidth={r.you ? 2.5 : 1.5} style={{ fill: c, stroke: r.you ? "var(--accent)" : "var(--panel-bg)" }}>
                      <title>{label}</title>
                    </circle>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <ChartKey a={a} />
      {va && b.england && <EnglandStrip b={b} a={a} />}
    </div>
  );
}

function ChartKey({ a }: { a: Academic }) {
  const b = a.board;
  if (b.unit === "va") {
    const tones: { t: BandTone; l: string }[] = a.state.phase === "gcse" || a.lines.some((l) => l.band && /average/.test(l.band)) || b.rows.some((r) => r.band && /average/.test(r.band))
      ? [{ t: "above2", l: "Well above" }, { t: "above", l: "Above" }, { t: "mid", l: "Average" }, { t: "below", l: "Below" }, { t: "below2", l: "Well below" }]
      : [{ t: "above", l: "Clearly above" }, { t: "mid", l: "In line" }, { t: "below", l: "Clearly below" }];
    return (
      <div className="flex flex-wrap gap-3">
        {tones.map((x) => (
          <Key key={x.t} swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: TONE_VAR[x.t] }} />}>{x.l}</Key>
        ))}
        <Key swatch={<span className="h-[2.5px] w-[16px] opacity-60" style={{ background: "var(--ac-mid)" }} />}>95% range</Key>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: TONE_VAR.above2 }} />}>Top quarter of the set</Key>
      <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: TONE_VAR.mid }} />}>Middle half</Key>
      <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: TONE_VAR.below2 }} />}>Bottom quarter</Key>
    </div>
  );
}

function EnglandStrip({ b, a }: { b: Board; a: Academic }) {
  const e = b.place.england;
  if (!e) return null;
  const pct = e.of > 1 ? (1 - (e.rank - 1) / (e.of - 1)) * 100 : 50;
  const what = a.state.phase === "gcse" ? "schools with Progress 8" : `schools and colleges with ${b.title.split(",")[0]} value added`;
  return (
    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-1 text-[11px] text-[var(--chip-fg)]" data-ac-england="">
      <span className="whitespace-nowrap">
        England: <b className="text-[var(--fg)]">{ord(e.rank)} of {e.of.toLocaleString("en-GB")}</b> {what}
      </span>
      <span className="relative h-2 min-w-[120px] flex-1 rounded-[4px]" style={{ background: "linear-gradient(90deg, var(--ac-below2), var(--adm-grid) 50%, var(--ac-above2))", opacity: 0.55 }}>
        <span className="absolute top-[-3px] h-[14px] w-[10px] rounded-[3px]" style={{ left: `calc(${pct}% - 5px)`, background: "var(--accent)" }} />
      </span>
      <Tl>lowest &rarr; highest</Tl>
    </div>
  );
}

function niceTicks(lo: number, hi: number, n: number): number[] {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Math.round(t / step) * step);
  return out;
}
const fmtTick = (t: number, unit: Unit) => (unit === "va" ? signedDelta(t, (x) => (Math.abs(x) < 0.001 ? "0" : Math.abs(x).toFixed(Math.abs(t) % 0.5 === 0 ? 1 : 2)), { zero: "" }) : unit === "share" ? `${t}%` : `${t}`);
const clip = (s: string, w: number) => {
  const max = Math.max(8, Math.floor(w / 6.6));
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

// ------------------------------------------------------------------------------- the ranking table

export function RankTable({ a }: { a: Academic }) {
  const b = a.board;
  if (boardEmpty(b)) return <Centre>{b.empty}</Centre>;
  const va = b.unit === "va";
  const p = b.place;
  const prev = b.period !== null ? periodLabel(b.period - 1) : "Last year";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-ac-table="">
      <Vt>{b.subtitle}</Vt>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-[var(--chip-fg)]">
        <span>Your school <b className="text-[var(--fg)]">{p.set ? rankText(p.set) : b.rows.find((r) => r.you)?.value === null ? "Not published" : "—"}</b></span>
        {p.region && <span>{p.region.name} <b className="text-[var(--fg)]">{rankText(p.region)}</b></span>}
        {p.england && <span>England <b className="text-[var(--fg)]">{rankText(p.england)}</b></span>}
        {b.counts && (
          <span>
            <b className="text-[var(--fg)]">{b.counts.above}</b> clearly above average, <b className="text-[var(--fg)]">{b.counts.below}</b> clearly below
          </span>
        )}
        {b.setNote && <span>{b.setNote}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 border-b border-[var(--panel-border)] bg-[var(--panel-bg)]">
            <tr>
              <Th>#</Th>
              <Th>School</Th>
              <Th className="text-right">Km</Th>
              <Th className="text-right">{b.measure}</Th>
              {va && <Th>95% range</Th>}
              {va && <Th>{a.state.phase === "gcse" ? "DfE band" : "Band"}</Th>}
              {!va && b.rows.some((r) => r.grade) && <Th>Grade</Th>}
              {b.unit === "share" && <Th className="text-right">Entries</Th>}
              <Th className="text-right">{prev}</Th>
              <Th className="text-right">Change</Th>
              {b.rows.some((r) => r.england) && <Th className="text-right">England</Th>}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, i) => {
              const rank = r.value === null ? "–" : String(b.rows.filter((x) => x.value !== null && x.value > r.value!).length + 1);
              void i;
              return (
                <tr key={r.urn} className="border-b border-[var(--panel-border)] last:border-0" style={r.you ? { background: "var(--ac-you-row)" } : undefined} data-ac-row={r.you ? "you" : ""}>
                  <Td>{rank}</Td>
                  <Td className={r.you ? "font-bold text-[var(--fg)]" : ""}>
                    {r.name}
                    {r.value === null && r.why && <div className="text-[11px] font-normal leading-snug text-[var(--muted2)]">{r.why}</div>}
                  </Td>
                  <Td className="text-right">{r.km === null ? "—" : r.km < 10 ? r.km.toFixed(1) : Math.round(r.km)}</Td>
                  <Td className="text-right font-bold text-[var(--fg)]">{fmtAc(r.value, b.unit)}</Td>
                  {va && <Td className="whitespace-nowrap">{r.lo !== null ? `${fmtAc(r.lo, "va")} to ${fmtAc(r.hi, "va")}` : "—"}</Td>}
                  {va && <Td><BandPill band={r.band} /></Td>}
                  {!va && b.rows.some((x) => x.grade) && <Td>{r.grade ?? "—"}</Td>}
                  {b.unit === "share" && <Td className="text-right">{r.entries ?? "—"}</Td>}
                  <Td className="text-right">{fmtAc(r.last, b.unit)}</Td>
                  <Td className="text-right">{fmtChangeAc(r.change, b.unit)}</Td>
                  {b.rows.some((x) => x.england) && <Td className="text-right">{r.england ? r.england.rank.toLocaleString("en-GB") : "—"}</Td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------- the map

export function AcademicMap({ a, fullscreen, room }: { a: Academic; fullscreen: boolean; room?: number }) {
  const b = a.board;
  const members: ConsortiumMapMember[] = useMemo(() => b.rows.filter((r) => r.easting !== null && r.northing !== null).map((r) => ({ urn: r.urn, name: r.name, easting: r.easting!, northing: r.northing!, roll: null })), [b]);
  if (boardEmpty(b)) return <Centre>{b.empty}</Centre>;
  if (!members.length) return <Empty>No located schools in this set.</Empty>;
  const h = fullscreen && room ? fillHeight(room, 90, 560) : null;
  const byUrn = new Map(b.rows.map((r) => [r.urn, r]));
  const hex = (urn: string) => {
    const r = byUrn.get(urn)!;
    return r.value === null ? TONE_HEX.none : TONE_HEX[toneOfRow(r, b.unit)];
  };
  const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return (
    <div className="flex flex-col gap-2" data-ac-map="">
      <Vt>{b.subtitle.replace("ranked", "on the map")}</Vt>
      <div style={h ? { height: h } : undefined}>
        <ConsortiumMap
          members={members}
          targetUrn={a.urn}
          heightClass={`${h ? "h-full" : fullscreen ? "h-[560px]" : "h-[340px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
          markerOf={(x) => {
            const you = x.urn === a.urn;
            return { radius: you ? 9 : 7, color: you ? SMT_HEX : hex(x.urn), fillColor: hex(x.urn), fillOpacity: byUrn.get(x.urn)?.value === null ? 0.25 : 0.75, weight: you ? 4 : 1.5 };
          }}
          tooltipOf={(x) => {
            const r = byUrn.get(x.urn)!;
            return `<b>${esc(r.name)}${r.you ? " (you)" : ""}</b><br>${r.value === null ? esc(r.why ?? "not published") : `${esc(b.measure)}: ${esc(fmtAc(r.value, b.unit))}${r.band ? ` · ${esc(r.band)}` : ""}${r.quarter ? ` · ${r.quarter === "middle" ? "middle half" : `${r.quarter} quarter`} of the set` : ""}`}`;
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ChartKey a={a} />
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: TONE_HEX.none }} />}>Not published</Key>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------- subject areas

export function AreasView({ a }: { a: Academic }) {
  const mode = a.state.mode;
  if (a.areas.none) return <Centre>{a.areas.none}</Centre>;
  const unit: Unit = mode === "va" ? "va" : mode === "entries" ? "share" : a.state.phase === "gcse" ? "grade" : "points";
  const blocks = a.areas.blocks;
  const level = a.state.phase === "gcse" ? "GCSE" : "Post-16";
  const allVals = blocks.flatMap((b) => b.quals.flatMap((q) => q.subjects.flatMap((s) => [s.value, ...s.setValues]))).filter((v): v is number => v !== null);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-ac-areas="">
      <Vt>
        {mode === "va" ? "Value added" : mode === "entries" ? "Entries" : "Results"} by subject area{a.state.phase === "post16" ? (a.state.group === "all" ? ", all qualifications" : "") : a.areaLabel ? ` · ${a.areaLabel}` : ""}
      </Vt>
      <Tl>
        Each subject area, its subjects by qualification{mode === "entries" ? ` · entries and share of the school's ${level} entries` : ""}
        {a.areas.period !== null ? ` · ${periodLabel(a.areas.period)}` : ""}
      </Tl>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-[1] border-b border-[var(--panel-border)] bg-[var(--panel-bg)]">
            <tr>
              <Th>Subject, by qualification</Th>
              <Th className="text-right">Entries</Th>
              {mode === "entries" && <Th>{a.areas.period !== null ? `${periodLabel(a.areas.period - 2).slice(0, 7)} → ${periodLabel(a.areas.period).slice(2)}` : ""}</Th>}
              {mode === "entries" && <Th>Size</Th>}
              <Th className="text-right">{mode === "va" ? "VA" : mode === "entries" ? "Share" : a.state.phase === "gcse" ? "Avg grade" : "Pts"}</Th>
              <Th>{mode === "va" ? "you (ringed) and the set's schools" : mode === "entries" ? "you and the set's typical school" : "you and the set's schools"}</Th>
              {mode === "entries" && <Th className="text-right">vs set</Th>}
              <Th className="text-right">{mode === "entries" ? "Set offering" : "Place in set"}</Th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <AreaRows key={b.id} label={b.label} quals={b.quals} mode={mode} unit={unit} vals={allVals} />
            ))}
            {a.areas.outside.length > 0 && <AreaRows label="Outside the subject areas" quals={[{ qualification: "EPQ", short: "EPQ", subjects: a.areas.outside }]} mode={mode} unit={unit} vals={allVals} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AreaRows({ label, quals, mode, unit, vals }: { label: string; quals: { qualification: string; short: string; subjects: AreaSubject[] }[]; mode: Academic["state"]["mode"]; unit: Unit; vals: number[] }) {
  const cols = mode === "entries" ? 8 : 5;
  return (
    <>
      <tr>
        <td colSpan={cols} className="px-2 pb-1 pt-3 text-[12px] font-extrabold text-[var(--fg)]">{label}</td>
      </tr>
      {quals.map((q) => (
        <QualRows key={q.qualification} q={q} mode={mode} unit={unit} vals={vals} cols={cols} />
      ))}
    </>
  );
}

function QualRows({ q, mode, unit, vals, cols }: { q: { qualification: string; short: string; subjects: AreaSubject[] }; mode: Academic["state"]["mode"]; unit: Unit; vals: number[]; cols: number }) {
  return (
    <>
      <tr>
        <td colSpan={cols} className="px-2 pt-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--muted2)]">{q.short}</td>
      </tr>
      {q.subjects.map((s) => (
        <tr key={`${s.qualification}::${s.subject}`} className="border-b border-[var(--panel-border)] last:border-0" data-ac-subject={s.subject}>
          <Td className="pl-4">
            {s.subject}
            {s.vicdata && <span title="placed in its subject area by VicData">&nbsp;&dagger;</span>}
          </Td>
          <Td className="text-right">{s.entries}</Td>
          {mode === "entries" && <Td className="whitespace-nowrap">{s.counts.map((c) => (c === null ? "—" : c)).join(" → ")}</Td>}
          {mode === "entries" && <Td>{s.size ? <SizeBadge size={s.size} /> : <span className="text-[var(--muted2)]">—</span>}</Td>}
          <Td className="text-right font-bold text-[var(--fg)]" title={s.why ?? undefined}>{s.value === null ? <span className="font-normal text-[var(--muted2)]">{s.why ? "not ranked" : "—"}</span> : fmtAc(s.value, unit)}</Td>
          <Td>{s.value !== null && <Dots s={s} unit={unit} vals={vals} mode={mode} />}</Td>
          {mode === "entries" && <Td className="text-right">{s.value !== null && s.typical !== null ? signedDelta(s.value - s.typical, (x) => Math.abs(x).toFixed(1), { zero: "±" }) : "none"}</Td>}
          <Td className="whitespace-nowrap text-right">{mode === "entries" ? (s.offering ? `${s.offering.n} of ${s.offering.of}` : "—") : s.only ? "only school" : s.place ? `${ord(s.place.rank)} of ${s.place.of}` : "—"}</Td>
        </tr>
      ))}
    </>
  );
}

function SizeBadge({ size }: { size: NonNullable<AreaSubject["size"]> }) {
  return <span className="inline-flex min-w-[24px] justify-center rounded-[4px] bg-[var(--adm-grey-bar)] px-1 text-[10.5px] font-bold text-[var(--fg)]">{size}</span>;
}

function Dots({ s, unit, vals, mode }: { s: AreaSubject; unit: Unit; vals: number[]; mode: Academic["state"]["mode"] }) {
  const W = 150;
  const lo = Math.min(...vals, unit === "va" ? 0 : Infinity);
  const hi = Math.max(...vals, unit === "va" ? 0 : -Infinity);
  const sx = scale([lo, hi], [6, W - 6]);
  if (mode === "entries") {
    const max = Math.max(s.value ?? 0, s.typical ?? 0, 1);
    return (
      <svg width={W} height={14} aria-hidden="true">
        <rect x={0} y={4} width={((s.value ?? 0) / max) * (W - 10)} height={6} rx={2} style={{ fill: "var(--accent)" }} />
        {s.typical !== null && <line x1={(s.typical / max) * (W - 10)} x2={(s.typical / max) * (W - 10)} y1={1} y2={13} strokeWidth={2} style={{ stroke: "var(--fg)" }} />}
      </svg>
    );
  }
  const tone = unit === "va" ? toneOf(s.band) : "mid";
  return (
    <svg width={W} height={14} aria-hidden="true">
      {unit === "va" && <line x1={sx(0)} x2={sx(0)} y1={0} y2={14} style={{ stroke: "var(--ac-zero)" }} />}
      {s.setValues.map((v, i) => (
        <circle key={i} cx={sx(v)} cy={7} r={3} opacity={0.6} style={{ fill: "var(--ac-mid)" }} />
      ))}
      {s.value !== null && <circle cx={sx(s.value)} cy={7} r={4.5} strokeWidth={2} style={{ fill: TONE_VAR[tone], stroke: "var(--accent)" }} />}
    </svg>
  );
}

// ------------------------------------------------------------------------------- grades

export function GradesView({ a }: { a: Academic }) {
  if (!a.grades.length) return <Centre>No grades published at this level.</Centre>;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto" data-ac-grades="">
      <Vt>Grade profile{a.period !== null ? `, ${periodLabel(a.areas.period ?? a.period)}` : ""}</Vt>
      {a.grades.map((g) => (
        <div key={g.qualification} className="flex flex-col gap-[6px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-[var(--fg)]">{g.short}</span>
            <Tl>
              {g.entries.toLocaleString("en-GB")} graded entries{g.top ? ` · ${g.top.label} ${g.top.pct.toFixed(0)}%` : ""}
            </Tl>
          </div>
          {g.bands.map((b) => (
            <div key={b.label} className="grid grid-cols-[64px_1fr_48px] items-center gap-2">
              <Tl>{b.label}</Tl>
              <span className="h-[10px] rounded-[3px] bg-[var(--adm-grid)]">
                <span className="block h-full rounded-[3px] bg-[var(--accent)]" style={{ width: `${Math.min(100, b.pct)}%` }} />
              </span>
              <Tl className="text-right">{b.pct.toFixed(0)}%</Tl>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------- row 2

export function TrendBand({ a, fullscreen, room }: { a: Academic; fullscreen: boolean; room?: number }) {
  const t = a.trends;
  const real = t.school.filter((p) => p.value !== null).length;
  const bandReal = t.band.filter((b) => b.p25 !== null).length;
  if (real < 1 && bandReal < 1) return <Centre>{a.board.empty ?? "Not enough published years to draw a trend."}</Centre>;
  const set = a.set.chosen ? a.set.label : `the ${a.set.label}`;
  const unit = t.unit === "va" ? "va" : t.unit === "share" ? "share" : t.unit === "grade" ? "grade" : t.unit === "entries" ? "pupils" : "points";
  return (
    <>
      <Vt>
        {t.label} against {set}
      </Vt>
      {/* No line for the school (an independent's Progress 8): the band alone, over the band's years. */}
      <BandChart school={t.school.length ? t.school : t.band.map((x) => ({ year: x.year, value: null }))} band={t.band} height={fullscreen ? fillHeight(room, 150, 300) : 150} unit={unit} label={t.label} setLabel={set} />
      <div className="flex flex-wrap gap-3">
        {t.schoolLabel && <Key swatch={<span className="w-[14px] border-t-[2.5px] border-[var(--accent)]" />}>{t.schoolLabel.replace(/ School$/, "")}</Key>}
        <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px] bg-[var(--adm-grey-bar)]" />}>Comparison set, middle half</Key>
      </div>
      {!t.schoolLabel && <Tl>{a.col1.note ?? ""}</Tl>}
    </>
  );
}

export function TrendTable({ a }: { a: Academic }) {
  const t = a.trends;
  const unit = t.unit === "va" ? "va" : t.unit === "share" ? "share" : t.unit === "grade" ? "grade" : t.unit === "entries" ? "pupils" : "points";
  return <BandTable title={`${t.label} against ${a.set.chosen ? a.set.label : `the ${a.set.label}`}`} school={t.school} band={t.band} unit={unit} setLabel="Comparison set" />;
}

export function EveryLine({ a }: { a: Academic }) {
  const lines = a.trends.lines.filter((l) => l.from !== null || l.to !== null);
  if (!lines.length) return <Centre>{a.col1.note ?? "No line has two years to compare."}</Centre>;
  const va = a.state.mode === "va";
  const span = Math.max(0.1, ...lines.flatMap((l) => [Math.abs((l.to ?? 0) - (va ? 0 : (l.from ?? 0))), va ? Math.abs(l.from ?? 0) : 0, va ? Math.abs(l.to ?? 0) : 0]));
  const W = 260;
  const sx = scale([-span, span], [8, W - 8]);
  const toneFor = (d: number) => (d > 0 ? "var(--ac-above)" : d < 0 ? "var(--ac-below)" : "var(--ac-mid)");
  return (
    <div className="flex flex-col gap-2" data-ac-lines="">
      <Vt>Last year to this, every {a.state.phase === "gcse" ? "GCSE" : "Post-16"} line</Vt>
      <div className="grid grid-cols-[112px_1fr_52px] items-center gap-x-2 gap-y-1">
        {lines.map((l) => {
          const d = l.to !== null && l.from !== null ? l.to - l.from : null;
          // Value added: each line against its own national average (0); points and shares: the change itself.
          const a0 = va ? (l.from ?? 0) : 0;
          const a1 = va ? (l.to ?? 0) : (d ?? 0);
          return (
            <FragmentRow key={l.key}>
              <div className="truncate text-[11.5px] text-[var(--chip-fg)]">{l.label}</div>
              <svg width="100%" height={20} viewBox={`0 0 ${W} 20`} preserveAspectRatio="none" aria-hidden="true">
                <line x1={sx(0)} x2={sx(0)} y1={0} y2={20} style={{ stroke: "var(--ac-zero)" }} />
                {d !== null && <line x1={sx(a0)} x2={sx(a1)} y1={10} y2={10} strokeWidth={2.4} style={{ stroke: toneFor(d) }} />}
                {va && l.from !== null && <circle cx={sx(a0)} cy={10} r={4} strokeWidth={1.6} style={{ fill: "var(--panel-bg)", stroke: "var(--ac-mid)" }} />}
                {(l.to !== null || !va) && <circle cx={sx(a1)} cy={10} r={5} style={{ fill: "var(--accent)" }} />}
              </svg>
              <div className="whitespace-nowrap text-right text-[11px] text-[var(--chip-fg)]">{d === null ? (l.to === null ? "no figure" : "new") : fmtChangeAc(d, l.unit === "share" ? "share" : l.unit)}</div>
            </FragmentRow>
          );
        })}
      </div>
      <div className="flex gap-3">
        {va ? (
          <>
            <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-[1.6px] border-[var(--ac-mid)]" />}>{lines[0].fromPeriod !== null ? periodLabel(lines[0].fromPeriod) : ""}</Key>
            <Key swatch={<span className="h-[9px] w-[9px] rounded-full bg-[var(--accent)]" />}>{lines[0].toPeriod !== null ? periodLabel(lines[0].toPeriod) : ""}</Key>
          </>
        ) : (
          <Tl>{lines[0].fromPeriod !== null && lines[0].toPeriod !== null ? `${periodLabel(lines[0].fromPeriod)} to ${periodLabel(lines[0].toPeriod)}` : ""}</Tl>
        )}
      </div>
    </div>
  );
}
const FragmentRow = ({ children }: { children: ReactNode }) => <>{children}</>;

export function Moves({ a }: { a: Academic }) {
  const m = a.trends.moves;
  if (!m.length) return <Centre>Nothing has moved yet: fewer than two years to compare.</Centre>;
  const up = m.filter((x) => x.change > 0);
  const down = m.filter((x) => x.change < 0);
  const kind = a.trends.movesKind;
  return (
    <div className="flex flex-col gap-2 overflow-auto" data-ac-moves="">
      <Vt>{kind === "subjects" ? `Biggest moves in entries since ${a.period !== null ? periodLabel(a.period - 2) : ""}` : "The set's schools, rising and falling, last year to this"}</Vt>
      {[{ l: kind === "subjects" ? "Growing" : "Rising", xs: up }, { l: kind === "subjects" ? "Shrinking" : "Falling", xs: down }].map((g) =>
        g.xs.length ? (
          <div key={g.l} className="flex flex-col gap-[3px]">
            <Tl className="font-bold uppercase tracking-[0.05em]">{g.l}</Tl>
            {g.xs.map((x) => (
              <div key={x.label} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 text-[11.5px]">
                <span className="truncate text-[var(--chip-fg)]">{x.label}</span>
                <span className="text-[var(--muted2)]">{kind === "subjects" ? `${x.from ?? 0} → ${x.to ?? 0}` : ""}</span>
                <span className="text-right font-bold" style={{ color: x.change > 0 ? "var(--adm-up-fg)" : "var(--adm-down-fg)" }}>{fmtChangeAc(x.change, x.unit)}</span>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

const MIX_COLOURS = ["var(--accent)", "var(--ac-above)", "var(--ac-below)", "var(--adm-grey-soft)", "var(--ac-mid)"];
export function MixBars({ a, fullscreen, room }: { a: Academic; fullscreen: boolean; room?: number }) {
  const mix = a.trends.mix;
  if (!mix.years.length) return <Centre>No entries to show at this level.</Centre>;
  const h = fullscreen ? fillHeight(room, 160, 320) : 26;
  return (
    <div className="flex flex-col gap-2" data-ac-mix="">
      <Vt>Entries by qualification group</Vt>
      <div className="flex flex-col gap-[6px]">
        {mix.years.map((y) => (
          <div key={y.year} className="grid grid-cols-[52px_1fr_36px] items-center gap-2">
            <Tl>{periodLabel(y.year)}</Tl>
            <div className="flex overflow-hidden rounded-[4px]" style={{ height: Math.max(14, Math.min(h, 26)) }}>
              {mix.keys.map((k, i) =>
                y.shares[k.key] ? (
                  <span key={k.key} style={{ width: `${y.shares[k.key]}%`, background: MIX_COLOURS[i % MIX_COLOURS.length] }} title={`${k.label}: ${y.counts[k.key]} entries (${y.shares[k.key].toFixed(0)}%)`} />
                ) : null,
              )}
            </div>
            <Tl className="text-right">{y.total}</Tl>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {mix.keys.map((k, i) => (
          <Key key={k.key} swatch={<span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: MIX_COLOURS[i % MIX_COLOURS.length] }} />}>{k.label}</Key>
        ))}
      </div>
      {mix.sentence && <p className="text-[11.5px] text-[var(--chip-fg)]">{mix.sentence}</p>}
    </div>
  );
}

export function MixTableView({ a }: { a: Academic }) {
  const mix = a.trends.mix;
  if (!mix.years.length) return <Centre>No entries to show at this level.</Centre>;
  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-auto">
      <Vt>Entries by qualification group, year by year</Vt>
      <table className="w-full border-collapse">
        <thead className="border-b border-[var(--panel-border)]">
          <tr>
            <Th>Year</Th>
            {mix.keys.map((k) => (
              <Th key={k.key} className="text-right">{k.label}</Th>
            ))}
            <Th className="text-right">All</Th>
          </tr>
        </thead>
        <tbody>
          {mix.years.map((y) => (
            <tr key={y.year} className="border-b border-[var(--panel-border)] last:border-0">
              <Td>{periodLabel(y.year)}</Td>
              {mix.keys.map((k) => (
                <Td key={k.key} className="text-right">{y.counts[k.key] ? `${y.counts[k.key]} · ${y.shares[k.key].toFixed(0)}%` : "—"}</Td>
              ))}
              <Td className="text-right font-bold text-[var(--fg)]">{y.total}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Against({ a }: { a: Academic }) {
  const x = a.trends.against;
  if (!x.length) return <Centre>No subject to compare with the set&rsquo;s typical school.</Centre>;
  return (
    <div className="flex flex-col gap-[4px] overflow-auto" data-ac-against="">
      <Vt>Where your mix differs most from the set</Vt>
      {x.map((r) => (
        <div key={r.label} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 text-[11.5px]">
          <span className="truncate text-[var(--chip-fg)]">{r.label}</span>
          <span className="text-[var(--muted2)]">
            {r.mine.toFixed(1)}% vs {r.typical.toFixed(1)}%
          </span>
          <span className="text-right font-bold" style={{ color: r.gap > 0 ? "var(--ac-above2)" : "var(--ac-below2)" }}>{signedDelta(r.gap, (v) => Math.abs(v).toFixed(1), { zero: "±" })}</span>
        </div>
      ))}
      <Tl>Share of Post-16 entries, against the set&rsquo;s typical school offering it</Tl>
    </div>
  );
}
