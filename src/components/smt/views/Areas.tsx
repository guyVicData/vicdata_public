"use client";

// VicData 0.8 SMT r1: Academic's Subject areas -- Admissions' strengths and weaknesses (buildRivals),
// against the comparison set instead of the rivals: each area's rank among the set's schools with
// that area, the gap to their average (diverging bars), its direction since 2022/23, and the flags
// (R-ADM-FLAG-STRENGTHS). A row opens that area. R-SMT-VIEW-AREAS.
import { Empty, FlagPill, Muted } from "@/components/admissions/ui";
import { DivergingBar } from "@/components/admissions/views/charts";
import { TREND_BASE_PERIOD, periodLabel } from "@/catalogue/years";
import type { StagePart } from "@/lib/smt/academic";
import { ord } from "../ui";

const dir = (v: number | null) => (v === null ? "—" : v > 0.05 ? "▲ rising" : v < -0.05 ? "▼ falling" : "▬ steady");
const FLAG_WORD: Record<string, string> = { strength: "Strength", strength_growing: "Strength, growing", weakness: "Weakness", weakness_widening: "Weakness, widening" };

export function SubjectAreas({ parts, setLabel, onArea, area }: { parts: StagePart[]; setLabel: string; onArea?: (stage: "ks4" | "ks5", id: string) => void; area: string | null }) {
  const shown = parts.filter((p) => p.areas.length);
  if (!parts.length) return <Empty>KS2 results have no subject areas.</Empty>;
  if (!shown.length) return <Empty>No subject area has set schools to compare with (each needs at least two schools in the set with enough entries).</Empty>;
  return (
    <>
      <div className="text-[13px] font-bold text-[var(--fg)]">Where you lead and trail {setLabel}, by subject area</div>
      <div className="min-h-0 overflow-y-auto">
        {shown.map((p) => {
          const max = Math.max(0.1, ...p.areas.map((a) => Math.abs(a.gap)));
          return (
            <div key={p.stage} className="flex flex-col">
              {parts.length > 1 && <div className="pt-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--muted2)]">{p.stage === "ks4" ? "GCSE" : "Post-16"}</div>}
              {p.overall && <Muted size={11.5}>Overall: {p.overall.replace(/^(\d+)/, (m) => ord(Number(m)))} in the set on {p.stage === "ks4" ? "Attainment 8" : "A-level points per entry"}</Muted>}
              <div className="grid grid-cols-[170px_70px_minmax(0,1fr)_76px_140px] items-center gap-[10px] border-b border-[var(--panel-border)] px-1 py-[6px] text-[10.5px] text-[var(--muted)]">
                <span>Subject area</span>
                <span>Rank in set</span>
                <span>Gap to the set&rsquo;s average (behind &larr; &rarr; ahead)</span>
                <span>Since {periodLabel(TREND_BASE_PERIOD).slice(2)}</span>
                <span>Flag</span>
              </div>
              {[...p.areas].sort((a, b) => b.gap - a.gap).map((a) => (
                <div key={a.familyId} data-area={a.familyId} className={`grid grid-cols-[170px_70px_minmax(0,1fr)_76px_140px] items-center gap-[10px] border-b border-[var(--panel-border)] px-1 py-[6px] text-[12px] ${area === a.familyId ? "font-bold text-[var(--fg)]" : "text-[var(--chip-fg)]"}`}>
                  {onArea ? (
                    <button type="button" className="truncate text-left hover:underline" onClick={() => onArea(p.stage, a.familyId)} title="Show this area's subjects">
                      {a.label}
                    </button>
                  ) : (
                    <span className="truncate">{a.label}</span>
                  )}
                  <span>
                    {ord(a.rank)} of {a.of}
                  </span>
                  <span title={`You ${a.mine.toFixed(2)}; the set's average ${(a.mine - a.gap).toFixed(2)} (gap ${a.gap > 0 ? "+" : ""}${a.gap.toFixed(2)} pts)`}>
                    <DivergingBar value={a.gap} max={max} />
                  </span>
                  <span title={a.gapSince2223 === null ? `No ${periodLabel(TREND_BASE_PERIOD)} figure` : `The gap moved ${a.gapSince2223 > 0 ? "+" : ""}${a.gapSince2223.toFixed(2)} pts since ${periodLabel(TREND_BASE_PERIOD)}`}>{dir(a.gapSince2223)}</span>
                  <span className="flex flex-wrap gap-1">
                    {a.flags
                      .filter((f) => !(f.id === "strength" && a.flags.some((g) => g.id === "strength_growing")) && !(f.id === "weakness" && a.flags.some((g) => g.id === "weakness_widening")))
                      .map((f) => (
                        <FlagPill key={f.id} small tone={f.id.startsWith("strength") ? "up" : "down"}>
                          {FLAG_WORD[f.id] ?? f.label}
                        </FlagPill>
                      ))}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="mt-auto text-[11px] leading-[1.4] text-[var(--muted2)]">Only the set&rsquo;s schools with that subject area are ranked. Small entries are left out. Choose an area to see its subjects.</div>
    </>
  );
}
