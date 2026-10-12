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

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

const UP = "#16a34a";
const DOWN = "#dc2626";
const FLAT = "#71717a";
const ACCENT = "#22d3ee";

export function FeederMap({ p, fullscreen, room }: { p: PipelineOk; fullscreen: boolean; room?: number }) {
  const rows = useMemo(() => p.feederTable.rows.filter((r) => r.easting !== null && r.northing !== null), [p]);
  // One members array per answer: the map rebuilds only when the schools change.
  const members: ConsortiumMapMember[] = useMemo(() => rows.map((r) => ({ urn: r.urn, name: r.name, easting: r.easting!, northing: r.northing!, roll: r.pupils })), [rows]);
  const byUrn = new Map(rows.map((r) => [r.urn, r]));
  if (!rows.length) return <Empty>No located schools in this set.</Empty>;
  return (
    <>
      <ViewTitle>
        Your feeders, sized by pupils aged {p.feederTable.age}, coloured by trend
      </ViewTitle>
      <MapBox room={fullscreen ? room : undefined} around={60} min={560}>
      <ConsortiumMap
        members={members}
        heightClass={`${room && fullscreen ? "h-full" : fullscreen ? "h-[560px]" : "h-[300px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
        colourOf={(m) => {
          const f = byUrn.get(m.urn)?.flag?.id;
          return f === "feeder_focus" ? UP : f === "feeder_red" ? DOWN : FLAT;
        }}
        tooltipOf={(m) => {
          const r = byUrn.get(m.urn)!;
          return `${r.name}: ${fmtN(r.pupils)} aged ${p.feederTable.age} (${fmtSigned(r.changePct, 0)} in two years)${r.flag ? ` · ${r.flag.label}` : ""}`;
        }}
      />
      </MapBox>
      <div className="flex flex-wrap gap-3">
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: UP }} />}>Rising or stable (focus)</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: DOWN }} />}>Falling faster than the area (red flag)</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: FLAT }} />}>Neither</Key>
      </div>
    </>
  );
}

export function RivalsMap({ m, fullscreen, room }: { m: MarketView; fullscreen: boolean; room?: number }) {
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
        members={members}
        targetUrn={m.urn}
        heightClass={`${room && fullscreen ? "h-full" : fullscreen ? "h-[560px]" : "h-[330px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
        colourOf={(x) => (x.urn === m.urn ? ACCENT : m.extras.find((e) => e.urn === x.urn)?.traits?.sector === "independent" ? "#a78bfa" : FLAT)}
        tooltipOf={(x) => {
          const r = m.entryAge.rows.find((row) => row.urn === x.urn && row.period === m.summary.latest);
          return `${x.name}: ${fmtN(r?.count)} aged ${m.entry.age}, ${r?.share != null ? `${r.share.toFixed(1)}% of this group` : "no share"}`;
        }}
      />
      </MapBox>
      <div className="flex flex-wrap gap-3">
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2" style={{ borderColor: ACCENT }} />}>You</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: FLAT }} />}>State</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: "#a78bfa" }} />}>Independent</Key>
      </div>
    </>
  );
}

// 0.7 admissions editor s1: in the focus mode the map takes the room it has; elsewhere the map's own
// height class, exactly as before (no wrapper).
function MapBox({ room, around, min, children }: { room?: number; around: number; min: number; children: ReactNode }) {
  if (!room) return <>{children}</>;
  return <div style={{ height: fillHeight(room, around, min) }}>{children}</div>;
}
