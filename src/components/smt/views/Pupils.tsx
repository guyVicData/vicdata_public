"use client";

// VicData 0.8 SMT r2: Pupils (the Pupils board). Column 1 "Your pupils now"; the large view's Shape and
// size (described, never ranked), Entry points at a glance and Leaving at 16 (Admissions' figures,
// read-only). Every figure is /api/smt/pupils'. R-SMT-VIEW-PUPILS-NOW, R-SMT-VIEW-SHAPE,
// R-SMT-ADMISSIONS-READ-ONLY, R-SMT-VIEW-LEAVING, R-SMT-PUPILS-LEVEL. 0.8 SMT Academic (R-SMT-NO-PILLS): Girls
// and boys, and Day and boarding -- the pills' figures as views; their notes are in the (i) (captionOf).
import { inLevelAges } from "@/lib/smt/levels";
import Link from "next/link";
import { SHAPE_LABELS, ShapeIcon } from "@/components/dashboard/ShapeIcon";
import { comparisonCaption } from "@/components/dashboard/PhaseBreakdownCard";
import { Empty, Key, Lbl, LineSwatch, PairTile, Tile, cx, fillHeight } from "@/components/admissions/ui";
import { LineChart, axisValues, scale, useWidth } from "@/components/admissions/views/charts";
import { useState } from "react";
import { ADMISSIONS_NOTES, SMT_NOTES } from "@/catalogue/notes";
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import type { ShapeLabel } from "@/lib/shape-classifier";
import type { Pupils } from "@/lib/smt/pupils";
import type { SmtSchool } from "../api";
import { Td, Th, fmt, fmtChange } from "../ui";
import { SizeByPhase } from "./Now";
import { arrowed, signedDelta } from "@/lib/signed-delta";

export const shapeName = (s: string | null) => (s ? (SHAPE_LABELS[s as ShapeLabel] ?? s) : "—");
// 0.8 feedback C (C4, SMT 8): what each shape name means, in a teacher's words (the classifier's own tree:
// a single large step, else the first year against the last).
export const SHAPE_MEANING: Record<ShapeLabel, string> = {
  tube: "about the same size in every year group",
  pyramid: "larger in the younger year groups, smaller towards the top",
  funnel: "larger towards the top: the year groups grow as pupils move up",
  wineglass: "much larger towards the top: a big intake in the upper years",
  mushroom: "one big step up (many join at one age), then level",
  top_step: "one big step down (many leave at one age), then level",
  irregular: "no clear pattern from year group to year group",
};
const isShape = (s: string | null): s is ShapeLabel => !!s && s in SHAPE_MEANING;

/** The shape's name with its picture and, unless `bare`, what it means. */
export function ShapeWord({ shape, bare = false }: { shape: string | null; bare?: boolean }) {
  if (!isShape(shape)) return <b className="text-[var(--fg)]">{shapeName(shape)}</b>;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle" data-shape={shape} title={`${shapeName(shape)}: ${SHAPE_MEANING[shape]}`}>
      <ShapeIcon shape={shape} size={20} />
      <b className="text-[var(--fg)]">{shapeName(shape)}</b>
      {!bare && <span className="text-[var(--muted2)]">({SHAPE_MEANING[shape]})</span>}
    </span>
  );
}

/** Year-group bars with each bar's figure above it (the main chart and C4's two small ones). */
function YearGroupBars({ groups, height, colourOf, small = false, label, lit }: { groups: { age: number; label: string; total: number }[]; height: number; colourOf: (age: number) => string; small?: boolean; label: string; lit?: (age: number) => boolean }) {
  const max = Math.max(1, ...groups.map((y) => y.total));
  return (
    <div className="flex flex-col gap-1" role="img" aria-label={label}>
      <div className={cx("flex items-end", small ? "gap-[3px]" : "gap-[6px]")} style={{ height }}>
        {groups.map((y) => (
          <div key={y.age} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[2px]" title={`${y.label}: ${fmt(y.total, "pupils")}`}>
            <span className={cx("tabular-nums text-[var(--muted2)]", small ? "text-[8.5px]" : "text-[10px]")} data-bar-value="">
              {y.total ? fmt(y.total, "pupils") : "—"}
            </span>
            <span data-level-age={lit?.(y.age) ? "on" : undefined} className="w-full rounded-t-[3px]" style={{ height: `${(y.total / max) * (height - (small ? 14 : 18))}px`, background: colourOf(y.age) }} />
          </div>
        ))}
      </div>
      <div className={cx("flex", small ? "gap-[3px]" : "gap-[6px]")}>
        {groups.map((y) => (
          <span key={y.age} className={cx("flex-1 text-center", lit?.(y.age) ? "font-bold text-[var(--fg)]" : "text-[var(--muted)]", small ? "text-[9px]" : "text-[10.5px]")}>
            {y.label}
          </span>
        ))}
      </div>
    </div>
  );
}
const inLevel = inLevelAges;

export function PupilsNow({ p, school, compact = false }: { p: Pupils; school: SmtSchool; compact?: boolean }) {
  const n = p.now;
  const ages = school.low !== null && school.high !== null ? `ages ${school.low}–${school.high}` : "whole school";
  const main = n.sizes.find((b) => b.key === n.mainBand) ?? n.sizes[0];
  // "Context: XL for Worcestershire, larger than the LA's average" -- the badge, then the school
  // page's own comparison (comparisonCaption's first clause), for the main phase.
  const context = main && main.badge && main.laMean !== null && main.englandMean !== null ? `${main.badge} for ${school.laName ?? "the LA"}: ${comparisonCaption(main.total, main.laMean, school.laName, main.englandMean).replace(/^(\w)/, (m) => m.toLowerCase())}` : null;
  const tiles = [
    <Tile key="roll" label="Roll" value={fmt(n.roll, "pupils")} sub={ages} accent />,
    <Tile key="since" label={`Since ${periodLabel(CENSUS_FIRST_PERIOD)}`} value={n.changePct === null ? "—" : arrowed(n.changePct, (x) => `${x.toFixed(0)}%`, 0)} sub="whole school" />,
    ...(school.mixed ? [<PairTile key="gb" pairs={[{ label: "Girls", value: n.girls !== null && n.boys !== null && n.girls + n.boys ? `${Math.round((n.girls / (n.girls + n.boys)) * 100)}%` : "—" }, { label: "Boys", value: n.girls !== null && n.boys !== null && n.girls + n.boys ? `${Math.round((n.boys / (n.girls + n.boys)) * 100)}%` : "—" }]} sub="in whole school" />] : []),
    ...(n.boarding ? [<PairTile key="db" pairs={[{ label: "Day", value: fmt(n.boarding.day, "pupils") }, { label: "Boarding", value: fmt(n.boarding.boarders, "pupils") }]} sub="in whole school" />] : []),
    ...(n.stayingOn ? [<Tile key="stay" small label={SMT_NOTES.y12Label} value={`${Math.round(n.stayingOn.pct)}%`} sub={SMT_NOTES.y12AgainstY11} />] : []),
  ];
  // An odd tile out spans both columns, so the grid has no gap (as the Academic board's four tiles).
  const grid = tiles.map((t, i) => (tiles.length % 2 === 1 && i === tiles.length - 1 ? <div key={`w${i}`} className="col-span-2 [&>div]:h-full">{t}</div> : t));
  if (compact) return <div className="grid grid-cols-2 gap-2">{tiles.slice(0, 4)}</div>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Your pupils now</div>
      <div className="grid grid-cols-2 gap-2">{grid}</div>
      <SizeByPhase sizes={n.sizes} school={school} caption={false} />
      {context && <div className="text-[12px] leading-[1.4] text-[var(--chip-fg)]">Context: {context}.</div>}
      {!n.boarding && <div className="text-[12px] leading-[1.4] text-[var(--muted2)]">No day or boarding split: {school.name} has no boarders, so the tile doesn&rsquo;t appear.</div>}
    </>
  );
}

export function ShapeAndSize({ p, height = 190 }: { p: Pupils; height?: number }) {
  const s = p.shape;
  if (!s.yearGroups.length) return <Empty>No census for this school, so no year groups to draw.</Empty>;
  const first = s.yearGroups[0].label.replace(/^Y/, "Year ");
  const last = s.yearGroups[s.yearGroups.length - 1].label.replace(/^Y/, "Year ");
  const h = p.highlight;
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="text-[13px] font-bold text-[var(--fg)]">
          Pupils in each year group, {first} to {last}
        </div>
        {/* 0.8 feedback C (C4): each bar's figure above it; the shape with its picture and what it means. */}
        <YearGroupBars groups={s.yearGroups} height={height} label="Pupils by year group" lit={(age) => inLevel(age, h)} colourOf={(age) => (!h || inLevel(age, h) ? (age >= 16 ? "rgba(var(--accent-rgb),0.62)" : "var(--accent)") : "var(--adm-grey-bar)")} />
        <div className="text-[12.5px] leading-[1.45] text-[var(--chip-fg)]">
          <span className="mr-1">Shape:</span>
          <ShapeWord shape={s.label} />. {s.was ? <>Since {periodLabel(s.sinceYear ?? CENSUS_FIRST_PERIOD)} (was {shapeName(s.was)}).</> : `Unchanged since ${periodLabel(s.sinceYear ?? CENSUS_FIRST_PERIOD)}.`}
        </div>
        {h && <div className="text-[11px] text-[var(--muted2)]">{SMT_NOTES.levelAges}</div>}
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 border-t border-[var(--panel-border)] pt-3 lg:w-[300px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <Lbl>Shapes around you</Lbl>
        {/* 0.8 feedback C (C4, SMT 8): two small charts drawn like the main one -- the nearest school in the
            set, then the set's middle at each year group -- in place of the counted shape words. */}
        {s.around.nearest && (
          <div className="flex flex-col gap-1" data-shape-nearest="">
            <div className="text-[11.5px] text-[var(--chip-fg)]">
              Nearest: <b className="text-[var(--fg)]">{s.around.nearest.name}</b>
              {s.around.nearest.km !== null ? ` · ${s.around.nearest.km.toFixed(1)} km` : ""}
            </div>
            <YearGroupBars small groups={s.around.nearest.yearGroups} height={64} label={`${s.around.nearest.name}: pupils by year group`} colourOf={() => "var(--adm-grey-soft)"} />
            <div className="text-[11px]">
              <ShapeWord shape={s.around.nearest.shape} bare />
            </div>
          </div>
        )}
        {s.around.setMiddle && (
          <div className="flex flex-col gap-1" data-shape-set="">
            <div className="text-[11.5px] text-[var(--chip-fg)]">
              {p.set.label}: the middle school at each year group ({s.around.setMiddle.schools} schools)
            </div>
            <YearGroupBars small groups={s.around.setMiddle.yearGroups} height={64} label={`${p.set.label}: the middle at each year group`} colourOf={() => "var(--adm-grey-2)"} />
            <div className="text-[11px]">
              <ShapeWord shape={s.around.setMiddle.shape} bare /> <span className="text-[var(--muted2)]">(their year groups added together)</span>
            </div>
          </div>
        )}
        {!s.around.nearest && !s.around.setMiddle && (
          <div className="flex justify-between gap-2 text-[12.5px]">
            <span className="text-[var(--chip-fg)]">{p.set.label}</span>
            <span className="text-right font-bold text-[var(--fg)]">{s.around.set.map((x) => `${x.schools} ${shapeName(x.shape)}`).join(" · ") || "—"}</span>
          </div>
        )}
        <div className="flex justify-between gap-2 text-[12.5px]">
          <span className="text-[var(--chip-fg)]">{SMT_NOTES.y12Label}, {p.set.label}</span>
          <span className="font-bold text-[var(--fg)]" title={`The middle of the set's ${s.around.stayingOnSet.schools} schools with a sixth form`}>
            {s.around.stayingOnSet.pct === null ? "—" : `${Math.round(s.around.stayingOnSet.pct)}%`}
          </span>
        </div>
        <div className="text-[11.5px] leading-snug text-[var(--muted2)]">{SMT_NOTES.shapesAround}</div>
        <Link href="/teacher/admissions" className="mt-auto text-[11.5px] font-bold text-[var(--adm-accent-text)]">
          Open in Admissions &rarr;
        </Link>
      </div>
    </div>
  );
}

export function EntryPoints({ p }: { p: Pupils }) {
  const e = p.entries;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Entry points at a glance</div>
      {e.status === "empty" ? (
        <Empty>{e.reason}</Empty>
      ) : (
        <div className="rounded-[9px] border border-[var(--panel-border)]">
          <table className="w-full border-collapse">
            <thead className="border-b border-[var(--panel-border)]">
              <tr>
                <Th>Entry point</Th>
                <Th>Cohort now</Th>
                <Th>The pool, next entry</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {e.rows.map((r) => (
                <tr key={r.entry} className="border-b border-[var(--panel-border)] last:border-0">
                  <Td className="font-bold text-[var(--fg)]">{r.label}</Td>
                  <Td>{fmt(r.cohort, "pupils")}</Td>
                  <Td title={r.poolSource ? `${r.poolSource === "counted" ? ADMISSIONS_NOTES.counted : r.age <= 4 ? ADMISSIONS_NOTES.births : ADMISSIONS_NOTES.birthsScaled}` : undefined}>
                    {fmt(r.pool, "pupils")} {r.poolYear ? <span className="text-[var(--muted2)]">· {r.poolYear} entry{r.poolSource === "births" ? ", from births" : ""}</span> : null}
                  </Td>
                  <Td>
                    <Link href={`/teacher/admissions?entry=${encodeURIComponent(r.entry)}`} className="whitespace-nowrap text-[11.5px] font-bold text-[var(--adm-accent-text)]">
                      Open in Admissions &rarr;
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">{ADMISSIONS_NOTES.pool}</div>
      {e.status === "empty" && (
        <Link href="/teacher/admissions" className="text-[11.5px] font-bold text-[var(--adm-accent-text)]">
          Open in Admissions &rarr;
        </Link>
      )}
    </>
  );
}

const signedPupils = (v: number) => signedDelta(v, (x) => Math.abs(x).toLocaleString("en-GB"), { zero: "±" });

/**
 * 0.8 feedback C (C5, SMT 10): Leaving at 16 as a chart -- a bar per year, Year 12 against the Year 11 a year
 * before: more joined than left above the line, more left below, each with its figure. The middle of the set
 * (its sixth forms' Year 12 against Year 11, latest year) is drawn on every bar as the change it would have
 * meant for that Year 11. "As a table" switches to the year-by-year table, its change one signed column.
 */
export function LeavingAt16({ p, school }: { p: Pupils; school: SmtSchool }) {
  const [table, setTable] = useState(false);
  if (!p.leaving.length) return <Empty>{school.phases.post16 ? "No Year 11 to follow: this school has no GCSE years." : `${school.name} has no sixth form, so nobody stays on at 16 here.`}</Empty>;
  const ref = p.shape.around.stayingOnSet.pct;
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-bold text-[var(--fg)]">Leaving at 16: Year 11 to Year 12, year by year</div>
        <span className="inline-flex overflow-hidden rounded-full border border-[var(--panel-border)] text-[11px]" role="group" aria-label="Chart or table">
          {(["Chart", "As a table"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={(k === "As a table") === table} onClick={() => setTable(k === "As a table")} className={cx("px-2.5 py-[3px] font-semibold", (k === "As a table") === table ? "bg-[var(--adm-rail-on)] text-[var(--fg)]" : "text-[var(--muted2)]")}>
              {k}
            </button>
          ))}
        </span>
      </div>
      {!table && <div className="text-[11.5px] text-[var(--chip-fg)]">Each bar: {SMT_NOTES.y12Label}, in pupils (Year 12 minus the Year 11 a year before).</div>}
      {table ? <LeavingTable p={p} /> : <LeavingBars p={p} />}
      {/* Review fixes (tables.md L9): the set's comparator beside the school's own years. */}
      {ref !== null && <div className="text-[11.5px] text-[var(--muted2)]">The middle of {p.set.label} (latest year): {Math.round(ref)}% stayed on, across {p.shape.around.stayingOnSet.schools} schools with a sixth form.</div>}
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">{ADMISSIONS_NOTES.leaving16}</div>
    </>
  );
}

function LeavingBars({ p, height = 210 }: { p: Pupils; height?: number }) {
  const [box, w] = useWidth<HTMLDivElement>();
  const ref = p.shape.around.stayingOnSet.pct;
  const rows = p.leaving.map((r) => ({ year: r.year, net: r.year11 !== null && r.year12 !== null ? r.year12 - r.year11 : null, at: ref !== null && r.year11 !== null ? Math.round(r.year11 * (ref / 100)) - r.year11 : null, y11: r.year11, y12: r.year12 }));
  const vals = rows.flatMap((r) => [r.net, r.at]).filter((v): v is number => v !== null);
  const span = Math.max(4, ...vals.map(Math.abs));
  const dom: [number, number] = [Math.min(0, ...vals) - span * 0.18, Math.max(0, ...vals) + span * 0.18];
  const grid = axisValues(dom, height, null, 0);
  const W = Math.max(w, 10);
  const padL = 34;
  const sy = scale(dom, [height - 6, 6]);
  const n = rows.length;
  const slot = (W - padL - 4) / Math.max(1, n);
  const bw = Math.min(46, slot * 0.56);
  const cx0 = (i: number) => padL + slot * i + slot / 2;
  return (
    <div ref={box} className="w-full" data-leaving-chart="">
      {w > 0 && (
        <svg width={W} height={height + 18} role="img" aria-label="Year 12 against Year 11, year by year: more joined above the line, more left below">
          {grid.map((v) => (
            <g key={v} data-y-grid={v}>
              <line x1={padL} x2={W} y1={sy(v)} y2={sy(v)} strokeWidth={v === 0 ? 1.4 : 1} style={{ stroke: v === 0 ? "var(--adm-axis)" : "var(--adm-grid)" }} />
              <text x={padL - 6} y={sy(v) + 3.5} textAnchor="end" fontSize={10} fontWeight={v === 0 ? 700 : undefined} style={{ fill: "var(--muted)" }}>
                {v === 0 ? "0" : signedPupils(v)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const x = cx0(i);
            const up = (r.net ?? 0) >= 0;
            return (
              <g key={r.year} data-leaving-year={r.year}>
                {r.net !== null && (
                  <rect x={x - bw / 2} width={bw} y={Math.min(sy(0), sy(r.net))} height={Math.max(1.5, Math.abs(sy(r.net) - sy(0)))} rx={3} style={{ fill: up ? "var(--accent)" : "var(--adm-grey-2)" }}>
                    <title>{`${periodLabel(r.year)}: Year 11 ${fmt(r.y11, "pupils")} the year before, Year 12 ${fmt(r.y12, "pupils")}: ${up ? `${fmt(r.net, "pupils")} more joined than left` : `${fmt(-r.net, "pupils")} more left than joined`}`}</title>
                  </rect>
                )}
                {r.at !== null && <line data-leaving-ref="" x1={x - bw / 2 - 5} x2={x + bw / 2 + 5} y1={sy(r.at)} y2={sy(r.at)} strokeWidth={2} strokeDasharray="4 3" style={{ stroke: "var(--fg)" }} opacity={0.55} />}
                {r.net !== null && (
                  <text x={x} y={up ? sy(r.net) - 5 : sy(r.net) + 13} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: "var(--fg)" }}>
                    {signedPupils(r.net)}
                  </text>
                )}
                <text x={x} y={height + 14} textAnchor="middle" fontSize={10} style={{ fill: "var(--muted)" }}>
                  {periodLabel(r.year)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <div className="flex flex-wrap gap-3 text-[11px]">
        <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px] bg-[var(--accent)]" />}>More joined than left</Key>
        <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px] bg-[var(--adm-grey-2)]" />}>More left than joined</Key>
        {ref !== null && <Key swatch={<LineSwatch colour="var(--fg)" width={14} weight={2} dashed />}>At the middle of {p.set.label} ({Math.round(ref)}% stayed on)</Key>}
      </div>
    </div>
  );
}

function LeavingTable({ p }: { p: Pupils }) {
  return (
    <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]" data-leaving-table="">
      <table className="w-full border-collapse">
        <thead className="border-b border-[var(--panel-border)]">
          <tr>
            <Th>Year 12 in</Th>
            <Th>Year 11 the year before</Th>
            <Th>Year 12</Th>
            <Th>{SMT_NOTES.y12Label}</Th>
            <Th>Joined (+) or left (−)</Th>
          </tr>
        </thead>
        <tbody>
          {p.leaving.map((r) => (
            <tr key={r.year} className="border-b border-[var(--panel-border)] last:border-0">
              <Td>{periodLabel(r.year)}</Td>
              <Td>{fmt(r.year11, "pupils")}</Td>
              <Td>{fmt(r.year12, "pupils")}</Td>
              <Td className="font-bold text-[var(--fg)]">{r.stayingPct === null ? "—" : `${Math.round(r.stayingPct)}%`}</Td>
              <Td className="tabular-nums">{r.leaving === null ? "—" : signedPupils(-r.leaving)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------ 0.8 SMT Academic: the pills' figures as views

const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${Math.round(v)}%`);
const pp = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : fmtChange({ change: v, unit: "pp" }));
const yr = (p: number) => periodLabel(p);

function Row({ label, value, title, strong = true }: { label: string; value: string; title?: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2 text-[12.5px]">
      <span className="text-[var(--chip-fg)]">{label}</span>
      <span className={cx("shrink-0 text-right tabular-nums", strong ? "font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]")} title={title}>
        {value}
      </span>
    </div>
  );
}

const SIDE = "flex w-full shrink-0 flex-col gap-2 border-t border-[var(--panel-border)] pt-3 lg:w-[300px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0";

/** Girls and boys (a mixed school): girls' share in each year group against the middle of the set's mixed
 * schools, its change since the census's first year against the set's, and where it shifts. */
export function GirlsAndBoys({ p, school, height = 150, fullscreen = false }: { p: Pupils; school: SmtSchool; height?: number; fullscreen?: boolean }) {
  const g = p.girlsBoys;
  if (!g || !g.years.length) return <Empty>{school.name} is a single-sex school, so there is no girls and boys balance to show.</Empty>;
  const first = g.years[0].label.replace(/^Y/, "Year ");
  const last = g.years[g.years.length - 1].label.replace(/^Y/, "Year ");
  const h = p.highlight;
  const short = school.name.replace(/ School$/, "");
  const years = g.trend.school.map((x) => x.year);
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="text-[13px] font-bold text-[var(--fg)]">
          Girls&rsquo; share in each year group, {first} to {last}
        </div>
        <div className="relative flex items-end gap-[6px]" style={{ height }} role="img" aria-label="Girls' share by year group">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--panel-border)]" style={{ bottom: "50%" }} />
          {g.years.map((y) => (
            <div key={y.age} className="relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${y.label}: ${pct(y.share)} girls (${fmt(y.girls, "pupils")} girls, ${fmt(y.boys, "pupils")} boys); ${p.set.label}'s middle ${pct(y.set.median)} of ${y.set.schools} mixed schools`}>
              <span data-level-age={inLevelAges(y.age, h) ? "on" : undefined} className="w-full rounded-t-[3px]" style={{ height: `${y.share ?? 0}%`, background: !h || inLevelAges(y.age, h) ? "var(--accent)" : "var(--adm-grey-bar)" }} />
              {y.set.median !== null && <span data-set-mark="" aria-hidden className="absolute -inset-x-[2px] h-[3px] rounded-full bg-[var(--fg)] opacity-60" style={{ bottom: `calc(${y.set.median}% - 1px)` }} />}
            </div>
          ))}
        </div>
        <div className="flex gap-[6px]">
          {g.years.map((y) => (
            <span key={y.age} className={cx("flex-1 text-center text-[10.5px] tabular-nums", inLevelAges(y.age, h) ? "font-bold text-[var(--fg)]" : "text-[var(--muted)]")}>
              {y.label}
              <br />
              {pct(y.share)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Key swatch={<span className="inline-block h-[10px] w-[10px] rounded-[2px] bg-[var(--accent)]" />}>Girls&rsquo; share, {short}</Key>
          <Key swatch={<span className="inline-block h-[3px] w-[14px] rounded-full bg-[var(--fg)] opacity-60" />}>Middle of {p.set.label}</Key>
          <Key swatch={<LineSwatch colour="var(--panel-border)" width={14} weight={1.5} dashed />}>50%</Key>
        </div>
        {years.length > 1 && (
          <>
            <div className="mt-1 text-[12.5px] font-bold text-[var(--fg)]">
              Girls&rsquo; share, whole school, {yr(years[0])} to {yr(years[years.length - 1])}
            </div>
            <LineChart
              height={fullscreen ? 160 : 90}
              yFormat={(v) => `${Math.round(v)}%`}
              xLabels={[yr(years[0]), yr(years[years.length - 1])]}
              series={[
                { id: "school", label: short, colour: "var(--accent)", width: 2.6, points: g.trend.school.map((x) => ({ x: x.year, y: x.value })), title: (pt) => `${short} ${yr(pt.x)}: ${pct(pt.y)}` },
                ...(g.trend.set.length ? [{ id: "set", label: `Middle of ${p.set.label}`, colour: "var(--adm-grey-soft)", width: 1.8, points: g.trend.set.map((x) => ({ x: x.year, y: x.value })), title: (pt: { x: number; y: number | null }) => `Middle of ${p.set.label} ${yr(pt.x)}: ${pct(pt.y)}` }] : []),
              ]}
            />
          </>
        )}
      </div>
      <div className={SIDE}>
        <Lbl>{g.whole.baseYear !== null ? `Since ${yr(g.whole.baseYear)}` : `Now · ${yr(g.year)}`}</Lbl>
        <Row label={short} value={g.whole.baseYear !== null ? `${pct(g.whole.base)} → ${pct(g.whole.share)}` : pct(g.whole.share)} />
        {g.whole.change !== null && <Row label="Change" value={pp(g.whole.change)} />}
        <Row label={`${p.set.label}, middle`} value={g.whole.baseYear !== null ? pp(g.whole.set.change.median) : pct(g.whole.set.share.median)} title={`The middle of ${g.whole.set.change.schools} mixed schools; their girls' share now ${pct(g.whole.set.share.median)}`} />
        <Row label={`${p.set.label}, girls' share now`} value={pct(g.whole.set.share.median)} strong={false} title={`The middle of ${g.whole.set.share.schools} mixed schools`} />
        {g.shifts.length > 0 && (
          <>
            <div className="mt-2">
              <Lbl>Where it shifts</Lbl>
            </div>
            {g.shifts.map((x) => (
              <div key={x.key} className="flex flex-col gap-[2px]" data-shift={x.key}>
                <Row label={`${x.label} against ${x.against}`} value={pp(x.shift)} title={`${x.label} ${pct(x.share)} girls, ${x.against} ${pct(x.againstShare)}`} />
                <Row label={`${p.set.label}, middle`} value={pp(x.set.median)} strong={false} title={`The middle of ${x.set.schools} mixed schools`} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Day and boarding (a boarding school): boarders and day pupils census by census, and boarders' share of the
 * roll against the middle of the set's boarding schools. */
export function DayAndBoarding({ p, school, fullscreen = false, room }: { p: Pupils; school: SmtSchool; fullscreen?: boolean; room?: number }) {
  const d = p.dayBoarding;
  if (!d) return <Empty>{school.name} has no boarders in the census, so there is no day and boarding split to show.</Empty>;
  const short = school.name.replace(/ School$/, "");
  const years = d.years.map((x) => x.year);
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="text-[13px] font-bold text-[var(--fg)]">
          Boarders&rsquo; share of the roll, {yr(years[0])} to {yr(years[years.length - 1])}
        </div>
        {years.length > 1 ? (
          <LineChart
            height={fullscreen ? fillHeight(room, 150, 300) : 130}
            yFormat={(v) => `${Math.round(v)}%`}
            xLabels={[yr(years[0]), yr(years[years.length - 1])]}
            series={[
              { id: "school", label: short, colour: "var(--accent)", width: 2.6, points: d.years.map((x) => ({ x: x.year, y: x.share })), title: (pt) => `${short} ${yr(pt.x)}: ${pct(pt.y)}` },
              ...(d.set.trend.length ? [{ id: "set", label: `Middle of the boarding schools in ${p.set.label}`, colour: "var(--adm-grey-2)", width: 1.8, dashed: "2 3", points: d.set.trend.map((x) => ({ x: x.year, y: x.value })), title: (pt: { x: number; y: number | null }) => `Middle of the boarding schools in ${p.set.label} ${yr(pt.x)}: ${pct(pt.y)}` }] : []),
            ]}
          />
        ) : (
          <Empty>Only one census year with boarders: no trend to draw yet.</Empty>
        )}
        <div className="flex flex-wrap gap-3">
          <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>{short}</Key>
          {d.set.trend.length > 0 && <Key swatch={<LineSwatch colour="var(--adm-grey-2)" width={14} weight={2} dashed />}>Middle of the boarding schools in {p.set.label}</Key>}
        </div>
        <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]">
          <table className="w-full border-collapse">
            <thead className="border-b border-[var(--panel-border)]">
              <tr>
                <Th>Census</Th>
                <Th>Boarders</Th>
                <Th>Day</Th>
                <Th>Boarders&rsquo; share</Th>
                {/* Review fixes (tables.md L9): the set's middle, the comparator the chart beside it draws. */}
                {d.set.trend.length > 0 && <Th title={`The middle of the ${d.set.trendSchools} boarding schools in ${p.set.label}`}>Set median share</Th>}
              </tr>
            </thead>
            <tbody>
              {[...d.years].reverse().map((r) => (
                <tr key={r.year} className="border-b border-[var(--panel-border)] last:border-0">
                  <Td>{yr(r.year)}</Td>
                  <Td>{fmt(r.boarders, "pupils")}</Td>
                  <Td>{fmt(r.day, "pupils")}</Td>
                  <Td className="font-bold text-[var(--fg)]">{pct(r.share)}</Td>
                  {d.set.trend.length > 0 && <Td className="text-[var(--muted2)]">{pct(d.set.trend.find((t) => t.year === r.year)?.value ?? null)}</Td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={SIDE}>
        <Lbl>Now · {yr(d.year)}</Lbl>
        <Row label="Boarders" value={`${fmt(d.now.boarders, "pupils")} · ${pct(d.now.share)}`} />
        <Row label="Day" value={fmt(d.now.day, "pupils")} />
        <Row label={`Boarding schools in ${p.set.label}, middle`} value={pct(d.set.share.median)} title={`The middle of ${d.set.share.schools} boarding schools`} />
        <Row label={`Boarding schools in ${p.set.label}`} value={`${d.set.boardingSchools} of ${d.set.of}`} strong={false} />
        {d.baseYear !== null && (
          <>
            <div className="mt-2">
              <Lbl>Since {yr(d.baseYear)}</Lbl>
            </div>
            <Row label={`${short}, boarders' share`} value={pp(d.change)} />
            <Row label={`Boarding schools in ${p.set.label}, middle`} value={pp(d.set.change.median)} strong={false} title={`The middle of ${d.set.change.schools} boarding schools' own change`} />
          </>
        )}
      </div>
    </div>
  );
}
