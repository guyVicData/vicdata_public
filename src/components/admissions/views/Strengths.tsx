"use client";

// VicData 0.7 admissions r2 (D4): Strengths and weaknesses (RivalSubjects.dc.html) -- each subject
// area with your rank among the rivals who teach it, the gap to their average (diverging bars),
// its direction since 2022/23, and the flags (Strength, Strength growing, Weakness, Weakness
// widening: R-ADM-FLAG-STRENGTHS); the overall and England ranks above; a link to the subject
// explorer with these rivals (0.7 r2b: the rivals, the stage and the subject area travel in
// the link; Teacher opens Comparisons on them). R-ADM-VIEW-STRENGTHS.
import Link from "next/link";
import type { RivalsView } from "../api";
import { Empty, FlagPill, Muted, ordinal, yearLabel } from "../ui";
import { DivergingBar } from "./charts";
import { figuresOf } from "./Momentum";
import { TREND_BASE_PERIOD } from "@/catalogue/years";
import { ARROW, flatBand, signedDelta, UNSIGNED_ZERO } from "@/lib/signed-delta";

export function overallLine(r: RivalsView): string | null {
  const o = r.overall;
  if (!o) return null;
  return `Overall: ${ordinal(o.rank)} of ${o.of} on ${o.measure}${o.national ? ` · ${ordinal(o.national.rank)} of ${o.national.of.toLocaleString("en-GB")} in England` : ""}`;
}

const dir = (v: number | null) => (v === null ? "—" : `${ARROW[flatBand(v, 2, 0.05)]} ${{ up: "rising", down: "falling", flat: "steady" }[flatBand(v, 2, 0.05)]}`);
const FLAG_WORD: Record<string, string> = { strength: "Strength", strength_growing: "Strength, growing", weakness: "Weakness", weakness_widening: "Weakness, widening" };

// 0.7 admissions editor s2: `order` -- "gap" (where you lead most first; the preset) or "az"; and
// `showFlags` -- the flag column. The flags' thresholds are a rule (R-ADM-FLAG-STRENGTHS).
export function Strengths({ r, explorerHref, fullscreen, order = "gap", showFlags = true }: { r: RivalsView; explorerHref: (subject?: string) => string | null; fullscreen: boolean; order?: "gap" | "az"; showFlags?: boolean }) {
  if (r.stage === "ks2") return <Empty>KS2 results have no subject areas: strengths and weaknesses are for GCSE (11+) and Post-16 (16+) entry points.</Empty>;
  if (!r.areas.length) return <Empty>No subject area has rivals to compare with (each needs at least two rivals with enough entries).</Empty>;
  const areas = order === "az" ? [...r.areas].sort((a, b) => (r.areaLabels[a.familyId] ?? a.familyId).localeCompare(r.areaLabels[b.familyId] ?? b.familyId)) : [...r.areas].sort((a, b) => b.gap - a.gap);
  const grid = showFlags ? "grid-cols-[170px_60px_minmax(0,1fr)_70px_150px]" : "grid-cols-[170px_60px_minmax(0,1fr)_70px]";
  const max = Math.max(0.1, ...areas.map((a) => Math.abs(a.gap)));
  const href = explorerHref();
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Where you lead and trail your rivals, by subject area &mdash; and which way it&rsquo;s moving</div>
      {overallLine(r) && <Muted size={11.5}>{overallLine(r)}</Muted>}
      <div className={fullscreen ? "" : "min-h-0 overflow-y-auto"}>
        <div className={`grid ${grid} items-center gap-[10px] border-b border-[var(--panel-border)] px-1 py-[6px] text-[10.5px] text-[var(--muted)]`}>
          <span>Subject area</span>
          <span>Your rank</span>
          <span>Gap to the rivals&rsquo; average (behind &larr; &rarr; ahead)</span>
          <span>Since {yearLabel(TREND_BASE_PERIOD).slice(2)}</span>
          {showFlags && <span>Flag</span>}
        </div>
        {areas.map((a) => (
          <div key={a.familyId} className={`grid ${grid} items-center gap-[10px] border-b border-[var(--panel-border)] px-1 py-[6px] text-[12px] text-[var(--chip-fg)]`}>
            <span className="truncate" title={a.place?.national ? `${ordinal(a.place.national.rank)} of ${a.place.national.of} in England${a.place.regional ? `; ${ordinal(a.place.regional.rank)} of ${a.place.regional.of} in ${a.place.regional.region}` : ""}` : undefined}>
              {href ? (
                <Link href={explorerHref(r.areaLabels[a.familyId]) ?? href} title="Open in the subject explorer with these rivals" className="hover:underline">
                  {r.areaLabels[a.familyId] ?? a.familyId}
                </Link>
              ) : (
                (r.areaLabels[a.familyId] ?? a.familyId)
              )}
            </span>
            <span>
              {ordinal(a.rank)} of {a.of}
            </span>
            <span title={`You ${a.mine.toFixed(2)}; the rivals' average ${(a.mine - a.gap).toFixed(2)} (gap ${signedDelta(a.gap, (x) => Math.abs(x).toFixed(2), UNSIGNED_ZERO)} pts)`}>
              <DivergingBar value={a.gap} max={max} />
            </span>
            <span title={a.gapSince2223 === null ? `No ${yearLabel(TREND_BASE_PERIOD)} figure` : `The gap moved ${signedDelta(a.gapSince2223, (x) => Math.abs(x).toFixed(2), UNSIGNED_ZERO)} pts since ${yearLabel(TREND_BASE_PERIOD)}`}>{dir(a.gapSince2223)}</span>
            {showFlags && (
            <span className="flex flex-wrap gap-1">
              {a.flags
                .filter((f) => !(f.id === "strength" && a.flags.some((g) => g.id === "strength_growing")) && !(f.id === "weakness" && a.flags.some((g) => g.id === "weakness_widening")))
                .map((f) => (
                  <FlagPill key={f.id} small tone={f.id.startsWith("strength") ? "up" : "down"} figures={figuresOf(f)}>
                    {FLAG_WORD[f.id] ?? f.label}
                  </FlagPill>
                ))}
            </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-3">
        <span className="grow text-[11px] leading-[1.4] text-[var(--muted2)]">Only rivals with that subject area are ranked (&ldquo;of {Math.min(...areas.map((a) => a.of))}&rdquo;). Small entries are left out. Click a subject area to open it in the subject explorer with these rivals.</span>
        {href && (
          <Link href={href} className="shrink-0 text-[11.5px] font-bold text-[var(--adm-accent-text)]">
            Open in the subject explorer with these rivals &rarr;
          </Link>
        )}
      </div>
    </>
  );
}
