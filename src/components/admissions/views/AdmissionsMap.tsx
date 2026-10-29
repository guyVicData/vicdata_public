"use client";

// VicData 0.7 admissions r2 (D3, D4): the map of feeders (sized by pupils at the age, coloured by
// trend) and the map of rivals (sized by pupils at the entry age). The existing fixed-list map
// (ConsortiumMap) through its new OPTIONAL props only -- so every existing caller draws exactly
// what it drew; the Data View's maps aren't touched.
import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import type { MarketView, PipelineOk } from "../api";
import { Empty, Key, ViewTitle, fillHeight, fmtN, fmtSigned } from "../ui";
import { rollRadius } from "@/lib/map-radius";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

const UP = "#16a34a";
const DOWN = "#dc2626";
const FLAT = "#71717a";
const ACCENT = "#22d3ee";
// Pupils in thirds: the accent, light to deep (the feeder map coloured by pupils).
const THIRDS = ["#a5f3fc", "#22d3ee", "#0e7490"];

// 0.7 admissions editor s2: `colour` -- "change" (the feeder flags: focus, red flag, neither) or
// "value" (pupils at the age, in thirds of this set). Either way each school is sized by its pupils.
// 0.8 Admissions fb1 (F-14): the school being fed is on the map too -- a solid accent dot, drawn last,
// sized by its latest entry cohort (Year 7) on the feeders' own scale, so its intake reads against theirs.
export function FeederMap({ p, fullscreen, room, colour = "change" }: { p: PipelineOk; fullscreen: boolean; room?: number; colour?: "change" | "value" }) {
  const rows = useMemo(() => p.feederTable.rows.filter((r) => r.easting !== null && r.northing !== null), [p]);
  const self = p.school.easting !== null && p.school.northing !== null ? { urn: p.school.urn, name: p.school.name, easting: p.school.easting, northing: p.school.northing, roll: p.now.cohort } : null;
  // One members array per answer: the map rebuilds only when the schools change.
  const members: ConsortiumMapMember[] = useMemo(() => [...rows.map((r) => ({ urn: r.urn, name: r.name, easting: r.easting!, northing: r.northing!, roll: r.pupils })), ...(self ? [self] : [])], [rows, self?.urn, self?.roll]); // eslint-disable-line react-hooks/exhaustive-deps
  const rolls = members.map((m) => m.roll).filter((r): r is number => r !== null);
  const [minRoll, maxRoll] = [Math.min(...rolls), Math.max(...rolls)];
  const entryWord = p.entry.age === 4 ? "Reception" : `Year ${p.entry.age - 4}`;
  const byUrn = new Map(rows.map((r) => [r.urn, r]));
  const sorted = rows.map((r) => r.pupils ?? 0).sort((a, b) => a - b);
  const thirdOf = (v: number | null) => (v === null ? 0 : v <= sorted[Math.floor((sorted.length - 1) / 3)] ? 0 : v <= sorted[Math.floor((2 * (sorted.length - 1)) / 3)] ? 1 : 2);
  if (!rows.length) return <Empty>No located schools in this set.</Empty>;
  return (
    <>
      {colour === "value" ? (
        <ViewTitle>Your feeders, sized and coloured by pupils aged {p.feederTable.age}</ViewTitle>
      ) : (
        <ViewTitle>
          Your feeders, sized by pupils aged {p.feederTable.age}, coloured by trend
        </ViewTitle>
      )}
      <MapBox room={fullscreen ? room : undefined} around={60} min={560}>
      <ConsortiumMap
        key={colour}
        members={members}
        heightClass={`${room && fullscreen ? "h-full" : fullscreen ? "h-[560px]" : "h-[300px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
        markerOf={(m) => (m.urn === p.school.urn ? { color: ACCENT, fillColor: ACCENT, fillOpacity: 0.9, radius: rollRadius(m.roll, minRoll, maxRoll), weight: 2.5 } : null)}
        colourOf={(m) => {
          if (colour === "value") return THIRDS[thirdOf(byUrn.get(m.urn)?.pupils ?? null)];
          const f = byUrn.get(m.urn)?.flag?.id;
          return f === "feeder_focus" ? UP : f === "feeder_red" ? DOWN : FLAT;
        }}
        tooltipOf={(m) => {
          if (m.urn === p.school.urn) return `${p.school.name} (you): ${fmtN(p.now.cohort)} in ${entryWord} now`;
          const r = byUrn.get(m.urn)!;
          return `${r.name}: ${fmtN(r.pupils)} aged ${p.feederTable.age} (${fmtSigned(r.changePct, 0)} in two years)${r.flag ? ` · ${r.flag.label}` : ""}`;
        }}
      />
      </MapBox>
      {colour === "value" ? (
        <div className="flex flex-wrap gap-3">
          {self && <YouKey word={entryWord} />}
          {(["Fewest pupils (a third of the set)", "The middle third", "Most pupils"] as const).map((l, i) => (
            <Key key={l} swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: THIRDS[i] }} />}>
              {l}
            </Key>
          ))}
        </div>
      ) : (
      <div className="flex flex-wrap gap-3">
        {self && <YouKey word={entryWord} />}
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: UP }} />}>Rising or stable (focus)</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: DOWN }} />}>Falling faster than the area (red flag)</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: FLAT }} />}>Neither</Key>
      </div>
      )}
    </>
  );
}

const YouKey = ({ word }: { word: string }) => (
  <Key swatch={<span data-you-key="" className="h-[9px] w-[9px] rounded-full" style={{ background: ACCENT }} />}>You, sized by your {word} now</Key>
);

// 0.7 admissions editor s2: `colour` -- "value" (by sector: state or independent, the preset) or
// "change" (each school's trend at the entry age since last year, as the ranked bars' arrow).
export function RivalsMap({ m, fullscreen, room, colour = "value" }: { m: MarketView; fullscreen: boolean; room?: number; colour?: "value" | "change" }) {
  const members: ConsortiumMapMember[] = useMemo(
    () => m.extras.filter((e) => e.traits?.easting != null && e.traits?.northing != null).map((e) => ({ urn: e.urn, name: m.schools[e.urn]?.name ?? e.urn, easting: e.traits!.easting!, northing: e.traits!.northing!, roll: e.entryNow })),
    [m],
  );
  if (!members.length) return <Empty>No located schools in this set.</Empty>;
  return (
    <>
      <ViewTitle>
        Your rivals, sized by pupils aged {m.entry.age}
      </ViewTitle>
      <MapBox room={fullscreen ? room : undefined} around={60} min={560}>
      <ConsortiumMap
        key={colour}
        members={members}
        targetUrn={m.urn}
        heightClass={`${room && fullscreen ? "h-full" : fullscreen ? "h-[560px]" : "h-[330px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
        colourOf={(x) => (x.urn === m.urn ? ACCENT : colour === "change" ? trendColour(m.summary.trend[x.urn]) : m.extras.find((e) => e.urn === x.urn)?.traits?.sector === "independent" ? "#a78bfa" : FLAT)}
        tooltipOf={(x) => {
          const r = m.entryAge.rows.find((row) => row.urn === x.urn && row.period === m.summary.latest);
          return `${x.name}: ${fmtN(r?.count)} aged ${m.entry.age}, ${r?.share != null ? `${r.share.toFixed(1)}% of this group` : "no share"}`;
        }}
      />
      </MapBox>
      {colour === "change" ? (
        <div className="flex flex-wrap gap-3">
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: ACCENT }} />}>You</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: UP }} />}>Up since last year</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: DOWN }} />}>Down</Key>
          <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: FLAT }} />}>Steady, or no figure</Key>
        </div>
      ) : (
      <div className="flex flex-wrap gap-3">
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: ACCENT }} />}>You</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: FLAT }} />}>State</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: "#a78bfa" }} />}>Independent</Key>
      </div>
      )}
    </>
  );
}

// 0.7 admissions editor s1: in the focus mode the map takes the room it has; elsewhere the map's own
// height class, exactly as before (no wrapper).
function MapBox({ room, around, min, children }: { room?: number; around: number; min: number; children: ReactNode }) {
  if (!room) return <>{children}</>;
  return <div style={{ height: fillHeight(room, around, min) }}>{children}</div>;
}

// The ranked bars' arrow: more than 2% up or down since last year (Bars.tsx, arrow(t, 2)).
const trendColour = (t: number | null | undefined) => (t === null || t === undefined ? FLAT : t > 2 ? UP : t < -2 ? DOWN : FLAT);
