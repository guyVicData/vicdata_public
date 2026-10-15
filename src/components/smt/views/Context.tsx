"use client";

// VicData 0.8 SMT: Context, the area around the school (the Context board). Round 3 drew it on real
// data at 5 miles; round 4 draws the whole board at the school's catchment (km, R-SMT-RADIUS) and the
// forward view from children already born (R-SMT-FORWARD): residents within the radius and by LA (ONS),
// deprivation of the school's neighbourhood and of the children around it (IoD), free school meals
// (DfE), and the projection. Every figure is /api/smt/context's or /api/smt/context/map's; every caveat
// is SMT_NOTES' (the wording rules, R-SMT-CONTEXT-WORDING, R-SMT-NOT-A-FORECAST).
// R-SMT-CONTEXT-RESIDENTS, -DEPRIVATION, -FSM, -GEOGRAPHY, R-SMT-VIEW-CONTEXT-NOW, R-SMT-VIEW-BIRTHS.
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ConsortiumMapArea, ConsortiumMapMarker, ConsortiumMapMember } from "@/components/ConsortiumMap";
import { Empty, Key, Lbl, LineSwatch, Tile, cx, fillHeight } from "@/components/admissions/ui";
import { LineChart } from "@/components/admissions/views/charts";
import { productAccent } from "@/components/shell/accent";
import { SMT_NOTES, smtNote } from "@/catalogue/notes";
import { periodLabel } from "@/catalogue/years";
import type { Context } from "@/lib/smt/context";
import type { ContextMap, MapLsoa, MapSchool } from "@/lib/smt/context-map";
import type { Load } from "../api";
import { fmt, shortYear } from "../ui";
import { placeLine } from "@/lib/place-line";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });
const S = productAccent("smt")!;

// One sequential scale for deciles, darkest for decile 1 (the most deprived 10%): violet, the SMT
// accent's family -- never red and green, never a scale that reads as good and bad.
export const DECILE_RAMP = ["#2e1065", "#4c1d95", "#5b21b6", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];
// Children per hectare, five classes, fewest to most (the same family, lightest to darkest).
const DENSITY_RAMP = ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#4c1d95"];
// FSM markers: a second sequential family (blue), so a school's marker never reads as the accent.
const FSM_RAMP = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"];
const FSM_BREAKS = [10, 20, 30, 40];
const GREY = "#9ca3af";

export type ShadeBy = "children" | "imd" | "idaci" | "fsm";

const changeWord = (pct: number, dp = 0) => `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(dp)}%`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
// "(range −8.1% to +3.4%) " -- the band at the tile's year, as change from the latest count.
const rangeWord = (lo: number | null, hi: number | null) => (lo !== null && hi !== null ? `(range ${signed(lo)} to ${signed(hi)}) ` : "");
const pctText = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);

// ------------------------------------------------------------------- column 1: the area now (K1, K2)

export function ContextNow({ c, compact = false }: { c: Context; compact?: boolean }) {
  const n = c.now;
  const tiles = [
    <Tile
      key="kids"
      label={`Children aged ${c.agesWord}`}
      value={fmt(n.children.value, "pupils")}
      sub={
        <>
          {n.children.since ? `${changeWord(n.children.since.changePct)} since ${n.children.since.from} · ` : ""}
          {n.children.scope}
        </>
      }
      accent
    />,
    <Tile key="births" label="Births, last year" value={n.births ? fmt(n.births.value, "pupils") : "—"} sub={n.births?.since ? `${changeWord(n.births.since.changePct)} since ${n.births.since.from} · ${c.place.la}` : (c.place.la ?? "")} />,
    <Tile
      key="proj"
      small
      label={n.projection ? `${n.projection.agesWord} by ${n.projection.to}` : "Projection"}
      value={n.projection ? changeWord(n.projection.changePct, 1) : "—"}
      sub={
        n.projection ? (
          <span data-projection-tile="" title={SMT_NOTES.wProjection}>
            {rangeWord(n.projection.lowPct, n.projection.highPct)}
            {n.projection.caption}
          </span>
        ) : (
          "no projection held for this area"
        )
      }
    />,
    <Tile key="schools" small label="Schools nearby" value={fmt(n.schools.count, "pupils")} sub={`${n.schools.phaseWord === "all" ? "all phases" : n.schools.phaseWord}, all sectors, ${n.schools.scope}`} />,
  ];
  // The census count beside the residents, never divided by them (wording rule 3). R4 (R5): the
  // authority mix under the children tile, one line, anything under 1% folded into "other".
  const pupils = (
    <>
      {n.mix && (
        <div data-area-mix="" className="text-[11px] leading-snug text-[var(--chip-fg)]" title={n.mix.ages}>
          {n.mix.line} <span className="text-[var(--muted2)]">({n.mix.ages})</span>
        </div>
      )}
      {n.pupilsNearby && (
        <div data-pupils-nearby="" className="text-[11px] leading-snug text-[var(--muted2)]">
          {smtNote("pupilsNearby", { n: fmt(n.pupilsNearby.value, "pupils"), radius: c.radius, year: n.pupilsNearby.period !== null ? periodLabel(n.pupilsNearby.period) : "" })}
        </div>
      )}
      {n.oneNeighbourhood && (
        <div data-one-neighbourhood="" className="text-[10.5px] leading-snug text-[var(--muted)]">
          {SMT_NOTES.oneNeighbourhood}
        </div>
      )}
    </>
  );
  if (compact)
    return (
      <>
        <div className="grid grid-cols-2 gap-2">{tiles}</div>
        {pupils}
        <SocialContext c={c} />
      </>
    );
  return (
    <div className="flex min-h-0 flex-col gap-[6px] overflow-y-auto">
      <div className="text-[12.5px] font-bold text-[var(--fg)]">The area now</div>
      <div className="grid grid-cols-2 gap-2">{tiles}</div>
      {pupils}
      <div className="text-[11.5px] text-[var(--muted2)]" data-place="" title={SMT_NOTES.noDistrict}>
        {placeLine([c.place.town, c.place.la, c.place.region])}
      </div>
      <div className="flex flex-col border-t border-[var(--panel-border)] pt-[6px]">
        <SocialContext c={c} />
      </div>
    </div>
  );
}

/** "Social context" (K2): the school's neighbourhood, the children around it by deprivation, and free
 * school meals. Deprivation is the area's, never the pupils' (wording rule 1). */
export function SocialContext({ c }: { c: Context }) {
  const s = c.social;
  return (
    <div data-social-context="" className="flex flex-col gap-[6px]">
      <Lbl>Social context</Lbl>
      {s.lsoa && s.imd !== null && s.idaci !== null ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--chip-fg)]" data-neighbourhood={s.lsoa} title={`${SMT_NOTES.neighbourhood}: ${s.lsoa}`}>
          <span className="text-[10.5px] text-[var(--muted2)]">{SMT_NOTES.neighbourhood}</span>
          <Decile label="IMD" title={SMT_NOTES.imdName} decile={s.imd} />
          <Decile label="IDACI" title={SMT_NOTES.idaciName} decile={s.idaci} />
        </div>
      ) : (
        <div data-no-lsoa="" className="text-[11.5px] leading-snug text-[var(--chip-fg)]">
          {SMT_NOTES.noLsoa}
        </div>
      )}
      {s.mix && s.deprived20 !== null && <MixBar mix={s.mix} deprived20={s.deprived20} radius={c.radius} />}
      {(s.lsoa || s.mix) && (
        <div data-deprivation-note="" className="text-[10.5px] leading-snug text-[var(--muted)]">
          Deprivation: {SMT_NOTES.wDeprivation}. {SMT_NOTES.wDeciles}
        </div>
      )}
      <Fsm c={c} />
    </div>
  );
}

function Decile({ label, title, decile }: { label: string; title: string; decile: number }) {
  return (
    <span className="inline-flex items-center gap-[6px]" title={title} data-decile={`${label}:${decile}`}>
      <span aria-hidden="true" className="h-[11px] w-[11px] shrink-0 rounded-[2px]" style={{ background: DECILE_RAMP[decile - 1] }} />
      <span>
        {label} <b className="font-bold tabular-nums text-[var(--fg)]">decile {decile} of 10</b>
      </span>
    </span>
  );
}

function MixBar({ mix, deprived20, radius }: { mix: number[]; deprived20: number; radius: string }) {
  return (
    <div className="flex flex-col gap-1" data-idaci-mix="" title={smtNote("mixTitle", { radius })}>
      <div className="flex items-center gap-[6px] text-[9.5px] text-[var(--muted)]">
        <span>1</span>
        <div className="flex h-[10px] grow overflow-hidden rounded-[3px]" role="img" aria-label={mix.map((v, i) => `decile ${i + 1}: ${v.toFixed(1)}%`).join(", ")}>
          {mix.map((v, i) => (
            <span key={i} title={`IDACI decile ${i + 1}: ${v.toFixed(1)}% of children`} style={{ width: `${v}%`, background: DECILE_RAMP[i] }} />
          ))}
        </div>
        <span>10</span>
      </div>
      <div className="text-[11.5px] leading-snug text-[var(--chip-fg)]" title={smtNote("mixInfo", { radius })}>
        {smtNote("mixLine", { pct: deprived20.toFixed(0), radius })}
      </div>
    </div>
  );
}

function Fsm({ c }: { c: Context }) {
  const f = c.social.fsm;
  const box = "rounded-[9px] border border-[var(--panel-border)] px-[10px] py-[5px] text-[11px] leading-snug";
  if (f.status === "independent")
    return (
      <div data-fsm="independent" className={cx(box, "text-[var(--chip-fg)]")}>
        <b className="font-semibold text-[var(--fg)]">{SMT_NOTES.wIndependentFsm}</b> {smtNote("wIndependentDraw", { radius: c.radius })}
      </div>
    );
  if (f.status === "none")
    return (
      <div data-fsm="none" className={cx(box, "text-[var(--chip-fg)]")}>
        <span className="text-[var(--muted2)]">{SMT_NOTES.fsmTitle}: </span>
        {SMT_NOTES.fsmNone}
      </div>
    );
  const change = f.first ? f.value - f.first.value : null;
  return (
    <div data-fsm="published" className={cx(box, "flex items-center justify-between gap-2")} title={SMT_NOTES.fsmInfo}>
      <span className="text-[var(--muted2)]">
        {SMT_NOTES.fsmTitle}, {periodLabel(f.period)} <b className="ml-1 text-[15px] font-extrabold tabular-nums text-[var(--fg)]">{pctText(f.value)}</b>
      </span>
      <span className="flex flex-col items-end text-right text-[var(--chip-fg)]">
        <span>
          {f.la.name ?? "LA"} {pctText(f.la.value)} · England {pctText(f.england)}
        </span>
        {change !== null && f.first && (
          <span className="text-[var(--muted2)]">
            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)} points since {periodLabel(f.first.period)}
          </span>
        )}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------- the map (K3)

export function shadeOptions(c: Context, map: ContextMap | null): { id: ShadeBy; label: string }[] {
  const lsoa = map?.state === "lsoa";
  return [
    { id: "children", label: `Shade by: children aged ${c.agesWord}` },
    ...(lsoa ? [{ id: "imd" as const, label: "Shade by: deprivation (IMD)" }, { id: "idaci" as const, label: "Shade by: children's deprivation (IDACI)" }] : []),
    { id: "fsm", label: "Shade by: free school meals (state schools)" },
  ];
}

const quantiles = (vals: number[], n: number) => {
  const v = [...vals].sort((a, b) => a - b);
  return Array.from({ length: n - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / n)] ?? 0);
};
const classOf = (v: number, breaks: number[]) => breaks.filter((b) => v >= b).length;

export function AreaMap({ c, map, shade, fullscreen, room }: { c: Context; map: Load<ContextMap>; shade: ShadeBy; fullscreen: boolean; room?: number }) {
  if (c.area === "around" && map.status === "loading") return <Empty>Loading the neighbourhoods…</Empty>;
  if (c.area === "around" && map.status === "ready" && map.data.state === "lsoa") return <NeighbourhoodMap c={c} m={map.data} shade={shade} fullscreen={fullscreen} room={room} />;
  return <LaMap c={c} shade={shade} map={map.status === "ready" ? map.data : null} fullscreen={fullscreen} room={room} />;
}

function frame(fullscreen: boolean, room?: number) {
  const h = fullscreen && room ? fillHeight(room, 40, 560) : null;
  return { style: h ? { height: h } : undefined, heightClass: `${h ? "h-full" : fullscreen ? "h-[560px]" : "h-[300px] lg:h-[380px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]` };
}

function fsmMarker(s: MapSchool | undefined, isSchool: boolean): ConsortiumMapMarker | null {
  if (isSchool) return null;
  if (!s) return { color: GREY, fillColor: GREY, fillOpacity: 0.9, radius: 6, weight: 1 };
  if (s.fsmNotPublished) return { color: "#6b7280", fillColor: "#ffffff", fillOpacity: 0, radius: 6, weight: 2 };
  if (!s.fsm) return { color: GREY, fillColor: GREY, fillOpacity: 0.5, radius: 5, weight: 1 };
  return { color: "#1e293b", fillColor: FSM_RAMP[classOf(s.fsm.value, FSM_BREAKS)], fillOpacity: 0.95, radius: 7, weight: 1 };
}

function NeighbourhoodMap({ c, m, shade, fullscreen, room }: { c: Context; m: Extract<ContextMap, { state: "lsoa" }>; shade: ShadeBy; fullscreen: boolean; room?: number }) {
  const density = useMemo(() => m.lsoas.map((l) => (l.areaHa > 0 ? l.children / l.areaHa : 0)), [m]);
  const breaks = useMemo(() => quantiles(density, DENSITY_RAMP.length), [density]);
  const byUrn = useMemo(() => new Map(m.schools.map((s) => [s.urn, s])), [m]);
  const areas: ConsortiumMapArea[] = useMemo(
    () =>
      m.lsoas.map((l: MapLsoa, i) => {
        const tip = `${l.name}: ${fmt(l.children, "pupils")} children aged ${c.agesWord} (mid-${m.year}) · IMD decile ${l.imd ?? "—"} · IDACI decile ${l.idaci ?? "—"}${l.within ? "" : ` · beyond ${m.radius}`}`;
        const fill = shade === "imd" ? (l.imd ? DECILE_RAMP[l.imd - 1] : GREY) : shade === "idaci" ? (l.idaci ? DECILE_RAMP[l.idaci - 1] : GREY) : shade === "fsm" ? GREY : DENSITY_RAMP[classOf(density[i], breaks)];
        return { id: l.code, geometry: l.geometry, fill, fillOpacity: shade === "fsm" ? 0.04 : m.dots ? 0.85 : 0.62, stroke: m.dots ? fill : "#ffffff", weight: m.dots ? 0 : 0.4, tooltip: tip };
      }),
    [m, shade, density, breaks, c.agesWord],
  );
  const members: ConsortiumMapMember[] = useMemo(() => m.schools.map((s) => ({ urn: s.urn, name: s.name, easting: s.easting, northing: s.northing, roll: null })), [m]);
  const f = frame(fullscreen, room);
  const others = c.now.schools.phaseWord === "all" ? "schools" : `${c.now.schools.phaseWord} schools`;
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row" data-map-state="lsoa" data-shade={shade} data-map-dots={m.dots ? "" : undefined} data-radius-km={m.radiusKm}>
      <div className="isolate min-w-0 grow" style={f.style}>
        <ConsortiumMap
          members={members}
          areas={areas}
          targetUrn={c.urn}
          circle={{ easting: m.centre.easting, northing: m.centre.northing, metres: m.radiusKm * 1000, colour: S.hex }}
          fitCircle
          redrawKey={`${shade}:${c.agesWord}:${m.radiusKm}`}
          heightClass={f.heightClass}
          colourOf={(x) => (x.urn === c.urn ? S.hex : GREY)}
          markerOf={(x) => (shade === "fsm" ? fsmMarker(byUrn.get(x.urn), x.urn === c.urn) : x.urn === c.urn ? null : { color: "#6b7280", fillColor: GREY, fillOpacity: 0.95, radius: 5, weight: 1 })}
          tooltipOf={(x) => {
            const s = byUrn.get(x.urn);
            const fsm = s?.fsmNotPublished ? "free school meals not published" : s?.fsm ? `free school meals ${s.fsm.value.toFixed(1)}% (${periodLabel(s.fsm.period)})` : "no free-school-meals figure";
            return `${x.name}${x.urn === c.urn ? " (you)" : ""} · ${fsm}`;
          }}
        />
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[300px]" data-map-legend="">
        <div className="text-[13px] font-bold text-[var(--fg)]">{SMT_NOTES.mapTitle}</div>
        <MapLegend c={c} m={m} shade={shade} breaks={breaks} others={others} />
        <div className="mt-auto text-[11px] leading-snug text-[var(--muted2)]">
          {smtNote("mapRing", { radius: m.radius, ring: `${m.ringKm} km` })}
          {m.dots && <> {smtNote("mapDots", { radius: m.radius })}</>}
        </div>
      </div>
    </div>
  );
}

function MapLegend({ c, m, shade, breaks, others }: { c: Context; m: Extract<ContextMap, { state: "lsoa" }>; shade: ShadeBy; breaks: number[]; others: string }) {
  const marks = (
    <>
      <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: S.hex }} />}>The school</Key>
      {shade !== "fsm" && <Key swatch={<span className="h-[8px] w-[8px] rounded-full" style={{ background: GREY }} />}>Other {others} within {m.radius}</Key>}
      <Key swatch={<span className="w-[14px] border-t-[1.5px] border-dashed" style={{ borderColor: S.hex }} />}>{m.radius}</Key>
    </>
  );
  if (shade === "imd" || shade === "idaci")
    return (
      <>
        <div className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">{smtNote("mapDeprivation", { index: shade === "imd" ? "IMD" : "IDACI", edition: m.edition ?? "" })}</div>
        <div className="flex flex-col gap-1">
          <div className="flex h-[10px] w-full overflow-hidden rounded-[2px]">
            {DECILE_RAMP.map((col, i) => (
              <span key={i} className="flex-1" style={{ background: col, opacity: 0.85 }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--muted)]">
            <span>1</span>
            <span>10</span>
          </div>
          <div className="text-[11px] font-semibold text-[var(--chip-fg)]">{SMT_NOTES.mapDecileLegend}</div>
          <div className="text-[10.5px] leading-snug text-[var(--muted)]">
            {SMT_NOTES.wDeprivation}. {SMT_NOTES.wDeciles}
          </div>
        </div>
        <div className="flex flex-col gap-1">{marks}</div>
      </>
    );
  if (shade === "fsm")
    return (
      <>
        <div className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">{smtNote("mapFsm", { year: m.fsmYear !== null ? periodLabel(m.fsmYear) : "" })}</div>
        <div className="text-[11px] font-semibold text-[var(--chip-fg)]">{SMT_NOTES.mapFsmLegend}</div>
        <div className="flex flex-col gap-1">
          {FSM_RAMP.map((col, i) => (
            <Key key={col} swatch={<span className="h-[10px] w-[10px] rounded-full border border-[#1e293b]" style={{ background: col }} />}>
              {i === 0 ? `under ${FSM_BREAKS[0]}%` : i === FSM_RAMP.length - 1 ? `${FSM_BREAKS[i - 1]}% or more` : `${FSM_BREAKS[i - 1]}–${FSM_BREAKS[i]}%`}
            </Key>
          ))}
          <Key swatch={<span className="h-[10px] w-[10px] rounded-full border-2 border-[#6b7280] bg-transparent" />}>Independent: not published</Key>
          {marks}
        </div>
      </>
    );
  const top = breaks.length ? breaks[breaks.length - 1] : 0;
  const per = (v: number) => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
  return (
    <>
      <div className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">{smtNote("mapChildren", { ages: c.agesWord, year: m.year })}</div>
      <div className="flex flex-col gap-1">
        <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: DENSITY_RAMP[DENSITY_RAMP.length - 1] }} />}>More children ({per(top)}+ per hectare)</Key>
        <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: DENSITY_RAMP[0] }} />}>Fewer children (under {per(breaks[0] ?? 0)})</Key>
        {marks}
      </div>
    </>
  );
}

/** Round 2's map: the region's LAs shaded by census pupils of the ages -- the Area pill's LA, and the
 * fallback until the neighbourhood boundaries are loaded. FSM still colours the school markers. */
function LaMap({ c, shade, map, fullscreen, room }: { c: Context; shade: ShadeBy; map: ContextMap | null; fullscreen: boolean; room?: number }) {
  const max = Math.max(1, ...c.map.las.map((l) => l.value ?? 0));
  const fsmOn = shade === "fsm";
  const areas: ConsortiumMapArea[] = useMemo(
    () =>
      c.map.las
        .filter((l) => l.geometry)
        .map((l) => ({ id: l.gss, geometry: l.geometry!, fill: S.hex, fillOpacity: fsmOn ? 0.03 : l.value === null ? 0.04 : 0.08 + 0.5 * (l.value / max), stroke: l.isSchoolLa ? S.hex : "#52525b", weight: l.isSchoolLa ? 2 : 0.8, tooltip: `${l.name}: ${l.value === null ? "no figure" : `${fmt(l.value, "pupils")} ${c.map.shade}`}` })),
    [c, max, fsmOn],
  );
  const members: ConsortiumMapMember[] = useMemo(() => c.map.schools.map((s) => ({ urn: s.urn, name: s.name, easting: s.easting, northing: s.northing, roll: null })), [c]);
  if (!members.length) return <Empty>No located schools around this school.</Empty>;
  const f = frame(fullscreen, room);
  return (
    <div className="flex min-h-0 grow flex-col gap-5 lg:flex-row" data-map-state="la">
      <div className="isolate min-w-0 grow" style={f.style}>
        <ConsortiumMap
          members={members}
          areas={areas}
          targetUrn={c.urn}
          redrawKey={shade}
          heightClass={f.heightClass}
          colourOf={(x) => (x.urn === c.urn ? S.hex : GREY)}
          tooltipOf={(x) => `${x.name}${x.urn === c.urn ? " (you)" : ""}`}
        />
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[300px]">
        <div className="text-[13px] font-bold text-[var(--fg)]">{SMT_NOTES.mapTitle}</div>
        <div className="text-[12px] leading-[1.45] text-[var(--chip-fg)]">
          {c.place.region ?? "The region"}&rsquo;s local authorities shaded by {c.map.shade} in their schools{c.map.period !== null ? ` (${shortYear(c.map.period)})` : ""}. The school in violet; other {c.now.schools.phaseWord === "all" ? "" : `${c.now.schools.phaseWord} `}schools nearby in grey.
        </div>
        <div className="flex flex-col gap-1">
          <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: S.hex, opacity: 0.58 }} />}>More children</Key>
          <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: S.hex, opacity: 0.12 }} />}>Fewer children</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: S.hex }} />}>The school</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: GREY }} />}>Other schools nearby</Key>
        </div>
        <div className="text-[11px] leading-snug text-[var(--muted2)]" data-shade-district="">
          {SMT_NOTES.shadeByDistrict}
        </div>
        {map && map.state === "fallback" && c.area === "around" && <div className="hidden" data-fallback-reason={map.reason} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- population (K4)

export function AgeBars({ c, ages, height = 150, title = "Children by single year of age" }: { c: Context; ages: [number, number]; height?: number; title?: string }) {
  const rows = c.byAge.ages;
  if (!rows.length) return <Empty>No population by age held for {c.byAge.scope === "around" ? "the area around this school" : (c.byAge.laName ?? "this LA")}.</Empty>;
  const max = Math.max(...rows.map((r) => r.value));
  const where = c.byAge.scope === "around" ? `within ${c.radius}` : (c.byAge.laName ?? "the LA");
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">
        {title} <span className="text-[11px] font-medium text-[var(--muted2)]">· {where}, mid-{c.byAge.period}</span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label="Residents by single year of age">
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

const phaseTitle = (c: Context) => (c.ages[1] <= 10 ? "Primary-age" : c.ages[0] >= 16 ? "Sixth-form-age" : "Secondary-age");

/** Row 2, "Forward" (0.8 SMT r4, F): the children of the school's ages living in the area (within the
 * radius, or the LA with the Area pill on it) -- estimates, solid, to the latest count, then the
 * projection from that count, its band shaded, the years that include children not yet born lighter and
 * labelled at the change. ONS's 2022-based projection and the scenario are faint lines, off until asked
 * for. R-SMT-FORWARD, R-SMT-NOT-A-FORECAST. */
export function PopulationProjected({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const f = c.forward;
  const [ons, setOns] = useState(false);
  const [scenario, setScenario] = useState(false);
  if (!f || f.estimates.filter((x) => x.value !== null).length < 2 || f.projection.length < 2) return <Empty>No projection held for the children {c.area === "around" ? `within ${c.radius}` : `in ${c.place.la ?? "this LA"}`}.</Empty>;
  const first = f.estimates[0]?.year;
  // The line splits where its ages start to include children not yet born; the two parts share that year.
  const split = f.unbornFrom;
  const born = f.projection.filter((p) => split === null || p.year < split);
  const unborn = split === null ? [] : f.projection.filter((p) => p.year >= split - 1);
  const pts = (xs: typeof f.projection, k: "middle" | "scenario" | "ons") => xs.map((p) => ({ x: p.year, y: p[k] }));
  const title = (label: string) => (pt: { x: number; y: number | null }) => `${pt.x}: ${fmt(pt.y, "pupils")} aged ${c.agesWord} (${label})`;
  const series = [
    { id: "e", label: "Estimates", colour: "var(--accent)", points: f.estimates.map((x) => ({ x: x.year, y: x.value })), title: title("estimate") },
    { id: "p", label: "Projection", colour: "var(--accent)", width: 2.4, points: pts(born, "middle"), title: title("projection") },
    ...(unborn.length ? [{ id: "u", label: "Projection, includes children not yet born", colour: "var(--accent)", width: 2.4, opacity: 0.45, points: pts(unborn, "middle"), title: title(`projection, ${SMT_NOTES.includesUnborn}`) }] : []),
    ...(scenario ? [{ id: "s", label: f.scenarioLabel, colour: "var(--adm-grey-soft)", width: 1.6, dashed: "2 3", points: pts(f.projection, "scenario"), title: title(f.scenarioLabel) }] : []),
    ...(ons && f.ons ? [{ id: "o", label: smtNote("onsLine", { base: f.ons.base ?? "" }), colour: "var(--adm-grey-2)", width: 1.6, dashed: "5 4", points: pts(f.projection, "ons"), title: title(smtNote("onsLine", { base: f.ons.base ?? "" })) }] : []),
  ];
  const toggle = (on: boolean, set: (v: boolean) => void, label: string, id: string) => (
    <button
      type="button"
      data-toggle={id}
      aria-pressed={on}
      onClick={() => set(!on)}
      className={cx("h-[20px] rounded-full border px-2 text-[10.5px] font-semibold", on ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--panel-border2)] text-[var(--muted)] hover:text-[var(--fg)]")}
    >
      {label}
    </button>
  );
  return (
    <div data-forward={f.scope} className="flex min-h-0 grow flex-col gap-2">
      <div className="text-[12.5px] font-bold text-[var(--fg)]">
        {phaseTitle(c)} population, projected <span className="text-[11px] font-medium text-[var(--muted2)]">· {c.agesWord}, {f.where}</span>
      </div>
      <LineChart
        height={fullscreen ? fillHeight(room, 150, 300) : 140}
        yFormat={(v) => fmt(v, "pupils")}
        xLabels={first !== undefined ? [String(first), String(f.horizonEnd)] : null}
        bands={f.bandMissing ? [] : [{ id: "band", colour: "var(--accent)", opacity: 0.16, points: f.projection.map((p) => ({ x: p.year, lo: p.low, hi: p.high })) }]}
        markers={split !== null ? [{ x: split, label: SMT_NOTES.includesUnborn }] : []}
        series={series}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Estimates, then the projection</Key>
        {!f.bandMissing && <Key swatch={<span className="h-[9px] w-[14px] rounded-[2px]" style={{ background: "var(--accent)", opacity: 0.25 }} />}>Range</Key>}
        {split !== null && <Key swatch={<span className="h-[3px] w-[14px] rounded" style={{ background: "var(--accent)", opacity: 0.45 }} />}>{SMT_NOTES.includesUnborn}</Key>}
        <span className="ml-auto flex gap-2">
          {f.ons && toggle(ons, setOns, SMT_NOTES.onsToggle, "ons")}
          {toggle(scenario, setScenario, f.scenarioLabel.charAt(0).toUpperCase() + f.scenarioLabel.slice(1), "scenario")}
        </span>
      </div>
      <div className="text-[10.5px] text-[var(--muted)]">
        {SMT_NOTES.wProjection}
        {f.bandMissing && <> {smtNote("bandMissing", { ages: c.agesWord })}</>}
      </div>
    </div>
  );
}

/** The large view's "Births and projections": births, and the projection for the school's ages. */
export function BirthsAndProjections({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const b = c.births.la;
  const proj = (c.forward?.projection ?? []).map((p) => ({ year: p.year, value: p.middle }));
  const lastYear = Math.max(b.at(-1)?.year ?? 0, proj.at(-1)?.year ?? 0);
  const where = c.forward?.where ?? "";
  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <div className="text-[13px] font-bold text-[var(--fg)]">Births and projections, {c.place.la}</div>
      <LineChart
        height={fullscreen ? fillHeight(room, 200, 300) : 200}
        yFormat={(v) => fmt(v, "pupils")}
        xLabels={b.length ? [String(b[0].year), String(lastYear)] : null}
        series={[
          { id: "b", label: "Births", colour: "var(--accent)", points: b.map((p) => ({ x: p.year, y: p.value })) },
          { id: "p", label: `Children aged ${c.agesWord} ${where} (projection)`, colour: "var(--adm-grey-soft)", dashed: "5 4", dots: true, points: proj.map((p) => ({ x: p.year, y: p.value })) },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Births, {c.place.la}</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} dashed />}>
          Children aged {c.agesWord} {where}, projected
        </Key>
      </div>
      <div className={cx("text-[11px] leading-[1.4] text-[var(--muted2)]")}>
        {c.notes.births} {c.notes.projection}
      </div>
    </div>
  );
}

/** New in the rail (K4): children of the school's ages within the radius over time, indexed, against the
 * LA and England. Residents, not pupils. */
export function NearbyOverTime({ c, fullscreen, room }: { c: Context; fullscreen: boolean; room?: number }) {
  const ix = c.nearby.indexed;
  if (ix.school.filter((p) => p.value !== null).length < 2) return <Empty>No small-area population held around this school.</Empty>;
  const ys = [...ix.school, ...ix.la, ...ix.england].map((p) => p.year);
  const raw = (pts: { year: number; value: number | null }[], y: number) => fmt(pts.find((p) => p.year === y)?.value, "pupils");
  const line = (id: string, label: string, colour: string, pts: typeof ix.school, rawPts: typeof ix.school, dashed?: string, width?: number) => ({ id, label, colour, dashed, width, points: pts.map((p) => ({ x: p.year, y: p.value })), title: (pt: { x: number; y: number | null }) => `${label} ${pt.x}: ${pt.y?.toFixed(0)} (${raw(rawPts, pt.x)} children)` });
  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <div className="text-[13px] font-bold text-[var(--fg)]">
        Children nearby over time <span className="text-[11px] font-medium text-[var(--muted2)]">· {SMT_NOTES.nearbyOverTimeCaption}</span>
      </div>
      <LineChart
        height={fullscreen ? fillHeight(room, 200, 300) : 220}
        reference={{ y: 100 }}
        yFormat={(v) => v.toFixed(0)}
        xLabels={[String(Math.min(...ys)), String(Math.max(...ys))]}
        series={[line("s", `Within ${c.radius}`, "var(--accent)", ix.school, c.nearby.school), line("l", c.place.la ?? "LA", "var(--adm-grey-soft)", ix.la, c.nearby.la, "5 4", 1.8), line("e", "England", "var(--adm-grey-2)", ix.england, c.nearby.england, "2 3", 1.6)]}
      />
      <div className="flex flex-wrap gap-3">
        <Key swatch={<LineSwatch colour="var(--accent)" width={14} />}>Within {c.radius}</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-soft)" width={14} dashed />}>{c.place.la}</Key>
        <Key swatch={<LineSwatch colour="var(--adm-grey-2)" width={14} weight={2} dashed />}>England</Key>
      </div>
      <div className="text-[11px] leading-[1.4] text-[var(--muted2)]">{c.notes.nearby}</div>
    </div>
  );
}
