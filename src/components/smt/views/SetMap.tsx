"use client";

// VicData 0.8 SMT r1: Overview's Map -- the school and its comparison set (R-SMT-VIEW-MAP). The shared
// Leaflet map Admissions' feeder and rival maps draw with (ConsortiumMap); the school ringed.
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { Empty, Key, fillHeight } from "@/components/admissions/ui";
import type { Overview } from "../api";
import { fmt } from "../ui";
import { productAccent } from "@/components/shell/accent";

// Leaflet sets marker colours as SVG attributes, where CSS variables don't resolve: the accent's hex.
const SMT_HEX = productAccent("smt")!.hex;
const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

export function SetMap({ o, fullscreen, room }: { o: Overview; fullscreen: boolean; room?: number }) {
  const members: ConsortiumMapMember[] = useMemo(
    () => Object.entries(o.schools).filter(([, s]) => s.easting !== null && s.northing !== null).map(([urn, s]) => ({ urn, name: s.name, easting: s.easting!, northing: s.northing!, roll: null })),
    [o],
  );
  if (!members.length) return <Empty>No located schools in this set.</Empty>;
  const h = fullscreen && room ? fillHeight(room, 60, 560) : null;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">
        {o.schools[o.urn]?.name ?? "The school"} and {o.set.label}
      </div>
      <div style={h ? { height: h } : undefined}>
        <ConsortiumMap
          members={members}
          targetUrn={o.urn}
          heightClass={`${h ? "h-full" : fullscreen ? "h-[560px]" : "h-[360px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
          colourOf={(x) => (x.urn === o.urn ? SMT_HEX : "#71717a")}
          tooltipOf={(x) => `${x.name}${x.urn === o.urn ? " (you)" : ""}`}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full border-2 border-[var(--accent)]" />}>{o.schools[o.urn]?.name ?? "You"}</Key>
        <Key swatch={<span className="h-[9px] w-[9px] rounded-full bg-[#71717a]" />}>
          {o.set.label} ({fmt(o.set.size, "pupils")} schools)
        </Key>
      </div>
    </>
  );
}
