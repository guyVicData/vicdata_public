"use client";

// VicData 0.8 SMT r1: Overview's Map -- the school and its comparison set (R-SMT-VIEW-MAP). The shared
// Leaflet map Admissions' feeder and rival maps draw with (ConsortiumMap); the school ringed.
// 0.8 SMT feedback round 1 (F-2): every dot, the focus school's too, sized by its whole-school roll
// (lib/map-radius.ts, the maps' one scale), and dot and label coloured on its roll trend -- green growing,
// amber steady, red shrinking -- by the shared 3-year rule (ROLL_DIRECTION_SPAN, the flat band; computed
// on the server, Overview.rolls). No new thresholds. A size key and the colour key sit under the map.
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ConsortiumMapMember } from "@/components/ConsortiumMap";
import { Empty, Key, fillHeight } from "@/components/admissions/ui";
import { periodLabel, ROLL_DIRECTION_SPAN, ROLL_WORD } from "@/catalogue/years";
import { ARROW, signedDelta, type Direction } from "@/lib/signed-delta";
import { MAX_RADIUS, MIN_RADIUS, rollRadius } from "@/lib/map-radius";
import type { Overview } from "../api";
import { fmt } from "../ui";
import { productAccent } from "@/components/shell/accent";

// Leaflet sets marker colours as SVG attributes, where CSS variables don't resolve: hex, on the light
// basemap in either theme (the boards' green, amber and red flags, light theme).
const SMT_HEX = productAccent("smt")!.hex;
export const TREND_HEX: Record<Direction, string> = { up: "#15803d", flat: "#b45309", down: "#b91c1c" };
const NO_TREND_HEX = "#71717a";
const ConsortiumMap = dynamic(() => import("@/components/ConsortiumMap"), { ssr: false });

const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** A dot's label: its name, whole-school roll, and the roll trend in the trend's colour. HTML (Leaflet's
 * tooltip), every name escaped. */
export function mapLabel(o: Overview, urn: string): string {
  const s = o.schools[urn];
  const r = o.rolls[urn];
  const name = `${esc(s?.name ?? urn)}${urn === o.urn ? " (you)" : ""}`;
  const roll = r?.roll !== null && r?.roll !== undefined ? `${fmt(r.roll, "pupils")} pupils${r.year !== null ? `, ${periodLabel(r.year)}` : ""}` : "no census roll";
  const t = r?.trend;
  const trend = t ? `<span style="color:${TREND_HEX[t.dir]};font-weight:700">${ARROW[t.dir]} ${t.word} ${signedDelta(t.pct, (x) => `${Math.abs(x).toFixed(0)}%`, { zero: "±" })} (${periodLabel(t.from)} to ${periodLabel(t.to)})</span>` : `<span style="color:${NO_TREND_HEX}">no roll trend</span>`;
  return `<b>${name}</b><br>${roll}<br>${trend}`;
}

export function SetMap({ o, fullscreen, room }: { o: Overview; fullscreen: boolean; room?: number }) {
  const members: ConsortiumMapMember[] = useMemo(
    () => Object.entries(o.schools).filter(([, s]) => s.easting !== null && s.northing !== null).map(([urn, s]) => ({ urn, name: s.name, easting: s.easting!, northing: s.northing!, roll: o.rolls?.[urn]?.roll ?? null })),
    [o],
  );
  const rolls = members.map((m) => m.roll).filter((r): r is number => r !== null);
  const lo = rolls.length ? Math.min(...rolls) : 0;
  const hi = rolls.length ? Math.max(...rolls) : 0;
  if (!members.length) return <Empty>No located schools in this set.</Empty>;
  const h = fullscreen && room ? fillHeight(room, 90, 560) : null;
  const colour = (urn: string) => {
    const t = o.rolls?.[urn]?.trend;
    return t ? TREND_HEX[t.dir] : NO_TREND_HEX;
  };
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">
        {o.schools[o.urn]?.name ?? "The school"} and {o.set.label}
      </div>
      <div style={h ? { height: h } : undefined}>
        <ConsortiumMap
          members={members}
          targetUrn={o.urn}
          heightClass={`${h ? "h-full" : fullscreen ? "h-[560px]" : "h-[340px]"} w-full overflow-hidden rounded-[10px] border border-[var(--panel-border)]`}
          markerOf={(x) => {
            const c = colour(x.urn);
            const you = x.urn === o.urn;
            return { radius: rollRadius(x.roll, lo, hi), color: you ? SMT_HEX : c, fillColor: c, fillOpacity: you ? 0.75 : 0.5, weight: you ? 4 : 1.5 };
          }}
          tooltipOf={(x) => mapLabel(o, x.urn)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1" data-map-keys="">
        <Key swatch={<span className="h-[11px] w-[11px] rounded-full border-[3px] border-[var(--accent)]" />}>{o.schools[o.urn]?.name ?? "You"}</Key>
        {(["up", "flat", "down"] as const).map((d) => (
          <Key key={d} swatch={<span className="h-[9px] w-[9px] rounded-full" style={{ background: TREND_HEX[d] }} />}>
            {ROLL_WORD[d]}
          </Key>
        ))}
        <span className="text-[11px] text-[var(--muted2)]">roll over {ROLL_DIRECTION_SPAN} years</span>
        {hi > lo && (
          <span className="inline-flex items-center gap-[6px] text-[11px] text-[var(--chip-fg)]" data-size-key="">
            <span className="text-[var(--muted2)]">Size: roll</span>
            {[lo, hi].map((r) => (
              <span key={r} className="inline-flex items-center gap-1">
                <span className="rounded-full border border-[var(--muted2)]" style={{ width: 2 * rollRadius(r, lo, hi), height: 2 * rollRadius(r, lo, hi), minWidth: 2 * MIN_RADIUS, maxWidth: 2 * MAX_RADIUS }} />
                {fmt(r, "pupils")}
              </span>
            ))}
          </span>
        )}
      </div>
    </>
  );
}
