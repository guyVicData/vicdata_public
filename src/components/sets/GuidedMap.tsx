"use client";

// VicData 0.8 front door, part 2 (D22): the guided sets editor's map -- the shared Leaflet map
// (ConsortiumMap, as Admissions' feeder and rival maps and SMT's set map draw with), centred on the
// school with 5, 10 and 15 km rings. Set members solid; main feeders / close rivals larger and labelled;
// suggestions dashed and hollow, and hovering one offers "+ [name]": a click adds it straight from the map.
// The "Suggest within" distance is a ring in the accent. Leaflet takes hex colours, never CSS variables.
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { RINGS_KM, type GuidedRow } from "@/lib/sets/guided";

const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

export function GuidedMap({
  focus,
  focusName,
  members,
  main,
  suggestions,
  maxKm,
  accentHex,
  onAdd,
  heightClass,
}: {
  focus: { urn: string; easting: number | null; northing: number | null } | null;
  focusName: string;
  members: GuidedRow[];
  main: ReadonlySet<string>;
  suggestions: GuidedRow[];
  maxKm: number;
  accentHex: string;
  onAdd: (urn: string) => void;
  heightClass: string;
}) {
  const located = (r: { easting: number | null; northing: number | null }) => r.easting !== null && r.northing !== null;
  const dots: ConsortiumMapMember[] = useMemo(() => {
    const out: ConsortiumMapMember[] = [];
    for (const r of suggestions) if (located(r)) out.push({ urn: r.urn, name: r.name, easting: r.easting!, northing: r.northing!, roll: null });
    for (const r of members) if (located(r)) out.push({ urn: r.urn, name: r.name, easting: r.easting!, northing: r.northing!, roll: null });
    if (focus && located(focus)) out.push({ urn: focus.urn, name: focusName, easting: focus.easting!, northing: focus.northing!, roll: null });
    return out;
  }, [members, suggestions, focus, focusName]);
  const inSet = useMemo(() => new Set(members.map((m) => m.urn)), [members]);
  if (!focus || !located(focus)) return <div className={`${heightClass} flex items-center justify-center text-[12.5px] text-[var(--muted2)]`}>The school has no location to centre the map on.</div>;
  const redrawKey = `${dots.map((d) => d.urn).join(",")}|${Array.from(main).sort().join(",")}|${maxKm}|${accentHex}`;
  return (
    <ConsortiumMap
      members={dots}
      targetUrn={focus.urn}
      redrawKey={redrawKey}
      heightClass={heightClass}
      circle={{ easting: focus.easting!, northing: focus.northing!, metres: maxKm * 1000, colour: accentHex }}
      fitCircle
      fitPadding={12}
      rings={{ easting: focus.easting!, northing: focus.northing!, km: RINGS_KM, colour: "#64748b" }}
      markerOf={(m) => {
        if (m.urn === focus.urn) return { color: accentHex, fillColor: "#ffffff", fillOpacity: 1, radius: 10, weight: 4 };
        if (inSet.has(m.urn)) return main.has(m.urn) ? { color: "#ffffff", fillColor: accentHex, fillOpacity: 1, radius: 9, weight: 2.5 } : { color: accentHex, fillColor: accentHex, fillOpacity: 0.95, radius: 6, weight: 1 };
        return { color: accentHex, fillColor: accentHex, fillOpacity: 0.08, radius: 6, weight: 1.6, dashArray: "2 3" };
      }}
      labelOf={(m) => (m.urn === focus.urn || main.has(m.urn) ? esc(m.name) : null)}
      tooltipOf={(m) => (inSet.has(m.urn) ? `<b>${esc(m.name)}</b><br>in your set` : `<b>+ ${esc(m.name)}</b><br>click to add`)}
      onSelect={(urn) => {
        if (urn !== focus.urn && !inSet.has(urn)) onAdd(urn);
      }}
    />
  );
}

/** The key under the map: in your set, main feeder (close rival), suggested. */
export function GuidedMapKey({ mainLegend }: { mainLegend: string }) {
  return (
    <div data-guided-map-key="" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--muted2)]">
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-[9px] w-[9px] rounded-full bg-[var(--accent)]" />In your set</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-[12px] w-[12px] rounded-full border-2 border-white bg-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]" />{mainLegend}</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-[10px] w-[10px] rounded-full border border-dashed border-[var(--accent)]" />Suggested</span>
    </div>
  );
}
