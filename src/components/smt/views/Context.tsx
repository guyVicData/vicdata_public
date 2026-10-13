"use client";

// VicData 0.8 SMT r2: Context, the area around the school (the Context board). Population only: the
// data gap (deprivation, free school meals) is shown, from SMT_NOTES. Every figure is
// /api/smt/context's. R-SMT-VIEW-CONTEXT-NOW, R-SMT-DATA-GAP, R-SMT-CONTEXT-GEOGRAPHY, R-SMT-VIEW-BIRTHS.
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ConsortiumMapArea, ConsortiumMapMember } from "@/components/ConsortiumMap";
import { Empty, Key, Lbl, LineSwatch, Tile, cx, fillHeight } from "@/components/admissions/ui";
import { LineChart } from "@/components/admissions/views/charts";
import { productAccent } from "@/components/shell/accent";
import { SMT_NOTES } from "@/catalogue/notes";
import type { Context } from "@/lib/smt/context";
import { fmt, shortYear } from "../ui";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });
const S = productAccent("smt")!;

/** The data gap, said where the deprivation figures would be (R-SMT-DATA-GAP). */
export function DataGap() {
  return (
    <div data-data-gap="" className="rounded-[9px] border border-dashed border-[rgba(var(--accent-rgb),0.55)] bg-[rgba(var(--accent-rgb),0.06)] px-3 py-2.5">
      <div className="text-[12.5px] font-bold text-[var(--adm-accent-text)]">{SMT_NOTES.dataGap}</div>
      <div className="mt-1 text-[12px] leading-[1.45] text-[var(--chip-fg)]">{SMT_NOTES.dataGapPlanned}</div>
    </div>
  );
}

export function ContextNow({ c, compact = false }: { c: Context; compact?: boolean }) {
  const n = c.now;
  const tiles = [
    <Tile key="kids" label={`Children aged ${c.agesWord}`} value={fmt(n.children.value, "pupils")} sub={n.children.scope} accent />,
    <Tile key="births" label="Births, last year" value={n.births ? fmt(n.births.value, "pupils") : "—"} sub={n.births?.since ? `${n.births.since.changePct >= 0 ? "▲" : "▼"} ${Math.abs(n.births.since.changePct).toFixed(0)}% since ${n.births.since.from} · ${c.place.la}` : (c.place.la ?? "")} />,
    <Tile key="proj" small label={n.projection ? `${n.projection.age}-year-olds by ${n.projection.to}` : "Projection"} value={n.projection ? `${n.projection.changePct >= 0 ? "▲" : "▼"} ${Math.abs(n.projection.changePct).toFixed(0)}%` : "—"} sub={n.projection ? `ONS projection, ${n.projection.area}` : "no ONS projection held"} />,
    <Tile key="schools" small label="Schools nearby" value={fmt(n.schools.count, "pupils")} sub={`${n.schools.phaseWord === "all" ? "all phases" : n.schools.phaseWord}, all sectors, ${n.schools.scope}`} />,
  ];
  // The data gap is said on a phone too (R-SMT-DATA-GAP).
  if (compact)
    return (
      <>
        <div className="grid grid-cols-2 gap-2">{tiles}</div>
        <DataGap />
      </>
    );
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">The area now</div>
      <div className="grid grid-cols-2 gap-2">{tiles}</div>
      <div className="text-[11.5px] text-[var(--muted2)]" data-place="">
        {[c.place.town, c.place.la, c.place.region].filter(Boolean).join(" · ")}
      </div>
      <div className="flex flex-col gap-2 border-t border-[var(--panel-border)] pt-2">
        <Lbl>Social context</Lbl>
        <DataGap />
      </div>
    </>
  );
}

export function AreaMap({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const max = Math.max(1, ...c.map.las.map((l) => l.value ?? 0));
  const areas: ConsortiumMapArea[] = useMemo(
    () =>
      c.map.las
        .filter((l) => l.geometry)
        .map((l) => ({ id: l.gss, geometry: l.geometry!, fill: S.hex, fillOpacity: l.value === null ? 0.04 : 0.08 + 0.5 * (l.value / max), stroke: l.isSchoolLa ? S.hex : "#52525b", weight: l.isSchoolLa ? 2 : 0.8, tooltip: `${l.name}: ${l.value === null ? "no figure" : `${fmt(l.value, "pupils")} ${c.map.shade}`}` })),
    [c, max],
  );
  const members: ConsortiumMapMember[] = useMemo(() => c.map.schools.map((s) => ({ urn: s.urn, name: s.name, easting: s.easting, northing: s.northing, roll: null })), [c]);
  if (!members.length) return <Empty>No located schools around this school.</Empty>;
  const h = fullscreen && room ? fillHeight(room, 40, 560) : null;
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row">
      <div className="min-w-0 grow" style={h ? { height: h } : undefined}>
        <ConsortiumMap
          members={members}
          areas={areas}
          targetUrn={c.urn}
          heightClass={`${h ? "h-full" : fullscreen ? "h-[560px]" : "h-[300px] lg:h-[380px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
          colourOf={(x) => (x.urn === c.urn ? S.hex : "#9ca3af")}
          tooltipOf={(x) => `${x.name}${x.urn === c.urn ? " (you)" : ""}`}
        />
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[300px]">
        <div className="text-[13px] font-bold text-[var(--fg)]">Where the school-age children are</div>
        <div className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">
          {c.place.region ?? "The region"}&rsquo;s local authorities shaded by {c.map.shade} in their schools{c.map.period !== null ? ` (${shortYear(c.map.period)})` : ""}. The school in violet; other {c.now.schools.phaseWord === "all" ? "" : `${c.now.schools.phaseWord} `}schools within 5 miles in grey.
        </div>
        <div className="flex flex-col gap-1">
          <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: S.hex, opacity: 0.58 }} />}>More children</Key>
          <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: S.hex, opacity: 0.12 }} />}>Fewer children</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: S.hex }} />}>The school</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full bg-[#9ca3af]" />}>Other schools nearby</Key>
        </div>
        <div className="text-[11px] leading-snug text-[var(--muted2)]">{SMT_NOTES.shadeByDistrict}</div>
        <div className="mt-auto rounded-[9px] border border-dashed border-[rgba(var(--accent-rgb),0.55)] px-3 py-2 text-[11.5px] leading-snug text-[var(--chip-fg)]">{SMT_NOTES.shadeLater}</div>
      </div>
    </div>
  );
}

export function AgeBars({ c, ages, height = 150, title = "Children by single year of age" }: { c: Context; ages: [number, number]; height?: number; title?: string }) {
  const rows = c.byAge.ages;
  if (!rows.length) return <Empty>No pupils by age held for {c.byAge.laName ?? "this LA"}.</Empty>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">{title}</div>
      <div className="flex items-end gap-[4px]" style={{ height }} role="img" aria-label="Pupils by single year of age">
        {rows.map((r) => {
          const on = r.age >= ages[0] && r.age <= ages[1];
          return <span key={r.age} data-age-on={on ? "on" : undefined} title={`Age ${r.age}: ${fmt(r.value, "pupils")}`} className="flex-1 rounded-t-[3px]" style={{ height: `${(r.value / max) * 100}%`, background: on ? "var(--accent)" : "var(--adm-grey-bar)" }} />;
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--muted)]">
        <span>age {rows[0].age}</span>
        <span>age {ages[0]}</span>
        <span>age {rows[rows.length - 1].age}</span>
      </div>
      <div className="text-[10.5px] leading-snug text-[var(--muted)]">{c.notes.popByAge}</div>
    </>
  );
}

export function BirthsIndexed({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const ix = c.births.indexed;
  if (ix.la.filter((p) => p.value !== null).length < 2) return <Empty>No births series held for {c.births.laName ?? "this LA"}.</Empty>;
  const ys = ix.la.map((p) => p.year);
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Births, indexed</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 140}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={[String(ys[0]), String(ys[ys.length - 1])]}
        series={[
          { id: "la", label: c.births.laName ?? "LA", colour: "var(--accent)", points: ix.la.map((p) => ({ x: p.year, y: p.value })), title: (pt) => `${c.births.laName} ${pt.x}: ${pt.y?.toFixed(0)} (${fmt(c.births.la.find((b) => b.year === pt.x)?.value, "pupils")} births)` },
          { id: "en", label: "England", colour: "var(--adm-grey-2)", width: 1.6, dashed: "4 3", points: ix.england.map((p) => ({ x: p.year, y: p.value })), title: (pt) => `England ${pt.x}: ${pt.y?.toFixed(0)} (${fmt(c.births.england.find((b) => b.year === pt.x)?.value, "pupils")} births)` },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>{c.births.laName}</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-2)" width={14} weight={2} dashed />}>England</Key>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">{c.notes.births}</div>
    </>
  );
}

export function BirthsTable({ c }: { c: Context }) {
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">Births, year by year</div>
      <div className="min-h-0 overflow-y-auto rounded-[9px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse text-[12px]">
          <thead className="border-b border-[var(--panel-border)] text-[10.5px] uppercase tracking-[0.05em] text-[var(--muted2)]">
            <tr>
              <th className="px-2 py-[6px] text-left">Year</th>
              <th className="px-2 py-[6px] text-left">{c.births.laName}</th>
              <th className="px-2 py-[6px] text-left">England</th>
            </tr>
          </thead>
          <tbody>
            {c.births.la.map((p, i) => (
              <tr key={p.year} className="border-b border-[var(--panel-border)] text-[var(--chip-fg)] last:border-0">
                <td className="px-2 py-[6px]">{p.year}</td>
                <td className="px-2 py-[6px] font-bold text-[var(--fg)]">{fmt(p.value, "pupils")}</td>
                <td className="px-2 py-[6px]">{fmt(c.births.england[i]?.value, "pupils")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Projection({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const pts = c.projection.pts;
  if (pts.length < 2) return <Empty>No ONS projection held for {c.projection.area ?? "this LA"}.</Empty>;
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">
        {c.projection.age}-year-olds in {c.projection.area}, projected
      </div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 140}
        yFormat={(v) => fmt(v, "pupils")}
        xLabels={[String(pts[0].year), String(pts[pts.length - 1].year)]}
        series={[{ id: "p", label: "ONS projection", colour: "var(--accent)", dashed: "5 4", dots: true, points: pts.map((p) => ({ x: p.year, y: p.value })), title: (pt) => `${pt.x}: ${fmt(pt.y, "pupils")} ${c.projection.age}-year-olds` }]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} dashed />}>ONS projection ({c.projection.baseYear}-based)</Key>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">{c.notes.projection}</div>
    </>
  );
}

export function BirthsAndProjections({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const b = c.births.la;
  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <div className="text-[13px] font-bold text-[var(--fg)]">Births and projections, {c.place.la}</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 200, 300) : 200}
        yFormat={(v) => fmt(v, "pupils")}
        xLabels={b.length ? [String(b[0].year), String(Math.max(b[b.length - 1].year, c.projection.pts.at(-1)?.year ?? 0))] : null}
        series={[
          { id: "b", label: "Births", colour: "var(--accent)", points: b.map((p) => ({ x: p.year, y: p.value })) },
          { id: "p", label: `${c.projection.age}-year-olds (ONS projection)`, colour: "var(--adm-grey-soft)", dashed: "5 4", dots: true, points: c.projection.pts.map((p) => ({ x: p.year, y: p.value })) },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Births</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} dashed />}>{c.projection.age}-year-olds, ONS projection</Key>
      </div>
      <div className={cx("text-[11px] leading-[1.4] text-[var(--muted2)]")}>
        {c.notes.births} {c.notes.projection}
      </div>
    </div>
  );
}
